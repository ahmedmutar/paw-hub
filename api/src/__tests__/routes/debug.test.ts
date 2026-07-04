import { describe, it, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole: vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

describe('debug route 500', () => {
  it('check actual error body from pasien route', async () => {
    const app = Fastify({ logger: false })
    app.decorate('prisma', {
      patient: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), groupBy: vi.fn().mockResolvedValue([]) },
      owner: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
      registration: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      medicalRecord: { findFirst: vi.fn().mockResolvedValue(null) },
    })
    app.addHook('preHandler', async (req: any) => {
      req.authUser = { userId: BigInt(1), role: 'admin', branchId: BigInt(1), tenantId: BigInt(1), fullname: 'A', username: 'a', branchName: 'B' }
    })
    const { pasienRoutes } = await import('../../modules/pasien/pasien.routes')
    await app.register(pasienRoutes, { prefix: '/api' })
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/api/pasien' })
    const res2 = await app.inject({ method: 'POST', url: '/api/pasien', payload: { petName: 'X', petCategory: 'Kucing', petGender: 'Jantan', ownerName: 'B', ownerPhone: '08123' } })
    console.log('GET /pasien STATUS:', res.statusCode)
    console.log('GET /pasien BODY:', res.body.substring(0, 400))
    console.log('POST /pasien STATUS:', res2.statusCode)
    console.log('POST /pasien BODY:', res2.body.substring(0, 400))
    await app.close()
  })
})
