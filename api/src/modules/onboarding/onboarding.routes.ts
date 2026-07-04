import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const TRIAL_DAYS = 14

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export async function onboardingRoutes(app: FastifyInstance) {

  // ── GET /onboarding/check-slug/:slug — cek ketersediaan slug ─────────────
  app.get('/onboarding/check-slug/:slug', async (req, reply) => {
    const { slug } = req.params as any
    const existing = await app.prisma.tenant.findUnique({ where: { slug } })
    return reply.send({ available: !existing })
  })

  // ── GET /onboarding/check-email/:email — cek email sudah terdaftar ───────
  app.get('/onboarding/check-email/:email', async (req, reply) => {
    const { email } = req.params as any
    const existing = await app.prisma.tenant.findUnique({ where: { email } })
    return reply.send({ available: !existing })
  })

  // ── GET /onboarding/plans — daftar paket tersedia (public) ───────────────
  app.get('/onboarding/plans', async (_req, reply) => {
    const plans = await app.prisma.subscriptionPlan.findMany({
      where:   { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    })
    return reply.send({
      data: plans.map(p => ({
        ...p,
        id:           p.id.toString(),
        priceMonthly: Number(p.priceMonthly),
        priceYearly:  Number(p.priceYearly),
      })),
    })
  })

  // ── POST /onboarding/register — daftar klinik baru ───────────────────────
  app.post('/onboarding/register', async (req, reply) => {
    const schema = z.object({
      // Informasi klinik
      clinicName:  z.string().min(3, 'Nama klinik minimal 3 karakter'),
      clinicSlug:  z.string().min(3).regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda -').optional(),
      clinicEmail: z.string().email('Email tidak valid'),
      clinicPhone: z.string().optional(),
      address:     z.string().optional(),
      // Akun admin
      adminName:     z.string().min(2, 'Nama admin minimal 2 karakter'),
      adminUsername: z.string().min(3).regex(/^[a-z0-9_]+$/, 'Username hanya huruf kecil, angka, dan _'),
      adminPassword: z.string().min(8, 'Password minimal 8 karakter'),
      adminEmail:    z.string().email().optional(),
      adminPhone:    z.string().optional(),
      // Plan
      planCode: z.enum(['free', 'starter', 'pro', 'enterprise']).default('free'),
    })

    const body = schema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid', errors: body.error.flatten() })
    }

    const d = body.data

    // Pastikan slug unik
    const slug = d.clinicSlug || slugify(d.clinicName)
    const existingSlug = await app.prisma.tenant.findUnique({ where: { slug } })
    if (existingSlug) return reply.status(409).send({ message: `Slug '${slug}' sudah digunakan. Coba yang lain.` })

    // Pastikan email tenant unik
    const existingEmail = await app.prisma.tenant.findUnique({ where: { email: d.clinicEmail } })
    if (existingEmail) return reply.status(409).send({ message: 'Email klinik sudah terdaftar.' })

    // Pastikan username unik
    const existingUser = await app.prisma.user.findUnique({ where: { username: d.adminUsername } })
    if (existingUser) return reply.status(409).send({ message: 'Username sudah digunakan.' })

    // Ambil plan
    const plan = await app.prisma.subscriptionPlan.findUnique({ where: { code: d.planCode } })
    if (!plan) return reply.status(400).send({ message: 'Paket tidak ditemukan. Pilih paket yang tersedia.' })

    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS)

    const hashedPassword = await bcrypt.hash(d.adminPassword, 12)
    const branchCode = `${slug.toUpperCase().slice(0, 6)}-01`

    // Buat tenant + branch + admin + subscription dalam satu transaksi
    const result = await app.prisma.$transaction(async (tx) => {
      // 1. Buat tenant
      const tenant = await tx.tenant.create({
        data: {
          name:        d.clinicName,
          slug,
          email:       d.clinicEmail,
          phoneNumber: d.clinicPhone,
          address:     d.address,
          status:      'trial',
          trialEndsAt,
        },
      })

      // 2. Buat branch utama
      const branch = await tx.branch.create({
        data: {
          tenantId:   tenant.id,
          branchCode,
          branchName: d.clinicName,
          address:    d.address,
          phoneNumber: d.clinicPhone,
          email:      d.clinicEmail,
        },
      })

      // 3. Buat admin user
      const user = await tx.user.create({
        data: {
          tenantId:   tenant.id,
          branchId:   branch.id,
          fullname:   d.adminName,
          username:   d.adminUsername,
          password:   hashedPassword,
          email:      d.adminEmail,
          phoneNumber: d.adminPhone,
          role:       'admin',
          status:     true,
        },
      })

      // 4. Buat subscription
      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId:  tenant.id,
          planId:    plan.id,
          cycle:     'monthly',
          status:    'trial',
          startedAt: new Date(),
          expiresAt: trialEndsAt,
        },
      })

      return { tenant, branch, user, subscription }
    })

    // Issue JWT untuk auto-login
    const payload = {
      userId:   result.user.id.toString(),
      username: result.user.username,
      role:     result.user.role,
      branchId: result.branch.id.toString(),
      tenantId: result.tenant.id.toString(),
    }
    const accessToken  = app.jwt.sign(payload, { expiresIn: process.env.JWT_EXPIRES_IN  || '15m' } as any)
    const refreshToken = app.jwt.sign(payload, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' } as any)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    await app.prisma.refreshToken.create({
      data: { userId: result.user.id, token: refreshToken, expiresAt },
    })

    return reply.status(201).send({
      message: `Selamat! Klinik ${d.clinicName} berhasil terdaftar. Masa trial ${TRIAL_DAYS} hari dimulai sekarang.`,
      data: {
        accessToken,
        refreshToken,
        user: {
          userId:    result.user.id.toString(),
          username:  result.user.username,
          fullname:  result.user.fullname,
          role:      result.user.role,
          branchId:  result.branch.id.toString(),
          branchName: result.branch.branchName,
          tenantId:  result.tenant.id.toString(),
        },
        tenant: {
          id:          result.tenant.id.toString(),
          name:        result.tenant.name,
          slug:        result.tenant.slug,
          status:      result.tenant.status,
          trialEndsAt: result.tenant.trialEndsAt,
        },
        subscription: {
          status:    result.subscription.status,
          expiresAt: result.subscription.expiresAt,
          plan:      { code: plan.code, name: plan.name, maxBranches: plan.maxBranches, maxUsers: plan.maxUsers },
        },
      },
    })
  })
}
