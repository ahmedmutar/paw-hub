import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildTestApp, loginAs } from './setup/testApp'
import { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'

const E2E_DB_URL = 'postgresql://ahmadmukhtar@localhost:5432/vetclinic_e2e'

describe('E2E — Antrian & Registrasi (F-04)', () => {
  let app: FastifyInstance
  let token: string
  let registrasiId: string
  let patientId: string
  let doctorUserId: string

  beforeAll(async () => {
    app = await buildTestApp()
    token = await loginAs(app, 'e2e_admin')

    const prisma = new PrismaClient({ datasources: { db: { url: E2E_DB_URL } } })
    try {
      // Create owner + patient for registration tests
      const branch0 = await prisma.branch.findFirst({ where: { branchCode: 'E2E' } })
      const owner = await prisma.owner.create({
        data: { ownerName: 'Registrasi Owner', phoneNumber: '0812345001', branchId: branch0!.id },
      })
      const branch = await prisma.branch.findFirst({ where: { branchCode: 'E2E' } })
      const admin  = await prisma.user.findFirst({ where: { username: 'e2e_admin' } })
      const patCount = await prisma.patient.count()
      const patient = await prisma.patient.create({
        data: {
          petName: 'Registrasi Pet', petCategory: 'Anjing',
          ownerId: owner.id, branchId: branch!.id,
          userId: admin!.id,
          idMember: `E2E-P-${String(patCount + 1).padStart(5, '0')}`,
        },
      })
      await prisma.medicalRecord.create({ data: { patientId: patient.id } })
      patientId = patient.id.toString()

      const dokter = await prisma.user.findFirst({ where: { role: 'dokter', username: 'e2e_dokter' } })
      doctorUserId = dokter!.id.toString()
    } finally {
      await prisma.$disconnect()
    }
  })
  afterAll(async () => { await app.close() })

  it('GET /api/registrasi/stats — mengembalikan statistik hari ini', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/registrasi/stats',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveProperty('total')
    expect(body.data).toHaveProperty('pending')
  })

  it('GET /api/registrasi — daftar registrasi dapat diambil', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/registrasi',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().data)).toBe(true)
  })

  it('POST /api/registrasi — membuat registrasi antrian baru', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/registrasi',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        patientId,
        doctorUserId,
        complaint: 'Demam dan tidak mau makan',
        registrant: 'Budi',
        visitType: 'baru',
        isPriority: false,
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data).toHaveProperty('idNumber')
    expect(body.data.idNumber).toMatch(/^REG-/)
    expect(body.data.acceptanceStatus).toBe('pending')
    registrasiId = body.data.id
  })

  it('POST /api/registrasi — validasi field wajib → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/registrasi',
      headers: { authorization: `Bearer ${token}` },
      payload: { complaint: 'tanpa pasien dan dokter' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/registrasi — registrasi baru muncul di daftar', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/registrasi',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.some((r: any) => r.id === registrasiId)).toBe(true)
  })

  it('POST /api/registrasi/:id/terima — terima registrasi oleh dokter', async () => {
    const dokterToken = await loginAs(app, 'e2e_dokter')
    const res = await app.inject({
      method: 'POST',
      url: `/api/registrasi/${registrasiId}/terima`,
      headers: { authorization: `Bearer ${dokterToken}` },
    })
    expect([200, 201]).toContain(res.statusCode)
    expect(res.json()).toHaveProperty('message')
  })

  it('POST /api/registrasi/:id/tolak — dapat menolak/decline registrasi', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/registrasi/${registrasiId}/tolak`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Dokter tidak tersedia' },
    })
    expect([200, 201]).toContain(res.statusCode)
    expect(res.json()).toHaveProperty('message')
  })
})
