// F-36: AI Symptom Checker
import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma, mockModel } from '../helpers/buildApp'

vi.mock('../../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: any) => done()),
  requireRole:  vi.fn(() => (_req: any, _rep: any, done: any) => done()),
}))

function makePrisma() {
  return fullMockPrisma({
    aiSymptomLog: { create: vi.fn().mockResolvedValue({ id: BigInt(1) }), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), groupBy: vi.fn().mockResolvedValue([]) },
  })
}

describe('F-36 AI Symptom Checker via API', () => {
  it('POST /api/public/symptom-checker mendeteksi gejala darurat', async () => {
    const { symptomRoutes } = await import('../../modules/symptom/symptom.routes')
    const app = await buildApp(symptomRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/public/symptom-checker',
      payload: { symptoms: 'anjing saya kejang dan tidak sadar', species: 'anjing', branchId: '1' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.urgencyLevel).toBe('segera')
    await app.close()
  })

  it('POST /api/public/symptom-checker mendeteksi gejala normal', async () => {
    const { symptomRoutes } = await import('../../modules/symptom/symptom.routes')
    const app = await buildApp(symptomRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/public/symptom-checker',
      payload: { symptoms: 'kucing aktif dan nafsu makan baik seperti biasa', species: 'kucing' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(['bisa_tunggu', 'tidak_perlu']).toContain(body.data.urgencyLevel)
    await app.close()
  })

  it('POST /api/public/symptom-checker tanpa symptoms mengembalikan error', async () => {
    const { symptomRoutes } = await import('../../modules/symptom/symptom.routes')
    const app = await buildApp(symptomRoutes, makePrisma())
    const res = await app.inject({
      method: 'POST', url: '/api/public/symptom-checker',
      payload: { species: 'anjing' },
    })
    expect([400, 422]).toContain(res.statusCode)
    await app.close()
  })

  it('GET /api/ai/symptom-log mengembalikan log admin', async () => {
    const { symptomRoutes } = await import('../../modules/symptom/symptom.routes')
    const app = await buildApp(symptomRoutes, makePrisma())
    const res = await app.inject({ method: 'GET', url: '/api/ai/symptom-log' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
