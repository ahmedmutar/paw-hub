// F-37: Drug Interaction & Kalkulator Dosis
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

const mockDrug = { id: BigInt(1), drugName: 'Amoxicillin', category: 'Antibiotik', dosagePerKgMin: 10, dosagePerKgMax: 20, unit: 'mg', species: ['anjing', 'kucing'], isActive: true }
const mockInteraction = { id: BigInt(1), drugAId: BigInt(1), drugBId: BigInt(2), severity: 'sedang', description: 'Monitoring diperlukan' }

function makePrisma() {
  return fullMockPrisma({
    drugDatabase:    { findMany: vi.fn().mockResolvedValue([mockDrug]), findUnique: vi.fn().mockResolvedValue(mockDrug), findFirst: vi.fn().mockResolvedValue(mockDrug), create: vi.fn().mockResolvedValue(mockDrug), update: vi.fn().mockResolvedValue(mockDrug) },
    drugInteraction: { findMany: vi.fn().mockResolvedValue([mockInteraction]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(mockInteraction) },
  })
}

describe('F-37 Drug Interaction & Dosis', () => {
  it('GET /api/clinical/drug-database mengembalikan database obat', async () => {
    const { clinicalRoutes } = await import('../../modules/clinical/clinical.routes')
    const app = await buildApp(clinicalRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/clinical/drug-database' })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().data)).toBe(true)
    await app.close()
  })

  it('POST /api/clinical/drug-check mengecek interaksi obat', async () => {
    const { clinicalRoutes } = await import('../../modules/clinical/clinical.routes')
    const app = await buildApp(clinicalRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/clinical/drug-check',
      payload: { drugIds: ['1', '2'] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveProperty('interactions')
    await app.close()
  })

  it('POST /api/clinical/dose-calculator menghitung dosis', async () => {
    const { clinicalRoutes } = await import('../../modules/clinical/clinical.routes')
    const app = await buildApp(clinicalRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/clinical/dose-calculator',
      payload: { drugId: '1', weightKg: 5 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveProperty('minDose')
    expect(body.data).toHaveProperty('maxDose')
    expect(body.data).toHaveProperty('recommendation')
    await app.close()
  })

  it('POST /api/clinical/dose-calculator drug tidak ditemukan → 404', async () => {
    const prisma = makePrisma()
    ;(prisma.drugDatabase as any).findUnique = vi.fn().mockResolvedValue(null)
    const { clinicalRoutes } = await import('../../modules/clinical/clinical.routes')
    const app = await buildApp(clinicalRoutes, prisma)
    const res = await app.inject({
      method: 'POST', url: '/api/clinical/dose-calculator',
      payload: { drugId: '99', weightKg: 5 },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})
