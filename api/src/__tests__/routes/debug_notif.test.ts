import { describe, it, vi } from 'vitest'
import { buildApp, fullMockPrisma } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true }) }) as any

describe('debug notif', () => {
  it('debug GET /api/notif/log', async () => {
    const prisma = fullMockPrisma({
      whatsappLog: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    })
    const { notifRoutes } = await import('../../modules/notif/notif.routes')
    const app = await buildApp(notifRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/notif/log' })
    console.log('STATUS:', res.statusCode, 'BODY:', res.body)
    await app.close()
  })
})
