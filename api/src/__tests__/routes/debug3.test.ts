import { describe, it, vi } from 'vitest'
import { buildApp, fullMockPrisma } from '../helpers/buildApp'
vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))
global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true }) }) as any

const mockLog = {
  id: BigInt(1), recipientPhone: '08123', type: 'antrian', message: 'Test',
  status: 'sent', sentAt: new Date(), branchId: BigInt(1), userId: BigInt(1),
}

describe('debug3', () => {
  it('notif log', async () => {
    const prisma = fullMockPrisma({ whatsappLog: { findMany: vi.fn().mockResolvedValue([mockLog]), count: vi.fn().mockResolvedValue(1) } })
    const { notifRoutes } = await import('../../modules/notif/notif.routes')
    const app = await buildApp(notifRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/notif/log' })
    console.log('notif STATUS:', res.statusCode, res.body.substring(0, 300))
    await app.close()
  })
  
  it('grooming antrian', async () => {
    const mockSession = {
      id: BigInt(1), patientId: BigInt(1), groomerId: BigInt(2), packageId: BigInt(0), 
      branchId: BigInt(1), userId: BigInt(1), status: 'antrian', scheduledAt: new Date(),
      patient: { petName: 'Mochi', id: BigInt(1), owner: { ownerName: 'Budi', phoneNumber: '08123', id: BigInt(1) } },
      groomer: { fullname: 'Sari', id: BigInt(1) },
      package: null, branch: null, services: [],
    }
    const prisma = fullMockPrisma({ groomingSession: { findMany: vi.fn().mockResolvedValue([mockSession]) } })
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const app = await buildApp(groomingRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/grooming/antrian' })
    console.log('grooming STATUS:', res.statusCode, res.body.substring(0, 300))
    await app.close()
  })

  it('broadcast log', async () => {
    const mockBlog = { id: BigInt(1), title: 'Promo!', message: 'Diskon', totalSent: 10, totalFailed: 0, sentAt: new Date(), status: 'done', branchId: BigInt(1), createdById: BigInt(1) }
    const prisma = fullMockPrisma({ broadcastLog: { findMany: vi.fn().mockResolvedValue([mockBlog]), count: vi.fn().mockResolvedValue(1) } })
    const { broadcastRoutes } = await import('../../modules/broadcast/broadcast.routes')
    const app = await buildApp(broadcastRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/broadcast/log' })
    console.log('broadcast STATUS:', res.statusCode, res.body.substring(0, 300))
    await app.close()
  })

  it('loyalty members', async () => {
    const mockMember = { id: BigInt(1), ownerId: BigInt(1), totalPoints: 250, tier: 'silver', totalSpend: 2500000, branchId: BigInt(1), joinedAt: new Date(), owner: { ownerName: 'Budi', phoneNumber: '08123' } }
    const prisma = fullMockPrisma({ loyaltyMember: { findMany: vi.fn().mockResolvedValue([mockMember]), count: vi.fn().mockResolvedValue(1) } })
    const { loyaltyRoutes } = await import('../../modules/loyalty/loyalty.routes')
    const app = await buildApp(loyaltyRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/loyalty/members' })
    console.log('loyalty STATUS:', res.statusCode, res.body.substring(0, 300))
    await app.close()
  })
})
