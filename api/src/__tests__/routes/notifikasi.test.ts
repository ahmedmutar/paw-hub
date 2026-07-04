// F-17: Notifikasi WhatsApp
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

// Mock global fetch for Fonnte API calls
global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true }) }) as any

const mockLog = {
  id: BigInt(1), recipientPhone: '08123', type: 'antrian',
  message: 'Nomor antrian Anda: 5', status: 'sent', sentAt: new Date(),
  branchId: BigInt(1), userId: BigInt(1), patientId: null, registrationId: null,
  patient: null, branch: null,
}

function makePrisma() {
  return fullMockPrisma({
    whatsappLog: { findMany: vi.fn().mockResolvedValue([mockLog]), create: vi.fn().mockResolvedValue(mockLog), count: vi.fn().mockResolvedValue(1) },
  })
}

describe('F-17 Notifikasi WhatsApp', () => {
  it('GET /api/notif/log mengembalikan log WA', async () => {
    const { notifRoutes } = await import('../../modules/notif/notif.routes')
    const app = await buildApp(notifRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/notif/log' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('POST /api/notif/wa/send mengirim pesan WA', async () => {
    const { notifRoutes } = await import('../../modules/notif/notif.routes')
    const app = await buildApp(notifRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/notif/wa/send',
      payload: { phone: '08123456789', message: 'Test notifikasi', type: 'manual' },
    })
    expect([200, 201, 400]).toContain(res.statusCode)
    await app.close()
  })
})
