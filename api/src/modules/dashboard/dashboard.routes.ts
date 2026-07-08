import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/auth'

// Registration/CheckUpResult/ListOfItem tidak punya tenantId langsung —
// cuma branchId. Admin dikunci ke seluruh cabang di tenant-nya, non-admin
// dikunci ke cabang sendiri.
function dashboardBranchFilter(user: any) {
  return user.role === 'admin'
    ? { branch: { tenantId: BigInt(user.tenantId) } }
    : { branchId: BigInt(user.branchId) }
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard/stats', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = dashboardBranchFilter(user)

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)

    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 6)
    weekStart.setHours(0, 0, 0, 0)

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [
      todayRegistrations,
      activeQueue,
      todayCheckups,
      pendingKasir,
      todayPayments,
      monthPayments,
      lowStockItems,
      recentPayments,
      weekRegistrations,
      topServices,
    ] = await Promise.all([
      // Pasien daftar hari ini
      app.prisma.registration.count({
        where: { ...branchFilter, isDeleted: false, createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      // Antrian aktif saat ini (pending + accepted)
      app.prisma.registration.count({
        where: { ...branchFilter, isDeleted: false, acceptanceStatus: { in: ['pending', 'accepted'] } },
      }),
      // Pemeriksaan berlangsung hari ini
      app.prisma.checkUpResult.count({
        where: {
          isDeleted: false,
          createdAt: { gte: todayStart, lte: todayEnd },
          registration: { ...branchFilter },
        },
      }),
      // Menunggu bayar
      app.prisma.checkUpResult.count({
        where: { isDeleted: false, statusPaidOff: false, registration: { ...branchFilter } },
      }),
      // Pembayaran hari ini dengan detail
      app.prisma.listOfPayment.findMany({
        where: {
          isDeleted: false,
          createdAt: { gte: todayStart, lte: todayEnd },
          checkUpResult: { registration: { ...branchFilter } },
        },
        include: {
          paymentItems:    { select: { detailItemPatient: { select: { priceOverall: true } } } },
          paymentServices: { select: { detailServicePatient: { select: { priceOverall: true } } } },
          paymentMethod:   { select: { methodName: true } },
        },
      }),
      // Pembayaran bulan ini
      app.prisma.listOfPayment.findMany({
        where: {
          isDeleted: false,
          createdAt: { gte: monthStart },
          checkUpResult: { registration: { ...branchFilter } },
        },
        include: {
          paymentMethod:   { select: { methodName: true } },
          paymentItems:    { select: { detailItemPatient: { select: { priceOverall: true } } } },
          paymentServices: { select: { detailServicePatient: { select: { priceOverall: true } } } },
        },
      }),
      // Low stock items
      app.prisma.listOfItem.findMany({
        where: { ...branchFilter, isDeleted: false, isActive: true, limitItem: { not: null } },
        select: { id: true, itemName: true, totalItem: true, limitItem: true },
        orderBy: { totalItem: 'asc' },
        take: 50,
      }),
      // 5 transaksi terakhir
      app.prisma.listOfPayment.findMany({
        where: { isDeleted: false, checkUpResult: { registration: { ...branchFilter } } },
        include: {
          checkUpResult: {
            include: {
              registration: {
                include: { patient: { select: { petName: true } } },
              },
            },
          },
          paymentMethod: { select: { methodName: true } },
          paymentItems:    { select: { detailItemPatient: { select: { priceOverall: true } } } },
          paymentServices: { select: { detailServicePatient: { select: { priceOverall: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Registrasi per hari 7 hari terakhir
      app.prisma.registration.groupBy({
        by: ['createdAt'],
        where: { ...branchFilter, isDeleted: false, createdAt: { gte: weekStart } },
        _count: { id: true },
      }),
      // Top 5 layanan bulan ini
      app.prisma.detailServicePatient.groupBy({
        by: ['priceServiceId'],
        where: {
          checkUpResult: { registration: { ...branchFilter }, createdAt: { gte: monthStart } },
        },
        _count: { id: true },
        _sum:   { priceOverall: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ])

    // Kalkulasi omzet
    const calcRevenue = (payments: typeof todayPayments) =>
      payments.reduce((sum, p) => {
        const items = p.paymentItems.reduce((s, i) => s + Number(i.detailItemPatient.priceOverall), 0)
        const svcs  = p.paymentServices.reduce((s, i) => s + Number(i.detailServicePatient.priceOverall), 0)
        return sum + items + svcs - Number(p.discount ?? 0)
      }, 0)

    const todayRevenue = calcRevenue(todayPayments)
    const monthRevenue = calcRevenue(monthPayments)

    // Low stock filter (totalItem <= limitItem)
    const lowStock = lowStockItems.filter(i => Number(i.totalItem) <= Number(i.limitItem))

    // Reformat recent payments
    const recentTx = recentPayments.map(p => {
      const items = p.paymentItems.reduce((s, i) => s + Number(i.detailItemPatient.priceOverall), 0)
      const svcs  = p.paymentServices.reduce((s, i) => s + Number(i.detailServicePatient.priceOverall), 0)
      return {
        id: p.id,
        createdAt: p.createdAt,
        patientName: p.checkUpResult.registration.patient.petName,
        methodName: p.paymentMethod?.methodName ?? 'Tunai',
        total: items + svcs - Number(p.discount ?? 0),
      }
    })

    // Tren harian 7 hari (group by date string)
    const trendMap: Record<string, number> = {}
    weekRegistrations.forEach(r => {
      const day = new Date(r.createdAt).toISOString().split('T')[0]
      trendMap[day] = (trendMap[day] ?? 0) + r._count.id
    })
    // Isi hari yang kosong
    const trend = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const key = d.toISOString().split('T')[0]
      return { date: key, count: trendMap[key] ?? 0 }
    })

    // Top services dengan nama
    const topSvcIds = topServices.map(s => s.priceServiceId)
    const topSvcNames = await app.prisma.priceService.findMany({
      where: { id: { in: topSvcIds } },
      include: { listOfService: { select: { serviceName: true } } },
      take: 5,
    })
    const topSvcMap = Object.fromEntries(topSvcNames.map(s => [s.id.toString(), s.listOfService.serviceName]))
    const topServicesResult = topServices.map(s => ({
      priceServiceId: s.priceServiceId,
      serviceName: topSvcMap[s.priceServiceId.toString()] ?? 'Layanan',
      count: s._count.id,
      total: Number(s._sum.priceOverall ?? 0),
    }))

    return reply.send({
      data: {
        today: {
          registrations: todayRegistrations,
          activeQueue,
          checkups: todayCheckups,
          pendingKasir,
          revenue: todayRevenue,
          transactions: todayPayments.length,
        },
        month: {
          revenue: monthRevenue,
          transactions: monthPayments.length,
        },
        lowStock: lowStock.slice(0, 5),
        recentTransactions: recentTx,
        trend,
        topServices: topServicesResult,
      },
    })
  })
}
