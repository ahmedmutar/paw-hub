// @ts-nocheck
import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'

export async function marketplaceRoutes(app: FastifyInstance) {
  // List integrations
  app.get('/marketplace/integrations', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const integrations = await req.server.prisma.marketplaceIntegration.findMany({
      where: { branchId },
      include: { orders: { orderBy: { orderDate: 'desc' }, take: 3 } },
    })
    return reply.send({ data: integrations })
  })

  // Connect marketplace (mock)
  app.post('/marketplace/connect', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { branchId, tenantId } = req.authUser
    const { platform, shopId, shopName, accessToken } = req.body as any

    if (!['tokopedia', 'shopee'].includes(platform)) {
      return reply.status(400).send({ message: 'Platform harus tokopedia atau shopee' })
    }

    const integration = await req.server.prisma.marketplaceIntegration.upsert({
      where: { branchId_platform: { branchId, platform } },
      create: { branchId, tenantId, platform, shopId, shopName, accessToken, syncEnabled: true },
      update: { shopId, shopName, accessToken, syncEnabled: true },
    })
    return reply.status(201).send({ data: integration })
  })

  // Disconnect
  app.delete('/marketplace/:id/disconnect', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    await req.server.prisma.marketplaceIntegration.update({
      where: { id },
      data: { syncEnabled: false, accessToken: null },
    })
    return reply.send({ message: 'Integrasi marketplace diputus' })
  })

  // Sync stock (mock — buat contoh orders)
  app.post('/marketplace/:id/sync', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const integration = await req.server.prisma.marketplaceIntegration.findUnique({ where: { id } })
    if (!integration) return reply.status(404).send({ message: 'Integrasi tidak ditemukan' })
    if (!integration.syncEnabled) return reply.status(400).send({ message: 'Integrasi tidak aktif' })

    // Mock: generate 2 sample orders
    const mockOrders = [
      { orderId: `${integration.platform.toUpperCase()}-${Date.now()}-001`, customerName: 'Budi Santoso', totalAmount: 150000, status: 'pending' },
      { orderId: `${integration.platform.toUpperCase()}-${Date.now()}-002`, customerName: 'Siti Rahayu', totalAmount: 85000, status: 'pending' },
    ]

    const created = await Promise.all(mockOrders.map(o =>
      req.server.prisma.marketplaceOrder.create({
        data: {
          integrationId: id, orderId: o.orderId, platform: integration.platform,
          customerName: o.customerName, items: [{ name: 'Produk Petshop', qty: 1, price: o.totalAmount }],
          totalAmount: o.totalAmount, status: o.status, orderDate: new Date(),
        },
      }).catch(() => null)
    ))

    await req.server.prisma.marketplaceIntegration.update({ where: { id }, data: { lastSyncAt: new Date() } })

    return reply.send({ data: { syncedAt: new Date(), newOrders: created.filter(Boolean).length } })
  })

  // List orders
  app.get('/marketplace/orders', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const { platform, status, page = 1, limit = 20 } = req.query as any
    const skip = (Number(page) - 1) * Number(limit)

    const integrations = await req.server.prisma.marketplaceIntegration.findMany({
      where: { branchId, ...(platform && { platform }) },
      select: { id: true },
    })
    const integrationIds = integrations.map(i => i.id)

    const where: any = {
      integrationId: { in: integrationIds },
      ...(status && { status }),
    }

    const [total, orders] = await Promise.all([
      req.server.prisma.marketplaceOrder.count({ where }),
      req.server.prisma.marketplaceOrder.findMany({
        where, skip, take: Number(limit),
        orderBy: { orderDate: 'desc' },
        include: { integration: { select: { platform: true, shopName: true } } },
      }),
    ])
    return reply.send({ data: orders, total, page: Number(page) })
  })

  // Update order status
  app.patch('/marketplace/orders/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const { status } = req.body as any
    const order = await req.server.prisma.marketplaceOrder.update({ where: { id }, data: { status } })
    return reply.send({ data: order })
  })

  // Dashboard stats
  app.get('/marketplace/stats', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const integrations = await req.server.prisma.marketplaceIntegration.findMany({ where: { branchId } })
    const ids = integrations.map(i => i.id)

    const [totalOrders, pendingOrders, totalRevenue] = await Promise.all([
      req.server.prisma.marketplaceOrder.count({ where: { integrationId: { in: ids } } }),
      req.server.prisma.marketplaceOrder.count({ where: { integrationId: { in: ids }, status: 'pending' } }),
      req.server.prisma.marketplaceOrder.findMany({ where: { integrationId: { in: ids }, status: { not: 'cancelled' } }, select: { totalAmount: true } }),
    ])

    return reply.send({
      data: {
        connectedPlatforms: integrations.filter(i => i.syncEnabled).length,
        totalOrders, pendingOrders,
        totalRevenue: totalRevenue.reduce((s, o) => s + Number(o.totalAmount), 0),
      },
    })
  })
}
