// F-28: Broadcast & CRM WhatsApp
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true }) }) as any

const mockLog = {
  id: BigInt(1), title: 'Promo', message: 'Promo!',
  totalSent: 10, totalFailed: 0, totalTarget: 10,
  sentAt: new Date(), createdAt: new Date(), completedAt: null,
  status: 'done', segment: null,
  branchId: BigInt(1), createdById: BigInt(1),
  user: { fullname: 'Admin' },
}

function makePrisma() {
  return fullMockPrisma({
    broadcastLog: { findMany: vi.fn().mockResolvedValue([mockLog]), create: vi.fn().mockResolvedValue(mockLog) },
    owner:        { findMany: vi.fn().mockResolvedValue([{ id: BigInt(1), ownerName: 'Budi', phoneNumber: '08123' }]) },
    patient:      { findMany: vi.fn().mockResolvedValue([]) },
    registration: { findMany: vi.fn().mockResolvedValue([]) },
  })
}

describe('F-28 Broadcast & CRM WA', () => {
  it('GET /api/broadcast/log mengembalikan riwayat broadcast', async () => {
    const { broadcastRoutes } = await import('../../modules/broadcast/broadcast.routes')
    const app = await buildApp(broadcastRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/broadcast/log' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('POST /api/broadcast/send mengirim broadcast ke semua owner', async () => {
    const { broadcastRoutes } = await import('../../modules/broadcast/broadcast.routes')
    const app = await buildApp(broadcastRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/broadcast/send',
      payload: { title: 'Promo', message: 'Promo vaksin diskon 20%!' },
    })
    expect([200, 201]).toContain(res.statusCode)
    await app.close()
  })
})

// ─── Isolasi antar-cabang (IDOR) ────────────────────────────────────────────────
// Modul ini konsisten scope pakai branchId langsung (superadmin bypass), yang
// sudah benar di GET /broadcast/log dan /analytics — tapi GET /:id/detail
// pakai findUnique by id tanpa filter branchId sama sekali, membocorkan isi
// pesan broadcast + nomor telepon semua penerima ke admin cabang manapun.
const ADMIN_USER = { userId: BigInt(1), username: 'admin', fullname: 'Admin', role: 'admin' as any, branchId: BigInt(1), branchName: 'Cabang 1', tenantId: BigInt(1) }
const OTHER_BRANCH_LOG = {
  id: BigInt(50), title: 'Promo Cabang Lain', message: 'Rahasia cabang lain',
  totalSent: 10, totalFailed: 0, totalTarget: 10,
  createdAt: new Date(), completedAt: null, status: 'done', segment: null,
  branchId: BigInt(2), user: { fullname: 'Admin Cabang Lain' },
  recipients: [{ owner: { ownerName: 'Pelanggan Lain' }, phone: '08199999999', status: 'sent', sentAt: new Date(), errorMsg: null }],
}
const OWN_LOG = { ...OTHER_BRANCH_LOG, id: BigInt(1), branchId: BigInt(1), title: 'Promo Sendiri' }

describe('broadcast.routes — isolasi antar-cabang (IDOR)', () => {
  it('GET /:id/detail milik cabang lain harus 404, bukan bocorkan isi pesan & no. telepon penerima', async () => {
    const { broadcastRoutes } = await import('../../modules/broadcast/broadcast.routes')
    const findUniqueMock = vi.fn().mockResolvedValue(OTHER_BRANCH_LOG)
    const prisma = fullMockPrisma({ broadcastLog: { findUnique: findUniqueMock, findFirst: vi.fn().mockResolvedValue(null) } })
    const app = await buildApp(broadcastRoutes, prisma, ADMIN_USER)

    const res = await app.inject({ method: 'GET', url: '/api/broadcast/50/detail' })

    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('GET /:id/detail milik cabang sendiri tetap 200 (kontrol positif)', async () => {
    const { broadcastRoutes } = await import('../../modules/broadcast/broadcast.routes')
    const prisma = fullMockPrisma({ broadcastLog: { findFirst: vi.fn().mockResolvedValue(OWN_LOG) } })
    const app = await buildApp(broadcastRoutes, prisma, ADMIN_USER)

    const res = await app.inject({ method: 'GET', url: '/api/broadcast/1/detail' })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.title).toBe('Promo Sendiri')
    await app.close()
  })
})
