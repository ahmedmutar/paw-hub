import { describe, it, vi } from 'vitest'
import { buildApp, fullMockPrisma } from '../helpers/buildApp'
vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))
global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

describe('debug4', () => {
  it('penggajian', async () => {
    const mockPayroll = { id: BigInt(1), userEmployeeId: BigInt(2), branchId: BigInt(1), createdById: BigInt(1), periodMonth: 6, periodYear: 2026, basicSallary: 5000000, totalOverall: 5500000, isDeleted: false, employee: { id: BigInt(2), fullname: 'Dr.A', username: 'dra', role: 'dokter' }, createdBy: null, branch: null }
    const prisma = fullMockPrisma({ payroll: { findMany: vi.fn().mockResolvedValue([mockPayroll]) } })
    const { penggajianRoutes } = await import('../../modules/penggajian/penggajian.routes')
    const app = await buildApp(penggajianRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/penggajian' })
    console.log('penggajian', res.statusCode, res.body.substring(0, 200))
    await app.close()
  })
  it('review/list', async () => {
    const mockReview = { id: BigInt(1), rating: 5, comment: 'Bagus', isPublished: false, branchId: BigInt(1), createdAt: new Date(), patientId: BigInt(1), doctorUserId: BigInt(1), patient: { petName: 'Mochi', petCategory: 'Kucing' }, doctor: { fullname: 'Dr. Andi' } }
    const prisma = fullMockPrisma({ reviewRecord: { findMany: vi.fn().mockResolvedValue([mockReview]), count: vi.fn().mockResolvedValue(1), aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 4.5 }, _count: { id: 10 } }) } })
    const { reviewRoutes } = await import('../../modules/review/review.routes')
    const app = await buildApp(reviewRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/review/list' })
    console.log('review/list', res.statusCode, res.body.substring(0, 300))
    await app.close()
  })
  it('gudang mutasi', async () => {
    const mockItem = { id: BigInt(1), itemName: 'Amox', totalItem: 100, limitItem: 10, branchId: BigInt(1), isDeleted: false }
    const prisma = fullMockPrisma({ listOfItem: { findFirst: vi.fn().mockResolvedValue(mockItem), update: vi.fn().mockResolvedValue(mockItem) }, stockMovement: { create: vi.fn().mockResolvedValue({ id: BigInt(1) }) } })
    const { gudangRoutes } = await import('../../modules/gudang/gudang.routes')
    const app = await buildApp(gudangRoutes, prisma)
    const res = await app.inject({ method: 'POST', url: '/api/gudang/mutasi', payload: { itemId: '1', quantity: 50, status: 'masuk', description: 'Pembelian' } })
    console.log('gudang mutasi', res.statusCode, res.body.substring(0, 300))
    await app.close()
  })
  it('telemed request', async () => {
    const prisma = fullMockPrisma({
      patient: { findFirst: vi.fn().mockResolvedValue({ id: BigInt(1), petName: 'Mochi', owner: { ownerName: 'Budi', phoneNumber: '08123' } }) },
      user: { findFirst: vi.fn().mockResolvedValue({ id: BigInt(2), fullname: 'Dr. Andi' }) },
      telemedSession: { create: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
    })
    const { telemedRoutes } = await import('../../modules/telemed/telemed.routes')
    const app = await buildApp(telemedRoutes, prisma)
    const res = await app.inject({ method: 'POST', url: '/api/telemed/request', payload: { patientId: '1', doctorId: '2', channel: 'chat', scheduledAt: '2026-07-01T09:00:00Z', complaint: 'Demam', fee: 100000 } })
    console.log('telemed', res.statusCode, res.body.substring(0, 300))
    await app.close()
  })
})
