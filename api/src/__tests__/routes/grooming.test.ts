// F-21: Grooming Standalone
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

const mockSession = {
  id: BigInt(1), patientId: BigInt(1), groomerId: BigInt(2),
  packageId: BigInt(0), userId: BigInt(1),
  status: 'antrian', scheduledAt: new Date(), branchId: BigInt(1),
  patient: { id: BigInt(1), petName: 'Mochi', owner: { id: BigInt(1), ownerName: 'Budi', phoneNumber: '08123' } },
  groomer: { id: BigInt(2), fullname: 'Sari' },
  package: null, branch: null, services: [],
}

function makePrisma() {
  return fullMockPrisma({
    groomingSession: { findMany: vi.fn().mockResolvedValue([mockSession]), findFirst: vi.fn().mockResolvedValue(mockSession), create: vi.fn().mockResolvedValue(mockSession), update: vi.fn().mockResolvedValue(mockSession) },
    patient: { findFirst: vi.fn().mockResolvedValue({ id: BigInt(1), petName: 'Mochi', owner: { ownerName: 'Budi', phoneNumber: '08123' } }) },
    user: { findFirst: vi.fn().mockResolvedValue({ id: BigInt(2), fullname: 'Sari' }) },
    listOfService: { findMany: vi.fn().mockResolvedValue([]) },
    paymentGrooming: { findMany: vi.fn().mockResolvedValue([]) },
  })
}

describe('F-21 Grooming Standalone', () => {
  it('GET /api/grooming/antrian mengembalikan antrian grooming', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const app = await buildApp(groomingRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/grooming/antrian' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('GET /api/grooming/sesi mengembalikan semua sesi', async () => {
    const { groomingRoutes } = await import('../../modules/grooming/grooming.routes')
    const app = await buildApp(groomingRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/grooming/sesi' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
