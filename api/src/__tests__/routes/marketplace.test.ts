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
