import { describe, it, expect, vi } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { registrasiRoutes } from '../../modules/registrasi/registrasi.routes'

// DEFAULT_AUTH_USER: role admin, branchId=1, tenantId=1.
// Registration punya branchId langsung. Modul ini tidak punya pola
// tenant-wide untuk admin (list/stats/antrian-hari-ini sudah konsisten
// mengunci SEMUA role ke branchId sendiri), jadi endpoint by-id juga harus
// dikunci ke branchId sendiri.
const OTHER_BRANCH_REG = { id: BigInt(50), branchId: BigInt(2), isDeleted: false, acceptanceStatus: 'pending', patient: { owner: {} } }

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    if ('branchId' in where && String(where.branchId) !== String(record.branchId)) return Promise.resolve(null)
    if ('isDeleted' in where && where.isDeleted !== record.isDeleted) return Promise.resolve(null)
    return Promise.resolve(record)
  })
}

describe('registrasi.routes — isolasi antar-cabang (IDOR)', () => {
  it('GET /registrasi/:id milik cabang lain harus 404', async () => {
    const prisma = fullMockPrisma({ registration: { findFirst: simulateFindFirst(OTHER_BRANCH_REG) } })
    const app = await buildApp(registrasiRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/registrasi/50' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('PUT /registrasi/:id milik cabang lain harus 404, bukan berhasil diubah', async () => {
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_REG, complaint: 'diubah' })
    const prisma = fullMockPrisma({ registration: { findFirst: simulateFindFirst(OTHER_BRANCH_REG), update: updateMock } })
    const app = await buildApp(registrasiRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'PUT', url: '/api/registrasi/50', payload: { complaint: 'diubah' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('POST /registrasi/:id/terima milik cabang lain harus 404, bukan berhasil diterima', async () => {
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_REG, acceptanceStatus: 'accepted' })
    const prisma = fullMockPrisma({ registration: { findFirst: simulateFindFirst(OTHER_BRANCH_REG), update: updateMock } })
    const app = await buildApp(registrasiRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'POST', url: '/api/registrasi/50/terima' })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('POST /registrasi/:id/tolak milik cabang lain harus 404, bukan berhasil ditolak', async () => {
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_REG, acceptanceStatus: 'declined' })
    const prisma = fullMockPrisma({ registration: { findFirst: simulateFindFirst(OTHER_BRANCH_REG), update: updateMock } })
    const app = await buildApp(registrasiRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'POST', url: '/api/registrasi/50/tolak', payload: {} })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('POST /registrasi/:id/batalkan milik cabang lain harus 404, bukan berhasil dibatalkan', async () => {
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_REG, acceptanceStatus: 'cancelled' })
    const prisma = fullMockPrisma({ registration: { findFirst: simulateFindFirst(OTHER_BRANCH_REG), update: updateMock } })
    const app = await buildApp(registrasiRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'POST', url: '/api/registrasi/50/batalkan', payload: {} })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('DELETE /registrasi/:id milik cabang lain harus 404, bukan terhapus', async () => {
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_REG, isDeleted: true })
    const prisma = fullMockPrisma({ registration: { findFirst: simulateFindFirst(OTHER_BRANCH_REG), update: updateMock } })
    const app = await buildApp(registrasiRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'DELETE', url: '/api/registrasi/50' })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })
})
