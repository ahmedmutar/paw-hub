import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, requireRole } from '../../middleware/auth'
import { snap, verifyMidtransSignature } from '../../lib/midtrans'

function fmtPlan(p: any) {
  return { ...p, id: p.id.toString(), priceMonthly: Number(p.priceMonthly), priceYearly: Number(p.priceYearly) }
}

function fmtInvoice(inv: any) {
  return {
    id:       inv.id.toString(),
    orderId:  inv.orderId,
    status:   inv.status,
    amount:   Number(inv.amount),
    cycle:    inv.cycle,
    paidAt:   inv.paidAt,
    plan:     inv.plan ? fmtPlan(inv.plan) : undefined,
  }
}

// Hitung tanggal expire berdasarkan cycle, dipakai baik saat aktivasi gratis
// maupun setelah pembayaran Midtrans terkonfirmasi.
function computeExpiresAt(cycle: 'monthly' | 'yearly') {
  const expiresAt = new Date()
  if (cycle === 'yearly') expiresAt.setFullYear(expiresAt.getFullYear() + 1)
  else expiresAt.setMonth(expiresAt.getMonth() + 1)
  return expiresAt
}

async function activateSubscription(app: FastifyInstance, tenantId: bigint, planId: bigint, cycle: string) {
  const expiresAt = computeExpiresAt(cycle as 'monthly' | 'yearly')
  const sub = await app.prisma.tenantSubscription.upsert({
    where:  { tenantId },
    update: { planId, cycle, status: 'active', expiresAt, cancelledAt: null },
    create: { tenantId, planId, cycle, status: 'active', expiresAt },
  })
  await app.prisma.tenant.update({ where: { id: tenantId }, data: { status: 'active' } })
  return sub
}

export async function billingRoutes(app: FastifyInstance) {

  // ── GET /billing/plans — daftar paket (public) ────────────────────────────
  app.get('/billing/plans', async (_req, reply) => {
    const plans = await app.prisma.subscriptionPlan.findMany({
      where: { isActive: true }, orderBy: { priceMonthly: 'asc' },
    })
    return reply.send({ data: plans.map(fmtPlan) })
  })

  // ── GET /billing/subscription — langganan tenant saat ini ────────────────
  app.get('/billing/subscription', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    if (!req.authUser.tenantId) return reply.status(404).send({ message: 'Tenant tidak terdaftar' })

    const sub = await app.prisma.tenantSubscription.findUnique({
      where:   { tenantId: req.authUser.tenantId },
      include: { plan: true },
    })
    if (!sub) return reply.status(404).send({ message: 'Tidak ada data langganan' })

    return reply.send({
      data: {
        id:          sub.id.toString(),
        status:      sub.status,
        cycle:       sub.cycle,
        startedAt:   sub.startedAt,
        expiresAt:   sub.expiresAt,
        cancelledAt: sub.cancelledAt,
        plan:        fmtPlan(sub.plan),
        daysLeft:    sub.expiresAt
          ? Math.max(0, Math.ceil((sub.expiresAt.getTime() - Date.now()) / 86_400_000))
          : null,
      },
    })
  })

  // ── GET /billing/usage — pemakaian vs limit plan ──────────────────────────
  app.get('/billing/usage', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    if (!req.authUser.tenantId) return reply.status(404).send({ message: 'Tenant tidak terdaftar' })

    const sub = await app.prisma.tenantSubscription.findUnique({
      where:   { tenantId: req.authUser.tenantId },
      include: { plan: true },
    })

    const [branchCount, userCount, patientCount] = await Promise.all([
      app.prisma.branch.count({ where: { tenantId: req.authUser.tenantId, isDeleted: false } }),
      app.prisma.user.count({ where: { tenantId: req.authUser.tenantId, isDeleted: false } }),
      app.prisma.patient.count({ where: { branch: { tenantId: req.authUser.tenantId }, isDeleted: false } }),
    ])

    const plan = sub?.plan
    return reply.send({
      data: {
        branches: { used: branchCount, limit: plan?.maxBranches ?? 1,  pct: plan ? Math.round(branchCount  / plan.maxBranches  * 100) : 0 },
        users:    { used: userCount,   limit: plan?.maxUsers    ?? 5,  pct: plan ? Math.round(userCount    / plan.maxUsers    * 100) : 0 },
        patients: { used: patientCount,limit: plan?.maxPatients ?? 500,pct: plan ? Math.round(patientCount / plan.maxPatients * 100) : 0 },
      },
    })
  })

  // ── POST /billing/checkout — mulai pembayaran upgrade lewat Midtrans ─────
  app.post('/billing/checkout', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    if (!req.authUser.tenantId) return reply.status(404).send({ message: 'Tenant tidak terdaftar' })

    const schema = z.object({
      planCode: z.enum(['free', 'starter', 'pro', 'enterprise']),
      cycle:    z.enum(['monthly', 'yearly']).default('monthly'),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid' })

    const plan = await app.prisma.subscriptionPlan.findUnique({ where: { code: body.data.planCode } })
    if (!plan) return reply.status(404).send({ message: 'Paket tidak ditemukan' })

    const amount = Number(body.data.cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly)

    // Paket gratis tidak perlu lewat payment gateway — langsung aktifkan.
    if (amount <= 0) {
      const sub = await activateSubscription(app, req.authUser.tenantId, plan.id, body.data.cycle)
      return reply.send({
        data: { free: true, status: sub.status, expiresAt: sub.expiresAt, plan: fmtPlan(plan) },
        message: `Berhasil pindah ke paket ${plan.name}.`,
      })
    }

    const tenant = await app.prisma.tenant.findUnique({ where: { id: req.authUser.tenantId } })
    if (!tenant) return reply.status(404).send({ message: 'Tenant tidak ditemukan' })

    const orderId = `SUB-${tenant.id}-${Date.now()}`

    const invoice = await app.prisma.billingInvoice.create({
      data: {
        tenantId: tenant.id,
        planId:   plan.id,
        cycle:    body.data.cycle,
        orderId,
        amount,
        status:   'pending',
      },
    })

    try {
      // @types/midtrans-client cuma mendefinisikan `transaction_details` — padahal
      // API Midtrans aslinya juga menerima customer_details & item_details.
      const transaction = await snap.createTransaction({
        transaction_details: { order_id: orderId, gross_amount: amount },
        customer_details: {
          first_name: req.authUser.fullname,
          email:      tenant.email,
          phone:      tenant.phoneNumber ?? undefined,
        },
        item_details: [{
          id: plan.code, price: amount, quantity: 1,
          name: `Paket ${plan.name} (${body.data.cycle === 'yearly' ? 'Tahunan' : 'Bulanan'})`,
        }],
      } as any)

      await app.prisma.billingInvoice.update({
        where: { id: invoice.id },
        data:  { snapToken: transaction.token },
      })

      return reply.send({
        data: { orderId, token: transaction.token, redirectUrl: transaction.redirect_url },
      })
    } catch (err: any) {
      await app.prisma.billingInvoice.update({ where: { id: invoice.id }, data: { status: 'failed' } })
      req.log.error(err, '[Billing] Gagal membuat transaksi Midtrans')
      return reply.status(502).send({ message: 'Gagal menghubungi payment gateway. Coba lagi.' })
    }
  })

  // ── GET /billing/invoice/:orderId — polling status setelah bayar ─────────
  app.get('/billing/invoice/:orderId', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { orderId } = req.params as { orderId: string }
    const invoice = await app.prisma.billingInvoice.findUnique({ where: { orderId }, include: { plan: true } })
    if (!invoice || invoice.tenantId !== req.authUser.tenantId) {
      return reply.status(404).send({ message: 'Invoice tidak ditemukan' })
    }
    return reply.send({ data: fmtInvoice(invoice) })
  })

  // ── POST /billing/webhook — notifikasi server-to-server dari Midtrans ────
  app.post('/billing/webhook', async (req, reply) => {
    const body = req.body as any

    if (!body?.order_id || !verifyMidtransSignature(body)) {
      return reply.status(403).send({ message: 'Signature tidak valid' })
    }

    const invoice = await app.prisma.billingInvoice.findUnique({ where: { orderId: body.order_id } })
    if (!invoice) return reply.status(404).send({ message: 'Invoice tidak ditemukan' })

    const status = body.transaction_status as string
    const fraudStatus = body.fraud_status as string | undefined

    if ((status === 'capture' && fraudStatus === 'accept') || status === 'settlement') {
      if (invoice.status !== 'paid') {
        await activateSubscription(app, invoice.tenantId, invoice.planId, invoice.cycle)
        await app.prisma.billingInvoice.update({
          where: { id: invoice.id },
          data:  { status: 'paid', paidAt: new Date(), paymentType: body.payment_type, rawNotification: body },
        })
      }
    } else if (status === 'expire') {
      await app.prisma.billingInvoice.update({ where: { id: invoice.id }, data: { status: 'expired', rawNotification: body } })
    } else if (status === 'deny' || status === 'cancel') {
      await app.prisma.billingInvoice.update({ where: { id: invoice.id }, data: { status: 'failed', rawNotification: body } })
    } else {
      await app.prisma.billingInvoice.update({ where: { id: invoice.id }, data: { rawNotification: body } })
    }

    return reply.send({ message: 'OK' })
  })

  // ── POST /billing/cancel — batalkan langganan ─────────────────────────────
  app.post('/billing/cancel', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    if (!req.authUser.tenantId) return reply.status(404).send({ message: 'Tenant tidak terdaftar' })

    const sub = await app.prisma.tenantSubscription.findUnique({ where: { tenantId: req.authUser.tenantId } })
    if (!sub) return reply.status(404).send({ message: 'Tidak ada langganan aktif' })
    if (sub.status === 'cancelled') return reply.status(400).send({ message: 'Langganan sudah dibatalkan' })

    await app.prisma.tenantSubscription.update({
      where: { tenantId: req.authUser.tenantId },
      data:  { status: 'cancelled', cancelledAt: new Date() },
    })
    await app.prisma.tenant.update({
      where: { id: req.authUser.tenantId },
      data:  { status: 'cancelled' },
    })

    return reply.send({ message: 'Langganan berhasil dibatalkan. Anda masih dapat mengakses hingga akhir periode.' })
  })

  // ── POST /billing/plans (superadmin: tambah/edit plan) ───────────────────
  app.post('/billing/plans', { preHandler: [authenticate] }, async (req: any, reply) => {
    if (req.authUser.role !== 'superadmin') return reply.status(403).send({ message: 'Akses ditolak' })

    const schema = z.object({
      code:         z.enum(['free', 'starter', 'pro', 'enterprise']),
      name:         z.string().min(2),
      priceMonthly: z.number().min(0),
      priceYearly:  z.number().min(0),
      maxBranches:  z.number().int().positive(),
      maxUsers:     z.number().int().positive(),
      maxPatients:  z.number().int().positive(),
      features:     z.record(z.any()).default({}),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid', errors: body.error.flatten() })

    const plan = await app.prisma.subscriptionPlan.upsert({
      where:  { code: body.data.code },
      update: body.data,
      create: body.data,
    })
    return reply.status(201).send({ data: fmtPlan(plan), message: 'Paket berhasil disimpan' })
  })
}
