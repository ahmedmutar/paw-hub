// F-28: Broadcast & CRM WhatsApp
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true }) }) as any

const mockLog = {
  id: BigInt(1), title: 'Promo', message: 'Promo!',
  totalSent: 10, totalFailed: 0, totalTarget: 10,
  sentAt: new Date(), createdAt: new Date(), completedAt: null,
  status: 'done', segment: null,
  branchId: BigInt(1), createdById: BigInt(1),
  user: { fullname: 'Admin' },
}

function makePrisma() {
  return fullMockPrisma({
    broadcastLog: { findMany: vi.fn().mockResolvedValue([mockLog]), create: vi.fn().mockResolvedValue(mockLog) },
    owner:        { findMany: vi.fn().mockResolvedValue([{ id: BigInt(1), ownerName: 'Budi', phoneNumber: '08123' }]) },
    patient:      { findMany: vi.fn().mockResolvedValue([]) },
    registration: { findMany: vi.fn().mockResolvedValue([]) },
  })
}

describe('F-28 Broadcast & CRM WA', () => {
  it('GET /api/broadcast/log mengembalikan riwayat broadcast', async () => {
    const { broadcastRoutes } = await import('../../modules/broadcast/broadcast.routes')
    const app = await buildApp(broadcastRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/broadcast/log' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('POST /api/broadcast/send mengirim broadcast ke semua owner', async () => {
    const { broadcastRoutes } = await import('../../modules/broadcast/broadcast.routes')
    const app = await buildApp(broadcastRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/broadcast/send',
      payload: { title: 'Promo', message: 'Promo vaksin diskon 20%!' },
    })
    expect([200, 201]).toContain(res.statusCode)
    await app.close()
  })
})
