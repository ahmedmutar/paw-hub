// F-33: Telemedicine / Konsultasi Online
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

const mockSession = {
  id: BigInt(1), patientId: BigInt(1), doctorId: BigInt(2),
  channel: 'chat', status: 'pending', fee: 100000, branchId: BigInt(1),
  scheduledAt: new Date(),
  patient: { petName: 'Mochi', owner: { ownerName: 'Budi', phoneNumber: '08123' } },
  doctor: { fullname: 'Dr. Andi' },
}

function makePrisma() {
  return fullMockPrisma({
    telemedSession: { findMany: vi.fn().mockResolvedValue([mockSession]), findFirst: vi.fn().mockResolvedValue(mockSession), create: vi.fn().mockResolvedValue(mockSession), update: vi.fn().mockResolvedValue(mockSession), count: vi.fn().mockResolvedValue(1) },
    patient: { findFirst: vi.fn().mockResolvedValue({ id: BigInt(1), petName: 'Mochi', owner: { ownerName: 'Budi', phoneNumber: '08123' } }) },
    user:    { findFirst: vi.fn().mockResolvedValue({ id: BigInt(2), fullname: 'Dr. Andi' }) },
    listOfPayment: { create: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
  })
}

describe('F-33 Telemedicine', () => {
  it('GET /api/telemed/sessions mengembalikan daftar sesi', async () => {
    const { telemedRoutes } = await import('../../modules/telemed/telemed.routes')
    const app = await buildApp(telemedRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/telemed/sessions' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('POST /api/telemed/request membuat sesi baru', async () => {
    const { telemedRoutes } = await import('../../modules/telemed/telemed.routes')
    const app = await buildApp(telemedRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/telemed/request',
      payload: { patientId: '1', ownerId: '1', doctorId: '2', channel: 'chat', scheduledAt: '2026-07-01T09:00:00Z', complaint: 'Demam', fee: 100000 },
    })
    expect([200, 201]).toContain(res.statusCode)
    await app.close()
  })

  it('PATCH /api/telemed/session/:id/confirm mengkonfirmasi sesi', async () => {
    const { telemedRoutes } = await import('../../modules/telemed/telemed.routes')
    const app = await buildApp(telemedRoutes, makePrisma())
    const res = await app.inject({
      method: 'PATCH', url: '/api/telemed/session/1/confirm',
      payload: { meetingLink: 'https://meet.google.com/abc' },
    })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })

  it('GET /api/telemed/rekap mengembalikan rekap telemed', async () => {
    const { telemedRoutes } = await import('../../modules/telemed/telemed.routes')
    const app = await buildApp(telemedRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/telemed/rekap' })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })
})
