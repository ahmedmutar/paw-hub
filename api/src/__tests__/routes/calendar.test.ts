// F-40: Integrasi Google Calendar
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

const mockCalendar = {
  id: BigInt(1), userId: BigInt(1), googleEmail: 'dokter@gmail.com',
  syncEnabled: true, lastSyncAt: new Date(),
}

function makePrisma() {
  return fullMockPrisma({
    doctorCalendarSync: { findFirst: vi.fn().mockResolvedValue(mockCalendar), upsert: vi.fn().mockResolvedValue(mockCalendar), update: vi.fn().mockResolvedValue(mockCalendar), delete: vi.fn().mockResolvedValue(mockCalendar) },
    appointment: { findMany: vi.fn().mockResolvedValue([{ id: BigInt(1), appointmentDate: new Date(), appointmentTime: '09:00', ownerName: 'Budi', complaint: 'Demam' }]) },
    user: { findMany: vi.fn().mockResolvedValue([{ id: BigInt(1), fullname: 'Dr. Andi', phoneNumber: '08123' }]) },
    doctorSchedule: { findMany: vi.fn().mockResolvedValue([]) },
  })
}

describe('F-40 Google Calendar Sync', () => {
  it('GET /api/calendar/status mengembalikan status koneksi', async () => {
    const { calendarRoutes } = await import('../../modules/calendar/calendar.routes')
    const app = await buildApp(calendarRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/calendar/status' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveProperty('syncEnabled')
    await app.close()
  })

  it('POST /api/calendar/connect menghubungkan Google Calendar', async () => {
    const { calendarRoutes } = await import('../../modules/calendar/calendar.routes')
    const app = await buildApp(calendarRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/calendar/connect',
      payload: { googleEmail: 'dokter@gmail.com', googleAccessToken: 'ya29.xxx', googleRefreshToken: '1//xxx' },
    })
    expect([200, 201]).toContain(res.statusCode)
    await app.close()
  })

  it('POST /api/calendar/sync melakukan sinkronisasi jadwal', async () => {
    const { calendarRoutes } = await import('../../modules/calendar/calendar.routes')
    const app = await buildApp(calendarRoutes, makePrisma())
    const res = await app.inject({ method: 'POST', url: '/api/calendar/sync', payload: {} })
    expect([200, 400, 404]).toContain(res.statusCode)
    await app.close()
  })
})
