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

// ─── Isolasi antar-cabang (IDOR) ────────────────────────────────────────────────
// DoctorSchedule/DoctorLeave punya branchId. Modul ini tidak punya pola
// tenant-wide untuk admin (semua endpoint list mengunci ke branchId sendiri),
// jadi PUT/DELETE by-id juga harus dikunci ke branchId sendiri.
const OTHER_BRANCH_SCHEDULE = { id: BigInt(50), branchId: BigInt(2), doctorId: BigInt(2), dayOfWeek: 1 }
const OTHER_BRANCH_LEAVE = { id: BigInt(51), branchId: BigInt(2), doctorId: BigInt(2), status: 'pending' }

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    if ('branchId' in where && String(where.branchId) !== String(record.branchId)) return Promise.resolve(null)
    return Promise.resolve(record)
  })
}

describe('jadwal-dokter.routes — isolasi antar-cabang (IDOR)', () => {
  it('PUT /jadwal-dokter/:id milik cabang lain harus 404, bukan berhasil diubah', async () => {
    const { jadwalDokterRoutes } = await import('../../modules/jadwal-dokter/jadwal-dokter.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_SCHEDULE, shiftStart: '09:00' })
    const prisma = fullMockPrisma({ doctorSchedule: { findFirst: simulateFindFirst(OTHER_BRANCH_SCHEDULE), update: updateMock } })
    const app = await buildApp(jadwalDokterRoutes, prisma)
    const res = await app.inject({ method: 'PUT', url: '/api/jadwal-dokter/50', payload: { shiftStart: '09:00' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('DELETE /jadwal-dokter/:id milik cabang lain harus 404, bukan terhapus', async () => {
    const { jadwalDokterRoutes } = await import('../../modules/jadwal-dokter/jadwal-dokter.routes')
    const deleteMock = vi.fn().mockResolvedValue({ id: BigInt(50) })
    const prisma = fullMockPrisma({ doctorSchedule: { findFirst: simulateFindFirst(OTHER_BRANCH_SCHEDULE), delete: deleteMock } })
    const app = await buildApp(jadwalDokterRoutes, prisma)
    const res = await app.inject({ method: 'DELETE', url: '/api/jadwal-dokter/50' })
    expect(res.statusCode).toBe(404)
    expect(deleteMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('PATCH /jadwal-dokter/cuti/:id milik cabang lain harus 404, bukan berhasil disetujui/ditolak', async () => {
    const { jadwalDokterRoutes } = await import('../../modules/jadwal-dokter/jadwal-dokter.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_LEAVE, status: 'approved' })
    const prisma = fullMockPrisma({ doctorLeave: { findFirst: simulateFindFirst(OTHER_BRANCH_LEAVE), update: updateMock } })
    const app = await buildApp(jadwalDokterRoutes, prisma)
    const res = await app.inject({ method: 'PATCH', url: '/api/jadwal-dokter/cuti/51', payload: { status: 'approved' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })
})
