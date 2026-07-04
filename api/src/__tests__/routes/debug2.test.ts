import { describe, it, vi } from 'vitest'
import { buildApp, fullMockPrisma } from '../helpers/buildApp'
vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))
global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

describe('debug2', () => {
  it('GET /api/gudang/barang', async () => {
    const prisma = fullMockPrisma({
      listOfItem: { findMany: vi.fn().mockResolvedValue([{ id: BigInt(1), itemName: 'Test', totalItem: 10, limitItem: 5 }]), count: vi.fn().mockResolvedValue(1) },
    })
    const { gudangRoutes } = await import('../../modules/gudang/gudang.routes')
    const app = await buildApp(gudangRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/gudang/barang' })
    console.log('gudang STATUS:', res.statusCode, 'BODY:', res.body.substring(0, 200))
    await app.close()
  })
  it('GET /api/pet-hotel/kamar', async () => {
    const prisma = fullMockPrisma({
      hotelRoom: { findMany: vi.fn().mockResolvedValue([{ id: BigInt(1), roomName: 'VIP-1', roomType: 'vip', pricePerNight: 150000, isOccupied: false, branchId: BigInt(1) }]) },
    })
    const { petHotelRoutes } = await import('../../modules/pet-hotel/pet-hotel.routes')
    const app = await buildApp(petHotelRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/pet-hotel/kamar' })
    console.log('pet-hotel STATUS:', res.statusCode, 'BODY:', res.body.substring(0, 200))
    await app.close()
  })
  it('GET /api/loyalty/member', async () => {
    const prisma = fullMockPrisma({
      loyaltyMember: { findMany: vi.fn().mockResolvedValue([{ id: BigInt(1), ownerId: BigInt(1), totalPoints: 250, tier: 'silver', totalSpend: 2500000, branchId: BigInt(1), owner: { ownerName: 'Budi', phoneNumber: '08123' } }]) },
    })
    const { loyaltyRoutes } = await import('../../modules/loyalty/loyalty.routes')
    const app = await buildApp(loyaltyRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/loyalty/member' })
    console.log('loyalty STATUS:', res.statusCode, 'BODY:', res.body.substring(0, 200))
    await app.close()
  })
})
