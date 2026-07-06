import { PrismaClient } from '@prisma/client'

const DEFAULT_CONFIG = { pointsPerRupiah: 0.001, silverThreshold: 500, goldThreshold: 2000, redeemRate: 100 }

export function calcTier(totalPoints: number, cfg: { silverThreshold: number; goldThreshold: number }): string {
  if (totalPoints >= cfg.goldThreshold) return 'gold'
  if (totalPoints >= cfg.silverThreshold) return 'silver'
  return 'basic'
}

export async function getOrCreateLoyaltyMember(prisma: any, ownerId: bigint, branchId: bigint, tenantId: bigint | null) {
  let member = await prisma.loyaltyMember.findUnique({ where: { ownerId_branchId: { ownerId, branchId } } })
  if (!member) {
    member = await prisma.loyaltyMember.create({ data: { ownerId, branchId, tenantId, totalPoints: 0, tier: 'basic', totalSpend: 0 } })
  }
  return member
}

export async function getLoyaltyBranchConfig(prisma: any, branchId: bigint) {
  return (await prisma.loyaltyConfig.findUnique({ where: { branchId } })) ?? {
    pointsPerRupiah: DEFAULT_CONFIG.pointsPerRupiah,
    silverThreshold: DEFAULT_CONFIG.silverThreshold,
    goldThreshold: DEFAULT_CONFIG.goldThreshold,
    redeemRate: DEFAULT_CONFIG.redeemRate,
    isActive: false,
  }
}

/** Awards loyalty points for a completed transaction. No-op if the branch's loyalty program is inactive or totalPaid rounds to 0 points. */
export async function awardLoyaltyPoints(
  prisma: PrismaClient,
  { ownerId, branchId, tenantId, totalPaid, description, refId }: {
    ownerId: bigint
    branchId: bigint
    tenantId: bigint | null
    totalPaid: number
    description?: string
    refId?: string
  }
) {
  const cfg = await getLoyaltyBranchConfig(prisma, branchId)
  if (!cfg.isActive) return { success: false, pointsEarned: 0 }

  const member = await getOrCreateLoyaltyMember(prisma, ownerId, branchId, tenantId)
  const pts = Math.floor(totalPaid * Number(cfg.pointsPerRupiah))
  if (pts <= 0) return { success: true, pointsEarned: 0 }

  const newBalance = member.totalPoints + pts
  const newTier = calcTier(newBalance, cfg)
  const newSpend = Number(member.totalSpend) + totalPaid

  await prisma.$transaction([
    prisma.loyaltyMember.update({
      where: { ownerId_branchId: { ownerId, branchId } },
      data: { totalPoints: newBalance, tier: newTier, totalSpend: newSpend },
    }),
    prisma.loyaltyPoint.create({
      data: { ownerId, branchId, tenantId, txType: 'earn', points: pts, balance: newBalance, description: description ?? `Transaksi Rp${totalPaid.toLocaleString()}`, refId },
    }),
  ])

  return { success: true, pointsEarned: pts, newBalance, tier: newTier }
}
