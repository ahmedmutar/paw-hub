import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authenticate } from '../../middleware/auth'

const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

const REFRESH_TTL_DAYS = 7

export async function authRoutes(app: FastifyInstance) {
  const signAccess = (payload: object) =>
    app.jwt.sign(payload, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as any)

  const signRefresh = (payload: object) =>
    app.jwt.sign(payload, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' } as any)

  // Login
  app.post('/masuk', async (req, reply) => {
    const body = loginSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const user = await app.prisma.user.findFirst({
      where: { username: body.data.username, isDeleted: false },
      include: { branch: { select: { branchName: true } } },
    })

    if (!user || !(await bcrypt.compare(body.data.password, user.password))) {
      return reply.status(401).send({ message: 'Username atau password salah.' })
    }
    if (!user.status) {
      return reply.status(401).send({ message: 'Akun tidak aktif. Hubungi administrator.' })
    }

    const payload = {
      userId:   user.id.toString(),
      username: user.username,
      role:     user.role,
      branchId: user.branchId.toString(),
      tenantId: user.tenantId?.toString() ?? null,
    }

    const accessToken  = signAccess(payload)
    const refreshToken = signRefresh(payload)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS)

    await app.prisma.refreshToken.deleteMany({ where: { userId: user.id } })
    await app.prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt },
    })

    // Ambil info tenant dan subscription jika ada
    let tenantInfo = null
    if (user.tenantId) {
      const tenant = await app.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        include: { subscription: { include: { plan: { select: { code: true, name: true, maxBranches: true, maxUsers: true } } } } },
      })
      if (tenant) {
        tenantInfo = {
          id:           tenant.id.toString(),
          name:         tenant.name,
          slug:         tenant.slug,
          status:       tenant.status,
          trialEndsAt:  tenant.trialEndsAt,
          subscription: tenant.subscription ? {
            status:      tenant.subscription.status,
            expiresAt:   tenant.subscription.expiresAt,
            plan:        tenant.subscription.plan,
          } : null,
        }
      }
    }

    return reply.send({
      message: 'Login berhasil.',
      data: {
        accessToken,
        refreshToken,
        user: {
          userId:      user.id.toString(),
          username:    user.username,
          fullname:    user.fullname,
          email:       user.email,
          role:        user.role,
          imageProfile: user.imageProfile,
          branchId:    user.branchId.toString(),
          branchName:  user.branch.branchName,
          tenantId:    user.tenantId?.toString() ?? null,
          tenant:      tenantInfo,
        },
      },
    })
  })

  // Refresh token
  app.post('/refresh', async (req, reply) => {
    const body = refreshSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Refresh token diperlukan.' })

    let payload: any
    try {
      payload = app.jwt.verify(body.data.refreshToken)
    } catch {
      return reply.status(401).send({ message: 'Refresh token tidak valid.' })
    }

    const stored = await app.prisma.refreshToken.findFirst({
      where: { token: body.data.refreshToken, userId: BigInt(payload.userId) },
    })
    if (!stored || stored.expiresAt < new Date()) {
      return reply.status(401).send({ message: 'Sesi habis. Silakan login ulang.' })
    }

    const user = await app.prisma.user.findFirst({
      where: { id: BigInt(payload.userId), isDeleted: false, status: true },
    })
    if (!user) return reply.status(401).send({ message: 'Akun tidak ditemukan.' })

    const newPayload = {
      userId: user.id.toString(),
      username: user.username,
      role: user.role,
      branchId: user.branchId.toString(),
    }

    return reply.send({ data: { accessToken: signAccess(newPayload) } })
  })

  // Logout
  app.post('/keluar', { preHandler: authenticate }, async (req, reply) => {
    await app.prisma.refreshToken.deleteMany({ where: { userId: req.authUser.userId } })
    return reply.send({ message: 'Logout berhasil.' })
  })

  // Profil
  app.get('/profil', { preHandler: authenticate }, async (req, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: req.authUser.userId },
      select: {
        id: true, staffingNumber: true, username: true, fullname: true,
        email: true, gender: true, phoneNumber: true, address: true,
        role: true, imageProfile: true,
        branch: { select: { branchName: true } },
      },
    })
    return reply.send({ data: user })
  })

  // Ganti password
  app.post('/ganti-password', { preHandler: authenticate }, async (req, reply) => {
    const schema = z.object({
      oldPassword: z.string().min(1),
      newPassword: z.string().min(8, 'Password minimal 8 karakter'),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })

    const user = await app.prisma.user.findUnique({ where: { id: req.authUser.userId } })
    if (!user || !(await bcrypt.compare(body.data.oldPassword, user.password))) {
      return reply.status(400).send({ message: 'Password lama tidak sesuai.' })
    }

    await app.prisma.user.update({
      where: { id: req.authUser.userId },
      data: { password: await bcrypt.hash(body.data.newPassword, 12) },
    })
    await app.prisma.refreshToken.deleteMany({ where: { userId: req.authUser.userId } })

    return reply.send({ message: 'Password berhasil diubah. Silakan login ulang.' })
  })
}
