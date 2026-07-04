// F-09: Gudang & Inventori
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

const mockItem = {
  id: BigInt(1), itemName: 'Amoxicillin 500mg', totalItem: 100,
  limitItem: 10, branchId: BigInt(1), isDeleted: false,
  categoryItem: { categoryName: 'Obat' },
  unit: { unitName: 'Tablet' },
  prices: [{ price: 5000, isActive: true }],
}

function makePrisma() {
  return fullMockPrisma({
    listOfItem: { findMany: vi.fn().mockResolvedValue([mockItem]), findFirst: vi.fn().mockResolvedValue(mockItem), findUnique: vi.fn().mockResolvedValue(mockItem), create: vi.fn().mockResolvedValue(mockItem), update: vi.fn().mockResolvedValue(mockItem) },
    categoryItem: { findMany: vi.fn().mockResolvedValue([{ id: BigInt(1), categoryName: 'Obat' }]) },
    unitItem: { findMany: vi.fn().mockResolvedValue([{ id: BigInt(1), unitName: 'Tablet' }]) },
    priceItem: { create: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
    stockMovement: { create: vi.fn().mockResolvedValue({ id: BigInt(1), listOfItem: { unitItem: { unitName: 'Tablet' } } }) },
  })
}

describe('F-09 Gudang & Inventori', () => {
  it('GET /api/gudang/barang mengembalikan daftar barang', async () => {
    const { gudangRoutes } = await import('../../modules/gudang/gudang.routes')
    const app = await buildApp(gudangRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/gudang/barang' })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().data)).toBe(true)
    await app.close()
  })

  it('GET /api/gudang/low-stock mengembalikan barang stok rendah', async () => {
    const { gudangRoutes } = await import('../../modules/gudang/gudang.routes')
    const app = await buildApp(gudangRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/gudang/low-stock' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('POST /api/gudang/mutasi membuat mutasi stok', async () => {
    const { gudangRoutes } = await import('../../modules/gudang/gudang.routes')
    const app = await buildApp(gudangRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/gudang/mutasi',
      payload: { listOfItemId: '1', quantity: 50, status: 'masuk', notes: 'Pembelian' },
    })
    expect([200, 201]).toContain(res.statusCode)
    await app.close()
  })
})
