import { describe, it, expect, vi } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { pemeriksaanRoutes } from '../../modules/pemeriksaan/pemeriksaan.routes'

// DEFAULT_AUTH_USER: role admin, branchId=1, tenantId=1.
// CheckUpResult tidak punya branchId langsung — cuma bisa dicek lewat relasi
// patientRegistrationId -> registration.branchId. Modul ini juga TIDAK punya
// pola tenant-wide untuk admin (GET list sudah mengunci SEMUA role, termasuk
// admin, ke branchId sendiri) — jadi fix-nya konsisten: kunci ke branchId
// sendiri, bukan tenant-wide.

const OTHER_BRANCH_CHECKUP = { id: BigInt(50), isDeleted: false, statusFinish: false, branchId: BigInt(2), registration: { branchId: BigInt(2), patient: { id: BigInt(1) } } }
const OWN_CHECKUP = { id: BigInt(1), isDeleted: false, statusFinish: false, branchId: BigInt(1), registration: { branchId: BigInt(1), patient: { id: BigInt(1) } } }

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    if ('isDeleted' in where && where.isDeleted !== record.isDeleted) return Promise.resolve(null)
    if ('registration' in where && where.registration?.branchId !== undefined && String(where.registration.branchId) !== String(record.branchId)) return Promise.resolve(null)
    return Promise.resolve(record)
  })
}

describe('pemeriksaan.routes — isolasi antar-cabang (IDOR)', () => {
  describe('GET /pemeriksaan/:id', () => {
    it('pemeriksaan milik cabang lain harus 404', async () => {
      const prisma = fullMockPrisma({ checkUpResult: { findFirst: simulateFindFirst(OTHER_BRANCH_CHECKUP) } })
      const app = await buildApp(pemeriksaanRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'GET', url: '/api/pemeriksaan/50' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('pemeriksaan milik cabang sendiri tetap 200 (kontrol positif)', async () => {
      const prisma = fullMockPrisma({ checkUpResult: { findFirst: simulateFindFirst(OWN_CHECKUP) } })
      const app = await buildApp(pemeriksaanRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'GET', url: '/api/pemeriksaan/1' })
      expect(res.statusCode).toBe(200)
      await app.close()
    })
  })

  it('PUT /pemeriksaan/:id milik cabang lain harus 404, bukan berhasil update', async () => {
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_CHECKUP, diagnosa: 'Diubah' })
    const prisma = fullMockPrisma({ checkUpResult: { findFirst: simulateFindFirst(OTHER_BRANCH_CHECKUP), update: updateMock } })
    const app = await buildApp(pemeriksaanRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'PUT', url: '/api/pemeriksaan/50', payload: { diagnosa: 'Diubah' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('POST /pemeriksaan/:id/items milik cabang lain harus 404, bukan berhasil tambah item', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      checkUpResult: { findFirst: simulateFindFirst(OTHER_BRANCH_CHECKUP) },
      detailItemPatient: { create: createMock },
    })
    const app = await buildApp(pemeriksaanRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'POST', url: '/api/pemeriksaan/50/items', payload: { priceItemId: '1', quantity: 1, priceOverall: 1000 } })
    expect(res.statusCode).toBe(404)
    expect(createMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('DELETE /pemeriksaan/:id/items/:itemId milik cabang lain harus 404, bukan terhapus', async () => {
    const deleteMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      checkUpResult: { findFirst: simulateFindFirst(OTHER_BRANCH_CHECKUP) },
      detailItemPatient: { delete: deleteMock },
    })
    const app = await buildApp(pemeriksaanRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'DELETE', url: '/api/pemeriksaan/50/items/1' })
    expect(res.statusCode).toBe(404)
    expect(deleteMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('POST /pemeriksaan/:id/services milik cabang lain harus 404, bukan berhasil tambah layanan', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      checkUpResult: { findFirst: simulateFindFirst(OTHER_BRANCH_CHECKUP) },
      detailServicePatient: { create: createMock },
    })
    const app = await buildApp(pemeriksaanRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'POST', url: '/api/pemeriksaan/50/services', payload: { priceServiceId: '1', priceOverall: 1000 } })
    expect(res.statusCode).toBe(404)
    expect(createMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('DELETE /pemeriksaan/:id/services/:serviceId milik cabang lain harus 404, bukan terhapus', async () => {
    const deleteMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      checkUpResult: { findFirst: simulateFindFirst(OTHER_BRANCH_CHECKUP) },
      detailServicePatient: { delete: deleteMock },
    })
    const app = await buildApp(pemeriksaanRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'DELETE', url: '/api/pemeriksaan/50/services/1' })
    expect(res.statusCode).toBe(404)
    expect(deleteMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('POST /pemeriksaan/:id/medicine-groups milik cabang lain harus 404, bukan berhasil tambah', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      checkUpResult: { findFirst: simulateFindFirst(OTHER_BRANCH_CHECKUP) },
      detailMedicineGroupResult: { create: createMock },
    })
    const app = await buildApp(pemeriksaanRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'POST', url: '/api/pemeriksaan/50/medicine-groups', payload: { medicineGroupId: '1' } })
    expect(res.statusCode).toBe(404)
    expect(createMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('DELETE /pemeriksaan/:id/medicine-groups/:mgId milik cabang lain harus 404, bukan terhapus', async () => {
    const deleteMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      checkUpResult: { findFirst: simulateFindFirst(OTHER_BRANCH_CHECKUP) },
      detailMedicineGroupResult: { delete: deleteMock },
    })
    const app = await buildApp(pemeriksaanRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'DELETE', url: '/api/pemeriksaan/50/medicine-groups/1' })
    expect(res.statusCode).toBe(404)
    expect(deleteMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('POST /pemeriksaan/:id/selesai milik cabang lain harus 404, bukan berhasil ditandai selesai', async () => {
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_CHECKUP, statusFinish: true })
    const prisma = fullMockPrisma({ checkUpResult: { findFirst: simulateFindFirst(OTHER_BRANCH_CHECKUP), update: updateMock } })
    const app = await buildApp(pemeriksaanRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'POST', url: '/api/pemeriksaan/50/selesai' })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('DELETE /pemeriksaan/:id milik cabang lain harus 404, bukan terhapus (sebelumnya TANPA cek apapun)', async () => {
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_CHECKUP, isDeleted: true })
    const prisma = fullMockPrisma({ checkUpResult: { findFirst: simulateFindFirst(OTHER_BRANCH_CHECKUP), update: updateMock } })
    const app = await buildApp(pemeriksaanRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'DELETE', url: '/api/pemeriksaan/50' })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })
})
