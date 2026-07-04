// F-14: Penggajian Staf
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

const mockPayroll = {
  id: BigInt(1), userEmployeeId: BigInt(2), branchId: BigInt(1), createdById: BigInt(1),
  periodMonth: 6, periodYear: 2026, basicSallary: 5_000_000, totalOverall: 5_500_000,
  isDeleted: false,
  employee: { id: BigInt(2), fullname: 'Dr. Andi', username: 'andi', role: 'dokter' },
  createdBy: null, branch: null,
}

function makePrisma() {
  return fullMockPrisma({
    payroll: { findMany: vi.fn().mockResolvedValue([mockPayroll]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(mockPayroll), update: vi.fn().mockResolvedValue(mockPayroll) },
    user: { findMany: vi.fn().mockResolvedValue([{ id: BigInt(2), fullname: 'Dr. Andi', username: 'andi', role: 'dokter' }]), findFirst: vi.fn().mockResolvedValue({ id: BigInt(2), fullname: 'Dr. Andi' }) },
  })
}

describe('F-14 Penggajian Staf', () => {
  it('GET /api/penggajian mengembalikan daftar slip gaji', async () => {
    const { penggajianRoutes } = await import('../../modules/penggajian/penggajian.routes')
    const app = await buildApp(penggajianRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/penggajian' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('POST /api/penggajian membuat slip gaji baru', async () => {
    const { penggajianRoutes } = await import('../../modules/penggajian/penggajian.routes')
    const app = await buildApp(penggajianRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/penggajian',
      payload: {
        userEmployeeId: '2', branchId: '1', datePayed: '2026-06-30',
        periodMonth: 6, periodYear: 2026, basicSallary: 5000000,
      },
    })
    expect([200, 201]).toContain(res.statusCode)
    await app.close()
  })

  it('GET /api/penggajian/rekap mengembalikan rekap bulanan', async () => {
    const { penggajianRoutes } = await import('../../modules/penggajian/penggajian.routes')
    const app = await buildApp(penggajianRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/penggajian/rekap?month=6&year=2026' })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })
})
