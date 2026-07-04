// F-01: Autentikasi & Manajemen Sesi
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

const mockUser = {
  id: BigInt(1), username: 'admin', fullname: 'Admin Test',
  password: '$2a$10$abcdefghijklmnopqrstuvwxyz123456', // bcrypt hash
  role: 'admin', status: true, isDeleted: false,
  branch: { branchName: 'Test Branch' }, branchId: BigInt(1), tenantId: BigInt(1),
}

function makePrisma() {
  return fullMockPrisma({
    user: { findFirst: vi.fn().mockResolvedValue(mockUser) },
    refreshToken: { create: vi.fn().mockResolvedValue({ token: 'refresh-token', userId: BigInt(1) }), findFirst: vi.fn().mockResolvedValue(null), deleteMany: vi.fn() },
  })
}

describe('F-01 Autentikasi', () => {
  it('POST /api/masuk dengan kredensial salah mengembalikan 401', async () => {
    const prisma = makePrisma()
    prisma.user.findFirst = vi.fn().mockResolvedValue(null)
    const { authRoutes } = await import('../../modules/auth/auth.routes')
    const app = await buildApp(authRoutes, prisma)
    const res = await app.inject({
      method: 'POST', url: '/api/masuk',
      payload: { username: 'salah', password: 'salah' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('POST /api/masuk tanpa body mengembalikan 400', async () => {
    const { authRoutes } = await import('../../modules/auth/auth.routes')
    const app = await buildApp(authRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/masuk',
      payload: {},
    })
    expect([400, 401]).toContain(res.statusCode)
    await app.close()
  })

  it('POST /api/keluar mengembalikan 200', async () => {
    const { authRoutes } = await import('../../modules/auth/auth.routes')
    const app = await buildApp(authRoutes, makePrisma())
    const res = await app.inject({ method: 'POST', url: '/api/keluar' })
    expect([200, 204]).toContain(res.statusCode)
    await app.close()
  })
})
