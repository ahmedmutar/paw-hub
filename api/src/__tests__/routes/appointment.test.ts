// F-18: Booking & Appointment Online
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel, DEFAULT_AUTH_USER } from '../helpers/buildApp'

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

// ─── Isolasi antar-cabang & antar-tenant (IDOR) ────────────────────────────────
// Appointment cuma punya branchId (tidak ada tenantId langsung). GET/PUT /:id
// sebelumnya TIDAK punya requireRole sama sekali (staf manapun bisa akses),
// dan list/stats untuk admin pakai where kosong `{}` alih-alih tenant-wide.
const OTHER_TENANT_APPT = {
  id: BigInt(50), ownerName: 'Orang Lain', ownerPhone: '08199999999',
  petName: 'Kucing Lain', appointmentDate: new Date(), appointmentTime: '10:00',
  complaint: 'Batuk', status: 'pending', branchId: BigInt(99), tenantId: BigInt(99), doctorUserId: BigInt(9),
  patientId: null, registrationId: null, handledBy: null,
  doctor: null, branch: { id: BigInt(99), branchName: 'Cabang Lain' }, patient: null,
}
const OWN_APPT = { ...OTHER_TENANT_APPT, id: BigInt(1), branchId: BigInt(1), tenantId: BigInt(1) }

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    if ('branchId' in where && String(where.branchId) !== String(record.branchId)) return Promise.resolve(null)
    if ('branch' in where && where.branch?.tenantId !== undefined && String(where.branch.tenantId) !== String(record.tenantId)) return Promise.resolve(null)
    return Promise.resolve(record)
  })
}

describe('appointment.routes — isolasi antar-cabang & antar-tenant (IDOR)', () => {
  it('GET /appointment/:id milik tenant lain harus 404 (sebelumnya tanpa requireRole sama sekali)', async () => {
    const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
    const prisma = fullMockPrisma({ appointment: { findFirst: simulateFindFirst(OTHER_TENANT_APPT) } })
    const app = await buildApp(appointmentRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/appointment/50' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('GET /appointment/:id milik tenant sendiri tetap 200 (kontrol positif)', async () => {
    const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
    const prisma = fullMockPrisma({ appointment: { findFirst: simulateFindFirst(OWN_APPT) } })
    const app = await buildApp(appointmentRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/appointment/1' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('PUT /appointment/:id milik tenant lain harus 404, bukan berhasil diubah', async () => {
    const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_APPT, notes: 'diubah' })
    const prisma = fullMockPrisma({ appointment: { findFirst: simulateFindFirst(OTHER_TENANT_APPT), update: updateMock } })
    const app = await buildApp(appointmentRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'PUT', url: '/api/appointment/50', payload: { notes: 'diubah' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('PUT /appointment/:id/confirm milik tenant lain harus 404, bukan berhasil dikonfirmasi', async () => {
    const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_APPT, status: 'confirmed' })
    const prisma = fullMockPrisma({ appointment: { findFirst: simulateFindFirst(OTHER_TENANT_APPT), update: updateMock } })
    const app = await buildApp(appointmentRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'PUT', url: '/api/appointment/50/confirm' })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('PUT /appointment/:id/decline milik tenant lain harus 404, bukan berhasil ditolak', async () => {
    const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_APPT, status: 'declined' })
    const prisma = fullMockPrisma({ appointment: { findFirst: simulateFindFirst(OTHER_TENANT_APPT), update: updateMock } })
    const app = await buildApp(appointmentRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'PUT', url: '/api/appointment/50/decline', payload: {} })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('PUT /appointment/:id/convert milik tenant lain harus 404, bukan berhasil dikonversi ke antrian', async () => {
    const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_APPT, status: 'converted' })
    const createRegMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      appointment: { findFirst: simulateFindFirst(OTHER_TENANT_APPT), update: updateMock },
      registration: { create: createRegMock },
    })
    const app = await buildApp(appointmentRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'PUT', url: '/api/appointment/50/convert' })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    expect(createRegMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('DELETE /appointment/:id milik tenant lain harus 404, bukan berhasil dibatalkan', async () => {
    const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_TENANT_APPT, status: 'cancelled' })
    const prisma = fullMockPrisma({ appointment: { findFirst: simulateFindFirst(OTHER_TENANT_APPT), update: updateMock } })
    const app = await buildApp(appointmentRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'DELETE', url: '/api/appointment/50' })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('GET /appointment untuk admin harus tetap discope ke tenant, bukan where kosong', async () => {
    const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
    const findManyMock = vi.fn().mockResolvedValue([])
    const prisma = fullMockPrisma({ appointment: { findMany: findManyMock } })
    const app = await buildApp(appointmentRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/appointment' })
    expect(res.statusCode).toBe(200)
    const where = findManyMock.mock.calls[0][0].where
    const hasTenantScope = 'branchId' in where || ('branch' in where && 'tenantId' in (where.branch ?? {}))
    expect(hasTenantScope).toBe(true)
    await app.close()
  })

  it('GET /appointment/stats untuk admin harus tetap discope ke tenant, bukan where kosong', async () => {
    const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
    const countMock = vi.fn().mockResolvedValue(0)
    const prisma = fullMockPrisma({ appointment: { count: countMock } })
    const app = await buildApp(appointmentRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/appointment/stats' })
    expect(res.statusCode).toBe(200)
    const where = countMock.mock.calls[0][0].where
    const hasTenantScope = 'branchId' in where || ('branch' in where && 'tenantId' in (where.branch ?? {}))
    expect(hasTenantScope).toBe(true)
    await app.close()
  })

  describe('POST /booking — fitur booking harus sesuai paket klinik', () => {
    it('ditolak 402 kalau paket klinik tidak punya fitur booking', async () => {
      const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
      const createMock = vi.fn()
      const prisma = fullMockPrisma({
        appointment: { findFirst: vi.fn().mockResolvedValue(null), create: createMock },
        branch: { findUnique: vi.fn().mockResolvedValue({ id: BigInt(1), tenantId: BigInt(1) }) },
        tenantSubscription: {
          findUnique: vi.fn().mockResolvedValue({ plan: { name: 'Free', features: { booking: false } } }),
        },
      })
      const app = await buildApp(appointmentRoutes, prisma)

      const res = await app.inject({
        method: 'POST', url: '/api/booking',
        payload: {
          branchId: '1', doctorUserId: '2', ownerName: 'Budi', ownerPhone: '08123456789',
          petName: 'Mochi', petCategory: 'Kucing', appointmentDate: '2026-07-01',
          appointmentTime: '09:00', complaint: 'Demam',
        },
      })

      expect(res.statusCode).toBe(402)
      expect(createMock).not.toHaveBeenCalled()
      await app.close()
    })

    it('diizinkan kalau paket klinik punya fitur booking', async () => {
      const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
      const prisma = fullMockPrisma({
        appointment: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(mockAppointment) },
        branch: { findUnique: vi.fn().mockResolvedValue({ id: BigInt(1), tenantId: BigInt(1) }) },
        whatsappLog: { create: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
        tenantSubscription: {
          findUnique: vi.fn().mockResolvedValue({ plan: { name: 'Starter', features: { booking: true } } }),
        },
      })
      const app = await buildApp(appointmentRoutes, prisma)

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
  })
})

describe('GET /appointment — admin instalasi lama (tenantId null) tidak boleh crash', () => {
  it('tetap 200 tanpa filter tenant saat admin.tenantId null', async () => {
    const { appointmentRoutes } = await import('../../modules/appointment/appointment.routes')
    const prisma = fullMockPrisma({ appointment: { findMany: vi.fn().mockResolvedValue([]) } })
    const app = await buildApp(appointmentRoutes, prisma, { ...DEFAULT_AUTH_USER, tenantId: null as any })
    const res = await app.inject({ method: 'GET', url: '/api/appointment' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
