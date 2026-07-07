// F-14: Penggajian Staf
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

import { penggajianRoutes as penggajianRoutesImport } from '../../modules/penggajian/penggajian.routes'

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
    branch: { findFirst: vi.fn().mockResolvedValue({ id: BigInt(1), tenantId: BigInt(1) }) },
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

// ─── Isolasi antar-cabang & antar-tenant (IDOR) ────────────────────────────────
// DEFAULT_AUTH_USER-equivalent lokal: role admin, branchId=1, tenantId=1 (lihat
// buildApp.ts). NON_ADMIN_USER dipakai untuk membuktikan GET /penggajian/:id
// sama sekali tidak punya requireRole, jadi staf non-admin pun bisa jadi korban
// (atau pelaku) kalau filter cabang/tenant tidak diterapkan.
const ADMIN_USER = { userId: BigInt(1), username: 'admin', fullname: 'Admin', role: 'admin' as any, branchId: BigInt(1), branchName: 'Cabang 1', tenantId: BigInt(1) }
const NON_ADMIN_USER = { ...ADMIN_USER, role: 'karyawan' as any }

function makePayroll(overrides: Record<string, any> = {}) {
  return {
    id: BigInt(1),
    userEmployeeId: BigInt(2),
    branchId: BigInt(1),
    tenantId: BigInt(1), // stand-in untuk simulasi relasi branch.tenantId, bukan kolom asli di model Payroll
    datePayed: new Date(),
    periodMonth: 1,
    periodYear: 2026,
    basicSallary: 5000000,
    accomodation: 0,
    percentageTurnover: 0,
    amountTurnover: 0,
    totalTurnover: 0,
    minusTurnover: 0,
    amountInpatient: 0,
    countInpatient: 0,
    totalInpatient: 0,
    percentageSurgery: 0,
    amountSurgery: 0,
    totalSurgery: 0,
    amountGrooming: 0,
    countGrooming: 0,
    totalGrooming: 0,
    totalOverall: 5000000,
    isDeleted: false,
    employee: { id: BigInt(2), fullname: 'Karyawan', username: 'kry', role: 'karyawan' },
    createdBy: { id: BigInt(1), fullname: 'Admin' },
    branch: { id: BigInt(1), branchName: 'Cabang 1' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Simulasi findFirst yang menghormati setiap key di where secara realistis
 * (termasuk relasi branch.tenantId), meniru perilaku DB sungguhan — supaya
 * test ini gagal (RED) kalau kode lupa menambahkan filter cabang/tenant, dan
 * lolos (GREEN) begitu filter itu benar-benar ada di where clause.
 */
function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    for (const key of Object.keys(where)) {
      if (key === 'id') {
        if (String(where.id) !== String(record.id)) return Promise.resolve(null)
      } else if (key === 'isDeleted') {
        if (where.isDeleted !== record.isDeleted) return Promise.resolve(null)
      } else if (key === 'branchId') {
        if (String(where.branchId) !== String(record.branchId)) return Promise.resolve(null)
      } else if (key === 'branch' && where.branch?.tenantId !== undefined) {
        if (String(where.branch.tenantId) !== String(record.tenantId)) return Promise.resolve(null)
      }
    }
    return Promise.resolve(record)
  })
}

const OTHER_BRANCH_SAME_TENANT = makePayroll({ id: BigInt(50), branchId: BigInt(2), tenantId: BigInt(1) })
const OTHER_TENANT = makePayroll({ id: BigInt(51), branchId: BigInt(99), tenantId: BigInt(99) })
const OWN = makePayroll({ id: BigInt(1), branchId: BigInt(1), tenantId: BigInt(1) })

describe('penggajian.routes — isolasi antar-cabang & antar-tenant (IDOR)', () => {
  describe('GET /penggajian/:id — tidak ada requireRole sama sekali', () => {
    it('staf non-admin cabang lain (tenant sama) harus 404, bukan bisa lihat slip gaji cabang lain', async () => {
      const prisma = fullMockPrisma({ payroll: { findFirst: simulateFindFirst(OTHER_BRANCH_SAME_TENANT) } })
      const app = await buildApp(penggajianRoutesImport, prisma, NON_ADMIN_USER)

      const res = await app.inject({ method: 'GET', url: '/api/penggajian/50' })

      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('admin tenant lain harus 404, bukan bisa lihat slip gaji tenant lain', async () => {
      const prisma = fullMockPrisma({ payroll: { findFirst: simulateFindFirst(OTHER_TENANT) } })
      const app = await buildApp(penggajianRoutesImport, prisma, ADMIN_USER)

      const res = await app.inject({ method: 'GET', url: '/api/penggajian/51' })

      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('admin cabang lain di tenant yang sama tetap boleh lihat (admin kelola seluruh tenant)', async () => {
      const prisma = fullMockPrisma({ payroll: { findFirst: simulateFindFirst(OTHER_BRANCH_SAME_TENANT) } })
      const app = await buildApp(penggajianRoutesImport, prisma, ADMIN_USER)

      const res = await app.inject({ method: 'GET', url: '/api/penggajian/50' })

      expect(res.statusCode).toBe(200)
      await app.close()
    })
  })

  describe('PUT/DELETE /penggajian/:id — admin tanpa cek cabang/tenant', () => {
    it('PUT slip gaji milik tenant lain harus 404, bukan berhasil update', async () => {
      const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT, basicSallary: 999 })
      const prisma = fullMockPrisma({ payroll: { findFirst: simulateFindFirst(OTHER_TENANT), update: updateMock } })
      const app = await buildApp(penggajianRoutesImport, prisma, ADMIN_USER)

      const res = await app.inject({ method: 'PUT', url: '/api/penggajian/51', payload: { basicSallary: 999 } })

      expect(res.statusCode).toBe(404)
      expect(updateMock).not.toHaveBeenCalled()
      await app.close()
    })

    it('DELETE slip gaji milik tenant lain harus 404, bukan terhapus', async () => {
      const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT, isDeleted: true })
      const prisma = fullMockPrisma({ payroll: { findFirst: simulateFindFirst(OTHER_TENANT), update: updateMock } })
      const app = await buildApp(penggajianRoutesImport, prisma, ADMIN_USER)

      const res = await app.inject({ method: 'DELETE', url: '/api/penggajian/51' })

      expect(res.statusCode).toBe(404)
      expect(updateMock).not.toHaveBeenCalled()
      await app.close()
    })

    it('PUT slip gaji milik cabang sendiri tetap 200 (kontrol positif)', async () => {
      const updateMock = vi.fn().mockResolvedValue({ ...OWN, basicSallary: 6000000 })
      const prisma = fullMockPrisma({ payroll: { findFirst: simulateFindFirst(OWN), update: updateMock } })
      const app = await buildApp(penggajianRoutesImport, prisma, ADMIN_USER)

      const res = await app.inject({ method: 'PUT', url: '/api/penggajian/1', payload: { basicSallary: 6000000 } })

      expect(res.statusCode).toBe(200)
      await app.close()
    })
  })

  describe('POST /penggajian — admin tidak boleh titip branchId milik tenant lain', () => {
    it('POST dengan branchId milik tenant lain harus ditolak', async () => {
      const prisma = fullMockPrisma({
        branch: { findFirst: vi.fn().mockResolvedValue(null) },
        payroll: { create: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
      })
      const app = await buildApp(penggajianRoutesImport, prisma, ADMIN_USER)

      const res = await app.inject({
        method: 'POST',
        url: '/api/penggajian',
        payload: {
          userEmployeeId: '2',
          branchId: '999',
          datePayed: '2026-01-01',
          periodMonth: 1,
          periodYear: 2026,
          basicSallary: 5000000,
        },
      })

      expect(res.statusCode).toBe(404)
      expect((prisma.payroll as any).create).not.toHaveBeenCalled()
      await app.close()
    })
  })
})
