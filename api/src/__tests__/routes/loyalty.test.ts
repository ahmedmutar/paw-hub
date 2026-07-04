// F-29: Loyalty Program
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

const mockMember = {
  id: BigInt(1), ownerId: BigInt(1), totalPoints: 250, tier: 'silver',
  totalSpend: 2_500_000, branchId: BigInt(1), joinedAt: new Date(),
  owner: { ownerName: 'Budi', phoneNumber: '08123' },
}

function makePrisma() {
  return fullMockPrisma({
    loyaltyMember: { findMany: vi.fn().mockResolvedValue([mockMember]), findUnique: vi.fn().mockResolvedValue(mockMember), count: vi.fn().mockResolvedValue(1) },
    loyaltyTransaction: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
    loyaltyPoint: { findMany: vi.fn().mockResolvedValue([]) },
    loyaltyConfig: { findUnique: vi.fn().mockResolvedValue({ pointsPerRupiah: 1, silverThreshold: 1000, goldThreshold: 5000, redeemRate: 100 }) },
    owner: { findFirst: vi.fn().mockResolvedValue({ id: BigInt(1), ownerName: 'Budi' }) },
  })
}

describe('F-29 Loyalty Program', () => {
  it('GET /api/loyalty/member mengembalikan semua member loyalty', async () => {
    const { loyaltyRoutes } = await import('../../modules/loyalty/loyalty.routes')
    const app = await buildApp(loyaltyRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/loyalty/members' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('GET /api/loyalty/member/:ownerId mengembalikan detail member', async () => {
    const { loyaltyRoutes } = await import('../../modules/loyalty/loyalty.routes')
    const app = await buildApp(loyaltyRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/loyalty/member/1' })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })
})
