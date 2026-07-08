import { describe, it, expect, vi } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { rekamMedisRoutes } from '../../modules/rekam-medis/rekam-medis.routes'

// DEFAULT_AUTH_USER: role admin, branchId=1, tenantId=1.
// Patient punya branchId langsung (bukan tenantId), jadi fix pakai filter
// custom mirip modul lain (admin -> branch.tenantId, non-admin -> branchId).
// VaccinationRecord/DewormingRecord/MajorProcedureRecord TIDAK punya branchId
// sama sekali, cuma relasi lewat patientId -> patient.branchId, jadi filter
// kepemilikannya harus lewat relasi `patient: { ... }`.

const OTHER_TENANT_PATIENT = { id: BigInt(50), branchId: BigInt(99), tenantId: BigInt(99), isDeleted: false, owner: {}, branch: {} }
const OWN_PATIENT = { id: BigInt(1), branchId: BigInt(1), tenantId: BigInt(1), isDeleted: false, owner: {}, branch: {} }

function simulateFindFirstPatient(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    for (const key of Object.keys(where)) {
      if (key === 'id' && String(where.id) !== String(record.id)) return Promise.resolve(null)
      if (key === 'isDeleted' && where.isDeleted !== record.isDeleted) return Promise.resolve(null)
      if (key === 'branchId' && String(where.branchId) !== String(record.branchId)) return Promise.resolve(null)
      if (key === 'branch' && where.branch?.tenantId !== undefined && String(where.branch.tenantId) !== String(record.tenantId)) return Promise.resolve(null)
    }
    return Promise.resolve(record)
  })
}

// Simulasi findFirst untuk record anak (vaksinasi/obat-cacing/tindakan) yang
// filternya lewat relasi `patient: { branchId }` atau `patient: { branch: { tenantId } }`.
function simulateFindFirstChild(record: Record<string, any>, patientOwnedByOtherTenant: boolean) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    if ('patient' in where && patientOwnedByOtherTenant) return Promise.resolve(null)
    return Promise.resolve(record)
  })
}

describe('rekam-medis.routes — isolasi antar-cabang & antar-tenant (IDOR)', () => {
  describe('GET /rekam-medis/:patientId', () => {
    it('pasien milik tenant lain harus 404', async () => {
      const prisma = fullMockPrisma({ patient: { findFirst: simulateFindFirstPatient(OTHER_TENANT_PATIENT) } })
      const app = await buildApp(rekamMedisRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'GET', url: '/api/rekam-medis/50' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('pasien milik tenant sendiri tetap 200 (kontrol positif)', async () => {
      const prisma = fullMockPrisma({ patient: { findFirst: simulateFindFirstPatient(OWN_PATIENT) } })
      const app = await buildApp(rekamMedisRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'GET', url: '/api/rekam-medis/1' })
      expect(res.statusCode).toBe(200)
      await app.close()
    })
  })

  describe('PUT /rekam-medis/:patientId/kartu', () => {
    it('pasien milik tenant lain harus 404, bukan berhasil upsert kartu', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
      const prisma = fullMockPrisma({
        patient: { findFirst: simulateFindFirstPatient(OTHER_TENANT_PATIENT) },
        medicalRecord: { upsert: upsertMock },
      })
      const app = await buildApp(rekamMedisRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'PUT', url: '/api/rekam-medis/50/kartu', payload: { allergies: 'Bulu kucing' } })
      expect(res.statusCode).toBe(404)
      expect(upsertMock).not.toHaveBeenCalled()
      await app.close()
    })
  })

  describe('POST /rekam-medis/:patientId/berat', () => {
    it('pasien milik tenant lain harus 404, bukan berhasil catat berat', async () => {
      const createMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
      const prisma = fullMockPrisma({
        patient: { findFirst: simulateFindFirstPatient(OTHER_TENANT_PATIENT) },
        weightRecord: { create: createMock },
      })
      const app = await buildApp(rekamMedisRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'POST', url: '/api/rekam-medis/50/berat', payload: { weightKg: 5 } })
      expect(res.statusCode).toBe(404)
      expect(createMock).not.toHaveBeenCalled()
      await app.close()
    })
  })

  describe('Vaksinasi', () => {
    it('POST vaksinasi untuk pasien tenant lain harus 404, bukan berhasil dicatat', async () => {
      const createMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
      const prisma = fullMockPrisma({
        patient: { findFirst: simulateFindFirstPatient(OTHER_TENANT_PATIENT) },
        vaccinationRecord: { create: createMock },
      })
      const app = await buildApp(rekamMedisRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'POST', url: '/api/rekam-medis/50/vaksinasi', payload: { vaccineName: 'Rabies', administeredAt: '2026-01-01' } })
      expect(res.statusCode).toBe(404)
      expect(createMock).not.toHaveBeenCalled()
      await app.close()
    })

    it('PUT /vaksinasi/:id milik pasien tenant lain harus 404, bukan berhasil update', async () => {
      const updateMock = vi.fn().mockResolvedValue({ id: BigInt(50) })
      const prisma = fullMockPrisma({
        vaccinationRecord: { findFirst: simulateFindFirstChild({ id: BigInt(50) }, true), update: updateMock },
      })
      const app = await buildApp(rekamMedisRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'PUT', url: '/api/rekam-medis/vaksinasi/50', payload: { vaccineName: 'Diubah' } })
      expect(res.statusCode).toBe(404)
      expect(updateMock).not.toHaveBeenCalled()
      await app.close()
    })

    it('DELETE /vaksinasi/:id milik pasien tenant lain harus 404, bukan terhapus', async () => {
      const deleteMock = vi.fn().mockResolvedValue({ id: BigInt(50) })
      const prisma = fullMockPrisma({
        vaccinationRecord: { findFirst: simulateFindFirstChild({ id: BigInt(50) }, true), delete: deleteMock },
      })
      const app = await buildApp(rekamMedisRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'DELETE', url: '/api/rekam-medis/vaksinasi/50' })
      expect(res.statusCode).toBe(404)
      expect(deleteMock).not.toHaveBeenCalled()
      await app.close()
    })
  })

  describe('Obat Cacing', () => {
    it('POST obat-cacing untuk pasien tenant lain harus 404', async () => {
      const createMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
      const prisma = fullMockPrisma({
        patient: { findFirst: simulateFindFirstPatient(OTHER_TENANT_PATIENT) },
        dewormingRecord: { create: createMock },
      })
      const app = await buildApp(rekamMedisRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'POST', url: '/api/rekam-medis/50/obat-cacing', payload: { medicationName: 'Combantrin', administeredAt: '2026-01-01' } })
      expect(res.statusCode).toBe(404)
      expect(createMock).not.toHaveBeenCalled()
      await app.close()
    })

    it('PUT /obat-cacing/:id milik pasien tenant lain harus 404', async () => {
      const updateMock = vi.fn().mockResolvedValue({ id: BigInt(50) })
      const prisma = fullMockPrisma({
        dewormingRecord: { findFirst: simulateFindFirstChild({ id: BigInt(50) }, true), update: updateMock },
      })
      const app = await buildApp(rekamMedisRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'PUT', url: '/api/rekam-medis/obat-cacing/50', payload: { medicationName: 'Diubah' } })
      expect(res.statusCode).toBe(404)
      expect(updateMock).not.toHaveBeenCalled()
      await app.close()
    })

    it('DELETE /obat-cacing/:id milik pasien tenant lain harus 404', async () => {
      const deleteMock = vi.fn().mockResolvedValue({ id: BigInt(50) })
      const prisma = fullMockPrisma({
        dewormingRecord: { findFirst: simulateFindFirstChild({ id: BigInt(50) }, true), delete: deleteMock },
      })
      const app = await buildApp(rekamMedisRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'DELETE', url: '/api/rekam-medis/obat-cacing/50' })
      expect(res.statusCode).toBe(404)
      expect(deleteMock).not.toHaveBeenCalled()
      await app.close()
    })
  })

  describe('Tindakan', () => {
    it('POST tindakan untuk pasien tenant lain harus 404', async () => {
      const createMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
      const prisma = fullMockPrisma({
        patient: { findFirst: simulateFindFirstPatient(OTHER_TENANT_PATIENT) },
        majorProcedureRecord: { create: createMock },
      })
      const app = await buildApp(rekamMedisRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'POST', url: '/api/rekam-medis/50/tindakan', payload: { procedureName: 'Operasi', performedAt: '2026-01-01' } })
      expect(res.statusCode).toBe(404)
      expect(createMock).not.toHaveBeenCalled()
      await app.close()
    })

    it('PUT /tindakan/:id milik pasien tenant lain harus 404', async () => {
      const updateMock = vi.fn().mockResolvedValue({ id: BigInt(50) })
      const prisma = fullMockPrisma({
        majorProcedureRecord: { findFirst: simulateFindFirstChild({ id: BigInt(50) }, true), update: updateMock },
      })
      const app = await buildApp(rekamMedisRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'PUT', url: '/api/rekam-medis/tindakan/50', payload: { procedureName: 'Diubah' } })
      expect(res.statusCode).toBe(404)
      expect(updateMock).not.toHaveBeenCalled()
      await app.close()
    })

    it('DELETE /tindakan/:id milik pasien tenant lain harus 404', async () => {
      const deleteMock = vi.fn().mockResolvedValue({ id: BigInt(50) })
      const prisma = fullMockPrisma({
        majorProcedureRecord: { findFirst: simulateFindFirstChild({ id: BigInt(50) }, true), delete: deleteMock },
      })
      const app = await buildApp(rekamMedisRoutes, prisma, DEFAULT_AUTH_USER)
      const res = await app.inject({ method: 'DELETE', url: '/api/rekam-medis/tindakan/50' })
      expect(res.statusCode).toBe(404)
      expect(deleteMock).not.toHaveBeenCalled()
      await app.close()
    })
  })
})
