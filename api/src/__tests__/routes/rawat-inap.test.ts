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

// ─── Isolasi antar-cabang & antar-tenant (IDOR) ────────────────────────────────
// InPatient cuma punya branchId (tidak ada tenantId langsung). GET/PUT/status/
// DELETE by-id sebelumnya tidak filter branchId sama sekali. list/aktif/stats
// untuk admin pakai where kosong `{}` alih-alih tenant-wide — InPatient tidak
// punya tenantId jadi itu bocor ke SEMUA tenant, bukan cuma cabang lain.
const ADMIN_USER = { userId: BigInt(1), username: 'admin', fullname: 'Admin', role: 'admin' as any, branchId: BigInt(1), branchName: 'Cabang 1', tenantId: BigInt(1) }
const OTHER_TENANT_RI = { id: BigInt(50), branchId: BigInt(99), tenantId: BigInt(99), isDeleted: false, acceptanceStatus: 'pending', patient: { owner: {} } }

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    if ('isDeleted' in where && where.isDeleted !== record.isDeleted) return Promise.resolve(null)
    if ('branchId' in where && String(where.branchId) !== String(record.branchId)) return Promise.resolve(null)
    if ('branch' in where && where.branch?.tenantId !== undefined && String(where.branch.tenantId) !== String(record.tenantId)) return Promise.resolve(null)
    return Promise.resolve(record)
  })
}

describe('rawat-inap — isolasi antar-cabang & antar-tenant (IDOR)', () => {
  it('GET /rawat-inap/:id milik tenant lain harus 404', async () => {
    const { registrasiRoutes } = await import('../../modules/registrasi/registrasi.routes')
    const prisma = fullMockPrisma({ inPatient: { findFirst: simulateFindFirst(OTHER_TENANT_RI) } })
    const app = await buildApp(registrasiRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'GET', url: '/api/rawat-inap/50' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('PUT /rawat-inap/:id milik tenant lain harus 404, bukan berhasil diubah', async () => {
    const { registrasiRoutes } = await import('../../modules/registrasi/registrasi.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_RI, complaint: 'diubah' })
    const prisma = fullMockPrisma({ inPatient: { findFirst: simulateFindFirst(OTHER_TENANT_RI), update: updateMock } })
    const app = await buildApp(registrasiRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'PUT', url: '/api/rawat-inap/50', payload: { complaint: 'diubah' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('PUT /rawat-inap/:id/status milik tenant lain harus 404, bukan berhasil diubah', async () => {
    const { registrasiRoutes } = await import('../../modules/registrasi/registrasi.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_RI, acceptanceStatus: 'accepted' })
    const prisma = fullMockPrisma({ inPatient: { findFirst: simulateFindFirst(OTHER_TENANT_RI), update: updateMock } })
    const app = await buildApp(registrasiRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'PUT', url: '/api/rawat-inap/50/status', payload: { status: 'accepted' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('DELETE /rawat-inap/:id milik tenant lain harus 404, bukan terhapus', async () => {
    const { registrasiRoutes } = await import('../../modules/registrasi/registrasi.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_RI, isDeleted: true })
    const prisma = fullMockPrisma({ inPatient: { findFirst: simulateFindFirst(OTHER_TENANT_RI), update: updateMock } })
    const app = await buildApp(registrasiRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'DELETE', url: '/api/rawat-inap/50' })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('GET /rawat-inap/stats untuk admin harus tetap discope ke tenant, bukan where kosong', async () => {
    const { registrasiRoutes } = await import('../../modules/registrasi/registrasi.routes')
    const countMock = vi.fn().mockResolvedValue(0)
    const prisma = fullMockPrisma({ inPatient: { count: countMock } })
    const app = await buildApp(registrasiRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'GET', url: '/api/rawat-inap/stats' })
    expect(res.statusCode).toBe(200)
    const where = countMock.mock.calls[0][0].where
    const hasTenantScope = 'branchId' in where || ('branch' in where && 'tenantId' in (where.branch ?? {}))
    expect(hasTenantScope).toBe(true)
    await app.close()
  })

  it('GET /rawat-inap (list) untuk admin harus tetap discope ke tenant, bukan where kosong', async () => {
    const { registrasiRoutes } = await import('../../modules/registrasi/registrasi.routes')
    const findManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({ inPatient: { findMany: findManyMock, count: vi.fn().mockResolvedValue(0) } })
    const app = await buildApp(registrasiRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'GET', url: '/api/rawat-inap' })
    expect(res.statusCode).toBe(200)
    const where = findManyMock.mock.calls[0][0].where
    const hasTenantScope = 'branchId' in where || ('branch' in where && 'tenantId' in (where.branch ?? {}))
    expect(hasTenantScope).toBe(true)
    await app.close()
  })

  it('GET /rawat-inap/aktif untuk admin harus tetap discope ke tenant, bukan where kosong', async () => {
    const { registrasiRoutes } = await import('../../modules/registrasi/registrasi.routes')
    const findManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({ inPatient: { findMany: findManyMock } })
    const app = await buildApp(registrasiRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'GET', url: '/api/rawat-inap/aktif' })
    expect(res.statusCode).toBe(200)
    const where = findManyMock.mock.calls[0][0].where
    const hasTenantScope = 'branchId' in where || ('branch' in where && 'tenantId' in (where.branch ?? {}))
    expect(hasTenantScope).toBe(true)
    await app.close()
  })
})
