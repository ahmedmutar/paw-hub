// F-41: Business Intelligence & Analytics Lanjutan
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

function makePrisma() {
  return fullMockPrisma({
    owner: {
      findMany: vi.fn().mockResolvedValue([{
        id: BigInt(1), ownerName: 'Budi', phoneNumber: '08123',
        patients: [{ registrations: [{ createdAt: new Date(), checkUpResults: [{ listOfPayments: [{ totalPayment: 100000 }] }] }] }],
        loyaltyMembers: [],
      }]),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([{
        id: BigInt(2), fullname: 'Dr. Andi',
        registrations: [{ checkUpResults: [{ listOfPayments: [{ totalPayment: 500000 }] }] }],
        reviewsAsDoctor: [{ rating: 5 }],
      }]),
    },
    listOfItem: {
      findMany: vi.fn().mockResolvedValue([{
        id: BigInt(1), itemName: 'Amoxicillin', totalItem: 50, limitItem: 10,
        stockMovements: [{ quantity: 10 }],
        unit: { unitName: 'Tablet' },
      }]),
    },
    registration: {
      findMany: vi.fn().mockResolvedValue([{ createdAt: new Date() }]),
    },
    checkUpResult: {
      findMany: vi.fn().mockResolvedValue([{ diagnosis: 'Infeksi Bakteri' }]),
    },
  })
}

describe('F-41 Business Intelligence', () => {
  it('GET /api/analytics/ltv mengembalikan customer LTV', async () => {
    const { analyticsRoutes } = await import('../../modules/analytics/analytics.routes')
    const app = await buildApp(analyticsRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/analytics/ltv' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    await app.close()
  })

  it('GET /api/analytics/churn mengembalikan churn detection', async () => {
    const { analyticsRoutes } = await import('../../modules/analytics/analytics.routes')
    const app = await buildApp(analyticsRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/analytics/churn' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('GET /api/analytics/doctor-performance mengembalikan kinerja dokter', async () => {
    const { analyticsRoutes } = await import('../../modules/analytics/analytics.routes')
    const app = await buildApp(analyticsRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/analytics/doctor-performance' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('GET /api/analytics/stock-forecast mengembalikan forecast stok', async () => {
    const { analyticsRoutes } = await import('../../modules/analytics/analytics.routes')
    const app = await buildApp(analyticsRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/analytics/stock-forecast' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('GET /api/analytics/heatmap mengembalikan heatmap jam tersibuk', async () => {
    const { analyticsRoutes } = await import('../../modules/analytics/analytics.routes')
    const app = await buildApp(analyticsRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/analytics/heatmap' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveProperty('heatmap')
    await app.close()
  })

  it('GET /api/analytics/diagnosis-trend mengembalikan tren diagnosis', async () => {
    const { analyticsRoutes } = await import('../../modules/analytics/analytics.routes')
    const app = await buildApp(analyticsRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/analytics/diagnosis-trend' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
