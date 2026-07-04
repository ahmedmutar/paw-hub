// @ts-nocheck
import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'

export async function analyticsRoutes(app: FastifyInstance) {
  // Customer LTV
  app.get('/analytics/ltv', { preHandler: [authenticate, requireRole('admin', 'superadmin')] }, async (req: any, reply) => {
    const { branchId, role } = req.authUser
    const { limit = 20 } = req.query as any

    const owners = await req.server.prisma.owner.findMany({
      where: { ...(role !== 'superadmin' && { branchId }), isDeleted: false },
      include: {
        patients: {
          include: {
            registrations: {
              where: { isDeleted: false },
              include: { checkUpResults: { include: { listOfPayments: true } } },
            },
          },
        },
        loyaltyMembers: { select: { totalSpend: true, tier: true, totalPoints: true } },
      },
      take: 200,
    })

    const ltvData = owners.map(o => {
      const totalSpend = o.loyaltyMembers[0]
        ? Number(o.loyaltyMembers[0].totalSpend)
        : o.patients.flatMap(p => p.registrations).flatMap(r => r.checkUpResults).flatMap(c => c.listOfPayments).reduce((s, pay) => s + Number(pay.totalPayment ?? 0), 0)

      const firstVisit = o.patients.flatMap(p => p.registrations).map(r => r.createdAt).sort()[0]
      const lastVisit = o.patients.flatMap(p => p.registrations).map(r => r.createdAt).sort().reverse()[0]
      const visitCount = o.patients.flatMap(p => p.registrations).length

      return {
        ownerId: o.id, ownerName: o.ownerName, phoneNumber: o.phoneNumber,
        totalSpend, visitCount, firstVisit, lastVisit,
        tier: o.loyaltyMembers[0]?.tier ?? 'basic',
        avgPerVisit: visitCount > 0 ? Math.round(totalSpend / visitCount) : 0,
      }
    }).sort((a, b) => b.totalSpend - a.totalSpend).slice(0, Number(limit))

    return reply.send({ data: ltvData })
  })

  // Churn detection (90+ hari tidak kunjungan)
  app.get('/analytics/churn', { preHandler: [authenticate, requireRole('admin', 'superadmin')] }, async (req: any, reply) => {
    const { branchId, role } = req.authUser
    const { days = 90 } = req.query as any
    const cutoff = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)

    const owners = await req.server.prisma.owner.findMany({
      where: { ...(role !== 'superadmin' && { branchId }), isDeleted: false },
      include: {
        patients: {
          include: { registrations: { orderBy: { createdAt: 'desc' }, take: 1 } },
        },
      },
    })

    const churnRisk = owners.filter(o => {
      const lastReg = o.patients.flatMap(p => p.registrations)[0]
      return lastReg && new Date(lastReg.createdAt) < cutoff
    }).map(o => {
      const regs = o.patients.flatMap(p => p.registrations)
      const lastVisit = regs.map(r => r.createdAt).sort().reverse()[0]
      const daysSince = lastVisit ? Math.floor((Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24)) : null
      return { ownerId: o.id, ownerName: o.ownerName, phoneNumber: o.phoneNumber, lastVisit, daysSince }
    }).sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0))

    return reply.send({ data: churnRisk, total: churnRisk.length })
  })

  // Doctor performance
  app.get('/analytics/doctor-performance', { preHandler: [authenticate, requireRole('admin', 'superadmin')] }, async (req: any, reply) => {
    const { branchId, role } = req.authUser
    const { month, year } = req.query as any
    const m = Number(month ?? new Date().getMonth() + 1)
    const y = Number(year ?? new Date().getFullYear())
    const dateFrom = new Date(y, m - 1, 1)
    const dateTo = new Date(y, m, 0, 23, 59, 59)

    const doctors = await req.server.prisma.user.findMany({
      where: { ...(role !== 'superadmin' && { branchId }), role: 'dokter', isDeleted: false },
      include: {
        registrations: {
          where: { createdAt: { gte: dateFrom, lte: dateTo }, isDeleted: false },
          include: { checkUpResults: { include: { listOfPayments: { select: { totalPayment: true } } } } },
        },
        reviewsAsDoctor: {
          where: { rating: { not: null } },
          select: { rating: true },
        },
      },
    })

    const perf = doctors.map(d => {
      const patientCount = d.registrations.length
      const omzet = d.registrations
        .flatMap(r => r.checkUpResults)
        .flatMap(c => c.listOfPayments)
        .reduce((s, p) => s + Number(p.totalPayment ?? 0), 0)
      const ratings = d.reviewsAsDoctor.filter(r => r.rating).map(r => r.rating!)
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null

      return {
        doctorId: d.id, fullname: d.fullname,
        patientCount, omzet, avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        reviewCount: ratings.length,
      }
    }).sort((a, b) => b.patientCount - a.patientCount)

    return reply.send({ data: perf })
  })

  // Stock forecast (prediksi kapan habis berdasarkan tren 90 hari)
  app.get('/analytics/stock-forecast', { preHandler: [authenticate, requireRole('admin', 'superadmin')] }, async (req: any, reply) => {
    const { branchId, role } = req.authUser
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    const items = await req.server.prisma.listOfItem.findMany({
      where: { ...(role !== 'superadmin' && { branchId }), isDeleted: false, totalItem: { gt: 0 } },
      include: {
        stockMovements: {
          where: { status: 'keluar', createdAt: { gte: cutoff } },
          select: { quantity: true },
        },
        unit: { select: { unitName: true } },
      },
    })

    const forecast = items.map(item => {
      const usedIn90Days = item.stockMovements.reduce((s, m) => s + Number(m.quantity ?? 0), 0)
      const dailyUsage = usedIn90Days / 90
      const daysLeft = dailyUsage > 0 ? Math.floor(Number(item.totalItem) / dailyUsage) : null

      return {
        itemId: item.id, itemName: item.itemName,
        currentStock: Number(item.totalItem), unitName: item.unit?.unitName,
        limitItem: item.limitItem, usedIn90Days,
        dailyUsage: Math.round(dailyUsage * 10) / 10,
        daysLeft, forecastDate: daysLeft ? new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000) : null,
        isLow: item.limitItem ? Number(item.totalItem) <= Number(item.limitItem) : false,
        isCritical: daysLeft !== null && daysLeft <= 14,
      }
    }).sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))

    return reply.send({ data: forecast.slice(0, 50) })
  })

  // Heatmap jam tersibuk
  app.get('/analytics/heatmap', { preHandler: [authenticate, requireRole('admin', 'superadmin')] }, async (req: any, reply) => {
    const { branchId, role } = req.authUser
    const { month, year } = req.query as any
    const m = Number(month ?? new Date().getMonth() + 1)
    const y = Number(year ?? new Date().getFullYear())
    const dateFrom = new Date(y, m - 1, 1)
    const dateTo = new Date(y, m, 0, 23, 59, 59)

    const registrations = await req.server.prisma.registration.findMany({
      where: { ...(role !== 'superadmin' && { branchId }), createdAt: { gte: dateFrom, lte: dateTo }, isDeleted: false },
      select: { createdAt: true },
    })

    // Build heatmap: dayOfWeek × hour
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    for (const r of registrations) {
      const d = new Date(r.createdAt)
      heatmap[d.getDay()][d.getHours()]++
    }

    const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    return reply.send({
      data: {
        heatmap: heatmap.map((row, i) => ({ day: DAY_NAMES[i], hours: row })),
        total: registrations.length,
      },
    })
  })

  // Diagnosis trend
  app.get('/analytics/diagnosis-trend', { preHandler: [authenticate, requireRole('admin', 'superadmin')] }, async (req: any, reply) => {
    const { branchId, role } = req.authUser
    const { limit = 10 } = req.query as any
    const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    const results = await req.server.prisma.checkUpResult.findMany({
      where: {
        ...(role !== 'superadmin' && { branchId }),
        createdAt: { gte: dateFrom },
        diagnosis: { not: null },
      },
      select: { diagnosis: true },
    })

    const countMap: Record<string, number> = {}
    for (const r of results) {
      if (!r.diagnosis) continue
      const diag = r.diagnosis.trim()
      countMap[diag] = (countMap[diag] ?? 0) + 1
    }

    const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1]).slice(0, Number(limit))
    return reply.send({ data: sorted.map(([diagnosis, count]) => ({ diagnosis, count })) })
  })
}
