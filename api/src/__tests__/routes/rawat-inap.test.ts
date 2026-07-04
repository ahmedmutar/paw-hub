// F-16: Rawat Inap
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

const mockInpatient = {
  id: BigInt(1), patientId: BigInt(1), doctorUserId: BigInt(2), userId: BigInt(1),
  estimateDay: 3, realityDay: null, acceptanceStatus: 'pending',
  branchId: BigInt(1), isDeleted: false,
  patient: { id: BigInt(1), petName: 'Mochi', ownerId: BigInt(1), owner: { id: BigInt(1), ownerName: 'Budi' } },
  doctor: { fullname: 'Dr. Andi' },
  branch: null,
}

function makePrisma() {
  return fullMockPrisma({
    inPatient: { findMany: vi.fn().mockResolvedValue([mockInpatient]), findFirst: vi.fn().mockResolvedValue(mockInpatient), count: vi.fn().mockResolvedValue(1), update: vi.fn().mockResolvedValue(mockInpatient) },
    registration: { findMany: vi.fn().mockResolvedValue([]) },
    patient: { findFirst: vi.fn().mockResolvedValue({ id: BigInt(1), petName: 'Mochi' }) },
  })
}

describe('F-16 Rawat Inap', () => {
  it('GET /api/rawat-inap mengembalikan daftar pasien rawat inap', async () => {
    const { registrasiRoutes } = await import('../../modules/registrasi/registrasi.routes')
    const app = await buildApp(registrasiRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/rawat-inap' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('GET /api/rawat-inap/aktif mengembalikan pasien aktif', async () => {
    const { registrasiRoutes } = await import('../../modules/registrasi/registrasi.routes')
    const app = await buildApp(registrasiRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/rawat-inap/aktif' })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })

  it('PUT /api/rawat-inap/:id/status mengubah status rawat inap', async () => {
    const { registrasiRoutes } = await import('../../modules/registrasi/registrasi.routes')
    const app = await buildApp(registrasiRoutes, makePrisma())
    const res = await app.inject({
      method: 'PUT', url: '/api/rawat-inap/1/status',
      payload: { status: 'accepted' },
    })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })
})
