// F-42: Integrasi Marketplace Tokopedia/Shopee
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

const mockIntegration = { id: BigInt(1), platform: 'tokopedia', shopName: 'PawCare Official', shopId: '12345', syncEnabled: true, branchId: BigInt(1) }
const mockOrder = { id: BigInt(1), orderId: 'TK-001', platform: 'tokopedia', customerName: 'Pelanggan', totalAmount: 85000, status: 'pending', branchId: BigInt(1), integration: mockIntegration }

function makePrisma() {
  return fullMockPrisma({
    marketplaceIntegration: { findMany: vi.fn().mockResolvedValue([mockIntegration]), findFirst: vi.fn().mockResolvedValue(mockIntegration), upsert: vi.fn().mockResolvedValue(mockIntegration), update: vi.fn().mockResolvedValue(mockIntegration), delete: vi.fn().mockResolvedValue(mockIntegration), count: vi.fn().mockResolvedValue(1) },
    marketplaceOrder: { findMany: vi.fn().mockResolvedValue([mockOrder]), findFirst: vi.fn().mockResolvedValue(mockOrder), create: vi.fn().mockResolvedValue(mockOrder), update: vi.fn().mockResolvedValue(mockOrder), count: vi.fn().mockResolvedValue(1), aggregate: vi.fn().mockResolvedValue({ _sum: { totalAmount: 85000 } }) },
  })
}

describe('F-42 Integrasi Marketplace', () => {
  it('GET /api/marketplace/integrations mengembalikan daftar integrasi', async () => {
    const { marketplaceRoutes } = await import('../../modules/marketplace/marketplace.routes')
    const app = await buildApp(marketplaceRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/marketplace/integrations' })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().data)).toBe(true)
    await app.close()
  })

  it('POST /api/marketplace/connect menghubungkan marketplace baru', async () => {
    const { marketplaceRoutes } = await import('../../modules/marketplace/marketplace.routes')
    const app = await buildApp(marketplaceRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/marketplace/connect',
      payload: { platform: 'shopee', shopName: 'PawCare Shopee', shopId: '67890', accessToken: 'token-xxx' },
    })
    expect([200, 201]).toContain(res.statusCode)
    await app.close()
  })

  it('GET /api/marketplace/orders mengembalikan pesanan', async () => {
    const { marketplaceRoutes } = await import('../../modules/marketplace/marketplace.routes')
    const app = await buildApp(marketplaceRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/marketplace/orders' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('GET /api/marketplace/stats mengembalikan statistik penjualan', async () => {
    const { marketplaceRoutes } = await import('../../modules/marketplace/marketplace.routes')
    const app = await buildApp(marketplaceRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/marketplace/stats' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveProperty('totalOrders')
    await app.close()
  })

  it('POST /api/marketplace/:id/sync melakukan mock sync', async () => {
    const { marketplaceRoutes } = await import('../../modules/marketplace/marketplace.routes')
    const app = await buildApp(marketplaceRoutes, makePrisma())
    const res = await app.inject({ method: 'POST', url: '/api/marketplace/1/sync', payload: {} })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })
})

// ─── Isolasi antar-cabang (IDOR) ────────────────────────────────────────────────
// Modul ini secara konsisten scope semua endpoint list/stats pakai branchId
// langsung (bukan tenant-wide seperti modul lain), jadi fix untuk endpoint
// by-id harus ikut pola yang sama: dikunci ke branchId milik admin sendiri.
const OTHER_BRANCH_INTEGRATION = { id: BigInt(2), platform: 'shopee', shopName: 'Toko Lain', shopId: '999', syncEnabled: true, branchId: BigInt(2) }
const OTHER_BRANCH_ORDER = { id: BigInt(2), orderId: 'TK-002', platform: 'tokopedia', customerName: 'Orang Lain', totalAmount: 50000, status: 'pending', integrationId: BigInt(2), integration: OTHER_BRANCH_INTEGRATION }

describe('marketplace.routes — isolasi antar-cabang (IDOR)', () => {
  it('DELETE /:id/disconnect milik cabang lain harus 404, bukan berhasil diputus', async () => {
    const { marketplaceRoutes } = await import('../../modules/marketplace/marketplace.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_INTEGRATION, syncEnabled: false })
    const prisma = fullMockPrisma({
      marketplaceIntegration: { findFirst: vi.fn().mockResolvedValue(null), update: updateMock },
    })
    const app = await buildApp(marketplaceRoutes, prisma)

    const res = await app.inject({ method: 'DELETE', url: '/api/marketplace/2/disconnect' })

    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('POST /:id/sync milik cabang lain harus 404, bukan bikin order palsu', async () => {
    const { marketplaceRoutes } = await import('../../modules/marketplace/marketplace.routes')
    const createMock = vi.fn().mockResolvedValue({ id: BigInt(99) })
    const prisma = fullMockPrisma({
      marketplaceIntegration: { findFirst: vi.fn().mockResolvedValue(null) },
      marketplaceOrder: { create: createMock },
    })
    const app = await buildApp(marketplaceRoutes, prisma)

    const res = await app.inject({ method: 'POST', url: '/api/marketplace/2/sync', payload: {} })

    expect(res.statusCode).toBe(404)
    expect(createMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('PATCH /orders/:id milik cabang lain harus 404, bukan berhasil ubah status', async () => {
    const { marketplaceRoutes } = await import('../../modules/marketplace/marketplace.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_ORDER, status: 'completed' })
    const prisma = fullMockPrisma({
      marketplaceOrder: { findFirst: vi.fn().mockResolvedValue(null), update: updateMock },
    })
    const app = await buildApp(marketplaceRoutes, prisma)

    const res = await app.inject({ method: 'PATCH', url: '/api/marketplace/orders/2', payload: { status: 'completed' } })

    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('PATCH /orders/:id milik cabang sendiri tetap berhasil (kontrol positif)', async () => {
    const { marketplaceRoutes } = await import('../../modules/marketplace/marketplace.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...mockOrder, status: 'completed' })
    const prisma = fullMockPrisma({
      marketplaceOrder: { findFirst: vi.fn().mockResolvedValue(mockOrder), update: updateMock },
    })
    const app = await buildApp(marketplaceRoutes, prisma)

    const res = await app.inject({ method: 'PATCH', url: '/api/marketplace/orders/1', payload: { status: 'completed' } })

    expect(res.statusCode).toBe(200)
    expect(updateMock).toHaveBeenCalled()
    await app.close()
  })
})
