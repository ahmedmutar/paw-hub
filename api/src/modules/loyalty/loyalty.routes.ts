import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'
import { audit, getIp } from '../../lib/audit'
import { awardLoyaltyPoints, calcTier, getLoyaltyBranchConfig as getBranchConfig, getOrCreateLoyaltyMember as getOrCreateMember } from '../../lib/loyalty'

export async function loyaltyRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma

  // GET /loyalty/config — get or init config for branch
  fastify.get('/loyalty/config', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const cfg = await getBranchConfig(prisma, req.authUser.branchId)
    return reply.send({ data: cfg })
  })

  // PUT /loyalty/config — update loyalty config
  fastify.put('/loyalty/config', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { pointsPerRupiah, silverThreshold, goldThreshold, redeemRate, isActive } = req.body as any
    const { branchId, tenantId } = req.authUser

    const cfg = await prisma.loyaltyConfig.upsert({
      where: { branchId },
      update: { pointsPerRupiah, silverThreshold, goldThreshold, redeemRate, isActive },
      create: { branchId, tenantId, pointsPerRupiah, silverThreshold, goldThreshold, redeemRate, isActive: isActive ?? true },
    })
    return reply.send({ success: true, data: cfg })
  })

  // GET /loyalty/members — list all members at this branch
  fastify.get('/loyalty/members', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { page = 1, limit = 20, tier, search } = req.query as any
    const { branchId } = req.authUser
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { branchId }
    if (tier) where.tier = tier
    if (search) where.owner = { ownerName: { contains: search, mode: 'insensitive' } }

    const [members, total] = await Promise.all([
      prisma.loyaltyMember.findMany({
        where, skip, take: Number(limit),
        orderBy: { totalPoints: 'desc' },
        include: { owner: { select: { ownerName: true, phoneNumber: true } } },
      }),
      prisma.loyaltyMember.count({ where }),
    ])

    return reply.send({
      data: members.map(m => ({
        id: m.id.toString(), ownerId: m.ownerId.toString(),
        ownerName: m.owner.ownerName, phone: m.owner.phoneNumber,
        totalPoints: m.totalPoints, tier: m.tier,
        totalSpend: Number(m.totalSpend), joinedAt: m.joinedAt,
      })),
      total, totalPages: Math.ceil(total / Number(limit)), page: Number(page),
    })
  })

  // GET /loyalty/member/:ownerId — member detail with point history
  fastify.get('/loyalty/member/:ownerId', { preHandler: [authenticate] }, async (req: any, reply) => {
    const ownerId = BigInt(req.params.ownerId)
    const { branchId } = req.authUser
    const cfg = await getBranchConfig(prisma, branchId)

    const [member, history] = await Promise.all([
      prisma.loyaltyMember.findUnique({
        where: { ownerId_branchId: { ownerId, branchId } },
        include: { owner: { select: { ownerName: true, phoneNumber: true } } },
      }),
      prisma.loyaltyPoint.findMany({
        where: { ownerId, branchId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ])

    return reply.send({
      data: {
        member: member ? {
          ...member, id: member.id.toString(), ownerId: member.ownerId.toString(),
          totalSpend: Number(member.totalSpend),
          nextTierPoints: member.tier === 'basic' ? cfg.silverThreshold - member.totalPoints
            : member.tier === 'silver' ? cfg.goldThreshold - member.totalPoints : 0,
          nextTier: member.tier === 'basic' ? 'silver' : member.tier === 'silver' ? 'gold' : null,
        } : null,
        history: history.map(h => ({ ...h, id: h.id.toString(), ownerId: h.ownerId.toString() })),
        config: cfg,
      },
    })
  })

  // POST /loyalty/earn — award points (manual entry; also called automatically on payment completion, see pembayaran.routes.ts)
  fastify.post('/loyalty/earn', { preHandler: [authenticate, requireRole('admin', 'kasir')] }, async (req: any, reply) => {
    const { ownerId, totalPaid, description, refId } = req.body as { ownerId: string; totalPaid: number; description?: string; refId?: string }
    const { branchId, tenantId } = req.authUser

    const result = await awardLoyaltyPoints(prisma, { ownerId: BigInt(ownerId), branchId, tenantId, totalPaid, description, refId })
    if (!result.success) return reply.send({ success: false, message: 'Program loyalty tidak aktif' })
    return reply.send({ success: true, data: result })
  })

  // POST /loyalty/redeem — redeem points for discount
  fastify.post('/loyalty/redeem', { preHandler: [authenticate, requireRole('admin', 'kasir')] }, async (req: any, reply) => {
    const { ownerId, points } = req.body as { ownerId: string; points: number }
    const { branchId, tenantId } = req.authUser
    const cfg = await getBranchConfig(prisma, branchId)
    if (!cfg.isActive) return reply.status(400).send({ message: 'Program loyalty tidak aktif' })

    const ownerBigInt = BigInt(ownerId)
    const member = await getOrCreateMember(prisma, ownerBigInt, branchId, tenantId)
    if (member.totalPoints < points) return reply.status(400).send({ message: `Poin tidak cukup. Saldo: ${member.totalPoints}` })

    const discountValue = points * Number(cfg.redeemRate)
    const newBalance = member.totalPoints - points
    const newTier = calcTier(newBalance, cfg)

    await prisma.$transaction([
      prisma.loyaltyMember.update({
        where: { ownerId_branchId: { ownerId: ownerBigInt, branchId } },
        data: { totalPoints: newBalance, tier: newTier },
      }),
      prisma.loyaltyPoint.create({
        data: { ownerId: ownerBigInt, branchId, tenantId, txType: 'redeem', points: -points, balance: newBalance, description: `Penukaran ${points} poin = diskon Rp${discountValue.toLocaleString()}` },
      }),
    ])

    audit(prisma, { tenantId, userId: req.authUser.userId, username: req.authUser.username, action: 'update', resource: 'loyalty', resourceId: ownerId, details: { redeemed: points, discount: discountValue }, ipAddress: getIp(req) }).catch(() => {})

    return reply.send({ success: true, data: { redeemedPoints: points, discountValue, newBalance, tier: newTier } })
  })

  // GET /loyalty/stats — overview stats for admin
  fastify.get('/loyalty/stats', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const [totalMembers, byTier, totalPointsEarned, totalRedeemed] = await Promise.all([
      prisma.loyaltyMember.count({ where: { branchId } }),
      prisma.loyaltyMember.groupBy({ by: ['tier'], where: { branchId }, _count: true }),
      prisma.loyaltyPoint.aggregate({ where: { branchId, txType: 'earn' }, _sum: { points: true } }),
      prisma.loyaltyPoint.aggregate({ where: { branchId, txType: 'redeem' }, _sum: { points: true } }),
    ])
    return reply.send({
      data: {
        totalMembers,
        byTier: Object.fromEntries(byTier.map(b => [b.tier, b._count])),
        totalPointsEarned: totalPointsEarned._sum.points ?? 0,
        totalRedeemed: Math.abs(totalRedeemed._sum.points ?? 0),
      },
    })
  })
}
