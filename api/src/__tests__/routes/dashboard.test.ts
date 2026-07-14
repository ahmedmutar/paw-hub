import { describe, it, expect, vi } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { dashboardRoutes } from '../../modules/dashboard/dashboard.routes'

// DEFAULT_AUTH_USER: role admin, branchId=1, tenantId=1.
// Registration tidak punya tenantId langsung — cuma branchId. GET
// /dashboard/stats sebelumnya pakai where kosong `{}` untuk admin, bocor
// data dashboard (omzet, antrian, stok) lintas tenant.

describe('dashboard.routes — admin harus tetap discope ke tenant, bukan where kosong', () => {
  it('GET /dashboard/stats untuk admin harus tenant-scoped', async () => {
    const countMock = vi.fn().mockResolvedValue(0)
    const prisma = fullMockPrisma({
      registration: { count: countMock, groupBy: vi.fn().mockResolvedValue([]) },
      checkUpResult: { count: vi.fn().mockResolvedValue(0) },
      listOfPayment: { findMany: vi.fn().mockResolvedValue([]) },
      listOfItem: { findMany: vi.fn().mockResolvedValue([]) },
      detailServicePatient: { groupBy: vi.fn().mockResolvedValue([]) },
      priceService: { findMany: vi.fn().mockResolvedValue([]) },
    })
    const app = await buildApp(dashboardRoutes, prisma, DEFAULT_AUTH_USER)

    const res = await app.inject({ method: 'GET', url: '/api/dashboard/stats' })
    expect(res.statusCode).toBe(200)

    const where = countMock.mock.calls[0][0].where
    const hasTenantScope = 'branchId' in where || ('branch' in where && 'tenantId' in (where.branch ?? {}))
    expect(hasTenantScope).toBe(true)
    await app.close()
  })
})

describe('GET /dashboard/stats — admin instalasi lama (tenantId null) tidak boleh crash', () => {
  it('tidak 500 saat admin.tenantId null, tetap 200 tanpa filter tenant', async () => {
    const countMock = vi.fn().mockResolvedValue(0)
    const prisma = fullMockPrisma({
      registration: { count: countMock, groupBy: vi.fn().mockResolvedValue([]) },
      checkUpResult: { count: vi.fn().mockResolvedValue(0) },
      listOfPayment: { findMany: vi.fn().mockResolvedValue([]) },
      listOfItem: { findMany: vi.fn().mockResolvedValue([]) },
      detailServicePatient: { groupBy: vi.fn().mockResolvedValue([]) },
      priceService: { findMany: vi.fn().mockResolvedValue([]) },
    })
    const app = await buildApp(dashboardRoutes, prisma, { ...DEFAULT_AUTH_USER, tenantId: null as any })

    const res = await app.inject({ method: 'GET', url: '/api/dashboard/stats' })

    expect(res.statusCode).toBe(200)
    await app.close()
  })
})

describe('GET /dashboard/stats — nearExpiry', () => {
  it('menyertakan daftar barang yang mendekati kadaluwarsa', async () => {
    const nearExpiryItem = { id: BigInt(1), itemName: 'Vaksin Rabies', totalItem: 5, expiredDate: new Date() }
    const prisma = fullMockPrisma({
      registration: { count: vi.fn().mockResolvedValue(0), groupBy: vi.fn().mockResolvedValue([]) },
      checkUpResult: { count: vi.fn().mockResolvedValue(0) },
      listOfPayment: { findMany: vi.fn().mockResolvedValue([]) },
      listOfItem: {
        findMany: vi.fn()
          .mockResolvedValueOnce([]) // lowStockItems
          .mockResolvedValueOnce([nearExpiryItem]), // nearExpiryItems
      },
      detailServicePatient: { groupBy: vi.fn().mockResolvedValue([]) },
      priceService: { findMany: vi.fn().mockResolvedValue([]) },
    })
    const app = await buildApp(dashboardRoutes, prisma, DEFAULT_AUTH_USER)

    const res = await app.inject({ method: 'GET', url: '/api/dashboard/stats' })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.nearExpiry).toHaveLength(1)
    expect(res.json().data.nearExpiry[0].itemName).toBe('Vaksin Rabies')
    await app.close()
  })
})
