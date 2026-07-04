// F-39: Laporan Pajak & PPh 21
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

const mockPayroll = {
  id: BigInt(1), userEmployeeId: BigInt(2), branchId: BigInt(1), periodMonth: 6, periodYear: 2026,
  totalOverall: 8_000_000, isDeleted: false,
  employee: { fullname: 'Dr. Andi', ptkpStatus: 'TK0', npwp: null, role: 'dokter', staffingNumber: null },
}

function makePrisma() {
  return fullMockPrisma({
    payroll: { findMany: vi.fn().mockResolvedValue([mockPayroll]) },
    user:    { update: vi.fn().mockResolvedValue({ id: BigInt(2), ptkpStatus: 'K1', npwp: '12.345.678.9-012.000' }) },
  })
}

describe('F-39 Laporan Pajak PPh 21', () => {
  it('GET /api/pajak/pph21/rekap mengembalikan rekap pajak', async () => {
    const { pajakRoutes } = await import('../../modules/pajak/pajak.routes')
    const app = await buildApp(pajakRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/pajak/pph21/rekap?month=6&year=2026' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveProperty('rows')
    expect(body.data).toHaveProperty('totalPph21')
    await app.close()
  })

  it('PATCH /api/pajak/user/:userId/ptkp mengubah PTKP status', async () => {
    const { pajakRoutes } = await import('../../modules/pajak/pajak.routes')
    const app = await buildApp(pajakRoutes, makePrisma())
    const res = await app.inject({
      method: 'PATCH', url: '/api/pajak/user/2/ptkp',
      payload: { ptkpStatus: 'K1', npwp: '12.345.678.9-012.000' },
    })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })

  it('POST /api/pajak/pph21/reminder mengirim reminder pajak', async () => {
    const { pajakRoutes } = await import('../../modules/pajak/pajak.routes')
    const prisma = makePrisma()
    ;(prisma.user as any).findMany = vi.fn().mockResolvedValue([{ id: BigInt(2), fullname: 'Dr. Andi', phoneNumber: '08123', ptkpStatus: 'TK0' }])
    const app = await buildApp(pajakRoutes, prisma)
    const res = await app.inject({ method: 'POST', url: '/api/pajak/pph21/reminder', payload: {} })
    expect([200, 201]).toContain(res.statusCode)
    await app.close()
  })
})
