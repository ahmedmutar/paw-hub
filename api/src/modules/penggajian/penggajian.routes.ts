import { FastifyInstance } from 'fastify'
import { UserRole } from '@prisma/client'
import { authenticate, requireRole } from '../../middleware/auth'

/**
 * Filter cabang untuk query Payroll: staf non-admin dikunci ke cabang sendiri,
 * admin dikunci ke seluruh cabang di tenant-nya (model Payroll tidak punya
 * kolom tenantId langsung, cuma relasi lewat branch).
 */
function payrollBranchFilter(user: any) {
  return user.role === 'admin'
    ? { branch: { tenantId: BigInt(user.tenantId) } }
    : { branchId: BigInt(user.branchId) }
}

export async function penggajianRoutes(app: FastifyInstance) {

  // ─── GET /penggajian ─────────────────────────────────────────────────────────
  // List slip gaji, filter by branch + bulan + tahun
  app.get('/penggajian', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { month, year, branchId: qBranch, employeeId } = req.query as any

    const branchFilter = user.role === 'admin' && qBranch
      ? { branchId: BigInt(qBranch) }
      : user.role !== 'admin'
      ? { branchId: BigInt(user.branchId) }
      : {}

    const where: any = {
      isDeleted: false,
      ...branchFilter,
      ...(month ? { periodMonth: Number(month) } : {}),
      ...(year  ? { periodYear:  Number(year)  } : {}),
      ...(employeeId ? { userEmployeeId: BigInt(employeeId) } : {}),
    }

    const payrolls = await app.prisma.payroll.findMany({
      where,
      include: {
        employee: { select: { id: true, fullname: true, username: true, role: true } },
        createdBy: { select: { id: true, fullname: true } },
        branch: { select: { id: true, branchName: true } },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { createdAt: 'desc' }],
    })

    return reply.send({ data: payrolls.map(formatPayroll) })
  })

  // ─── GET /penggajian/rekap ────────────────────────────────────────────────────
  // Rekap total penggajian per bulan
  app.get('/penggajian/rekap', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { year, branchId: qBranch } = req.query as any

    const branchFilter = user.role === 'admin' && qBranch
      ? { branchId: BigInt(qBranch) }
      : user.role !== 'admin'
      ? { branchId: BigInt(user.branchId) }
      : {}

    const targetYear = year ? Number(year) : new Date().getFullYear()

    const rekap = await app.prisma.payroll.groupBy({
      by: ['periodMonth', 'periodYear'],
      where: { isDeleted: false, periodYear: targetYear, ...branchFilter },
      _sum: { totalOverall: true },
      _count: { id: true },
      orderBy: { periodMonth: 'asc' },
    })

    return reply.send({
      data: rekap.map(r => ({
        month: r.periodMonth,
        year: r.periodYear,
        totalGaji: Number(r._sum.totalOverall ?? 0),
        jumlahKaryawan: r._count.id,
      })),
    })
  })

  // ─── GET /penggajian/karyawan ─────────────────────────────────────────────────
  // Daftar karyawan untuk dropdown (bukan admin, bukan super_admin)
  app.get('/penggajian/karyawan', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { branchId: qBranch } = req.query as any

    const branchFilter = user.role === 'admin' && qBranch
      ? { branchId: BigInt(qBranch) }
      : user.role !== 'admin'
      ? { branchId: BigInt(user.branchId) }
      : {}

    const employees = await app.prisma.user.findMany({
      where: {
        status: true,
        isDeleted: false,
        role: { notIn: ['admin' as UserRole, 'super_admin' as UserRole] },
        ...branchFilter,
      },
      select: { id: true, fullname: true, username: true, role: true },
      orderBy: { fullname: 'asc' },
    })

    return reply.send({ data: employees })
  })

  // ─── GET /penggajian/:id ──────────────────────────────────────────────────────
  app.get('/penggajian/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { id } = req.params as any

    const payroll = await app.prisma.payroll.findFirst({
      where: { id: BigInt(id), isDeleted: false, ...payrollBranchFilter(user) },
      include: {
        employee: { select: { id: true, fullname: true, username: true, role: true } },
        createdBy: { select: { id: true, fullname: true } },
        branch: { select: { id: true, branchName: true } },
      },
    })

    if (!payroll) return reply.status(404).send({ message: 'Slip gaji tidak ditemukan' })
    return reply.send({ data: formatPayroll(payroll) })
  })

  // ─── POST /penggajian ─────────────────────────────────────────────────────────
  app.post('/penggajian', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const user = (req as any).authUser
    const body = req.body as any

    const {
      userEmployeeId,
      branchId,
      datePayed,
      periodMonth,
      periodYear,
      basicSallary,
      accomodation = 0,
      percentageTurnover = 0,
      amountTurnover = 0,
      totalTurnover = 0,
      minusTurnover = 0,
      amountInpatient = 0,
      countInpatient = 0,
      totalInpatient = 0,
      percentageSurgery = 0,
      amountSurgery = 0,
      totalSurgery = 0,
      amountGrooming = 0,
      countGrooming = 0,
      totalGrooming = 0,
    } = body

    if (!userEmployeeId || !branchId || !datePayed || !periodMonth || !periodYear || !basicSallary) {
      return reply.status(400).send({ message: 'Field wajib tidak lengkap' })
    }

    if (user.role === 'admin') {
      const targetBranch = await app.prisma.branch.findFirst({
        where: { id: BigInt(branchId), tenantId: BigInt(user.tenantId) },
      })
      if (!targetBranch) return reply.status(404).send({ message: 'Cabang tidak ditemukan.' })
    }

    // Cek duplikasi
    const existing = await app.prisma.payroll.findFirst({
      where: {
        userEmployeeId: BigInt(userEmployeeId),
        periodMonth: Number(periodMonth),
        periodYear: Number(periodYear),
        isDeleted: false,
      },
    })
    if (existing) {
      return reply.status(409).send({
        message: `Slip gaji untuk karyawan ini di bulan ${periodMonth}/${periodYear} sudah ada`,
      })
    }

    const totalOverall = Number(basicSallary)
      + Number(accomodation)
      + Number(totalTurnover)
      + Number(totalInpatient)
      + Number(totalSurgery)
      + Number(totalGrooming)
      - Number(minusTurnover)

    const payroll = await app.prisma.payroll.create({
      data: {
        userEmployeeId: BigInt(userEmployeeId),
        branchId: BigInt(branchId),
        datePayed: new Date(datePayed),
        periodMonth: Number(periodMonth),
        periodYear: Number(periodYear),
        basicSallary: Number(basicSallary),
        accomodation: Number(accomodation),
        percentageTurnover: Number(percentageTurnover),
        amountTurnover: Number(amountTurnover),
        totalTurnover: Number(totalTurnover),
        minusTurnover: Number(minusTurnover),
        amountInpatient: Number(amountInpatient),
        countInpatient: Number(countInpatient),
        totalInpatient: Number(totalInpatient),
        percentageSurgery: Number(percentageSurgery),
        amountSurgery: Number(amountSurgery),
        totalSurgery: Number(totalSurgery),
        amountGrooming: Number(amountGrooming),
        countGrooming: Number(countGrooming),
        totalGrooming: Number(totalGrooming),
        totalOverall,
        userId: BigInt(user.userId),
      },
      include: {
        employee: { select: { id: true, fullname: true, username: true, role: true } },
        createdBy: { select: { id: true, fullname: true } },
        branch: { select: { id: true, branchName: true } },
      },
    })

    return reply.status(201).send({ data: formatPayroll(payroll), message: 'Slip gaji berhasil dibuat' })
  })

  // ─── PUT /penggajian/:id ──────────────────────────────────────────────────────
  app.put('/penggajian/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const user = (req as any).authUser
    const { id } = req.params as any
    const body = req.body as any

    const existing = await app.prisma.payroll.findFirst({
      where: { id: BigInt(id), isDeleted: false, ...payrollBranchFilter(user) },
    })
    if (!existing) return reply.status(404).send({ message: 'Slip gaji tidak ditemukan' })

    const {
      datePayed,
      basicSallary,
      accomodation,
      percentageTurnover,
      amountTurnover,
      totalTurnover,
      minusTurnover,
      amountInpatient,
      countInpatient,
      totalInpatient,
      percentageSurgery,
      amountSurgery,
      totalSurgery,
      amountGrooming,
      countGrooming,
      totalGrooming,
    } = body

    const bs = basicSallary !== undefined ? Number(basicSallary) : Number(existing.basicSallary)
    const acc = accomodation !== undefined ? Number(accomodation) : Number(existing.accomodation)
    const tt = totalTurnover !== undefined ? Number(totalTurnover) : Number(existing.totalTurnover)
    const mt = minusTurnover !== undefined ? Number(minusTurnover) : Number(existing.minusTurnover)
    const ti = totalInpatient !== undefined ? Number(totalInpatient) : Number(existing.totalInpatient)
    const ts = totalSurgery !== undefined ? Number(totalSurgery) : Number(existing.totalSurgery)
    const tg = totalGrooming !== undefined ? Number(totalGrooming) : Number(existing.totalGrooming)
    const totalOverall = bs + acc + tt + ti + ts + tg - mt

    const updated = await app.prisma.payroll.update({
      where: { id: BigInt(id) },
      data: {
        ...(datePayed ? { datePayed: new Date(datePayed) } : {}),
        basicSallary: bs,
        accomodation: acc,
        ...(percentageTurnover !== undefined ? { percentageTurnover: Number(percentageTurnover) } : {}),
        ...(amountTurnover !== undefined ? { amountTurnover: Number(amountTurnover) } : {}),
        totalTurnover: tt,
        minusTurnover: mt,
        ...(amountInpatient !== undefined ? { amountInpatient: Number(amountInpatient) } : {}),
        ...(countInpatient !== undefined ? { countInpatient: Number(countInpatient) } : {}),
        totalInpatient: ti,
        ...(percentageSurgery !== undefined ? { percentageSurgery: Number(percentageSurgery) } : {}),
        ...(amountSurgery !== undefined ? { amountSurgery: Number(amountSurgery) } : {}),
        totalSurgery: ts,
        ...(amountGrooming !== undefined ? { amountGrooming: Number(amountGrooming) } : {}),
        ...(countGrooming !== undefined ? { countGrooming: Number(countGrooming) } : {}),
        totalGrooming: tg,
        totalOverall,
        userUpdateId: BigInt(user.userId),
      },
      include: {
        employee: { select: { id: true, fullname: true, username: true, role: true } },
        createdBy: { select: { id: true, fullname: true } },
        branch: { select: { id: true, branchName: true } },
      },
    })

    return reply.send({ data: formatPayroll(updated), message: 'Slip gaji berhasil diperbarui' })
  })

  // ─── DELETE /penggajian/:id ───────────────────────────────────────────────────
  app.delete('/penggajian/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const user = (req as any).authUser
    const { id } = req.params as any

    const existing = await app.prisma.payroll.findFirst({
      where: { id: BigInt(id), isDeleted: false, ...payrollBranchFilter(user) },
    })
    if (!existing) return reply.status(404).send({ message: 'Slip gaji tidak ditemukan' })

    await app.prisma.payroll.update({
      where: { id: BigInt(id) },
      data: { isDeleted: true, deletedAt: new Date() },
    })

    return reply.send({ message: 'Slip gaji berhasil dihapus' })
  })
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatPayroll(p: any) {
  return {
    id: p.id.toString(),
    userEmployeeId: p.userEmployeeId.toString(),
    branchId: p.branchId.toString(),
    datePayed: p.datePayed,
    periodMonth: p.periodMonth,
    periodYear: p.periodYear,
    basicSallary: Number(p.basicSallary),
    accomodation: Number(p.accomodation),
    percentageTurnover: Number(p.percentageTurnover),
    amountTurnover: Number(p.amountTurnover),
    totalTurnover: Number(p.totalTurnover),
    minusTurnover: Number(p.minusTurnover),
    amountInpatient: Number(p.amountInpatient),
    countInpatient: p.countInpatient,
    totalInpatient: Number(p.totalInpatient),
    percentageSurgery: Number(p.percentageSurgery),
    amountSurgery: Number(p.amountSurgery),
    totalSurgery: Number(p.totalSurgery),
    amountGrooming: Number(p.amountGrooming),
    countGrooming: p.countGrooming,
    totalGrooming: Number(p.totalGrooming),
    totalOverall: Number(p.totalOverall),
    employee: p.employee
      ? { ...p.employee, id: p.employee.id.toString() }
      : null,
    createdBy: p.createdBy
      ? { ...p.createdBy, id: p.createdBy.id.toString() }
      : null,
    branch: p.branch
      ? { ...p.branch, id: p.branch.id.toString() }
      : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}
