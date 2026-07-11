import { describe, it, expect, vi } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { reminderRoutes } from '../../modules/reminder/reminder.routes'

// DEFAULT_AUTH_USER: role admin, branchId=1, tenantId=1.
// VaccinationRecord/DewormingRecord/ReminderLog tidak punya branchId
// langsung — cuma lewat relasi patientId -> patient.branchId.

function hasTenantScope(where: any) {
  const p = where?.patient ?? {}
  return 'branchId' in p || ('branch' in p && 'tenantId' in (p.branch ?? {}))
}

describe('reminder.routes — admin harus tetap discope ke tenant, bukan where kosong', () => {
  it('GET /reminder/upcoming untuk admin harus tenant-scoped', async () => {
    const findManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({
      vaccinationRecord: { findMany: findManyMock },
      dewormingRecord: { findMany: vi.fn().mockResolvedValue([]) },
    })
    const app = await buildApp(reminderRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/reminder/upcoming' })
    expect(res.statusCode).toBe(200)
    expect(hasTenantScope(findManyMock.mock.calls[0][0].where)).toBe(true)
    await app.close()
  })

  it('GET /reminder/stats untuk admin harus tenant-scoped', async () => {
    const countMock = vi.fn().mockResolvedValue(0)
    const prisma = fullMockPrisma({
      vaccinationRecord: { count: countMock },
      dewormingRecord: { count: vi.fn().mockResolvedValue(0) },
      reminderLog: { count: vi.fn().mockResolvedValue(0) },
    })
    const app = await buildApp(reminderRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/reminder/stats' })
    expect(res.statusCode).toBe(200)
    expect(hasTenantScope(countMock.mock.calls[0][0].where)).toBe(true)
    await app.close()
  })

  it('GET /reminder/log harus tetap discope ke cabang/tenant, bukan tanpa filter sama sekali', async () => {
    const findManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({ reminderLog: { findMany: findManyMock, count: vi.fn().mockResolvedValue(0) } })
    const app = await buildApp(reminderRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/reminder/log' })
    expect(res.statusCode).toBe(200)
    expect(hasTenantScope(findManyMock.mock.calls[0][0].where)).toBe(true)
    await app.close()
  })
})

describe('reminder.routes — isolasi antar-tenant (IDOR)', () => {
  it('POST /reminder/send-manual/:type/:recordId untuk record milik tenant lain harus 404, bukan berhasil dikirim ulang', async () => {
    const deleteManyMock = vi.fn().mockResolvedValue({ count: 0 })
    const prisma = fullMockPrisma({
      vaccinationRecord: { findFirst: vi.fn().mockResolvedValue(null) },
      reminderLog: { deleteMany: deleteManyMock },
    })
    const app = await buildApp(reminderRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'POST', url: '/api/reminder/send-manual/vaccination/50' })
    expect(res.statusCode).toBe(404)
    expect(deleteManyMock).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('POST /reminder/run — fitur reminder harus sesuai paket klinik', () => {
  it('ditolak 402 kalau paket klinik tidak punya fitur reminder', async () => {
    const findManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({
      vaccinationRecord: { findMany: findManyMock },
      tenantSubscription: {
        findUnique: vi.fn().mockResolvedValue({ plan: { name: 'Free', features: { reminder: false } } }),
      },
    })
    const app = await buildApp(reminderRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'POST', url: '/api/reminder/run' })
    expect(res.statusCode).toBe(402)
    expect(findManyMock).not.toHaveBeenCalled()
    await app.close()
  })
})
