import { describe, it, expect, vi } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { userRoutes } from '../../modules/user/user.routes'

// DEFAULT_AUTH_USER: role admin, branchId=1, tenantId=1.
// User punya kolom tenantId langsung, jadi fix pakai tenantFilter() sama
// seperti Cabang/Pajak. Bug di sini adalah yang PALING PARAH sejauh ini
// karena reset-password + hapus sesi = account takeover penuh lintas tenant.

const OTHER_TENANT_USER = { id: BigInt(50), tenantId: BigInt(99), branchId: BigInt(2), username: 'orang-lain', fullname: 'Orang Lain', role: 'karyawan', status: true }
const OWN_USER = { id: BigInt(2), tenantId: BigInt(1), branchId: BigInt(1), username: 'staf-sendiri', fullname: 'Staf Sendiri', role: 'karyawan', status: true, branch: { branchName: 'Cabang 1' } }

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    for (const key of Object.keys(where)) {
      if (key === 'id' && String(where.id) !== String(record.id)) return Promise.resolve(null)
      if (key === 'tenantId' && String(where.tenantId) !== String(record.tenantId)) return Promise.resolve(null)
      if (key === 'isDeleted' && where.isDeleted !== (record.isDeleted ?? false)) return Promise.resolve(null)
    }
    return Promise.resolve(record)
  })
}

describe('user.routes — isolasi antar-tenant (IDOR)', () => {
  describe('POST /user/:id/reset-password — account takeover paling parah', () => {
    it('reset password user milik tenant lain harus 404, BUKAN berhasil reset + hapus sesi', async () => {
      const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_USER, password: 'hashed' })
      const deleteManyMock = vi.fn().mockResolvedValue({ count: 0 })
      const prisma = fullMockPrisma({
        user: { findFirst: simulateFindFirst(OTHER_TENANT_USER), update: updateMock },
        refreshToken: { deleteMany: deleteManyMock },
      })
      const app = await buildApp(userRoutes, prisma, DEFAULT_AUTH_USER)

      const res = await app.inject({ method: 'POST', url: '/api/user/50/reset-password', payload: { newPassword: 'password-baru-paksa' } })

      expect(res.statusCode).toBe(404)
      expect(updateMock).not.toHaveBeenCalled()
      expect(deleteManyMock).not.toHaveBeenCalled()
      await app.close()
    })

    it('reset password user milik tenant sendiri tetap berhasil (kontrol positif)', async () => {
      const updateMock = vi.fn().mockResolvedValue({ ...OWN_USER, password: 'hashed' })
      const prisma = fullMockPrisma({
        user: { findFirst: simulateFindFirst(OWN_USER), update: updateMock },
        refreshToken: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      })
      const app = await buildApp(userRoutes, prisma, DEFAULT_AUTH_USER)

      const res = await app.inject({ method: 'POST', url: '/api/user/2/reset-password', payload: { newPassword: 'password-baru' } })

      expect(res.statusCode).toBe(200)
      expect(updateMock).toHaveBeenCalled()
      await app.close()
    })
  })

  describe('PUT /user/:id — privilege escalation lintas tenant', () => {
    it('update user (termasuk role) milik tenant lain harus 404, bukan berhasil', async () => {
      const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_USER, role: 'admin' })
      const prisma = fullMockPrisma({ user: { findFirst: simulateFindFirst(OTHER_TENANT_USER), update: updateMock } })
      const app = await buildApp(userRoutes, prisma, DEFAULT_AUTH_USER)

      const res = await app.inject({ method: 'PUT', url: '/api/user/50', payload: { role: 'admin' } })

      expect(res.statusCode).toBe(404)
      expect(updateMock).not.toHaveBeenCalled()
      await app.close()
    })

    it('update user milik tenant sendiri tetap berhasil (kontrol positif)', async () => {
      const updateMock = vi.fn().mockResolvedValue({ ...OWN_USER, fullname: 'Nama Baru' })
      const prisma = fullMockPrisma({ user: { findFirst: simulateFindFirst(OWN_USER), update: updateMock } })
      const app = await buildApp(userRoutes, prisma, DEFAULT_AUTH_USER)

      const res = await app.inject({ method: 'PUT', url: '/api/user/2', payload: { fullname: 'Nama Baru' } })

      expect(res.statusCode).toBe(200)
      await app.close()
    })
  })

  describe('PATCH /user/:id/toggle-status — nonaktifkan akun lintas tenant', () => {
    it('toggle status user milik tenant lain harus 404, bukan berhasil dinonaktifkan', async () => {
      const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_USER, status: false })
      const prisma = fullMockPrisma({ user: { findFirst: simulateFindFirst(OTHER_TENANT_USER), update: updateMock } })
      const app = await buildApp(userRoutes, prisma, DEFAULT_AUTH_USER)

      const res = await app.inject({ method: 'PATCH', url: '/api/user/50/toggle-status' })

      expect(res.statusCode).toBe(404)
      expect(updateMock).not.toHaveBeenCalled()
      await app.close()
    })
  })

  describe('DELETE /user/:id — hapus akun lintas tenant', () => {
    it('hapus user milik tenant lain harus 404, bukan terhapus', async () => {
      const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_USER, isDeleted: true })
      const prisma = fullMockPrisma({ user: { findFirst: simulateFindFirst(OTHER_TENANT_USER), update: updateMock } })
      const app = await buildApp(userRoutes, prisma, DEFAULT_AUTH_USER)

      const res = await app.inject({ method: 'DELETE', url: '/api/user/50' })

      expect(res.statusCode).toBe(404)
      expect(updateMock).not.toHaveBeenCalled()
      await app.close()
    })
  })

  describe('GET /user — admin tidak boleh titip branchId milik tenant lain', () => {
    it('list user dengan query branchId milik tenant lain harus ditolak', async () => {
      const findManyMock = vi.fn().mockResolvedValue([])
      const prisma = fullMockPrisma({
        branch: { findFirst: vi.fn().mockResolvedValue(null) },
        user: { findMany: findManyMock },
      })
      const app = await buildApp(userRoutes, prisma, DEFAULT_AUTH_USER)

      const res = await app.inject({ method: 'GET', url: '/api/user?branchId=999' })

      expect(res.statusCode).toBe(404)
      expect(findManyMock).not.toHaveBeenCalled()
      await app.close()
    })
  })
})
