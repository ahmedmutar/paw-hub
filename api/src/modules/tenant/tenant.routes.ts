import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, requireSuperAdmin, tenantFilter } from '../../middleware/auth'

function fmt(t: any) {
  return {
    ...t,
    id: t.id.toString(),
    subscription: t.subscription ? {
      ...t.subscription,
      id:       t.subscription.id.toString(),
      tenantId: t.subscription.tenantId.toString(),
      planId:   t.subscription.planId.toString(),
    } : null,
    branches: t.branches?.map((b: any) => ({ ...b, id: b.id.toString(), tenantId: b.tenantId?.toString() })),
    users:    t.users?.map((u: any) => ({ id: u.id.toString(), fullname: u.fullname, role: u.role })),
  }
}

export async function tenantRoutes(app: FastifyInstance) {

  // ── GET /tenant — list semua tenant (superadmin) ──────────────────────────
  app.get('/tenant', { preHandler: [authenticate, requireSuperAdmin as any] }, async (req: any, reply) => {
    const q = req.query as any
    const page  = Math.max(1, Number(q.page ?? 1))
    const limit = Math.min(50, Number(q.limit ?? 20))
    const skip  = (page - 1) * limit

    const where: any = {
      isDeleted: false,
      ...(q.status && { status: q.status }),
      ...(q.search && { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }, { slug: { contains: q.search, mode: 'insensitive' } }] }),
    }

    const [total, tenants] = await Promise.all([
      app.prisma.tenant.count({ where }),
      app.prisma.tenant.findMany({
        where,
        include: {
          subscription: { include: { plan: { select: { code: true, name: true } } } },
          _count: { select: { branches: true, users: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
    ])

    return reply.send({
      data: tenants.map(t => ({
        id:           t.id.toString(),
        name:         t.name,
        slug:         t.slug,
        email:        t.email,
        phoneNumber:  t.phoneNumber,
        status:       t.status,
        trialEndsAt:  t.trialEndsAt,
        createdAt:    t.createdAt,
        branchCount:  t._count.branches,
        userCount:    t._count.users,
        subscription: t.subscription ? {
          status:    t.subscription.status,
          cycle:     t.subscription.cycle,
          expiresAt: t.subscription.expiresAt,
          plan:      t.subscription.plan,
        } : null,
      })),
      total, page, limit, totalPages: Math.ceil(total / limit),
    })
  })

  // ── GET /tenant/:id — detail tenant ──────────────────────────────────────
  app.get('/tenant/:id', { preHandler: [authenticate, requireSuperAdmin as any] }, async (req: any, reply) => {
    const { id } = req.params as any
    const tenant = await app.prisma.tenant.findFirst({
      where: { id: BigInt(id), isDeleted: false },
      include: {
        subscription: { include: { plan: true } },
        branches:     { where: { isDeleted: false }, select: { id: true, branchName: true, branchCode: true, isActive: true } },
        _count:       { select: { branches: true, users: true } },
      },
    })
    if (!tenant) return reply.status(404).send({ message: 'Tenant tidak ditemukan' })

    const patientCount = await app.prisma.patient.count({
      where: { branch: { tenantId: BigInt(id) }, isDeleted: false },
    })

    return reply.send({
      data: {
        id:           tenant.id.toString(),
        name:         tenant.name,
        slug:         tenant.slug,
        email:        tenant.email,
        phoneNumber:  tenant.phoneNumber,
        address:      tenant.address,
        logoUrl:      tenant.logoUrl,
        status:       tenant.status,
        trialEndsAt:  tenant.trialEndsAt,
        createdAt:    tenant.createdAt,
        branchCount:  tenant._count.branches,
        userCount:    tenant._count.users,
        patientCount,
        branches:     tenant.branches.map(b => ({ ...b, id: b.id.toString() })),
        subscription: tenant.subscription ? {
          id:         tenant.subscription.id.toString(),
          status:     tenant.subscription.status,
          cycle:      tenant.subscription.cycle,
          startedAt:  tenant.subscription.startedAt,
          expiresAt:  tenant.subscription.expiresAt,
          plan:       { ...tenant.subscription.plan, id: tenant.subscription.plan.id.toString(), priceMonthly: Number(tenant.subscription.plan.priceMonthly), priceYearly: Number(tenant.subscription.plan.priceYearly) },
        } : null,
      },
    })
  })

  // ── PUT /tenant/:id — update tenant info ──────────────────────────────────
  app.put('/tenant/:id', { preHandler: [authenticate, requireSuperAdmin as any] }, async (req: any, reply) => {
    const { id } = req.params as any
    const schema = z.object({
      name:       z.string().min(2).optional(),
      email:      z.string().email().optional(),
      phoneNumber: z.string().optional(),
      address:    z.string().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid' })

    const updated = await app.prisma.tenant.update({
      where: { id: BigInt(id) },
      data:  body.data,
    })
    return reply.send({ data: { ...updated, id: updated.id.toString() }, message: 'Tenant berhasil diperbarui' })
  })

  // ── PUT /tenant/:id/status — suspend/activate/cancel ─────────────────────
  app.put('/tenant/:id/status', { preHandler: [authenticate, requireSuperAdmin as any] }, async (req: any, reply) => {
    const { id } = req.params as any
    const schema = z.object({ status: z.enum(['trial', 'active', 'suspended', 'cancelled']) })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Status tidak valid' })

    const tenant = await app.prisma.tenant.update({
      where: { id: BigInt(id) },
      data:  { status: body.data.status },
    })

    // Sinkronisasi status subscription jika cancelled/suspended
    if (body.data.status === 'cancelled') {
      await app.prisma.tenantSubscription.updateMany({
        where: { tenantId: BigInt(id) },
        data:  { status: 'cancelled', cancelledAt: new Date() },
      })
    }

    return reply.send({ data: { id: tenant.id.toString(), status: tenant.status }, message: `Tenant berhasil di-${body.data.status}` })
  })

  // ── DELETE /tenant/:id — soft delete ─────────────────────────────────────
  app.delete('/tenant/:id', { preHandler: [authenticate, requireSuperAdmin as any] }, async (req: any, reply) => {
    const { id } = req.params as any
    await app.prisma.tenant.update({ where: { id: BigInt(id) }, data: { isDeleted: true } })
    return reply.send({ message: 'Tenant berhasil dihapus' })
  })

  // ── GET /tenant/stats/overview — ringkasan platform (superadmin) ──────────
  app.get('/tenant/stats/overview', { preHandler: [authenticate, requireSuperAdmin as any] }, async (req: any, reply) => {
    const [total, trial, active, suspended, cancelled] = await Promise.all([
      app.prisma.tenant.count({ where: { isDeleted: false } }),
      app.prisma.tenant.count({ where: { isDeleted: false, status: 'trial' } }),
      app.prisma.tenant.count({ where: { isDeleted: false, status: 'active' } }),
      app.prisma.tenant.count({ where: { isDeleted: false, status: 'suspended' } }),
      app.prisma.tenant.count({ where: { isDeleted: false, status: 'cancelled' } }),
    ])

    return reply.send({ data: { total, trial, active, suspended, cancelled } })
  })

  // ── GET /tenant/me — info tenant sendiri (admin klinik) ──────────────────
  app.get('/tenant/me', { preHandler: [authenticate] }, async (req: any, reply) => {
    if (!req.authUser.tenantId) return reply.status(404).send({ message: 'Tenant tidak terdaftar' })

    const tenant = await app.prisma.tenant.findFirst({
      where: { id: req.authUser.tenantId, isDeleted: false },
      include: {
        subscription: { include: { plan: true } },
        _count:       { select: { branches: true, users: true } },
      },
    })
    if (!tenant) return reply.status(404).send({ message: 'Tenant tidak ditemukan' })

    const patientCount = await app.prisma.patient.count({
      where: { branch: { tenantId: req.authUser.tenantId }, isDeleted: false },
    })

    return reply.send({
      data: {
        id:           tenant.id.toString(),
        name:         tenant.name,
        slug:         tenant.slug,
        email:        tenant.email,
        phoneNumber:  tenant.phoneNumber,
        address:      tenant.address,
        logoUrl:      tenant.logoUrl,
        status:       tenant.status,
        trialEndsAt:  tenant.trialEndsAt,
        branchCount:  tenant._count.branches,
        userCount:    tenant._count.users,
        patientCount,
        subscription: tenant.subscription ? {
          status:    tenant.subscription.status,
          cycle:     tenant.subscription.cycle,
          startedAt: tenant.subscription.startedAt,
          expiresAt: tenant.subscription.expiresAt,
          plan: {
            ...tenant.subscription.plan,
            id:           tenant.subscription.plan.id.toString(),
            priceMonthly: Number(tenant.subscription.plan.priceMonthly),
            priceYearly:  Number(tenant.subscription.plan.priceYearly),
          },
        } : null,
      },
    })
  })
}
