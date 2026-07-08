// F-04: Data Pasien (Hewan)
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

const mockOwner = { id: BigInt(1), ownerName: 'Budi', phoneNumber: '08123456789', email: 'budi@mail.com', address: 'Jakarta', isDeleted: false }
const mockPatient = { id: BigInt(1), petName: 'Mochi', petCategory: 'Kucing', gender: 'Jantan', ownerId: BigInt(1), branchId: BigInt(1), owner: mockOwner, isDeleted: false }

function makePrisma() {
  return fullMockPrisma({
    owner:   { findMany: vi.fn().mockResolvedValue([mockOwner]), findFirst: vi.fn().mockResolvedValue(mockOwner), create: vi.fn().mockResolvedValue(mockOwner) },
    patient: { findMany: vi.fn().mockResolvedValue([mockPatient]), findFirst: vi.fn().mockResolvedValue(mockPatient), create: vi.fn().mockResolvedValue(mockPatient), count: vi.fn().mockResolvedValue(1) },
  })
}

describe('F-04 Data Pasien', () => {
  it('GET /api/pasien mengembalikan daftar pasien', async () => {
    const { pasienRoutes } = await import('../../modules/pasien/pasien.routes')
    const app = await buildApp(pasienRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/pasien' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    await app.close()
  })

  it('POST /api/pasien membuat pasien baru', async () => {
    const { pasienRoutes } = await import('../../modules/pasien/pasien.routes')
    const app = await buildApp(pasienRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/pasien',
      payload: {
        petName: 'Mochi', petCategory: 'Kucing', breed: 'Persia',
        gender: 'Jantan', birthDate: '2022-01-01',
        ownerName: 'Budi', phoneNumber: '08123456789',
        email: 'budi@mail.com', address: 'Jakarta',
      },
    })
    expect(res.statusCode).toBe(201)
    await app.close()
  })

  it('GET /api/pasien/:id mengembalikan detail pasien', async () => {
    const { pasienRoutes } = await import('../../modules/pasien/pasien.routes')
    const app = await buildApp(pasienRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/pasien/1' })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })
})

// ─── Isolasi antar-cabang (IDOR) ────────────────────────────────────────────────
// Patient/Owner punya branchId langsung. Modul ini tidak punya pola
// tenant-wide untuk admin (list & stats mengunci SEMUA role ke branchId
// sendiri), jadi endpoint by-id juga harus dikunci ke branchId sendiri.
// PUT/DELETE sebelumnya TIDAK punya requireRole sama sekali dan tidak cek
// kepemilikan cabang sama sekali (blind update).
const OTHER_BRANCH_PATIENT = { id: BigInt(50), petName: 'Kucing Lain', petCategory: 'Kucing', ownerId: BigInt(2), branchId: BigInt(2), isDeleted: false }
const OTHER_BRANCH_OWNER = { id: BigInt(51), ownerName: 'Orang Lain', branchId: BigInt(2), isDeleted: false }

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    if ('branchId' in where && String(where.branchId) !== String(record.branchId)) return Promise.resolve(null)
    if ('isDeleted' in where && where.isDeleted !== record.isDeleted) return Promise.resolve(null)
    return Promise.resolve(record)
  })
}

describe('pasien.routes — isolasi antar-cabang (IDOR)', () => {
  it('GET /pasien/:id milik cabang lain harus 404', async () => {
    const { pasienRoutes } = await import('../../modules/pasien/pasien.routes')
    const prisma = fullMockPrisma({ patient: { findFirst: simulateFindFirst(OTHER_BRANCH_PATIENT) } })
    const app = await buildApp(pasienRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/pasien/50' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('PUT /pasien/:id milik cabang lain harus 404, bukan berhasil diubah', async () => {
    const { pasienRoutes } = await import('../../modules/pasien/pasien.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_PATIENT, petName: 'Diubah' })
    const prisma = fullMockPrisma({ patient: { findFirst: simulateFindFirst(OTHER_BRANCH_PATIENT), update: updateMock } })
    const app = await buildApp(pasienRoutes, prisma)
    const res = await app.inject({ method: 'PUT', url: '/api/pasien/50', payload: { petName: 'Diubah' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('PUT /pemilik/:id milik cabang lain harus 404, bukan berhasil diubah', async () => {
    const { pasienRoutes } = await import('../../modules/pasien/pasien.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_OWNER, ownerName: 'Diubah' })
    const prisma = fullMockPrisma({ owner: { findFirst: simulateFindFirst(OTHER_BRANCH_OWNER), update: updateMock } })
    const app = await buildApp(pasienRoutes, prisma)
    const res = await app.inject({ method: 'PUT', url: '/api/pemilik/51', payload: { ownerName: 'Diubah' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('DELETE /pasien/:id milik cabang lain harus 404, bukan terhapus', async () => {
    const { pasienRoutes } = await import('../../modules/pasien/pasien.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_PATIENT, isDeleted: true })
    const prisma = fullMockPrisma({
      patient: { findFirst: simulateFindFirst(OTHER_BRANCH_PATIENT), update: updateMock },
      registration: { findFirst: vi.fn().mockResolvedValue(null) },
    })
    const app = await buildApp(pasienRoutes, prisma)
    const res = await app.inject({ method: 'DELETE', url: '/api/pasien/50' })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })
})
