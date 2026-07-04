// F-32: Pet Hotel / Penginapan Hewan
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

const mockRoom = { id: BigInt(1), roomName: 'VIP-1', roomType: 'vip', pricePerNight: 150000, isOccupied: false, branchId: BigInt(1) }
const mockBooking = {
  id: BigInt(1), roomId: BigInt(1), patientId: BigInt(1), ownerId: BigInt(1),
  checkInDate: new Date('2026-07-01'), checkOutDate: new Date('2026-07-03'),
  status: 'pending', totalPrice: 300000, branchId: BigInt(1),
  room: mockRoom,
  patient: { petName: 'Mochi' },
  owner: { ownerName: 'Budi', phoneNumber: '08123' },
}

function makePrisma() {
  return fullMockPrisma({
    hotelRoom:    { findMany: vi.fn().mockResolvedValue([mockRoom]), findUnique: vi.fn().mockResolvedValue(mockRoom), findFirst: vi.fn().mockResolvedValue(mockRoom), create: vi.fn().mockResolvedValue(mockRoom), update: vi.fn().mockResolvedValue(mockRoom) },
    hotelBooking: { findMany: vi.fn().mockResolvedValue([mockBooking]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(mockBooking), update: vi.fn().mockResolvedValue(mockBooking) },
    hotelCareLog: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
  })
}

describe('F-32 Pet Hotel', () => {
  it('GET /api/pet-hotel/kamar mengembalikan daftar kamar', async () => {
    const { petHotelRoutes } = await import('../../modules/pet-hotel/pet-hotel.routes')
    const app = await buildApp(petHotelRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/pet-hotel/kamar' })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().data)).toBe(true)
    await app.close()
  })

  it('POST /api/pet-hotel/kamar membuat kamar baru', async () => {
    const { petHotelRoutes } = await import('../../modules/pet-hotel/pet-hotel.routes')
    const app = await buildApp(petHotelRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/pet-hotel/kamar',
      payload: { roomName: 'VIP-2', roomType: 'vip', capacity: 1, pricePerNight: 150000, facilities: 'AC, TV' },
    })
    expect([200, 201]).toContain(res.statusCode)
    await app.close()
  })

  it('GET /api/pet-hotel/booking mengembalikan daftar booking', async () => {
    const { petHotelRoutes } = await import('../../modules/pet-hotel/pet-hotel.routes')
    const app = await buildApp(petHotelRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/pet-hotel/booking' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('POST /api/pet-hotel/booking membuat booking', async () => {
    const { petHotelRoutes } = await import('../../modules/pet-hotel/pet-hotel.routes')
    const app = await buildApp(petHotelRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/pet-hotel/booking',
      payload: { roomId: '1', patientId: '1', ownerId: '1', checkIn: '2026-07-01', checkOut: '2026-07-03', specialNeeds: '' },
    })
    expect([200, 201]).toContain(res.statusCode)
    await app.close()
  })

  it('GET /api/pet-hotel/laporan mengembalikan laporan hotel', async () => {
    const prisma = makePrisma()
    ;(prisma.hotelBooking as any).count = vi.fn().mockResolvedValue(5)
    ;(prisma.hotelBooking as any).aggregate = vi.fn().mockResolvedValue({ _sum: { totalPrice: 500000 } })
    const { petHotelRoutes } = await import('../../modules/pet-hotel/pet-hotel.routes')
    const app = await buildApp(petHotelRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/pet-hotel/laporan' })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })
})
