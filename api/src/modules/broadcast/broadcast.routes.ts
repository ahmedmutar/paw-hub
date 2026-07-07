import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'
import { audit, getIp } from '../../lib/audit'

const FONNTE_TOKEN = process.env.FONNTE_TOKEN ?? ''

async function sendWA(phone: string, message: string) {
  const clean = phone.replace(/[^0-9]/g, '').replace(/^0/, '62')
  return fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { Authorization: FONNTE_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: clean, message, delay: 2, schedule: 0 }),
  }).then(r => r.json())
}

export async function broadcastRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma

  // POST /broadcast/send
  fastify.post('/broadcast/send', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const { title, message, segment } = req.body as {
      title: string; message: string
      segment?: { petCategory?: string; lastVisitDaysAgo?: number; minVisits?: number }
    }
    if (!title || !message) return reply.status(400).send({ message: 'title dan message wajib diisi' })

    const { branchId, tenantId } = req.authUser

    // Build owner query with segmentation
    const andClauses: any[] = [
      { branchId },
      { isDeleted: false },
    ]

    if (segment?.petCategory) {
      andClauses.push({ patients: { some: { petCategory: segment.petCategory, isDeleted: false } } })
    }
    if (segment?.lastVisitDaysAgo) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - segment.lastVisitDaysAgo)
      andClauses.push({ patients: { some: { registrations: { some: { createdAt: { lte: cutoff } } } } } })
    }

    const owners = await prisma.owner.findMany({
      where: { AND: andClauses },
      select: { id: true, ownerName: true, phoneNumber: true },
    })

    const validOwners = owners.filter(o => o.phoneNumber)

    // Create broadcast log
    const broadcast = await prisma.broadcastLog.create({
      data: {
        tenantId,
        branchId,
        userId: req.authUser.userId,
        title,
        message,
        segment: segment ?? {},
        status: 'sending',
        totalTarget: validOwners.length,
        startedAt: new Date(),
      },
    })

    // Create recipient records
    if (validOwners.length > 0) {
      await prisma.broadcastRecipient.createMany({
        data: validOwners.map(o => ({
          broadcastId: broadcast.id,
          ownerId: o.id,
          phone: o.phoneNumber!,
          status: 'pending',
        })),
      })
    }

    // Send non-blocking in background
    ;(async () => {
      let sent = 0; let failed = 0
      for (const owner of validOwners) {
        try {
          const personalMsg = message
            .replace('{nama}', owner.ownerName)
            .replace('{owner}', owner.ownerName)
          const res: any = await sendWA(owner.phoneNumber!, personalMsg)
          const ok = res?.status === true
          await prisma.broadcastRecipient.updateMany({
            where: { broadcastId: broadcast.id, ownerId: owner.id },
            data: { status: ok ? 'sent' : 'failed', sentAt: new Date(), errorMsg: ok ? null : res?.reason ?? 'failed' },
          })
          if (ok) sent++; else failed++
        } catch { failed++ }
        // small delay to avoid rate limit
        await new Promise(r => setTimeout(r, 800))
      }
      await prisma.broadcastLog.update({
        where: { id: broadcast.id },
        data: { status: 'done', totalSent: sent, totalFailed: failed, completedAt: new Date() },
      })
    })().catch(() => {})

    audit(prisma, { tenantId, userId: req.authUser.userId, username: req.authUser.username, action: 'create', resource: 'broadcast', resourceId: String(broadcast.id), details: { title, totalTarget: validOwners.length }, ipAddress: getIp(req) }).catch(() => {})

    return reply.send({ success: true, data: { broadcastId: broadcast.id.toString(), totalTarget: validOwners.length } })
  })

  // GET /broadcast/log
  fastify.get('/broadcast/log', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const { page = 1, limit = 20 } = req.query as any
    const skip = (Number(page) - 1) * Number(limit)
    const { branchId, tenantId, role } = req.authUser
    const where: any = role === 'superadmin' ? {} : { branchId }

    const [logs, total] = await Promise.all([
      prisma.broadcastLog.findMany({
        where, orderBy: { createdAt: 'desc' }, skip, take: Number(limit),
        include: { user: { select: { fullname: true } }, _count: { select: { recipients: true } } },
      }),
      prisma.broadcastLog.count({ where }),
    ])

    return reply.send({
      data: logs.map(l => ({
        id: l.id.toString(), title: l.title, status: l.status,
        totalTarget: l.totalTarget, totalSent: l.totalSent, totalFailed: l.totalFailed,
        createdAt: l.createdAt, completedAt: l.completedAt,
        createdBy: l.user.fullname,
        preview: l.message.slice(0, 80) + (l.message.length > 80 ? '...' : ''),
        segment: l.segment,
      })),
      total, totalPages: Math.ceil(total / Number(limit)), page: Number(page),
    })
  })

  // GET /broadcast/:id/detail
  fastify.get('/broadcast/:id/detail', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const { branchId, role } = req.authUser
    const where: any = role === 'superadmin' ? { id } : { id, branchId }
    const log = await prisma.broadcastLog.findFirst({
      where,
      include: {
        user: { select: { fullname: true } },
        recipients: { orderBy: { sentAt: 'desc' }, take: 100, include: { owner: { select: { ownerName: true } } } },
      },
    })
    if (!log) return reply.status(404).send({ message: 'Tidak ditemukan' })
    return reply.send({
      data: {
        id: log.id.toString(), title: log.title, message: log.message,
        status: log.status, totalTarget: log.totalTarget, totalSent: log.totalSent, totalFailed: log.totalFailed,
        createdAt: log.createdAt, completedAt: log.completedAt, createdBy: log.user.fullname,
        segment: log.segment,
        recipients: log.recipients.map(r => ({
          ownerName: r.owner.ownerName, phone: r.phone, status: r.status, sentAt: r.sentAt, errorMsg: r.errorMsg,
        })),
      },
    })
  })

  // GET /broadcast/analytics
  fastify.get('/broadcast/analytics', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const { branchId, role } = req.authUser
    const where: any = role === 'superadmin' ? {} : { branchId }

    const [total, done, sending] = await Promise.all([
      prisma.broadcastLog.count({ where }),
      prisma.broadcastLog.aggregate({ where: { ...where, status: 'done' }, _sum: { totalSent: true, totalFailed: true, totalTarget: true } }),
      prisma.broadcastLog.count({ where: { ...where, status: 'sending' } }),
    ])

    const last5 = await prisma.broadcastLog.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, title: true, status: true, totalSent: true, totalTarget: true, createdAt: true },
    })

    return reply.send({
      data: {
        totalBroadcasts: total,
        totalSent: done._sum.totalSent ?? 0,
        totalFailed: done._sum.totalFailed ?? 0,
        totalReached: done._sum.totalTarget ?? 0,
        activeSending: sending,
        successRate: done._sum.totalTarget ? Math.round(((done._sum.totalSent ?? 0) / done._sum.totalTarget) * 100) : 0,
        recent: last5.map(l => ({ ...l, id: l.id.toString() })),
      },
    })
  })

  // GET /broadcast/segment-preview (preview how many owners match a segment)
  fastify.get('/broadcast/segment-preview', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const { petCategory, lastVisitDaysAgo } = req.query as any
    const { branchId } = req.authUser

    const andClauses: any[] = [{ branchId }, { isDeleted: false }]
    if (petCategory) andClauses.push({ patients: { some: { petCategory, isDeleted: false } } })
    if (lastVisitDaysAgo) {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - Number(lastVisitDaysAgo))
      andClauses.push({ patients: { some: { registrations: { some: { createdAt: { lte: cutoff } } } } } })
    }

    const count = await prisma.owner.count({ where: { AND: andClauses } })
    const withPhone = await prisma.owner.count({ where: { AND: [...andClauses, { phoneNumber: { not: null } }] } })

    return reply.send({ data: { totalOwners: count, withPhone, withoutPhone: count - withPhone } })
  })
}
