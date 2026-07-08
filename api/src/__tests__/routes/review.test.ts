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

// ─── Isolasi antar-cabang (IDOR) ────────────────────────────────────────────────
// ReviewRecord/Registration punya branchId. List/stats sudah benar dikunci ke
// branchId sendiri, tapi POST /review/send dan PATCH /review/:id/publish
// sebelumnya sama sekali tidak filter branchId.
const OTHER_BRANCH_REG = { id: BigInt(50), branchId: BigInt(2), patientId: BigInt(1), doctorUserId: BigInt(2), review: null, patient: { petName: 'Kucing Lain', owner: { ownerName: 'Orang Lain', phoneNumber: '08199999999' } }, doctor: {} }

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    if ('branchId' in where && String(where.branchId) !== String(record.branchId)) return Promise.resolve(null)
    return Promise.resolve(record)
  })
}

describe('review.routes — isolasi antar-cabang (IDOR)', () => {
  it('POST /review/send untuk registrasi milik cabang lain harus 404, bukan berhasil dikirim', async () => {
    const { reviewRoutes } = await import('../../modules/review/review.routes')
    const createMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      registration: { findFirst: simulateFindFirst(OTHER_BRANCH_REG) },
      reviewRecord: { create: createMock },
    })
    const app = await buildApp(reviewRoutes, prisma)
    const res = await app.inject({ method: 'POST', url: '/api/review/send', payload: { registrationId: '50' } })
    expect(res.statusCode).toBe(404)
    expect(createMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('PATCH /review/:id/publish milik cabang lain harus 404, bukan berhasil diubah', async () => {
    const { reviewRoutes } = await import('../../modules/review/review.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...mockReview, isPublished: true })
    const prisma = fullMockPrisma({
      reviewRecord: { findFirst: simulateFindFirst({ id: BigInt(50), branchId: BigInt(2) }), update: updateMock },
    })
    const app = await buildApp(reviewRoutes, prisma)
    const res = await app.inject({ method: 'PATCH', url: '/api/review/50/publish', payload: { isPublished: true } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })
})
