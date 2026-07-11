import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, requireRole } from '../../middleware/auth'
import { sendWhatsapp } from './wa.service'
import { WaNotifType } from '@prisma/client'
import { checkPlanFeature } from '../../lib/planLimits'

// WhatsappLog cuma punya branchId (tidak ada tenantId langsung). Admin
// dikunci ke seluruh cabang di tenant-nya, non-admin dikunci ke cabang sendiri.
function notifBranchFilter(user: any) {
  return user.role === 'admin'
    ? { branch: { tenantId: BigInt(user.tenantId) } }
    : { branchId: BigInt(user.branchId) }
}

export async function notifRoutes(app: FastifyInstance) {

  // ── GET /notif/log — list WhatsApp logs (admin only) ─────────────────────
  app.get('/notif/log', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const q      = req.query as any
    const page   = Number(q.page  || 1)
    const limit  = Number(q.limit || 30)
    const status = q.status as string | undefined
    const type   = q.type   as string | undefined
    const search = q.search as string | undefined

    const where: any = {
      ...notifBranchFilter(req.authUser),
      ...(status ? { status } : {}),
      ...(type   ? { type }   : {}),
      ...(search ? {
        OR: [
          { recipientPhone: { contains: search } },
          { recipientName:  { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    }

    const [data, total] = await Promise.all([
      app.prisma.whatsappLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, petName: true } },
          branch:  { select: { id: true, branchName: true } },
        },
      }),
      app.prisma.whatsappLog.count({ where }),
    ])

    return reply.send({
      data: data.map(formatLog),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  })

  // ── GET /notif/log/stats ──────────────────────────────────────────────────
  app.get('/notif/log/stats', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const bf = notifBranchFilter(req.authUser)
    const today = new Date(); today.setHours(0, 0, 0, 0)

    const [total, sent, failed, today_count] = await Promise.all([
      app.prisma.whatsappLog.count({ where: bf }),
      app.prisma.whatsappLog.count({ where: { ...bf, status: 'sent' } }),
      app.prisma.whatsappLog.count({ where: { ...bf, status: 'failed' } }),
      app.prisma.whatsappLog.count({ where: { ...bf, createdAt: { gte: today } } }),
    ])

    return reply.send({ data: { total, sent, failed, today: today_count } })
  })

  // ── POST /notif/wa/send — manual send (admin/resepsionis) ─────────────────
  app.post('/notif/wa/send', { preHandler: authenticate }, async (req, reply) => {
    const schema = z.object({
      phone:   z.string().min(8),
      message: z.string().min(1),
      type:    z.enum(['custom', 'queue_confirmation', 'queue_called', 'vaccination_reminder',
                       'deworming_reminder', 'payment_receipt', 'inpatient_update']).default('custom'),
      patientId:      z.string().optional(),
      registrationId: z.string().optional(),
      recipientName:  z.string().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid', errors: body.error.flatten().fieldErrors })
    }

    const featureCheck = await checkPlanFeature(app, req.authUser.tenantId, 'whatsapp')
    if (!featureCheck.ok) return reply.status(402).send({ message: featureCheck.message })

    const { phone, message, type, patientId, registrationId, recipientName } = body.data

    // Non-blocking — fire and forget, result reflected in log
    sendWhatsapp(app.prisma, {
      phone,
      message,
      recipientName,
      type: type as WaNotifType,
      patientId:      patientId      ? BigInt(patientId)      : undefined,
      registrationId: registrationId ? BigInt(registrationId) : undefined,
      branchId: req.authUser.branchId,
      userId:   req.authUser.userId,
    }).catch(() => {})

    return reply.status(202).send({ message: 'Pesan WhatsApp sedang dikirim' })
  })

  // ── POST /notif/wa/resend/:id — retry failed log ──────────────────────────
  app.post('/notif/wa/resend/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const { id } = req.params as any
    const log = await app.prisma.whatsappLog.findFirst({
      where: { id: BigInt(id), ...notifBranchFilter(req.authUser) },
    })
    if (!log) return reply.status(404).send({ message: 'Log tidak ditemukan' })
    if (log.status === 'sent') return reply.status(400).send({ message: 'Pesan sudah berhasil dikirim' })

    sendWhatsapp(app.prisma, {
      phone:          log.recipientPhone,
      recipientName:  log.recipientName ?? undefined,
      message:        log.message,
      type:           log.type,
      patientId:      log.patientId      ?? undefined,
      registrationId: log.registrationId ?? undefined,
      branchId:       log.branchId,
      userId:         req.authUser.userId,
    }).catch(() => {})

    return reply.status(202).send({ message: 'Mencoba kirim ulang pesan WhatsApp' })
  })

  // ── GET /notif/config — check token configured ────────────────────────────
  app.get('/notif/config', { preHandler: [authenticate, requireRole('admin')] }, async (_req, reply) => {
    return reply.send({
      data: {
        configured: !!process.env.FONNTE_TOKEN,
        provider: 'Fonnte',
      },
    })
  })
}

function formatLog(l: any) {
  return {
    ...l,
    id:             l.id.toString(),
    branchId:       l.branchId.toString(),
    userId:         l.userId.toString(),
    patientId:      l.patientId?.toString()      ?? null,
    registrationId: l.registrationId?.toString() ?? null,
    patient: l.patient ? { ...l.patient, id: l.patient.id.toString() } : null,
    branch:  l.branch  ? { ...l.branch,  id: l.branch.id.toString()  } : null,
  }
}
