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

// ─── Isolasi antar-cabang (IDOR) ────────────────────────────────────────────────
// PATCH /request/:id/result sebelumnya TIDAK punya requireRole sama sekali
// (staf manapun bisa tulis/timpa hasil lab), dan GET /history/:patientId juga
// tidak filter branchId sama sekali. List (/lab/request) sudah benar pakai
// `role !== 'superadmin' && { branchId }`.
const OTHER_BRANCH_REQUEST = { id: BigInt(50), branchId: BigInt(2), testType: 'hematologi', patient: { petName: 'Kucing Lain', owner: { ownerName: 'Orang Lain', phoneNumber: '08199999999' } } }
const OWN_REQUEST = { ...mockRequest }

describe('lab.routes — isolasi antar-cabang (IDOR)', () => {
  it('PATCH /lab/request/:id/result milik cabang lain harus 404, bukan berhasil tulis hasil', async () => {
    const { labRoutes } = await import('../../modules/lab/lab.routes')
    const upsertMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      labRequest: { findFirst: vi.fn().mockResolvedValue(null) },
      labResult: { upsert: upsertMock },
    })
    const app = await buildApp(labRoutes, prisma)
    const res = await app.inject({ method: 'PATCH', url: '/api/lab/request/50/result', payload: { isReady: true } })
    expect(res.statusCode).toBe(404)
    expect(upsertMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('PATCH /lab/request/:id/result milik cabang sendiri tetap berhasil (kontrol positif)', async () => {
    const { labRoutes } = await import('../../modules/lab/lab.routes')
    const upsertMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      labRequest: { findFirst: vi.fn().mockResolvedValue(OWN_REQUEST) },
      labResult: { upsert: upsertMock },
    })
    const app = await buildApp(labRoutes, prisma)
    const res = await app.inject({ method: 'PATCH', url: '/api/lab/request/1/result', payload: { isReady: false } })
    expect(res.statusCode).toBe(200)
    expect(upsertMock).toHaveBeenCalled()
    await app.close()
  })

  it('GET /lab/history/:patientId untuk staf non-superadmin harus tetap discope ke cabang sendiri', async () => {
    const { labRoutes } = await import('../../modules/lab/lab.routes')
    const findManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({ labRequest: { findMany: findManyMock } })
    const app = await buildApp(labRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/lab/history/1' })
    expect(res.statusCode).toBe(200)
    const where = findManyMock.mock.calls[0][0].where
    expect('branchId' in where).toBe(true)
    await app.close()
  })
})
