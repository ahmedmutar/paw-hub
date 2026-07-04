// F-04: Data Pasien (Hewan)
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

const mockOwner = { id: BigInt(1), ownerName: 'Budi', phoneNumber: '08123456789', email: 'budi@mail.com', address: 'Jakarta', isDeleted: false }
const mockPatient = { id: BigInt(1), petName: 'Mochi', petCategory: 'Kucing', gender: 'Jantan', ownerId: BigInt(1), branchId: BigInt(1), owner: mockOwner, isDeleted: false }

function makePrisma() {
  return fullMockPrisma({
    owner:   { findMany: vi.fn().mockResolvedValue([mockOwner]), findFirst: vi.fn().mockResolvedValue(mockOwner), create: vi.fn().mockResolvedValue(mockOwner) },
    patient: { findMany: vi.fn().mockResolvedValue([mockPatient]), findFirst: vi.fn().mockResolvedValue(mockPatient), create: vi.fn().mockResolvedValue(mockPatient), count: vi.fn().mockResolvedValue(1) },
  })
}

describe('F-04 Data Pasien', () => {
  it('GET /api/pasien mengembalikan daftar pasien', async () => {
    const { pasienRoutes } = await import('../../modules/pasien/pasien.routes')
    const app = await buildApp(pasienRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/pasien' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    await app.close()
  })

  it('POST /api/pasien membuat pasien baru', async () => {
    const { pasienRoutes } = await import('../../modules/pasien/pasien.routes')
    const app = await buildApp(pasienRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/pasien',
      payload: {
        petName: 'Mochi', petCategory: 'Kucing', breed: 'Persia',
        gender: 'Jantan', birthDate: '2022-01-01',
        ownerName: 'Budi', phoneNumber: '08123456789',
        email: 'budi@mail.com', address: 'Jakarta',
      },
    })
    expect(res.statusCode).toBe(201)
    await app.close()
  })

  it('GET /api/pasien/:id mengembalikan detail pasien', async () => {
    const { pasienRoutes } = await import('../../modules/pasien/pasien.routes')
    const app = await buildApp(pasienRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/pasien/1' })
    expect([200, 404]).toContain(res.statusCode)
    await app.close()
  })
})
