import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/auth'

function fmt(n: any) {
  return {
    id:         n.id.toString(),
    type:       n.type,
    title:      n.title,
    message:    n.message,
    entityType: n.entityType,
    entityId:   n.entityId,
    isRead:     n.isRead,
    createdAt:  n.createdAt,
  }
}

export async function notifikasiStaffRoutes(app: FastifyInstance) {

  // ── GET /notifications — daftar notifikasi staf untuk cabang sendiri ─────
  app.get('/notifications', { preHandler: [authenticate] }, async (req, reply) => {
    const { unreadOnly, page = '1', limit = '20' } = req.query as any
    const branchId = req.authUser.branchId
    const take = Math.min(Number(limit) || 20, 50)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where = { branchId, ...(unreadOnly === 'true' ? { isRead: false } : {}) }

    const [items, total] = await Promise.all([
      app.prisma.staffNotification.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
      app.prisma.staffNotification.count({ where }),
    ])

    return reply.send({
      data: items.map(fmt),
      meta: { total, page: Number(page) || 1, limit: take, totalPages: Math.max(Math.ceil(total / take), 1) },
    })
  })

  // ── GET /notifications/unread-count ───────────────────────────────────────
  app.get('/notifications/unread-count', { preHandler: [authenticate] }, async (req, reply) => {
    const count = await app.prisma.staffNotification.count({
      where: { branchId: req.authUser.branchId, isRead: false },
    })
    return reply.send({ data: { count } })
  })

  // ── POST /notifications/:id/read — tandai satu notifikasi terbaca ─────────
  app.post('/notifications/:id/read', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const notif = await app.prisma.staffNotification.findUnique({ where: { id: BigInt(id) } })
    if (!notif || notif.branchId !== req.authUser.branchId) {
      return reply.status(404).send({ message: 'Notifikasi tidak ditemukan' })
    }
    await app.prisma.staffNotification.update({ where: { id: BigInt(id) }, data: { isRead: true } })
    return reply.send({ message: 'OK' })
  })

  // ── POST /notifications/read-all — tandai semua terbaca ───────────────────
  app.post('/notifications/read-all', { preHandler: [authenticate] }, async (req, reply) => {
    await app.prisma.staffNotification.updateMany({
      where: { branchId: req.authUser.branchId, isRead: false },
      data:  { isRead: true },
    })
    return reply.send({ message: 'Semua notifikasi ditandai terbaca' })
  })
}
