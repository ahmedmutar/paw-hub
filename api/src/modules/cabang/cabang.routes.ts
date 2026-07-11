import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, requireRole, tenantFilter } from '../../middleware/auth'
import { checkPlanLimit } from '../../lib/planLimits'

const branchSchema = z.object({
  branchCode:         z.string().min(1).max(10).toUpperCase(),
  branchName:         z.string().min(1),
  address:            z.string().optional(),
  phoneNumber:        z.string().optional(),
  email:              z.string().email().optional().or(z.literal('')),
  operatingHours:     z.string().optional(),
  paymentInstruction: z.string().optional(),
  isActive:           z.boolean().optional(),
})

export async function cabangRoutes(app: FastifyInstance) {

  // GET /cabang — list semua cabang + statistik ringkasan
  app.get('/cabang', { preHandler: authenticate }, async (req, reply) => {
    const { authUser } = req
    const where = authUser.role === 'admin' || authUser.role === 'superadmin'
      ? { isDeleted: false, ...tenantFilter(authUser) }
      : { id: authUser.branchId, isDeleted: false }

    const branches = await app.prisma.branch.findMany({
      where,
      orderBy: { branchName: 'asc' },
    })

    // Hitung statistik per cabang sekaligus
    const stats = await Promise.all(
      branches.map(async (b) => {
        const [totalUsers, totalPatients, activeDoctors] = await Promise.all([
          app.prisma.user.count({ where: { branchId: b.id, isDeleted: false } }),
          app.prisma.patient.count({ where: { branchId: b.id, isDeleted: false } }),
          app.prisma.user.count({ where: { branchId: b.id, role: 'dokter', status: true, isDeleted: false } }),
        ])
        return { branchId: b.id.toString(), totalUsers, totalPatients, activeDoctors }
      })
    )

    const result = branches.map((b) => ({
      ...b,
      stats: stats.find((s) => s.branchId === b.id.toString()),
    }))

    return reply.send({ data: result })
  })

  // GET /cabang/:id — detail satu cabang + list user-nya
  app.get('/cabang/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const branch = await app.prisma.branch.findFirst({
      where: { id: BigInt(id), isDeleted: false, ...tenantFilter(req.authUser) },
    })
    if (!branch) return reply.status(404).send({ message: 'Cabang tidak ditemukan.' })

    const users = await app.prisma.user.findMany({
      where: { branchId: BigInt(id), isDeleted: false },
      select: {
        id: true, staffingNumber: true, fullname: true,
        username: true, role: true, status: true, phoneNumber: true,
      },
      orderBy: [{ role: 'asc' }, { fullname: 'asc' }],
    })

    return reply.send({ data: { ...branch, users } })
  })

  // POST /cabang — tambah cabang baru
  app.post('/cabang', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const body = branchSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const existing = await app.prisma.branch.findUnique({ where: { branchCode: body.data.branchCode } })
    if (existing) return reply.status(400).send({ message: 'Kode cabang sudah digunakan.' })

    const limitCheck = await checkPlanLimit(app, req.authUser.tenantId, 'branches')
    if (!limitCheck.ok) return reply.status(402).send({ message: limitCheck.message })

    const branch = await app.prisma.branch.create({
      data: {
        ...body.data,
        email: body.data.email || undefined,
        tenantId: req.authUser.tenantId ?? undefined,
      },
    })
    return reply.status(201).send({ message: 'Cabang berhasil ditambahkan.', data: branch })
  })

  // PUT /cabang/:id — edit cabang
  app.put('/cabang/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = branchSchema.partial().safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const existing = await app.prisma.branch.findFirst({
      where: { id: BigInt(id), isDeleted: false, ...tenantFilter(req.authUser) },
    })
    if (!existing) return reply.status(404).send({ message: 'Cabang tidak ditemukan.' })

    const branch = await app.prisma.branch.update({
      where: { id: BigInt(id) },
      data: { ...body.data, email: body.data.email || undefined },
    })
    return reply.send({ message: 'Cabang berhasil diperbarui.', data: branch })
  })

  // PATCH /cabang/:id/toggle-status — aktif/nonaktif
  app.patch('/cabang/:id/toggle-status', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const branch = await app.prisma.branch.findFirst({
      where: { id: BigInt(id), isDeleted: false, ...tenantFilter(req.authUser) },
    })
    if (!branch) return reply.status(404).send({ message: 'Cabang tidak ditemukan.' })

    const updated = await app.prisma.branch.update({
      where: { id: BigInt(id) },
      data: { isActive: !branch.isActive },
    })
    return reply.send({
      message: `Cabang ${updated.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
      data: updated,
    })
  })

  // DELETE /cabang/:id — soft delete
  app.delete('/cabang/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await app.prisma.branch.findFirst({
      where: { id: BigInt(id), isDeleted: false, ...tenantFilter(req.authUser) },
    })
    if (!existing) return reply.status(404).send({ message: 'Cabang tidak ditemukan.' })

    await app.prisma.branch.update({
      where: { id: BigInt(id) },
      data: { isDeleted: true, isActive: false },
    })
    return reply.send({ message: 'Cabang berhasil dihapus.' })
  })
}
