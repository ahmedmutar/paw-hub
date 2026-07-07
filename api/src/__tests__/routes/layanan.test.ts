import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, mockModel, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { layananRoutes } from '../../modules/layanan/layanan.routes'

// authUser di test ini selalu branchId=1 (lihat DEFAULT_AUTH_USER). Record "milik cabang lain"
// di bawah ini sengaja diberi branchId=2, supaya kita bisa pastikan endpoint benar-benar
// menyaring berdasarkan cabang si pengguna, bukan cuma "id ketemu = boleh akses".
const OTHER_BRANCH_CATEGORY = { id: BigInt(99), branchId: BigInt(2), categoryName: 'Kategori Cabang Lain', isDeleted: false }
const OTHER_BRANCH_SERVICE = { id: BigInt(88), branchId: BigInt(2), serviceName: 'Layanan Cabang Lain', isActive: true, isDeleted: false }

/**
 * Simulasi Prisma findFirst/findUnique yang benar-benar menghormati semua kunci di `where`
 * (termasuk branchId kalau ada), supaya kita bisa membedakan "kode belum filter branchId sama
 * sekali" (bug) dari "kode sudah filter branchId dengan benar" (fix) — mock generik bawaan
 * (mockResolvedValue) tidak bisa membedakan ini karena selalu mengembalikan nilai yang sama
 * apapun isi where-nya.
 */
function simulateOwnedLookup(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    for (const key of Object.keys(where)) {
      if (where[key] === undefined) continue
      if (record[key] === undefined) continue
      if (String(where[key]) !== String(record[key])) return Promise.resolve(null)
    }
    return Promise.resolve(record)
  })
}

describe('layanan.routes — isolasi antar-cabang (IDOR)', () => {
  describe('kategori', () => {
    it('PUT /layanan/kategori/:id milik cabang lain harus 404, bukan berhasil update', async () => {
      const prisma = fullMockPrisma({
        serviceCategory: {
          findFirst: simulateOwnedLookup(OTHER_BRANCH_CATEGORY),
          update: vi.fn().mockResolvedValue({ ...OTHER_BRANCH_CATEGORY, categoryName: 'Diubah Paksa' }),
        },
      })
      const app = await buildApp(layananRoutes, prisma)

      const res = await app.inject({
        method: 'PUT',
        url: '/api/layanan/kategori/99',
        payload: { categoryName: 'Diubah Paksa' },
      })

      expect(res.statusCode).toBe(404)
      expect((prisma.serviceCategory as any).update).not.toHaveBeenCalled()
    })

    it('DELETE /layanan/kategori/:id milik cabang lain harus 404, bukan terhapus', async () => {
      const prisma = fullMockPrisma({
        serviceCategory: {
          findFirst: simulateOwnedLookup(OTHER_BRANCH_CATEGORY),
          update: vi.fn().mockResolvedValue({ ...OTHER_BRANCH_CATEGORY, isDeleted: true }),
        },
        listOfService: { count: vi.fn().mockResolvedValue(0) },
      })
      const app = await buildApp(layananRoutes, prisma)

      const res = await app.inject({ method: 'DELETE', url: '/api/layanan/kategori/99' })

      expect(res.statusCode).toBe(404)
      expect((prisma.serviceCategory as any).update).not.toHaveBeenCalled()
    })
  })

  describe('layanan', () => {
    it('GET /layanan/:id milik cabang lain harus 404, bukan bocor data', async () => {
      const prisma = fullMockPrisma({
        listOfService: { findFirst: simulateOwnedLookup(OTHER_BRANCH_SERVICE) },
      })
      const app = await buildApp(layananRoutes, prisma)

      const res = await app.inject({ method: 'GET', url: '/api/layanan/88' })

      expect(res.statusCode).toBe(404)
    })

    it('PUT /layanan/:id milik cabang lain harus 404, bukan berhasil update', async () => {
      const prisma = fullMockPrisma({
        listOfService: {
          findFirst: simulateOwnedLookup(OTHER_BRANCH_SERVICE),
          update: vi.fn().mockResolvedValue({ ...OTHER_BRANCH_SERVICE, serviceName: 'Diubah Paksa' }),
        },
      })
      const app = await buildApp(layananRoutes, prisma)

      const res = await app.inject({
        method: 'PUT',
        url: '/api/layanan/88',
        payload: { serviceName: 'Diubah Paksa' },
      })

      expect(res.statusCode).toBe(404)
      expect((prisma.listOfService as any).update).not.toHaveBeenCalled()
    })

    it('PATCH /layanan/:id/toggle-status milik cabang lain harus 404, bukan berhasil toggle', async () => {
      const prisma = fullMockPrisma({
        listOfService: {
          findFirst: simulateOwnedLookup(OTHER_BRANCH_SERVICE),
          update: vi.fn().mockResolvedValue({ ...OTHER_BRANCH_SERVICE, isActive: false }),
        },
      })
      const app = await buildApp(layananRoutes, prisma)

      const res = await app.inject({ method: 'PATCH', url: '/api/layanan/88/toggle-status' })

      expect(res.statusCode).toBe(404)
      expect((prisma.listOfService as any).update).not.toHaveBeenCalled()
    })

    it('DELETE /layanan/:id milik cabang lain harus 404, bukan terhapus', async () => {
      const prisma = fullMockPrisma({
        listOfService: {
          findFirst: simulateOwnedLookup(OTHER_BRANCH_SERVICE),
          update: vi.fn().mockResolvedValue({ ...OTHER_BRANCH_SERVICE, isDeleted: true }),
        },
        detailServicePatient: { count: vi.fn().mockResolvedValue(0) },
      })
      const app = await buildApp(layananRoutes, prisma)

      const res = await app.inject({ method: 'DELETE', url: '/api/layanan/88' })

      expect(res.statusCode).toBe(404)
      expect((prisma.listOfService as any).update).not.toHaveBeenCalled()
    })
  })

  describe('harga', () => {
    it('POST /layanan/:id/harga milik cabang lain harus 404, bukan berhasil ubah harga', async () => {
      const prisma = fullMockPrisma({
        listOfService: { findFirst: simulateOwnedLookup(OTHER_BRANCH_SERVICE) },
        priceService: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn().mockResolvedValue({ id: BigInt(1) }),
        },
      })
      const app = await buildApp(layananRoutes, prisma)

      const res = await app.inject({
        method: 'POST',
        url: '/api/layanan/88/harga',
        payload: { sellingPrice: 999000 },
      })

      expect(res.statusCode).toBe(404)
      expect((prisma.priceService as any).create).not.toHaveBeenCalled()
    })

    it('GET /layanan/:id/harga milik cabang lain harus 404, bukan bocor riwayat harga', async () => {
      const prisma = fullMockPrisma({
        listOfService: { findFirst: simulateOwnedLookup(OTHER_BRANCH_SERVICE) },
      })
      const app = await buildApp(layananRoutes, prisma)

      const res = await app.inject({ method: 'GET', url: '/api/layanan/88/harga' })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('kontrol positif — akses ke cabang sendiri tetap normal', () => {
    it('GET /layanan/:id milik cabang sendiri tetap 200', async () => {
      const ownService = { ...OTHER_BRANCH_SERVICE, id: BigInt(1), branchId: DEFAULT_AUTH_USER.branchId }
      const prisma = fullMockPrisma({
        listOfService: { findFirst: simulateOwnedLookup(ownService) },
      })
      const app = await buildApp(layananRoutes, prisma)

      const res = await app.inject({ method: 'GET', url: '/api/layanan/1' })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).data.id).toBe('1')
    })
  })
})
