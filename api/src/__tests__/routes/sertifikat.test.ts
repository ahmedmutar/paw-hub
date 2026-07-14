import { describe, it, expect, vi } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { sertifikatRoutes } from '../../modules/sertifikat/sertifikat.routes'

// DEFAULT_AUTH_USER: role admin, branchId=1, tenantId=1.
// VaccinationRecord/MajorProcedureRecord/CheckUpResult tidak punya branchId
// langsung — cuma lewat relasi checkUpResult.registration.branch (atau
// registration.branch untuk sertifikat sehat). Sebelumnya tidak ada
// requireRole ATAUPUN filter cabang/tenant sama sekali di ketiga endpoint.

const OTHER_TENANT_VACCINATION = {
  id: BigInt(50), vaccineName: 'Rabies', administeredAt: new Date(), batchNumber: null, nextDueAt: null, notes: null,
  patient: { petName: 'Kucing Lain', petCategory: 'Kucing', owner: { ownerName: 'Orang Lain' } },
  checkUpResult: { doctor: { fullname: 'Dr. Lain' }, registration: { branch: { branchName: 'Cabang Lain', tenantId: BigInt(99) } } },
}
const OWN_VACCINATION = {
  ...OTHER_TENANT_VACCINATION, id: BigInt(1),
  checkUpResult: { doctor: { fullname: 'Dr. Sendiri' }, registration: { branch: { branchName: 'Cabang Sendiri', tenantId: BigInt(1) } } },
}

const OTHER_TENANT_CHECKUP = {
  id: BigInt(51), createdAt: new Date(), diagnosa: null, weightKg: null, temperature: null, homeInstructions: null,
  doctor: { fullname: 'Dr. Lain' },
  registration: { branch: { branchName: 'Cabang Lain', tenantId: BigInt(99) }, patient: { petName: 'Kucing Lain', petCategory: 'Kucing', owner: { ownerName: 'Orang Lain' } } },
}

const OTHER_TENANT_PROCEDURE = {
  id: BigInt(52), procedureName: 'Operasi', performedAt: new Date(), notes: null,
  patient: { petName: 'Kucing Lain', petCategory: 'Kucing', owner: { ownerName: 'Orang Lain' } },
  checkUpResult: { doctor: { fullname: 'Dr. Lain' }, registration: { branch: { branchName: 'Cabang Lain', tenantId: BigInt(99) } } },
}

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    const tenantId = where.checkUpResult?.registration?.branch?.tenantId ?? where.registration?.branch?.tenantId
    if (tenantId !== undefined) {
      const recordTenantId = record.checkUpResult?.registration?.branch?.tenantId ?? record.registration?.branch?.tenantId
      if (String(tenantId) !== String(recordTenantId)) return Promise.resolve(null)
    }
    return Promise.resolve(record)
  })
}

describe('sertifikat.routes — isolasi antar-tenant (IDOR)', () => {
  it('GET /sertifikat/vaksin/:id milik tenant lain harus 404, bukan bocorkan PDF (sebelumnya tanpa cek apapun)', async () => {
    const prisma = fullMockPrisma({ vaccinationRecord: { findFirst: simulateFindFirst(OTHER_TENANT_VACCINATION) } })
    const app = await buildApp(sertifikatRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/sertifikat/vaksin/50' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('GET /sertifikat/vaksin/:id milik tenant sendiri tetap 200 (kontrol positif)', async () => {
    const prisma = fullMockPrisma({ vaccinationRecord: { findFirst: simulateFindFirst(OWN_VACCINATION) } })
    const app = await buildApp(sertifikatRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/sertifikat/vaksin/1' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('GET /sertifikat/sehat/:id milik tenant lain harus 404', async () => {
    const prisma = fullMockPrisma({ checkUpResult: { findFirst: simulateFindFirst(OTHER_TENANT_CHECKUP) } })
    const app = await buildApp(sertifikatRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/sertifikat/sehat/51' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('GET /sertifikat/prosedur/:id milik tenant lain harus 404', async () => {
    const prisma = fullMockPrisma({ majorProcedureRecord: { findFirst: simulateFindFirst(OTHER_TENANT_PROCEDURE) } })
    const app = await buildApp(sertifikatRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/sertifikat/prosedur/52' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

describe('GET /sertifikat/vaksin/:id — admin instalasi lama (tenantId null) tidak boleh crash', () => {
  it('tetap 200 tanpa filter tenant saat admin.tenantId null', async () => {
    const prisma = fullMockPrisma({ vaccinationRecord: { findFirst: vi.fn().mockResolvedValue(OWN_VACCINATION) } })
    const app = await buildApp(sertifikatRoutes, prisma, { ...DEFAULT_AUTH_USER, tenantId: null as any })
    const res = await app.inject({ method: 'GET', url: '/api/sertifikat/vaksin/1' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
