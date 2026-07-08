import { describe, it, expect, vi } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { pembayaranRoutes } from '../../modules/pembayaran/pembayaran.routes'

// DEFAULT_AUTH_USER: role admin, branchId=1, tenantId=1.
// ListOfPayment tidak punya branchId/tenantId langsung — cuma bisa dicek
// lewat relasi checkUpResultId -> registration.branchId. Modul ini juga
// TIDAK punya pola tenant-wide untuk admin (GET /pembayaran list sudah
// mengunci SEMUA role, termasuk admin, ke branchId sendiri), jadi fix-nya
// konsisten dikunci ke branchId sendiri.

const OTHER_BRANCH_PAYMENT = { id: BigInt(50), isDeleted: false, branchId: BigInt(2), checkUpResult: { registration: { branchId: BigInt(2) } } }
const OWN_PAYMENT = { id: BigInt(1), isDeleted: false, branchId: BigInt(1), checkUpResult: { registration: { branchId: BigInt(1) } } }
const OTHER_BRANCH_CHECKUP = { id: BigInt(50), isDeleted: false, statusPaidOff: false, branchId: BigInt(2), registration: { branchId: BigInt(2) } }

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    if ('isDeleted' in where && where.isDeleted !== record.isDeleted) return Promise.resolve(null)
    if ('registration' in where && where.registration?.branchId !== undefined && String(where.registration.branchId) !== String(record.branchId)) return Promise.resolve(null)
    if ('checkUpResult' in where && where.checkUpResult?.registration?.branchId !== undefined && String(where.checkUpResult.registration.branchId) !== String(record.branchId)) return Promise.resolve(null)
    return Promise.resolve(record)
  })
}

describe('pembayaran.routes — isolasi antar-cabang (IDOR)', () => {
  describe('GET /pembayaran/:id', () => {
    it('pembayaran milik cabang lain harus 404, bukan bocorkan invoice', async () => {
      const prisma = fullMockPrisma({ listOfPayment: { findFirst: simulateFindFirst(OTHER_BRANCH_PAYMENT) } })
      const app = await buildApp(pembayaranRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'GET', url: '/api/pembayaran/50' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('pembayaran milik cabang sendiri tetap 200 (kontrol positif)', async () => {
      const prisma = fullMockPrisma({ listOfPayment: { findFirst: simulateFindFirst(OWN_PAYMENT) } })
      const app = await buildApp(pembayaranRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'GET', url: '/api/pembayaran/1' })
      expect(res.statusCode).toBe(200)
      await app.close()
    })
  })

  it('POST /pembayaran dengan checkUpResultId milik cabang lain harus 404, bukan berhasil dibuat', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      checkUpResult: { findFirst: simulateFindFirst(OTHER_BRANCH_CHECKUP) },
      listOfPayment: { create: createMock },
    })
    const app = await buildApp(pembayaranRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'POST', url: '/api/pembayaran', payload: { checkUpResultId: '50' } })
    expect(res.statusCode).toBe(404)
    expect(createMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('DELETE /pembayaran/:id milik cabang lain harus 404, bukan terhapus', async () => {
    const updateMock = vi.fn().mockResolvedValue({ id: BigInt(50) })
    const prisma = fullMockPrisma({
      listOfPayment: { findFirst: simulateFindFirst(OTHER_BRANCH_PAYMENT), update: updateMock },
    })
    const app = await buildApp(pembayaranRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'DELETE', url: '/api/pembayaran/50' })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('GET /pembayaran/tagihan/:checkUpId milik cabang lain harus 404', async () => {
    const prisma = fullMockPrisma({ checkUpResult: { findFirst: simulateFindFirst(OTHER_BRANCH_CHECKUP) } })
    const app = await buildApp(pembayaranRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/pembayaran/tagihan/50' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('GET /pembayaran/antrian-kasir untuk admin harus tetap discope ke cabang sendiri, bukan where kosong', async () => {
    const findManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({ checkUpResult: { findMany: findManyMock } })
    const app = await buildApp(pembayaranRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/pembayaran/antrian-kasir' })
    expect(res.statusCode).toBe(200)
    const where = findManyMock.mock.calls[0][0].where
    expect('branchId' in (where.registration ?? {})).toBe(true)
    await app.close()
  })

  it('GET /pembayaran/stats untuk admin harus tetap discope ke cabang sendiri, bukan where kosong', async () => {
    const findManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({
      listOfPayment: { findMany: findManyMock },
      checkUpResult: { count: vi.fn().mockResolvedValue(0) },
    })
    const app = await buildApp(pembayaranRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/pembayaran/stats' })
    expect(res.statusCode).toBe(200)
    const where = findManyMock.mock.calls[0][0].where
    expect('branchId' in (where.checkUpResult?.registration ?? {})).toBe(true)
    await app.close()
  })
})
