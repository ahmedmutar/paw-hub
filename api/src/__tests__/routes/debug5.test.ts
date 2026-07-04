import { describe, it, vi } from 'vitest'
import { buildApp, fullMockPrisma } from '../helpers/buildApp'
vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))
global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

describe('debug5', () => {
  it('lab/templates', async () => {
    const { labRoutes } = await import('../../modules/lab/lab.routes')
    const app = await buildApp(labRoutes, fullMockPrisma())
    const res = await app.inject({ method: 'GET', url: '/api/lab/templates' })
    console.log('lab templates', res.statusCode, res.body.substring(0, 300))
    await app.close()
  })
  it('clinical dose-calculator', async () => {
    const mockDrug = { id: BigInt(1), drugName: 'Amox', dosagePerKgMin: 10, dosagePerKgMax: 20, unit: 'mg', species: ['anjing'], category: 'Antibiotik', isActive: true }
    const prisma = fullMockPrisma({ drugDatabase: { findFirst: vi.fn().mockResolvedValue(mockDrug) } })
    const { clinicalRoutes } = await import('../../modules/clinical/clinical.routes')
    const app = await buildApp(clinicalRoutes, prisma)
    const res = await app.inject({ method: 'POST', url: '/api/clinical/dose-calculator', payload: { drugId: '1', weightKg: 5 } })
    console.log('clinical dose', res.statusCode, res.body.substring(0, 300))
    await app.close()
  })
  it('pajak/pph21/rekap', async () => {
    const mockEmployee = { id: BigInt(2), fullname: 'Dr. Andi', role: 'dokter', ptkpStatus: 'TK0', npwp: null, branchId: BigInt(1), totalOverall: 8000000 }
    const mockPayroll = { id: BigInt(1), userEmployeeId: BigInt(2), branchId: BigInt(1), periodMonth: 6, periodYear: 2026, basicSallary: 8000000, totalOverall: 8000000, pph21Amount: 200000, isDeleted: false, user: { fullname: 'Dr. Andi', ptkpStatus: 'TK0', npwp: null } }
    const prisma = fullMockPrisma({ payroll: { findMany: vi.fn().mockResolvedValue([mockPayroll]) }, user: { findFirst: vi.fn().mockResolvedValue(mockEmployee) } })
    const { pajakRoutes } = await import('../../modules/pajak/pajak.routes')
    const app = await buildApp(pajakRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/pajak/pph21/rekap?month=6&year=2026' })
    console.log('pajak', res.statusCode, res.body.substring(0, 300))
    await app.close()
  })
  it('jadwal/kalender', async () => {
    const { jadwalDokterRoutes } = await import('../../modules/jadwal-dokter/jadwal-dokter.routes')
    const app = await buildApp(jadwalDokterRoutes, fullMockPrisma({ doctorSchedule: { findMany: vi.fn().mockResolvedValue([]) }, user: { findMany: vi.fn().mockResolvedValue([]) } }))
    const res1 = await app.inject({ method: 'GET', url: '/api/jadwal-dokter/kalender/week' })
    const res2 = await app.inject({ method: 'GET', url: '/api/jadwal-dokter/kalender' })
    console.log('kalender/week', res1.statusCode, res2.statusCode)
    await app.close()
  })
  it('pet-hotel booking POST', async () => {
    const mockRoom = { id: BigInt(1), roomName: 'VIP-1', isOccupied: false }
    const mockBooking = { id: BigInt(1) }
    const prisma = fullMockPrisma({ hotelRoom: { findFirst: vi.fn().mockResolvedValue(mockRoom) }, hotelBooking: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(mockBooking), count: vi.fn().mockResolvedValue(0) } })
    const { petHotelRoutes } = await import('../../modules/pet-hotel/pet-hotel.routes')
    const app = await buildApp(petHotelRoutes, prisma)
    const res = await app.inject({ method: 'POST', url: '/api/pet-hotel/booking', payload: { roomId: '1', patientId: '1', ownerId: '1', checkInDate: '2026-07-01', checkOutDate: '2026-07-03', specialNeeds: '' } })
    console.log('pet-hotel booking', res.statusCode, res.body.substring(0, 300))
    await app.close()
  })
})
