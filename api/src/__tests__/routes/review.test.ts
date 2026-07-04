// F-30: Rating & Ulasan
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

const mockReview = {
  id: BigInt(1), rating: 5, comment: 'Dokternya ramah!',
  isPublished: false, branchId: BigInt(1), sentAt: new Date(), repliedAt: null,
  patient: { petName: 'Mochi' },
  doctor: { fullname: 'Dr. Andi' },
  registration: { createdAt: new Date() },
}

function makePrisma() {
  return fullMockPrisma({
    reviewRecord: { findMany: vi.fn().mockResolvedValue([mockReview]), count: vi.fn().mockResolvedValue(1), aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 4.5 }, _count: { id: 10 } }), groupBy: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
  })
}

describe('F-30 Rating & Ulasan', () => {
  it('GET /api/review/list mengembalikan daftar ulasan', async () => {
    const { reviewRoutes } = await import('../../modules/review/review.routes')
    const app = await buildApp(reviewRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/review/list' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('GET /api/review/stats mengembalikan statistik rating', async () => {
    const { reviewRoutes } = await import('../../modules/review/review.routes')
    const app = await buildApp(reviewRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/review/stats' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('PATCH review - publish ulasan terbaik', async () => {
    const { reviewRoutes } = await import('../../modules/review/review.routes')
    const app = await buildApp(reviewRoutes, makePrisma())
    const res = await app.inject({
      method: 'PATCH', url: '/api/review/1/publish',
      payload: { isPublished: true },
    })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })
})
