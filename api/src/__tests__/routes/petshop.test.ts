// F-15: Pet Shop
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

const mockProduct = {
  id: BigInt(1), itemName: 'Royal Canin 1kg', totalItem: 20,
  branchId: BigInt(1), isDeleted: false,
  prices: [{ price: 85000, isActive: true }],
}
const mockTransaction = {
  id: BigInt(1), totalAmount: 85000, branchId: BigInt(1),
  items: [], clinicItems: [],
}

function makePrisma() {
  return fullMockPrisma({
    listOfItemPetShop: { findMany: vi.fn().mockResolvedValue([mockProduct]), findFirst: vi.fn().mockResolvedValue(mockProduct), create: vi.fn().mockResolvedValue(mockProduct), update: vi.fn().mockResolvedValue(mockProduct) },
    paymentPetshop:    { findMany: vi.fn().mockResolvedValue([mockTransaction]), create: vi.fn().mockResolvedValue(mockTransaction) },
    priceItemPetShop:  { create: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
    listOfItem: { findFirst: vi.fn().mockResolvedValue(null) },
  })
}

describe('F-15 Pet Shop', () => {
  it('GET /api/petshop/produk mengembalikan daftar produk', async () => {
    const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
    const app = await buildApp(petshopRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/petshop/produk' })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().data)).toBe(true)
    await app.close()
  })

  it('GET /api/petshop/transaksi mengembalikan riwayat transaksi', async () => {
    const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
    const app = await buildApp(petshopRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/petshop/transaksi' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('GET /api/petshop/stats mengembalikan statistik petshop', async () => {
    const prisma = makePrisma()
    ;(prisma.paymentPetshop as any).aggregate = vi.fn().mockResolvedValue({ _sum: { totalAmount: 1000000 }, _count: { id: 5 } })
    const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
    const app = await buildApp(petshopRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/petshop/stats' })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })
})

// ─── Isolasi antar-cabang & antar-tenant (IDOR) ────────────────────────────────
// Modul ini punya surface paling luas dari yang pernah diaudit: hampir semua
// endpoint by-id (produk, harga, stok, transaksi) sama sekali tidak filter
// branchId/tenantId, DAN endpoint list/stats untuk admin tanpa query branchId
// pakai where kosong `{}` (bocor lintas TENANT, bukan cuma lintas cabang).
const ADMIN_USER = { userId: BigInt(1), username: 'admin', fullname: 'Admin', role: 'admin' as any, branchId: BigInt(1), branchName: 'Cabang 1', tenantId: BigInt(1) }
const NON_ADMIN_USER = { ...ADMIN_USER, role: 'karyawan' as any }

/**
 * Simulasi findFirst yang menghormati key di where secara realistis, termasuk
 * relasi branch.tenantId (produk) dan user.branchId / user.branch.tenantId
 * (transaksi) — meniru DB sungguhan supaya RED kalau kode lupa filter.
 */
function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    for (const key of Object.keys(where)) {
      if (key === 'id' && String(where.id) !== String(record.id)) return Promise.resolve(null)
      if (key === 'isDeleted' && where.isDeleted !== record.isDeleted) return Promise.resolve(null)
      if (key === 'branchId' && String(where.branchId) !== String(record.branchId)) return Promise.resolve(null)
      if (key === 'branch' && where.branch?.tenantId !== undefined && String(where.branch.tenantId) !== String(record.tenantId)) return Promise.resolve(null)
      if (key === 'user') {
        if (where.user?.branchId !== undefined && String(where.user.branchId) !== String(record.branchId)) return Promise.resolve(null)
        if (where.user?.branch?.tenantId !== undefined && String(where.user.branch.tenantId) !== String(record.tenantId)) return Promise.resolve(null)
      }
    }
    return Promise.resolve(record)
  })
}

const OWN_PRODUCT = { id: BigInt(1), branchId: BigInt(1), tenantId: BigInt(1), isDeleted: false, itemName: 'Royal Canin', totalItem: 20, limitItem: null, expiredDate: null, unitItemId: BigInt(1), categoryItemId: BigInt(1), branch: null, priceItemPetShops: [] }
const OTHER_TENANT_PRODUCT = { ...OWN_PRODUCT, id: BigInt(50), branchId: BigInt(99), tenantId: BigInt(99) }
const OTHER_TENANT_TRX = { id: BigInt(51), branchId: BigInt(99), tenantId: BigInt(99), isDeleted: false, userId: BigInt(9), discount: 0, user: null, items: [], clinicItems: [] }
const OWN_TRX = { id: BigInt(1), branchId: BigInt(1), tenantId: BigInt(1), isDeleted: false, userId: BigInt(1), discount: 0, user: null, items: [], clinicItems: [] }

describe('petshop.routes — isolasi antar-cabang & antar-tenant (IDOR)', () => {
  describe('Produk by-id', () => {
    it('GET /petshop/produk/:id milik tenant lain harus 404', async () => {
      const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
      const prisma = fullMockPrisma({ listOfItemPetShop: { findFirst: simulateFindFirst(OTHER_TENANT_PRODUCT) } })
      const app = await buildApp(petshopRoutes, prisma, ADMIN_USER)
      const res = await app.inject({ method: 'GET', url: '/api/petshop/produk/50' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('GET /petshop/produk/:id milik tenant sendiri tetap 200 (kontrol positif)', async () => {
      const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
      const prisma = fullMockPrisma({ listOfItemPetShop: { findFirst: simulateFindFirst(OWN_PRODUCT) } })
      const app = await buildApp(petshopRoutes, prisma, ADMIN_USER)
      const res = await app.inject({ method: 'GET', url: '/api/petshop/produk/1' })
      expect(res.statusCode).toBe(200)
      await app.close()
    })

    it('PUT /petshop/produk/:id milik tenant lain harus 404, bukan berhasil update', async () => {
      const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
      const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_PRODUCT, itemName: 'Diubah' })
      const prisma = fullMockPrisma({ listOfItemPetShop: { findFirst: simulateFindFirst(OTHER_TENANT_PRODUCT), update: updateMock } })
      const app = await buildApp(petshopRoutes, prisma, ADMIN_USER)
      const res = await app.inject({ method: 'PUT', url: '/api/petshop/produk/50', payload: { itemName: 'Diubah' } })
      expect(res.statusCode).toBe(404)
      expect(updateMock).not.toHaveBeenCalled()
      await app.close()
    })

    it('DELETE /petshop/produk/:id milik tenant lain harus 404, bukan terhapus', async () => {
      const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
      const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_PRODUCT, isDeleted: true })
      const prisma = fullMockPrisma({ listOfItemPetShop: { findFirst: simulateFindFirst(OTHER_TENANT_PRODUCT), update: updateMock } })
      const app = await buildApp(petshopRoutes, prisma, ADMIN_USER)
      const res = await app.inject({ method: 'DELETE', url: '/api/petshop/produk/50' })
      expect(res.statusCode).toBe(404)
      expect(updateMock).not.toHaveBeenCalled()
      await app.close()
    })

    it('POST /petshop/produk/:id/stok milik tenant lain harus 404, bukan berhasil ubah stok', async () => {
      const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
      const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_PRODUCT, totalItem: 999 })
      const prisma = fullMockPrisma({ listOfItemPetShop: { findFirst: simulateFindFirst(OTHER_TENANT_PRODUCT), update: updateMock } })
      const app = await buildApp(petshopRoutes, prisma, ADMIN_USER)
      const res = await app.inject({ method: 'POST', url: '/api/petshop/produk/50/stok', payload: { qty: 10, type: 'masuk' } })
      expect(res.statusCode).toBe(404)
      expect(updateMock).not.toHaveBeenCalled()
      await app.close()
    })

    it('POST /petshop/produk dengan branchId milik tenant lain harus ditolak', async () => {
      const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
      const createMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
      const prisma = fullMockPrisma({
        branch: { findFirst: vi.fn().mockResolvedValue(null) },
        listOfItemPetShop: { create: createMock },
      })
      const app = await buildApp(petshopRoutes, prisma, ADMIN_USER)
      const res = await app.inject({
        method: 'POST', url: '/api/petshop/produk',
        payload: { itemName: 'Test', unitItemId: '1', categoryItemId: '1', branchId: '999', sellingPrice: 1000, capitalPrice: 800 },
      })
      expect(res.statusCode).toBe(404)
      expect(createMock).not.toHaveBeenCalled()
      await app.close()
    })
  })

  describe('Harga produk', () => {
    it('GET /petshop/harga/:produkId milik tenant lain harus 404', async () => {
      const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
      const findManyMock = vi.fn().mockResolvedValue([{ id: BigInt(1), listOfItemPetShopId: BigInt(50), sellingPrice: 1000, capitalPrice: 800, petshopFee: 0, createdAt: new Date() }])
      const prisma = fullMockPrisma({
        listOfItemPetShop: { findFirst: simulateFindFirst(OTHER_TENANT_PRODUCT) },
        priceItemPetShop: { findMany: findManyMock },
      })
      const app = await buildApp(petshopRoutes, prisma, ADMIN_USER)
      const res = await app.inject({ method: 'GET', url: '/api/petshop/harga/50' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('POST /petshop/harga/:produkId milik tenant lain harus 404, bukan berhasil dibuat', async () => {
      const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
      const createMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
      const prisma = fullMockPrisma({
        listOfItemPetShop: { findFirst: simulateFindFirst(OTHER_TENANT_PRODUCT) },
        priceItemPetShop: { create: createMock },
      })
      const app = await buildApp(petshopRoutes, prisma, ADMIN_USER)
      const res = await app.inject({ method: 'POST', url: '/api/petshop/harga/50', payload: { sellingPrice: 5000, capitalPrice: 4000 } })
      expect(res.statusCode).toBe(404)
      expect(createMock).not.toHaveBeenCalled()
      await app.close()
    })
  })

  describe('Transaksi by-id', () => {
    it('GET /petshop/transaksi/:id milik cabang lain (staf non-admin) harus 404', async () => {
      const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
      const prisma = fullMockPrisma({ paymentPetshop: { findFirst: simulateFindFirst(OTHER_TENANT_TRX) } })
      const app = await buildApp(petshopRoutes, prisma, NON_ADMIN_USER)
      const res = await app.inject({ method: 'GET', url: '/api/petshop/transaksi/51' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('GET /petshop/transaksi/:id milik cabang sendiri tetap 200 (kontrol positif)', async () => {
      const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
      const prisma = fullMockPrisma({ paymentPetshop: { findFirst: simulateFindFirst(OWN_TRX) } })
      const app = await buildApp(petshopRoutes, prisma, NON_ADMIN_USER)
      const res = await app.inject({ method: 'GET', url: '/api/petshop/transaksi/1' })
      expect(res.statusCode).toBe(200)
      await app.close()
    })

    it('DELETE /petshop/transaksi/:id milik tenant lain (admin) harus 404, bukan terhapus', async () => {
      const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
      const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_TRX, isDeleted: true })
      const prisma = fullMockPrisma({ paymentPetshop: { findFirst: simulateFindFirst(OTHER_TENANT_TRX), update: updateMock } })
      const app = await buildApp(petshopRoutes, prisma, ADMIN_USER)
      const res = await app.inject({ method: 'DELETE', url: '/api/petshop/transaksi/51' })
      expect(res.statusCode).toBe(404)
      expect(updateMock).not.toHaveBeenCalled()
      await app.close()
    })
  })

  describe('List/stats untuk admin tanpa qBranch — tidak boleh bocor lintas tenant', () => {
    it('GET /petshop/produk untuk admin harus tetap discope ke tenant, bukan where kosong', async () => {
      const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
      const findManyMock = vi.fn().mockResolvedValue([])
      const prisma = fullMockPrisma({ listOfItemPetShop: { findMany: findManyMock } })
      const app = await buildApp(petshopRoutes, prisma, ADMIN_USER)
      const res = await app.inject({ method: 'GET', url: '/api/petshop/produk' })
      expect(res.statusCode).toBe(200)
      const where = findManyMock.mock.calls[0][0].where
      const hasTenantScope = 'branchId' in where || ('branch' in where && 'tenantId' in (where.branch ?? {}))
      expect(hasTenantScope).toBe(true)
      await app.close()
    })

    it('GET /petshop/stats untuk admin harus tetap discope ke tenant, bukan where kosong', async () => {
      const { petshopRoutes } = await import('../../modules/petshop/petshop.routes')
      const findManyMock = vi.fn().mockResolvedValue([])
      const prisma = fullMockPrisma({
        paymentPetshop: { findMany: findManyMock },
        listOfItemPetShop: { count: vi.fn().mockResolvedValue(0) },
      })
      const app = await buildApp(petshopRoutes, prisma, ADMIN_USER)
      const res = await app.inject({ method: 'GET', url: '/api/petshop/stats' })
      expect(res.statusCode).toBe(200)
      const where = findManyMock.mock.calls[0][0].where
      const userWhere = where.user ?? {}
      const hasTenantScope = 'branchId' in userWhere || ('branch' in userWhere && 'tenantId' in (userWhere.branch ?? {}))
      expect(hasTenantScope).toBe(true)
      await app.close()
    })
  })
})
