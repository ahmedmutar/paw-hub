import { describe, it, vi } from 'vitest'
import { buildApp, fullMockPrisma } from '../helpers/buildApp'
vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))
global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

describe('debug6', () => {
  it('rawat-inap from registrasi', async () => {
    const mockInpatient = { id: BigInt(1), patientId: BigInt(1), doctorId: BigInt(2), estimateDay: 3, realityDay: null, acceptanceStatus: 'pending', branchId: BigInt(1), isDeleted: false, patient: { petName: 'Mochi', owner: { ownerName: 'Budi' } }, doctor: { fullname: 'Dr. Andi' } }
    const prisma = fullMockPrisma({ inPatient: { findMany: vi.fn().mockResolvedValue([mockInpatient]), count: vi.fn().mockResolvedValue(1), findFirst: vi.fn().mockResolvedValue(mockInpatient), update: vi.fn().mockResolvedValue(mockInpatient) } })
    const { registrasiRoutes } = await import('../../modules/registrasi/registrasi.routes')
    const app = await buildApp(registrasiRoutes, prisma)
    const res1 = await app.inject({ method: 'GET', url: '/api/rawat-inap' })
    const res2 = await app.inject({ method: 'GET', url: '/api/rawat-inap/aktif' })
    console.log('rawat-inap GET', res1.statusCode, 'aktif', res2.statusCode)
    await app.close()
  })
  it('appointment POST booking', async () => {
    const prisma = fullMockPrisma({ 
      appointment: { create: vi.fn().mockResolvedValue({ id: BigInt(1) }), findFirst: vi.fn().mockResolvedValue(null) },
      branch: { findFirst: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
      user: { findFirst: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
    })
    const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
    const app = await buildApp(appointmentRoutes, prisma)
    const res = await app.inject({ method: 'POST', url: '/api/booking', payload: { branchId: '1', ownerName: 'Budi', ownerPhone: '08123456789', petName: 'Mochi', petCategory: 'Kucing', appointmentDate: '2026-07-01', appointmentTime: '09:00', complaint: 'Demam' } })
    console.log('appointment booking', res.statusCode, res.body.substring(0, 300))
    await app.close()
  })
  it('symptom normal', async () => {
    const { symptomRoutes } = await import('../../modules/symptom/symptom.routes')
    const app = await buildApp(symptomRoutes, fullMockPrisma({ aiSymptomLog: { create: vi.fn().mockResolvedValue({ id: BigInt(1) }) } }))
    const res = await app.inject({ method: 'POST', url: '/api/public/symptom-checker', payload: { symptoms: 'kucing aktif nafsu makan baik', species: 'kucing' } })
    console.log('symptom normal', res.statusCode, res.body.substring(0, 300))
    await app.close()
  })
  it('calendar sync', async () => {
    const mockCalendar = { id: BigInt(1), userId: BigInt(1), googleEmail: 'doc@gmail.com', syncEnabled: true }
    const prisma = fullMockPrisma({ doctorCalendarSync: { findFirst: vi.fn().mockResolvedValue(mockCalendar), update: vi.fn().mockResolvedValue(mockCalendar) } })
    const { calendarRoutes } = await import('../../modules/calendar/calendar.routes')
    const app = await buildApp(calendarRoutes, prisma)
    const res = await app.inject({ method: 'POST', url: '/api/calendar/sync', payload: {} })
    console.log('calendar sync', res.statusCode, res.body.substring(0, 300))
    await app.close()
  })
})
