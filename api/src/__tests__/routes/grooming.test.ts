// F-21: Grooming Standalone
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

const mockSession = {
  id: BigInt(1), patientId: BigInt(1), groomerId: BigInt(2),
  packageId: BigInt(0), userId: BigInt(1),
  status: 'antrian', scheduledAt: new Date(), branchId: BigInt(1),
  patient: { id: BigInt(1), petName: 'Mochi', owner: { id: BigInt(1), ownerName: 'Budi', phoneNumber: '08123' } },
  groomer: { id: BigInt(2), fullname: 'Sari' },
  package: null, branch: null, services: [],
}

function makePrisma() {
  return fullMockPrisma({
    groomingSession: { findMany: vi.fn().mockResolvedValue([mockSession]), findFirst: vi.fn().mockResolvedValue(mockSession), create: vi.fn().mockResolvedValue(mockSession), update: vi.fn().mockResolvedValue(mockSession) },
    patient: { findFirst: vi.fn().mockResolvedValue({ id: BigInt(1), petName: 'Mochi', owner: { ownerName: 'Budi', phoneNumber: '08123' } }) },
    user: { findFirst: vi.fn().mockResolvedValue({ id: BigInt(2), fullname: 'Sari' }) },
    listOfService: { findMany: vi.fn().mockResolvedValue([]) },
    paymentGrooming: { findMany: vi.fn().mockResolvedValue([]) },
  })
}

describe('F-21 Grooming Standalone', () => {
  it('GET /api/grooming/antrian mengembalikan antrian grooming', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const app = await buildApp(groomingRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/grooming/antrian' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('GET /api/grooming/sesi mengembalikan semua sesi', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const app = await buildApp(groomingRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/grooming/sesi' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})

// ─── Isolasi antar-cabang & antar-tenant (IDOR) ────────────────────────────────
// GroomingSession/GroomingPackage cuma punya branchId (tidak ada tenantId
// langsung). List/stats/antrian untuk admin pakai where kosong `{}` — bocor
// ke SEMUA tenant. By-id (sesi & paket) sama sekali tidak filter branchId.
const ADMIN_USER = { userId: BigInt(1), username: 'admin', fullname: 'Admin', role: 'admin' as any, branchId: BigInt(1), branchName: 'Cabang 1', tenantId: BigInt(1) }
const OTHER_TENANT_SESSION = { id: BigInt(50), branchId: BigInt(99), tenantId: BigInt(99), isDeleted: false, status: 'waiting', patientId: BigInt(1), groomerId: BigInt(2), packageId: BigInt(1), userId: BigInt(1), totalPrice: 0, discount: 0 }
const OTHER_TENANT_PACKAGE = { id: BigInt(51), branchId: BigInt(99), tenantId: BigInt(99), isDeleted: false, isActive: true, price: 100000 }

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    if ('isDeleted' in where && where.isDeleted !== record.isDeleted) return Promise.resolve(null)
    if ('isActive' in where && where.isActive !== record.isActive) return Promise.resolve(null)
    if ('branchId' in where && String(where.branchId) !== String(record.branchId)) return Promise.resolve(null)
    if ('branch' in where && where.branch?.tenantId !== undefined && String(where.branch.tenantId) !== String(record.tenantId)) return Promise.resolve(null)
    return Promise.resolve(record)
  })
}

describe('grooming.routes — isolasi antar-cabang & antar-tenant (IDOR)', () => {
  it('GET /grooming/sesi/:id milik tenant lain harus 404', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const prisma = fullMockPrisma({ groomingSession: { findFirst: simulateFindFirst(OTHER_TENANT_SESSION) } })
    const app = await buildApp(groomingRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'GET', url: '/api/grooming/sesi/50' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('PUT /grooming/sesi/:id/status milik tenant lain harus 404, bukan berhasil diubah', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_SESSION, status: 'in_progress' })
    const prisma = fullMockPrisma({ groomingSession: { findFirst: simulateFindFirst(OTHER_TENANT_SESSION), update: updateMock } })
    const app = await buildApp(groomingRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'PUT', url: '/api/grooming/sesi/50/status', payload: { action: 'mulai' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('PUT /grooming/sesi/:id milik tenant lain harus 404, bukan berhasil diubah', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_SESSION, notes: 'diubah' })
    const prisma = fullMockPrisma({ groomingSession: { findFirst: simulateFindFirst(OTHER_TENANT_SESSION), update: updateMock } })
    const app = await buildApp(groomingRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'PUT', url: '/api/grooming/sesi/50', payload: { notes: 'diubah' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('DELETE /grooming/sesi/:id milik tenant lain harus 404, bukan terhapus', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_SESSION, isDeleted: true })
    const prisma = fullMockPrisma({ groomingSession: { findFirst: simulateFindFirst(OTHER_TENANT_SESSION), update: updateMock } })
    const app = await buildApp(groomingRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'DELETE', url: '/api/grooming/sesi/50' })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('PUT /grooming/paket/:id milik tenant lain harus 404, bukan berhasil diubah', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_PACKAGE, packageName: 'Diubah' })
    const prisma = fullMockPrisma({ groomingPackage: { findFirst: simulateFindFirst(OTHER_TENANT_PACKAGE), update: updateMock } })
    const app = await buildApp(groomingRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'PUT', url: '/api/grooming/paket/51', payload: { packageName: 'Diubah' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('DELETE /grooming/paket/:id milik tenant lain harus 404, bukan terhapus', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_PACKAGE, isDeleted: true })
    const prisma = fullMockPrisma({ groomingPackage: { findFirst: simulateFindFirst(OTHER_TENANT_PACKAGE), update: updateMock } })
    const app = await buildApp(groomingRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'DELETE', url: '/api/grooming/paket/51' })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('POST /grooming/sesi dengan packageId milik tenant lain harus 404, bukan berhasil dibuat', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const createMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      groomingPackage: { findFirst: simulateFindFirst(OTHER_TENANT_PACKAGE) },
      groomingSession: { create: createMock },
    })
    const app = await buildApp(groomingRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'POST', url: '/api/grooming/sesi', payload: { patientId: 1, groomerId: 2, packageId: 51 } })
    expect(res.statusCode).toBe(404)
    expect(createMock).not.toHaveBeenCalled()
    await app.close()
  })

  describe('POST /grooming/sesi — fitur grooming harus sesuai paket klinik', () => {
    const OWN_PACKAGE = { id: BigInt(1), branchId: BigInt(1), tenantId: BigInt(1), isDeleted: false, isActive: true, price: 100000 }

    it('ditolak 402 kalau paket klinik tidak punya fitur grooming', async () => {
      const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
      const createMock = vi.fn()
      const prisma = fullMockPrisma({
        groomingPackage: { findFirst: vi.fn().mockResolvedValue(OWN_PACKAGE) },
        groomingSession: { create: createMock },
        tenantSubscription: {
          findUnique: vi.fn().mockResolvedValue({ plan: { name: 'Free', features: { grooming: false } } }),
        },
      })
      const app = await buildApp(groomingRoutes, prisma, ADMIN_USER)
      const res = await app.inject({ method: 'POST', url: '/api/grooming/sesi', payload: { patientId: 1, groomerId: 2, packageId: 1 } })
      expect(res.statusCode).toBe(402)
      expect(createMock).not.toHaveBeenCalled()
      await app.close()
    })
  })

  it('GET /grooming/stats untuk admin harus tetap discope ke tenant, bukan where kosong', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const countMock = vi.fn().mockResolvedValue(0)
    const prisma = fullMockPrisma({ groomingSession: { count: countMock, aggregate: vi.fn().mockResolvedValue({ _sum: { totalPrice: 0 } }) } })
    const app = await buildApp(groomingRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'GET', url: '/api/grooming/stats' })
    expect(res.statusCode).toBe(200)
    const where = countMock.mock.calls[0][0].where
    const hasTenantScope = 'branchId' in where || ('branch' in where && 'tenantId' in (where.branch ?? {}))
    expect(hasTenantScope).toBe(true)
    await app.close()
  })

  it('GET /grooming/sesi (list) untuk admin harus tetap discope ke tenant, bukan where kosong', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const findManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({ groomingSession: { findMany: findManyMock, count: vi.fn().mockResolvedValue(0) } })
    const app = await buildApp(groomingRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'GET', url: '/api/grooming/sesi' })
    expect(res.statusCode).toBe(200)
    const where = findManyMock.mock.calls[0][0].where
    const hasTenantScope = 'branchId' in where || ('branch' in where && 'tenantId' in (where.branch ?? {}))
    expect(hasTenantScope).toBe(true)
    await app.close()
  })

  it('GET /grooming/paket untuk admin harus tetap discope ke tenant, bukan where kosong', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const findManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({ groomingPackage: { findMany: findManyMock } })
    const app = await buildApp(groomingRoutes, prisma, ADMIN_USER)
    const res = await app.inject({ method: 'GET', url: '/api/grooming/paket' })
    expect(res.statusCode).toBe(200)
    const where = findManyMock.mock.calls[0][0].where
    const hasTenantScope = 'branchId' in where || ('branch' in where && 'tenantId' in (where.branch ?? {}))
    expect(hasTenantScope).toBe(true)
    await app.close()
  })
})

describe('GET /grooming/paket — admin instalasi lama (tenantId null) tidak boleh crash', () => {
  it('tetap 200 tanpa filter tenant saat admin.tenantId null', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const prisma = fullMockPrisma({ groomingPackage: { findMany: vi.fn().mockResolvedValue([]) } })
    const app = await buildApp(groomingRoutes, prisma, { ...ADMIN_USER, tenantId: null as any })
    const res = await app.inject({ method: 'GET', url: '/api/grooming/paket' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
