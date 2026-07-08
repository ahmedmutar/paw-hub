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

// ─── Isolasi antar-cabang (IDOR) ────────────────────────────────────────────────
// TelemedSession punya branchId. List (/telemed/sessions) sudah benar pakai
// `role !== 'superadmin' && { branchId }`, tapi GET/PATCH/POST by-id sama
// sekali tidak filter branchId.
const OTHER_BRANCH_SESSION = { id: BigInt(50), branchId: BigInt(2), status: 'pending', isPaid: false, patient: { petName: 'Lain', petCategory: 'Kucing', petYearAge: 1, petMonthAge: 0 }, owner: { ownerName: 'Orang Lain', phoneNumber: '08199999999', address: '' }, doctor: { fullname: 'Dr. Lain' } }

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    if ('branchId' in where && String(where.branchId) !== String(record.branchId)) return Promise.resolve(null)
    return Promise.resolve(record)
  })
}

describe('telemed.routes — isolasi antar-cabang (IDOR)', () => {
  it('GET /telemed/session/:id milik cabang lain harus 404', async () => {
    const { telemedRoutes } = await import('../../modules/telemed/telemed.routes')
    const prisma = fullMockPrisma({ telemedSession: { findFirst: simulateFindFirst(OTHER_BRANCH_SESSION) } })
    const app = await buildApp(telemedRoutes, prisma)
    const res = await app.inject({ method: 'GET', url: '/api/telemed/session/50' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('PATCH /telemed/session/:id/confirm milik cabang lain harus 404, bukan berhasil dikonfirmasi', async () => {
    const { telemedRoutes } = await import('../../modules/telemed/telemed.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_SESSION, status: 'confirmed' })
    const prisma = fullMockPrisma({ telemedSession: { findFirst: simulateFindFirst(OTHER_BRANCH_SESSION), update: updateMock } })
    const app = await buildApp(telemedRoutes, prisma)
    const res = await app.inject({ method: 'PATCH', url: '/api/telemed/session/50/confirm' })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('PATCH /telemed/session/:id/notes milik cabang lain harus 404, bukan berhasil disimpan', async () => {
    const { telemedRoutes } = await import('../../modules/telemed/telemed.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_SESSION, doctorNotes: 'Diubah' })
    const prisma = fullMockPrisma({ telemedSession: { findFirst: simulateFindFirst(OTHER_BRANCH_SESSION), update: updateMock } })
    const app = await buildApp(telemedRoutes, prisma)
    const res = await app.inject({ method: 'PATCH', url: '/api/telemed/session/50/notes', payload: { doctorNotes: 'Diubah' } })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('POST /telemed/billing/:id milik cabang lain harus 404, bukan berhasil ditandai lunas', async () => {
    const { telemedRoutes } = await import('../../modules/telemed/telemed.routes')
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_SESSION, isPaid: true })
    const prisma = fullMockPrisma({ telemedSession: { findFirst: simulateFindFirst(OTHER_BRANCH_SESSION), update: updateMock } })
    const app = await buildApp(telemedRoutes, prisma)
    const res = await app.inject({ method: 'POST', url: '/api/telemed/billing/50', payload: {} })
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })
})
