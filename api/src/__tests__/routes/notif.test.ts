import { describe, it, expect, vi } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { notifRoutes } from '../../modules/notif/notif.routes'

// DEFAULT_AUTH_USER: role admin, branchId=1, tenantId=1.
// WhatsappLog punya branchId langsung (tidak ada tenantId). GET /notif/log
// dan /notif/log/stats untuk admin pakai where kosong `{}`, dan
// POST /notif/wa/resend/:id sama sekali tidak filter branchId.

function hasTenantScope(where: any) {
  return 'branchId' in (where ?? {}) || ('branch' in (where ?? {}) && 'tenantId' in (where.branch ?? {}))
}

describe('notif.routes — admin harus tetap discope ke tenant, bukan where kosong', () => {
  it('GET /notif/log untuk admin harus tenant-scoped', async () => {
    const findManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({ whatsappLog: { findMany: findManyMock, count: vi.fn().mockResolvedValue(0) } })
    const app = await buildApp(notifRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/notif/log' })
    expect(res.statusCode).toBe(200)
    expect(hasTenantScope(findManyMock.mock.calls[0][0].where)).toBe(true)
    await app.close()
  })

  it('GET /notif/log/stats untuk admin harus tenant-scoped', async () => {
    const countMock = vi.fn().mockResolvedValue(0)
    const prisma = fullMockPrisma({ whatsappLog: { count: countMock } })
    const app = await buildApp(notifRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/notif/log/stats' })
    expect(res.statusCode).toBe(200)
    expect(hasTenantScope(countMock.mock.calls[0][0].where)).toBe(true)
    await app.close()
  })
})

describe('notif.routes — isolasi antar-tenant (IDOR)', () => {
  it('POST /notif/wa/resend/:id milik tenant lain harus 404, bukan berhasil dikirim ulang', async () => {
    const findFirstMock = vi.fn().mockResolvedValue(null)
    const prisma = fullMockPrisma({ whatsappLog: { findFirst: findFirstMock } })
    const app = await buildApp(notifRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'POST', url: '/api/notif/wa/resend/50' })
    expect(findFirstMock).toHaveBeenCalled()
    expect(res.statusCode).toBe(404)
    const where = findFirstMock.mock.calls[0][0].where
    expect(hasTenantScope(where)).toBe(true)
    await app.close()
  })
})
