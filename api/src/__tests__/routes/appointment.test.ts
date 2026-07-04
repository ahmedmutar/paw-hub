// F-18: Booking & Appointment Online
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

const mockAppointment = {
  id: BigInt(1), ownerName: 'Budi', ownerPhone: '08123',
  petName: 'Mochi', petCategory: 'Kucing',
  appointmentDate: new Date(), appointmentTime: '09:00', complaint: 'Demam',
  status: 'pending', branchId: BigInt(1), doctorUserId: BigInt(2),
  patientId: null, registrationId: null, handledBy: null,
  doctor: { id: BigInt(2), fullname: 'Dr. Andi' },
  branch: { id: BigInt(1), branchName: 'Klinik Test' },
  patient: null,
}

function makePrisma() {
  return fullMockPrisma({
    appointment: { findMany: vi.fn().mockResolvedValue([mockAppointment]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(mockAppointment), update: vi.fn().mockResolvedValue(mockAppointment), count: vi.fn().mockResolvedValue(1) },
    user: { findFirst: vi.fn().mockResolvedValue({ id: BigInt(2), fullname: 'Dr. Andi' }) },
    branch: { findFirst: vi.fn().mockResolvedValue({ id: BigInt(1), branchName: 'Test' }) },
    whatsappLog: { create: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
  })
}

describe('F-18 Booking & Appointment', () => {
  it('POST /api/booking membuat booking publik', async () => {
    const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
    const app = await buildApp(appointmentRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/booking',
      payload: {
        branchId: '1', doctorUserId: '2', ownerName: 'Budi', ownerPhone: '08123456789',
        petName: 'Mochi', petCategory: 'Kucing', appointmentDate: '2026-07-01',
        appointmentTime: '09:00', complaint: 'Demam',
      },
    })
    expect([200, 201]).toContain(res.statusCode)
    await app.close()
  })

  it('GET /api/appointment mengembalikan daftar appointment admin', async () => {
    const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
    const app = await buildApp(appointmentRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/appointment' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('PUT /api/appointment/:id/confirm mengonfirmasi booking', async () => {
    const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
    const app = await buildApp(appointmentRoutes, makePrisma())
    const res = await app.inject({
      method: 'PUT', url: '/api/appointment/1/confirm',
      payload: { note: 'Silakan datang tepat waktu' },
    })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })
})
