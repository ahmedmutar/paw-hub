import { describe, it, expect, vi } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { cabangRoutes } from '../../modules/cabang/cabang.routes'

describe('POST /cabang — batas paket', () => {
  it('ditolak 402 saat jumlah cabang tenant sudah mencapai batas maksimal paket', async () => {
    const createMock = vi.fn()
    const prisma = fullMockPrisma({
      branch: { findUnique: vi.fn().mockResolvedValue(null), create: createMock },
      tenantSubscription: {
        findUnique: vi.fn().mockResolvedValue({ plan: { name: 'Free', maxBranches: 1, features: {} } }),
      },
    })
    ;(prisma as any).branch.count = vi.fn().mockResolvedValue(1)
    const app = await buildApp(cabangRoutes, prisma, DEFAULT_AUTH_USER)

    const res = await app.inject({
      method: 'POST', url: '/api/cabang',
      payload: { branchCode: 'C2', branchName: 'Cabang Kedua' },
    })

    expect(res.statusCode).toBe(402)
    expect(createMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('diizinkan saat masih di bawah batas maksimal paket', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: BigInt(2), branchCode: 'C2', branchName: 'Cabang Kedua' })
    const prisma = fullMockPrisma({
      branch: { findUnique: vi.fn().mockResolvedValue(null), create: createMock },
      tenantSubscription: {
        findUnique: vi.fn().mockResolvedValue({ plan: { name: 'Pro', maxBranches: 5, features: {} } }),
      },
    })
    ;(prisma as any).branch.count = vi.fn().mockResolvedValue(1)
    const app = await buildApp(cabangRoutes, prisma, DEFAULT_AUTH_USER)

    const res = await app.inject({
      method: 'POST', url: '/api/cabang',
      payload: { branchCode: 'C2', branchName: 'Cabang Kedua' },
    })

    expect(res.statusCode).toBe(201)
    expect(createMock).toHaveBeenCalled()
    await app.close()
  })
})
