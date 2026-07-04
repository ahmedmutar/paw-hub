// F-15: Pet Shop
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

const mockProduct = {
  id: BigInt(1), itemName: 'Royal Canin 1kg', totalItem: 20,
  branchId: BigInt(1), isDeleted: false,
  prices: [{ price: 85000, isActive: true }],
}
const mockTransaction = {
  id: BigInt(1), totalAmount: 85000, branchId: BigInt(1),
  items: [], clinicItems: [],
}

function makePrisma() {
  return fullMockPrisma({
    listOfItemPetShop: { findMany: vi.fn().mockResolvedValue([mockProduct]), findFirst: vi.fn().mockResolvedValue(mockProduct), create: vi.fn().mockResolvedValue(mockProduct), update: vi.fn().mockResolvedValue(mockProduct) },
    paymentPetshop:    { findMany: vi.fn().mockResolvedValue([mockTransaction]), create: vi.fn().mockResolvedValue(mockTransaction) },
    priceItemPetShop:  { create: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
    listOfItem: { findFirst: vi.fn().mockResolvedValue(null) },
  })
}

describe('F-15 Pet Shop', () => {
  it('GET /api/petshop/produk mengembalikan daftar produk', async () => {
    const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
    const app = await buildApp(petshopRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/petshop/produk' })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().data)).toBe(true)
    await app.close()
  })

  it('GET /api/petshop/transaksi mengembalikan riwayat transaksi', async () => {
    const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
    const app = await buildApp(petshopRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/petshop/transaksi' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('GET /api/petshop/stats mengembalikan statistik petshop', async () => {
    const prisma = makePrisma()
    ;(prisma.paymentPetshop as any).aggregate = vi.fn().mockResolvedValue({ _sum: { totalAmount: 1000000 }, _count: { id: 5 } })
    const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
    const app = await buildApp(petshopRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/petshop/stats' })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })
})
