import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'

export async function auditRoutes(app: FastifyInstance) {

  // ── GET /audit — log aktivitas (admin & superadmin) ───────────────────────
  app.get('/audit', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const q      = req.query as any
    const page   = Math.max(1, Number(q.page  ?? 1))
    const limit  = Math.min(100, Number(q.limit ?? 50))
    const skip   = (page - 1) * limit

    const tenantFilter = req.authUser.role === 'superadmin'
      ? {}
      : req.authUser.tenantId
        ? { tenantId: req.authUser.tenantId }
        : {}

    const where: any = {
      ...tenantFilter,
      ...(q.action   && { action:   q.action }),
      ...(q.resource && { resource: q.resource }),
      ...(q.userId   && { userId:   BigInt(q.userId) }),
      ...(q.search   && {
        OR: [
          { username:   { contains: q.search, mode: 'insensitive' } },
          { resource:   { contains: q.search, mode: 'insensitive' } },
          { resourceId: { contains: q.search, mode: 'insensitive' } },
        ],
      }),
    }

    if (q.dateFrom || q.dateTo) {
      where.createdAt = {}
      if (q.dateFrom) where.createdAt.gte = new Date(q.dateFrom)
      if (q.dateTo) {
        const to = new Date(q.dateTo)
        to.setHours(23, 59, 59, 999)
        where.createdAt.lte = to
      }
    }

    const [total, logs] = await Promise.all([
      app.prisma.auditLog.count({ where }),
      app.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return reply.send({
      data: logs.map(l => ({
        ...l,
        id:       l.id.toString(),
        tenantId: l.tenantId?.toString() ?? null,
        userId:   l.userId?.toString()   ?? null,
      })),
      total, page, limit,
      totalPages: Math.ceil(total / limit),
    })
  })

  // ── GET /audit/stats — ringkasan aktivitas ─────────────────────────────────
  app.get('/audit/stats', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const tenantFilter = req.authUser.role === 'superadmin'
      ? {}
      : req.authUser.tenantId ? { tenantId: req.authUser.tenantId } : {}

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const [totalToday, byAction, byResource] = await Promise.all([
      app.prisma.auditLog.count({ where: { ...tenantFilter, createdAt: { gte: today, lt: tomorrow } } }),
      app.prisma.auditLog.groupBy({
        by: ['action'],
        where: { ...tenantFilter, createdAt: { gte: today, lt: tomorrow } },
        _count: { action: true },
      }),
      app.prisma.auditLog.groupBy({
        by: ['resource'],
        where: { ...tenantFilter, createdAt: { gte: today, lt: tomorrow } },
        _count: { resource: true },
        orderBy: { _count: { resource: 'desc' } },
        take: 5,
      }),
    ])

    return reply.send({
      data: {
        totalToday,
        byAction:   byAction.map(r => ({ action: r.action, count: r._count.action })),
        byResource: byResource.map(r => ({ resource: r.resource, count: r._count.resource })),
      },
    })
  })
}
