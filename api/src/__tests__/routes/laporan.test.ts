import { describe, it, expect, vi } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { laporanRoutes } from '../../modules/laporan/laporan.routes'

// DEFAULT_AUTH_USER: role admin, branchId=1, tenantId=1.
// Expense tidak punya tenantId langsung (cuma branchId), jadi filter admin
// yang benar harus tenant-wide lewat relasi branch.tenantId — bukan where
// kosong `{}` seperti sebelumnya (itu bocor laporan keuangan ke SEMUA tenant).

function hasTenantScope(where: any) {
  return 'branchId' in (where ?? {}) || ('branch' in (where ?? {}) && 'tenantId' in (where.branch ?? {}))
}

describe('laporan.routes — admin harus tetap discope ke tenant, bukan where kosong', () => {
  it('GET /laporan/harian: query expense untuk admin harus tenant-scoped', async () => {
    const expenseFindManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({
      listOfPayment: { findMany: vi.fn().mockResolvedValue([]) },
      expense: { findMany: expenseFindManyMock },
    })
    const app = await buildApp(laporanRoutes, prisma, DEFAULT_AUTH_USER)

    const res = await app.inject({ method: 'GET', url: '/api/laporan/harian' })
    expect(res.statusCode).toBe(200)
    expect(hasTenantScope(expenseFindManyMock.mock.calls[0][0].where)).toBe(true)
    await app.close()
  })

  it('GET /laporan/bulanan: query expense untuk admin harus tenant-scoped', async () => {
    const expenseFindManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({
      listOfPayment: { findMany: vi.fn().mockResolvedValue([]) },
      expense: { findMany: expenseFindManyMock },
    })
    const app = await buildApp(laporanRoutes, prisma, DEFAULT_AUTH_USER)

    const res = await app.inject({ method: 'GET', url: '/api/laporan/bulanan' })
    expect(res.statusCode).toBe(200)
    expect(hasTenantScope(expenseFindManyMock.mock.calls[0][0].where)).toBe(true)
    await app.close()
  })

  it('GET /laporan/rekap: query expense untuk admin harus tenant-scoped', async () => {
    const expenseFindManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({
      listOfPayment: { findMany: vi.fn().mockResolvedValue([]) },
      expense: { findMany: expenseFindManyMock },
    })
    const app = await buildApp(laporanRoutes, prisma, DEFAULT_AUTH_USER)

    const res = await app.inject({ method: 'GET', url: '/api/laporan/rekap' })
    expect(res.statusCode).toBe(200)
    expect(hasTenantScope(expenseFindManyMock.mock.calls[0][0].where)).toBe(true)
    await app.close()
  })

  it('GET /laporan/ringkasan: query expense untuk admin harus tenant-scoped', async () => {
    const expenseFindManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({
      listOfPayment: { findMany: vi.fn().mockResolvedValue([]) },
      expense: { findMany: expenseFindManyMock },
    })
    const app = await buildApp(laporanRoutes, prisma, DEFAULT_AUTH_USER)

    const res = await app.inject({ method: 'GET', url: '/api/laporan/ringkasan' })
    expect(res.statusCode).toBe(200)
    expect(hasTenantScope(expenseFindManyMock.mock.calls[0][0].where)).toBe(true)
    await app.close()
  })

  it('GET /laporan/harian: query payment untuk admin harus tenant-scoped (bukan checkUpResult kosong)', async () => {
    const paymentFindManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({
      listOfPayment: { findMany: paymentFindManyMock },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
    })
    const app = await buildApp(laporanRoutes, prisma, DEFAULT_AUTH_USER)

    const res = await app.inject({ method: 'GET', url: '/api/laporan/harian' })
    expect(res.statusCode).toBe(200)
    const where = paymentFindManyMock.mock.calls[0][0].where
    const regWhere = where.checkUpResult?.registration ?? {}
    expect(hasTenantScope(regWhere)).toBe(true)
    await app.close()
  })
})
