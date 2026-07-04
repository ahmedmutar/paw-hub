// F-34: Manajemen Lab & Hasil Pemeriksaan
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

const mockRequest = {
  id: BigInt(1), patientId: BigInt(1), doctorId: BigInt(2),
  testType: 'hematologi', status: 'pending', isReady: false,
  branchId: BigInt(1),
  patient: { petName: 'Mochi', owner: { ownerName: 'Budi', phoneNumber: '08123' } },
  doctor: { fullname: 'Dr. Andi' },
  results: [],
}

function makePrisma() {
  return fullMockPrisma({
    labRequest: { findMany: vi.fn().mockResolvedValue([mockRequest]), findFirst: vi.fn().mockResolvedValue(mockRequest), create: vi.fn().mockResolvedValue(mockRequest), update: vi.fn().mockResolvedValue(mockRequest) },
    labResult:  { create: vi.fn().mockResolvedValue({ id: BigInt(1) }), findMany: vi.fn().mockResolvedValue([]) },
    patient:    { findFirst: vi.fn().mockResolvedValue({ id: BigInt(1), petName: 'Mochi', owner: { ownerName: 'Budi', phoneNumber: '08123' } }) },
  })
}

describe('F-34 Manajemen Lab', () => {
  it('GET /api/lab/templates mengembalikan template lab', async () => {
    const { labRoutes } = await import('../../modules/lab/lab.routes')
    const app = await buildApp(labRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/lab/templates' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    const keys = body.data.map((t: any) => t.key)
    expect(keys).toContain('hematologi')
    await app.close()
  })

  it('GET /api/lab/request mengembalikan daftar permintaan lab', async () => {
    const { labRoutes } = await import('../../modules/lab/lab.routes')
    const app = await buildApp(labRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/lab/request' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('POST /api/lab/request membuat permintaan lab baru', async () => {
    const { labRoutes } = await import('../../modules/lab/lab.routes')
    const app = await buildApp(labRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/lab/request',
      payload: { patientId: '1', testType: 'hematologi', notes: 'Cek anemia' },
    })
    expect([200, 201]).toContain(res.statusCode)
    await app.close()
  })

  it('GET /api/lab/history/:patientId mengembalikan riwayat lab', async () => {
    const { labRoutes } = await import('../../modules/lab/lab.routes')
    const app = await buildApp(labRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/lab/history/1' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
