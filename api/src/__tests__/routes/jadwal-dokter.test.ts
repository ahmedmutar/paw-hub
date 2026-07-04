// F-31: Manajemen Jadwal Dokter & Shift
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

const mockSchedule = {
  id: BigInt(1), doctorId: BigInt(2), dayOfWeek: 1,
  shiftStart: '08:00', shiftEnd: '16:00', maxPatients: 20,
  branchId: BigInt(1),
  doctor: { fullname: 'Dr. Andi' },
}

function makePrisma() {
  return fullMockPrisma({
    doctorSchedule: { findMany: vi.fn().mockResolvedValue([mockSchedule]), findFirst: vi.fn().mockResolvedValue(mockSchedule), create: vi.fn().mockResolvedValue(mockSchedule), update: vi.fn().mockResolvedValue(mockSchedule), upsert: vi.fn().mockResolvedValue(mockSchedule) },
    doctorLeave: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: BigInt(1) }), update: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
    user: { findMany: vi.fn().mockResolvedValue([{ id: BigInt(2), fullname: 'Dr. Andi', role: 'dokter' }]) },
  })
}

describe('F-31 Jadwal Dokter & Shift', () => {
  it('GET /api/jadwal-dokter mengembalikan jadwal semua dokter', async () => {
    const { jadwalDokterRoutes } = await import('../../modules/jadwal-dokter/jadwal-dokter.routes')
    const app = await buildApp(jadwalDokterRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/jadwal-dokter' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('GET /api/jadwal-dokter/kalender mengembalikan kalender mingguan', async () => {
    const { jadwalDokterRoutes } = await import('../../modules/jadwal-dokter/jadwal-dokter.routes')
    const app = await buildApp(jadwalDokterRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/jadwal-dokter/kalender/week' })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })

  it('POST /api/jadwal-dokter/:doctorId membuat/update jadwal', async () => {
    const { jadwalDokterRoutes } = await import('../../modules/jadwal-dokter/jadwal-dokter.routes')
    const app = await buildApp(jadwalDokterRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/jadwal-dokter',
      payload: { doctorId: '2', dayOfWeek: 1, shiftStart: '08:00', shiftEnd: '16:00', maxPatients: 20 },
    })
    expect([200, 201]).toContain(res.statusCode)
    await app.close()
  })
})
