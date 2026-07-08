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

// ─── Isolasi antar-cabang (IDOR) ────────────────────────────────────────────────
// HotelRoom/HotelBooking punya branchId. Modul ini mengunci semua role
// (kecuali superadmin) ke branchId sendiri di list, jadi by-id juga harus
// dikunci ke branchId sendiri. HotelCareLog tidak punya branchId langsung,
// cuma lewat relasi bookingId -> hotelBooking.branchId.
const OTHER_BRANCH_ROOM = { id: BigInt(50), branchId: BigInt(2), roomType: 'vip', pricePerNight: 150000, isActive: true }
const OTHER_BRANCH_BOOKING = { id: BigInt(51), branchId: BigInt(2), isPaid: false, totalPrice: 300000, status: 'pending' }

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    if ('branchId' in where && String(where.branchId) !== String(record.branchId)) return Promise.resolve(null)
    if ('booking' in where && where.booking?.branchId !== undefined && String(where.booking.branchId) !== String(record.branchId)) return Promise.resolve(null)
    return Promise.resolve(record)
  })
}

describe('pet-hotel.routes — isolasi antar-cabang (IDOR)', () => {
  it('PUT /pet-hotel/kamar/:id milik cabang lain harus 404, bukan berhasil diubah', async () => {
    const { petHotelRoutes } = await import('../../modules/pet-hotel/pet-hotel.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_ROOM, roomName: 'Diubah' })
    const prisma = fullMockPrisma({ hotelRoom: { findFirst: simulateFindFirst(OTHER_BRANCH_ROOM), update: updateMock } })
    const app = await buildApp(petHotelRoutes, prisma)
    const res = await app.inject({ method: 'PUT', url: '/api/pet-hotel/kamar/50', payload: { roomName: 'Diubah' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('PATCH /pet-hotel/booking/:id/status milik cabang lain harus 404, bukan berhasil diubah (sebelumnya tanpa requireRole sama sekali)', async () => {
    const { petHotelRoutes } = await import('../../modules/pet-hotel/pet-hotel.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_BOOKING, status: 'checkedout' })
    const prisma = fullMockPrisma({ hotelBooking: { findFirst: simulateFindFirst(OTHER_BRANCH_BOOKING), update: updateMock } })
    const app = await buildApp(petHotelRoutes, prisma)
    const res = await app.inject({ method: 'PATCH', url: '/api/pet-hotel/booking/51/status', payload: { status: 'checkedout' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('POST /pet-hotel/kasir/:id milik cabang lain harus 404, bukan berhasil ditandai lunas', async () => {
    const { petHotelRoutes } = await import('../../modules/pet-hotel/pet-hotel.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_BOOKING, isPaid: true })
    const prisma = fullMockPrisma({ hotelBooking: { findFirst: simulateFindFirst(OTHER_BRANCH_BOOKING), update: updateMock } })
    const app = await buildApp(petHotelRoutes, prisma)
    const res = await app.inject({ method: 'POST', url: '/api/pet-hotel/kasir/51', payload: {} })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('GET /pet-hotel/care-log/:bookingId milik cabang lain harus 404', async () => {
    const { petHotelRoutes } = await import('../../modules/pet-hotel/pet-hotel.routes')
    const findManyMock = vi.fn().mockResolvedValue([{ id: BigInt(1) }])
    const prisma = fullMockPrisma({
      hotelBooking: { findFirst: simulateFindFirst(OTHER_BRANCH_BOOKING) },
      hotelCareLog: { findMany: findManyMock },
    })
    const app = await buildApp(petHotelRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/pet-hotel/care-log/51' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('POST /pet-hotel/care-log/:bookingId milik cabang lain harus 404, bukan berhasil dicatat', async () => {
    const { petHotelRoutes } = await import('../../modules/pet-hotel/pet-hotel.routes')
    const createMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      hotelBooking: { findFirst: simulateFindFirst(OTHER_BRANCH_BOOKING) },
      hotelCareLog: { create: createMock },
    })
    const app = await buildApp(petHotelRoutes, prisma)
    const res = await app.inject({ method: 'POST', url: '/api/pet-hotel/care-log/51', payload: { logDate: '2026-01-01' } })
    expect(res.statusCode).toBe(404)
    expect(createMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('POST /pet-hotel/booking dengan roomId milik cabang lain harus 404, bukan berhasil dibuat', async () => {
    const { petHotelRoutes } = await import('../../modules/pet-hotel/pet-hotel.routes')
    const createMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      hotelRoom: { findFirst: simulateFindFirst(OTHER_BRANCH_ROOM) },
      hotelBooking: { create: createMock },
    })
    const app = await buildApp(petHotelRoutes, prisma)
    const res = await app.inject({ method: 'POST', url: '/api/pet-hotel/booking', payload: { roomId: '50', patientId: '1', ownerId: '1', checkIn: '2026-07-01', checkOut: '2026-07-03' } })
    expect(res.statusCode).toBe(404)
    expect(createMock).not.toHaveBeenCalled()
    await app.close()
  })
})
