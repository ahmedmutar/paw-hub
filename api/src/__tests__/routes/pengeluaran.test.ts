import { describe, it, expect, vi } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { pengeluaranRoutes } from '../../modules/pengeluaran/pengeluaran.routes'

// DEFAULT_AUTH_USER: role admin, branchId=1, tenantId=1.
const OTHER_BRANCH_SAME_TENANT_EXPENSE = { id: BigInt(50), branchId: BigInt(2), isDeleted: false, quantity: 1, amount: 1000 }
const OTHER_TENANT_EXPENSE = { id: BigInt(51), branchId: BigInt(99), isDeleted: false, quantity: 1, amount: 1000 }

const NON_ADMIN_USER = { ...DEFAULT_AUTH_USER, role: 'karyawan' as any, branchId: BigInt(1), tenantId: BigInt(1) }

/** Simulasi findUnique/findFirst yang menghormati where.id saja (meniru bug: tidak ada filter cabang/tenant sama sekali). */
function bugFindUnique(record: Record<string, any>) {
  return vi.fn((args: any) => {
    if (String(args?.where?.id) === String(record.id)) return Promise.resolve(record)
    return Promise.resolve(null)
  })
}

describe('pengeluaran.routes — isolasi antar-cabang & antar-tenant (IDOR)', () => {
  describe('PUT/DELETE by id — staf non-admin', () => {
    it('PUT /pengeluaran/:id milik cabang lain (staf non-admin) harus 404, bukan berhasil update', async () => {
      const prisma = fullMockPrisma({
        expense: {
          findUnique: bugFindUnique(OTHER_BRANCH_SAME_TENANT_EXPENSE),
          update: vi.fn().mockResolvedValue({ ...OTHER_BRANCH_SAME_TENANT_EXPENSE, itemName: 'Diubah Paksa' }),
        },
      })
      const app = await buildApp(pengeluaranRoutes, prisma, NON_ADMIN_USER)

      const res = await app.inject({ method: 'PUT', url: '/api/pengeluaran/50', payload: { itemName: 'Diubah Paksa' } })

      expect(res.statusCode).toBe(404)
      expect((prisma.expense as any).update).not.toHaveBeenCalled()
    })

    it('DELETE /pengeluaran/:id milik cabang lain (staf non-admin) harus 404, bukan terhapus', async () => {
      const prisma = fullMockPrisma({
        expense: {
          findUnique: bugFindUnique(OTHER_BRANCH_SAME_TENANT_EXPENSE),
          update: vi.fn().mockResolvedValue({ ...OTHER_BRANCH_SAME_TENANT_EXPENSE, isDeleted: true }),
        },
      })
      const app = await buildApp(pengeluaranRoutes, prisma, NON_ADMIN_USER)

      const res = await app.inject({ method: 'DELETE', url: '/api/pengeluaran/50' })

      expect(res.statusCode).toBe(404)
      expect((prisma.expense as any).update).not.toHaveBeenCalled()
    })
  })

  describe('PUT/DELETE by id — admin lintas tenant', () => {
    it('PUT /pengeluaran/:id milik tenant lain (admin) harus 404, bukan berhasil update', async () => {
      const prisma = fullMockPrisma({
        expense: {
          findUnique: bugFindUnique(OTHER_TENANT_EXPENSE),
          update: vi.fn().mockResolvedValue({ ...OTHER_TENANT_EXPENSE, itemName: 'Diubah Paksa' }),
        },
      })
      const app = await buildApp(pengeluaranRoutes, prisma, DEFAULT_AUTH_USER)

      const res = await app.inject({ method: 'PUT', url: '/api/pengeluaran/51', payload: { itemName: 'Diubah Paksa' } })

      expect(res.statusCode).toBe(404)
      expect((prisma.expense as any).update).not.toHaveBeenCalled()
    })

    it('DELETE /pengeluaran/:id milik tenant lain (admin) harus 404, bukan terhapus', async () => {
      const prisma = fullMockPrisma({
        expense: {
          findUnique: bugFindUnique(OTHER_TENANT_EXPENSE),
          update: vi.fn().mockResolvedValue({ ...OTHER_TENANT_EXPENSE, isDeleted: true }),
        },
      })
      const app = await buildApp(pengeluaranRoutes, prisma, DEFAULT_AUTH_USER)

      const res = await app.inject({ method: 'DELETE', url: '/api/pengeluaran/51' })

      expect(res.statusCode).toBe(404)
      expect((prisma.expense as any).update).not.toHaveBeenCalled()
    })
  })

  describe('kontrol positif — akses ke data cabang/tenant sendiri tetap normal', () => {
    it('PUT /pengeluaran/:id milik cabang sendiri tetap 200', async () => {
      const ownExpense = { id: BigInt(1), branchId: DEFAULT_AUTH_USER.branchId, isDeleted: false, quantity: 1, amount: 1000, dateSpend: new Date(), category: 'Lain-lain', itemName: 'Lama', notes: null }
      const prisma = fullMockPrisma({
        expense: {
          findUnique: bugFindUnique(ownExpense),
          findFirst: vi.fn().mockResolvedValue(ownExpense),
          update: vi.fn().mockResolvedValue({ ...ownExpense, itemName: 'Baru' }),
        },
      })
      const app = await buildApp(pengeluaranRoutes, prisma, DEFAULT_AUTH_USER)

      const res = await app.inject({ method: 'PUT', url: '/api/pengeluaran/1', payload: { itemName: 'Baru' } })

      expect(res.statusCode).toBe(200)
    })
  })

  describe('list/stats untuk admin — tidak boleh bocor lintas tenant', () => {
    it('GET /pengeluaran/stats untuk admin harus scope query dengan tenant, bukan {} kosong', async () => {
      const aggregateMock = vi.fn().mockResolvedValue({ _sum: { amountOverall: 0 }, _count: { id: 0 } })
      const groupByMock = vi.fn().mockResolvedValue([])
      const prisma = fullMockPrisma({
        expense: { aggregate: aggregateMock, groupBy: groupByMock },
      })
      const app = await buildApp(pengeluaranRoutes, prisma, DEFAULT_AUTH_USER)

      const res = await app.inject({ method: 'GET', url: '/api/pengeluaran/stats' })
      expect(res.statusCode).toBe(200)

      // Where clause admin TIDAK BOLEH kosong `{}` — harus tetap terikat ke tenant admin
      // (via branchId langsung ATAU relasi branch.tenantId, karena Expense tidak punya kolom tenantId).
      const firstCallWhere = aggregateMock.mock.calls[0][0].where
      const hasTenantScope = 'branchId' in firstCallWhere || ('branch' in firstCallWhere && 'tenantId' in (firstCallWhere.branch ?? {}))
      expect(hasTenantScope).toBe(true)
    })
  })

  describe('POST — admin tidak boleh titip branchId milik tenant lain', () => {
    it('POST /pengeluaran dengan branchId milik tenant lain harus ditolak', async () => {
      const prisma = fullMockPrisma({
        branch: { findFirst: vi.fn().mockResolvedValue(null) }, // branch itu tidak ditemukan di tenant admin
        expense: { create: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
      })
      const app = await buildApp(pengeluaranRoutes, prisma, DEFAULT_AUTH_USER)

      const res = await app.inject({
        method: 'POST',
        url: '/api/pengeluaran',
        payload: { itemName: 'Test', quantity: 1, amount: 1000, branchId: '999' },
      })

      expect(res.statusCode).toBe(404)
      expect((prisma.expense as any).create).not.toHaveBeenCalled()
    })
  })
})
