import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, requireRole } from '../../middleware/auth'

const SESSION_INCLUDE = {
  patient: { select: { id: true, petName: true, species: true, breed: true, owner: { select: { id: true, ownerName: true, phoneNumber: true } } } },
  groomer: { select: { id: true, fullname: true } },
  package: { select: { id: true, packageName: true, durationMin: true } },
  branch:  { select: { id: true, branchName: true } },
} as const

function formatSession(s: any) {
  return {
    ...s,
    id:         s.id.toString(),
    patientId:  s.patientId.toString(),
    groomerId:  s.groomerId.toString(),
    packageId:  s.packageId.toString(),
    branchId:   s.branchId.toString(),
    userId:     s.userId.toString(),
    totalPrice: Number(s.totalPrice),
    discount:   Number(s.discount),
    patient:    s.patient ? { ...s.patient, id: s.patient.id.toString(), owner: s.patient.owner ? { ...s.patient.owner, id: s.patient.owner.id.toString() } : null } : null,
    groomer:    s.groomer ? { ...s.groomer, id: s.groomer.id.toString() } : null,
    package:    s.package ? { ...s.package, id: s.package.id.toString() } : null,
    branch:     s.branch  ? { ...s.branch,  id: s.branch.id.toString()  } : null,
  }
}

function formatPackage(p: any) {
  return {
    ...p,
    id:       p.id.toString(),
    branchId: p.branchId.toString(),
    price:    Number(p.price),
  }
}

// GroomingSession/GroomingPackage cuma punya branchId (tidak ada tenantId
// langsung). Admin dikunci ke seluruh cabang di tenant-nya, non-admin
// dikunci ke cabang sendiri.
function groomingBranchFilter(user: any) {
  return user.role === 'admin'
    ? { branch: { tenantId: BigInt(user.tenantId) } }
    : { branchId: BigInt(user.branchId) }
}

export async function groomingRoutes(app: FastifyInstance) {

  // ── GET /grooming/stats ───────────────────────────────────────────────────
  app.get('/grooming/stats', { preHandler: [authenticate, requireRole('admin', 'karyawan', 'resepsionis', 'kasir')] }, async (req: any, reply) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const branchFilter = groomingBranchFilter(req.authUser)

    const [waiting, inProgress, doneToday, revenue] = await Promise.all([
      app.prisma.groomingSession.count({ where: { ...branchFilter, status: 'waiting', isDeleted: false } }),
      app.prisma.groomingSession.count({ where: { ...branchFilter, status: 'in_progress', isDeleted: false } }),
      app.prisma.groomingSession.count({ where: { ...branchFilter, status: 'done', isDeleted: false, completedAt: { gte: today, lt: tomorrow } } }),
      app.prisma.groomingSession.aggregate({
        where:  { ...branchFilter, status: 'done', isPaid: true, isDeleted: false, completedAt: { gte: today, lt: tomorrow } },
        _sum:   { totalPrice: true },
      }),
    ])

    return reply.send({
      data: {
        waiting,
        inProgress,
        doneToday,
        revenueToday: Number(revenue._sum.totalPrice ?? 0),
      },
    })
  })

  // ── GET /grooming/antrian — antrian aktif (waiting + in_progress) ─────────
  app.get('/grooming/antrian', { preHandler: [authenticate, requireRole('admin', 'karyawan', 'resepsionis', 'kasir')] }, async (req: any, reply) => {
    const branchFilter = groomingBranchFilter(req.authUser)

    const sessions = await app.prisma.groomingSession.findMany({
      where:   { ...branchFilter, status: { in: ['waiting', 'in_progress'] }, isDeleted: false },
      include: SESSION_INCLUDE,
      orderBy: [{ status: 'asc' }, { queueNumber: 'asc' }],
    })

    return reply.send({ data: sessions.map(formatSession) })
  })

  // ── GET /grooming/sesi — semua sesi dengan filter ─────────────────────────
  app.get('/grooming/sesi', { preHandler: [authenticate, requireRole('admin', 'karyawan', 'resepsionis', 'kasir')] }, async (req: any, reply) => {
    const q = req.query as any
    const page  = Math.max(1, Number(q.page ?? 1))
    const limit = Math.min(50, Number(q.limit ?? 20))
    const skip  = (page - 1) * limit

    const branchFilter = groomingBranchFilter(req.authUser)

    // Filter tanggal
    let dateFilter: any = {}
    if (q.date) {
      const d = new Date(q.date)
      d.setHours(0, 0, 0, 0)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      dateFilter = { createdAt: { gte: d, lt: next } }
    }

    const where: any = {
      ...branchFilter,
      ...dateFilter,
      isDeleted: false,
      ...(q.status && { status: q.status }),
      ...(q.search && {
        OR: [
          { patient: { petName: { contains: q.search, mode: 'insensitive' } } },
          { patient: { owner: { ownerName: { contains: q.search, mode: 'insensitive' } } } },
          { groomer: { fullname: { contains: q.search, mode: 'insensitive' } } },
        ],
      }),
    }

    const [total, sessions] = await Promise.all([
      app.prisma.groomingSession.count({ where }),
      app.prisma.groomingSession.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return reply.send({
      data:  sessions.map(formatSession),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  })

  // ── GET /grooming/sesi/:id ────────────────────────────────────────────────
  app.get('/grooming/sesi/:id', { preHandler: [authenticate, requireRole('admin', 'karyawan', 'resepsionis', 'kasir')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const session = await app.prisma.groomingSession.findFirst({
      where:   { id: BigInt(id), isDeleted: false, ...groomingBranchFilter(req.authUser) },
      include: SESSION_INCLUDE,
    })
    if (!session) return reply.status(404).send({ message: 'Sesi tidak ditemukan' })
    return reply.send({ data: formatSession(session) })
  })

  // ── POST /grooming/sesi — daftar sesi grooming baru ──────────────────────
  app.post('/grooming/sesi', { preHandler: [authenticate, requireRole('admin', 'karyawan', 'resepsionis')] }, async (req: any, reply) => {
    const schema = z.object({
      patientId:   z.number().int().positive(),
      groomerId:   z.number().int().positive(),
      packageId:   z.number().int().positive(),
      scheduledAt: z.string().optional(),
      notes:       z.string().optional(),
      discount:    z.number().min(0).default(0),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid', errors: body.error.flatten() })

    const { patientId, groomerId, packageId, scheduledAt, notes, discount } = body.data

    // Ambil harga dari paket (harus milik cabang/tenant sendiri)
    const pkg = await app.prisma.groomingPackage.findFirst({
      where: { id: BigInt(packageId), isDeleted: false, isActive: true, ...groomingBranchFilter(req.authUser) },
    })
    if (!pkg) return reply.status(404).send({ message: 'Paket grooming tidak ditemukan atau tidak aktif' })

    const branchId = req.authUser.role !== 'admin' ? BigInt(req.authUser.branchId) : BigInt(pkg.branchId)

    // Generate queue number (per hari, per cabang)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const lastQueue = await app.prisma.groomingSession.findFirst({
      where:   { branchId, createdAt: { gte: today, lt: tomorrow }, isDeleted: false },
      orderBy: { queueNumber: 'desc' },
      select:  { queueNumber: true },
    })
    const queueNumber = (lastQueue?.queueNumber ?? 0) + 1

    const totalPrice = Number(pkg.price) - discount

    const session = await app.prisma.groomingSession.create({
      data: {
        queueNumber,
        patientId:   BigInt(patientId),
        groomerId:   BigInt(groomerId),
        packageId:   BigInt(packageId),
        branchId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        notes,
        totalPrice,
        discount,
        userId: BigInt(req.authUser.userId),
      },
      include: SESSION_INCLUDE,
    })

    return reply.status(201).send({ data: formatSession(session), message: 'Sesi grooming berhasil didaftarkan' })
  })

  // ── PUT /grooming/sesi/:id/status — update status sesi ───────────────────
  app.put('/grooming/sesi/:id/status', { preHandler: [authenticate, requireRole('admin', 'karyawan')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const schema = z.object({
      action: z.enum(['mulai', 'selesai', 'bayar', 'cancel']),
      notes:  z.string().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid' })

    const session = await app.prisma.groomingSession.findFirst({
      where: { id: BigInt(id), isDeleted: false, ...groomingBranchFilter(req.authUser) },
    })
    if (!session) return reply.status(404).send({ message: 'Sesi tidak ditemukan' })

    const { action, notes } = body.data

    const validTransitions: Record<string, string[]> = {
      waiting:     ['mulai', 'cancel'],
      in_progress: ['selesai', 'cancel'],
      done:        ['bayar'],
      cancelled:   [],
    }

    if (!validTransitions[session.status]?.includes(action)) {
      return reply.status(400).send({ message: `Aksi '${action}' tidak valid untuk status '${session.status}'` })
    }

    const updateData: any = {}
    if (action === 'mulai')    { updateData.status = 'in_progress'; updateData.startedAt = new Date() }
    if (action === 'selesai')  { updateData.status = 'done'; updateData.completedAt = new Date() }
    if (action === 'bayar')    { updateData.isPaid = true }
    if (action === 'cancel')   { updateData.status = 'cancelled' }
    if (notes !== undefined)   { updateData.notes = notes }

    const updated = await app.prisma.groomingSession.update({
      where:   { id: BigInt(id) },
      data:    updateData,
      include: SESSION_INCLUDE,
    })

    const labelMap: Record<string, string> = { mulai: 'dimulai', selesai: 'selesai', bayar: 'lunas', cancel: 'dibatalkan' }
    return reply.send({ data: formatSession(updated), message: `Sesi grooming berhasil ${labelMap[action]}` })
  })

  // ── PUT /grooming/sesi/:id — edit sesi (groomer/paket/catatan/jadwal) ─────
  app.put('/grooming/sesi/:id', { preHandler: [authenticate, requireRole('admin', 'karyawan', 'resepsionis')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const schema = z.object({
      groomerId:   z.number().int().positive().optional(),
      packageId:   z.number().int().positive().optional(),
      scheduledAt: z.string().nullable().optional(),
      notes:       z.string().optional(),
      discount:    z.number().min(0).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid' })

    const session = await app.prisma.groomingSession.findFirst({
      where: { id: BigInt(id), isDeleted: false, ...groomingBranchFilter(req.authUser) },
    })
    if (!session) return reply.status(404).send({ message: 'Sesi tidak ditemukan' })
    if (session.status === 'done' || session.status === 'cancelled') {
      return reply.status(400).send({ message: 'Sesi yang sudah selesai atau dibatalkan tidak dapat diubah' })
    }

    const updateData: any = {}
    if (body.data.groomerId !== undefined) updateData.groomerId = BigInt(body.data.groomerId)
    if (body.data.notes     !== undefined) updateData.notes     = body.data.notes
    if (body.data.scheduledAt !== undefined) updateData.scheduledAt = body.data.scheduledAt ? new Date(body.data.scheduledAt) : null

    if (body.data.packageId !== undefined || body.data.discount !== undefined) {
      const pkgId  = body.data.packageId ? BigInt(body.data.packageId) : session.packageId
      const pkg    = await app.prisma.groomingPackage.findFirst({ where: { id: pkgId, isDeleted: false } })
      if (!pkg) return reply.status(404).send({ message: 'Paket tidak ditemukan' })
      const disc   = body.data.discount ?? Number(session.discount)
      updateData.packageId  = pkgId
      updateData.totalPrice = Number(pkg.price) - disc
      updateData.discount   = disc
    }

    const updated = await app.prisma.groomingSession.update({
      where:   { id: BigInt(id) },
      data:    updateData,
      include: SESSION_INCLUDE,
    })

    return reply.send({ data: formatSession(updated), message: 'Sesi grooming berhasil diperbarui' })
  })

  // ── DELETE /grooming/sesi/:id — soft delete ───────────────────────────────
  app.delete('/grooming/sesi/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const session = await app.prisma.groomingSession.findFirst({ where: { id: BigInt(id), isDeleted: false, ...groomingBranchFilter(req.authUser) } })
    if (!session) return reply.status(404).send({ message: 'Sesi tidak ditemukan' })

    await app.prisma.groomingSession.update({
      where: { id: BigInt(id) },
      data:  { isDeleted: true, deletedAt: new Date() },
    })
    return reply.send({ message: 'Sesi grooming berhasil dihapus' })
  })

  // ── GET /grooming/groomer — list groomer untuk dropdown ───────────────────
  app.get('/grooming/groomer', { preHandler: [authenticate, requireRole('admin', 'karyawan', 'resepsionis')] }, async (req: any, reply) => {
    const branchFilter = groomingBranchFilter(req.authUser)

    const groomers = await app.prisma.user.findMany({
      where:   { ...branchFilter, role: { in: ['karyawan', 'admin'] }, isDeleted: false, status: true },
      select:  { id: true, fullname: true, role: true },
      orderBy: { fullname: 'asc' },
    })

    return reply.send({ data: groomers.map(g => ({ ...g, id: g.id.toString() })) })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PAKET GROOMING
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /grooming/paket ───────────────────────────────────────────────────
  app.get('/grooming/paket', { preHandler: [authenticate, requireRole('admin', 'karyawan', 'resepsionis', 'kasir')] }, async (req: any, reply) => {
    const q = req.query as any
    const branchFilter = groomingBranchFilter(req.authUser)

    const where: any = {
      ...branchFilter,
      isDeleted: false,
      ...(q.search && { packageName: { contains: q.search, mode: 'insensitive' } }),
      ...(q.isActive !== undefined && { isActive: q.isActive === 'true' }),
    }

    const packages = await app.prisma.groomingPackage.findMany({
      where,
      include: { branch: { select: { id: true, branchName: true } } },
      orderBy: { packageName: 'asc' },
    })

    return reply.send({
      data: packages.map(p => ({
        ...formatPackage(p),
        branch: p.branch ? { ...p.branch, id: p.branch.id.toString() } : null,
      })),
    })
  })

  // ── POST /grooming/paket — buat paket baru ────────────────────────────────
  app.post('/grooming/paket', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const schema = z.object({
      packageName: z.string().min(2),
      description: z.string().optional(),
      price:       z.number().positive(),
      durationMin: z.number().int().positive().default(60),
      branchId:    z.number().int().positive(),
      isActive:    z.boolean().default(true),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid', errors: body.error.flatten() })

    const pkg = await app.prisma.groomingPackage.create({
      data: {
        ...body.data,
        branchId: BigInt(body.data.branchId),
      },
      include: { branch: { select: { id: true, branchName: true } } },
    })

    return reply.status(201).send({
      data: { ...formatPackage(pkg), branch: pkg.branch ? { ...pkg.branch, id: pkg.branch.id.toString() } : null },
      message: 'Paket grooming berhasil ditambahkan',
    })
  })

  // ── PUT /grooming/paket/:id ───────────────────────────────────────────────
  app.put('/grooming/paket/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const schema = z.object({
      packageName: z.string().min(2).optional(),
      description: z.string().nullable().optional(),
      price:       z.number().positive().optional(),
      durationMin: z.number().int().positive().optional(),
      isActive:    z.boolean().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid' })

    const existing = await app.prisma.groomingPackage.findFirst({ where: { id: BigInt(id), isDeleted: false, ...groomingBranchFilter(req.authUser) } })
    if (!existing) return reply.status(404).send({ message: 'Paket tidak ditemukan' })

    const updated = await app.prisma.groomingPackage.update({
      where:   { id: BigInt(id) },
      data:    body.data,
      include: { branch: { select: { id: true, branchName: true } } },
    })

    return reply.send({
      data: { ...formatPackage(updated), branch: updated.branch ? { ...updated.branch, id: updated.branch.id.toString() } : null },
      message: 'Paket grooming berhasil diperbarui',
    })
  })

  // ── DELETE /grooming/paket/:id ────────────────────────────────────────────
  app.delete('/grooming/paket/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const existing = await app.prisma.groomingPackage.findFirst({ where: { id: BigInt(id), isDeleted: false, ...groomingBranchFilter(req.authUser) } })
    if (!existing) return reply.status(404).send({ message: 'Paket tidak ditemukan' })

    // Cek apakah ada sesi aktif
    const activeCount = await app.prisma.groomingSession.count({
      where: { packageId: BigInt(id), status: { in: ['waiting', 'in_progress'] }, isDeleted: false },
    })
    if (activeCount > 0) {
      return reply.status(400).send({ message: 'Paket tidak dapat dihapus karena masih ada sesi aktif' })
    }

    await app.prisma.groomingPackage.update({ where: { id: BigInt(id) }, data: { isDeleted: true } })
    return reply.send({ message: 'Paket grooming berhasil dihapus' })
  })
}
