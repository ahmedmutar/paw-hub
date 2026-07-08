import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authenticate, requireRole, tenantFilter } from '../../middleware/auth'

const createSchema = z.object({
  username:      z.string().min(3, 'Min 3 karakter'),
  fullname:      z.string().min(1, 'Wajib diisi'),
  password:      z.string().min(8, 'Min 8 karakter'),
  email:         z.string().email().optional().or(z.literal('')),
  gender:        z.enum(['Laki-laki', 'Perempuan']).optional(),
  religion:      z.string().optional(),
  birthPlace:    z.string().optional(),
  birthdate:     z.string().optional(),
  bloodGroup:    z.string().optional(),
  idCardNumber:  z.string().optional(),
  phoneNumber:   z.string().optional(),
  homeNumber:    z.string().optional(),
  address:       z.string().optional(),
  role:          z.enum(['admin', 'dokter', 'resepsionis', 'kasir', 'karyawan']),
  branchId:      z.string(),
  status:        z.boolean().default(true),
})

const updateSchema = createSchema.omit({ password: true, username: true, branchId: true }).partial()

export async function userRoutes(app: FastifyInstance) {

  // GET /user — list user dengan filter
  app.get('/user', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const q = req.query as any
    let branchId: bigint
    if (q.branchId) {
      const targetBranch = await app.prisma.branch.findFirst({ where: { id: BigInt(q.branchId), ...tenantFilter(req.authUser) } })
      if (!targetBranch) return reply.status(404).send({ message: 'Cabang tidak ditemukan.' })
      branchId = targetBranch.id
    } else {
      branchId = req.authUser.branchId
    }
    const page  = Number(q.page  || 1)
    const limit = Number(q.limit || 20)
    const skip  = (page - 1) * limit

    const where: any = {
      isDeleted: false,
      branchId,
      ...(q.role   && { role: q.role }),
      ...(q.status !== undefined && q.status !== '' && { status: q.status === 'true' }),
      ...(q.search && {
        OR: [
          { fullname:      { contains: q.search, mode: 'insensitive' } },
          { username:      { contains: q.search, mode: 'insensitive' } },
          { staffingNumber:{ contains: q.search, mode: 'insensitive' } },
          { phoneNumber:   { contains: q.search, mode: 'insensitive' } },
        ],
      }),
    }

    const [data, total] = await Promise.all([
      app.prisma.user.findMany({
        where, skip, take: limit,
        select: {
          id: true, staffingNumber: true, username: true, fullname: true,
          email: true, gender: true, phoneNumber: true, bloodGroup: true,
          role: true, status: true, imageProfile: true,
          birthdate: true, birthPlace: true, religion: true,
          idCardNumber: true, address: true, homeNumber: true,
          branchId: true,
          branch: { select: { branchName: true, branchCode: true } },
          createdAt: true,
        },
        orderBy: [{ role: 'asc' }, { fullname: 'asc' }],
      }),
      app.prisma.user.count({ where }),
    ])

    // Hitung summary per role
    const roleSummary = await app.prisma.user.groupBy({
      by: ['role'],
      where: { branchId, isDeleted: false },
      _count: { id: true },
    })

    return reply.send({
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      roleSummary,
    })
  })

  // GET /user/dokter — list dokter aktif (untuk dropdown)
  app.get('/user/dokter', { preHandler: authenticate }, async (req, reply) => {
    const doctors = await app.prisma.user.findMany({
      where: { role: 'dokter', isDeleted: false, status: true, branchId: req.authUser.branchId },
      select: { id: true, fullname: true, staffingNumber: true },
      orderBy: { fullname: 'asc' },
    })
    return reply.send({ data: doctors })
  })

  // POST /user — tambah user baru
  app.post('/user', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const body = createSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const existing = await app.prisma.user.findFirst({ where: { username: body.data.username } })
    if (existing) return reply.status(400).send({ message: 'Username sudah digunakan.' })

    const branchId = BigInt(body.data.branchId)
    const userCount = await app.prisma.user.count({ where: { branchId } })
    const branch = await app.prisma.branch.findUnique({ where: { id: branchId } })
    const staffingNumber = `BVC-U-${branch?.branchCode ?? 'XX'}-${String(userCount + 1).padStart(4, '0')}`

    const { branchId: _, ...rest } = body.data
    const user = await app.prisma.user.create({
      data: {
        ...rest,
        branchId,
        staffingNumber,
        email:       rest.email      || undefined,
        birthdate:   rest.birthdate  ? new Date(rest.birthdate) : undefined,
        password:    await bcrypt.hash(body.data.password, 12),
        createdBy:   req.authUser.username,
      },
      select: {
        id: true, staffingNumber: true, username: true,
        fullname: true, role: true, status: true,
        branch: { select: { branchName: true } },
      },
    })

    return reply.status(201).send({ message: 'User berhasil ditambahkan.', data: user })
  })

  // PUT /user/:id — update data user
  app.put('/user/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = updateSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const existing = await app.prisma.user.findFirst({ where: { id: BigInt(id), ...tenantFilter(req.authUser) } })
    if (!existing) return reply.status(404).send({ message: 'User tidak ditemukan.' })

    const user = await app.prisma.user.update({
      where: { id: BigInt(id) },
      data: {
        ...body.data,
        email:      body.data.email     || undefined,
        birthdate:  body.data.birthdate ? new Date(body.data.birthdate) : undefined,
        updatedBy:  req.authUser.username,
      },
      select: {
        id: true, username: true, fullname: true, role: true,
        status: true, branch: { select: { branchName: true } },
      },
    })
    return reply.send({ message: 'User berhasil diperbarui.', data: user })
  })

  // PATCH /user/:id/toggle-status — aktif/nonaktif langsung
  app.patch('/user/:id/toggle-status', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = await app.prisma.user.findFirst({ where: { id: BigInt(id), ...tenantFilter(req.authUser) } })
    if (!user) return reply.status(404).send({ message: 'User tidak ditemukan.' })

    const updated = await app.prisma.user.update({
      where: { id: BigInt(id) },
      data: { status: !user.status, updatedBy: req.authUser.username },
    })
    return reply.send({
      message: `Akun ${updated.fullname} ${updated.status ? 'diaktifkan' : 'dinonaktifkan'}.`,
      data: { id: updated.id.toString(), status: updated.status },
    })
  })

  // POST /user/:id/reset-password
  app.post('/user/:id/reset-password', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { newPassword } = req.body as { newPassword: string }
    if (!newPassword || newPassword.length < 8) {
      return reply.status(400).send({ message: 'Password minimal 8 karakter.' })
    }
    const existing = await app.prisma.user.findFirst({ where: { id: BigInt(id), ...tenantFilter(req.authUser) } })
    if (!existing) return reply.status(404).send({ message: 'User tidak ditemukan.' })

    await app.prisma.user.update({
      where: { id: BigInt(id) },
      data: { password: await bcrypt.hash(newPassword, 12), updatedBy: req.authUser.username },
    })
    // Hapus sesi aktif user tersebut
    await app.prisma.refreshToken.deleteMany({ where: { userId: BigInt(id) } })
    return reply.send({ message: 'Password berhasil direset. Sesi aktif user telah dihapus.' })
  })

  // DELETE /user/:id — soft delete
  app.delete('/user/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    // Cegah hapus diri sendiri
    if (BigInt(id) === req.authUser.userId) {
      return reply.status(400).send({ message: 'Tidak bisa menghapus akun sendiri.' })
    }
    const existing = await app.prisma.user.findFirst({ where: { id: BigInt(id), ...tenantFilter(req.authUser) } })
    if (!existing) return reply.status(404).send({ message: 'User tidak ditemukan.' })

    await app.prisma.user.update({
      where: { id: BigInt(id) },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.authUser.username, status: false },
    })
    await app.prisma.refreshToken.deleteMany({ where: { userId: BigInt(id) } })
    return reply.send({ message: 'User berhasil dihapus.' })
  })
}
