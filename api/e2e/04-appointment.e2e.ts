import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildTestApp, loginAs } from './setup/testApp'
import { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'

const E2E_DB_URL = 'postgresql://ahmadmukhtar@localhost:5432/vetclinic_e2e'

describe('E2E — Booking & Appointment Online (F-18)', () => {
  let app: FastifyInstance
  let adminToken: string
  let appointmentId: string
  let doctorUserId: string
  let branchId: string

  beforeAll(async () => {
    app = await buildTestApp()
    adminToken = await loginAs(app, 'e2e_admin')

    const prisma = new PrismaClient({ datasources: { db: { url: E2E_DB_URL } } })
    try {
      const dokter = await prisma.user.findFirst({ where: { username: 'e2e_dokter' } })
      const branch = await prisma.branch.findFirst({ where: { branchCode: 'E2E' } })
      doctorUserId = dokter!.id.toString()
      branchId     = branch!.id.toString()
    } finally {
      await prisma.$disconnect()
    }
  })
  afterAll(async () => { await app.close() })

  it('GET /api/booking/config — endpoint publik tersedia tanpa auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/booking/config?branchId=${branchId}`,
    })
    expect([200, 404]).toContain(res.statusCode)
  })

  it('POST /api/booking — booking online publik berhasil dibuat', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]

    const res = await app.inject({
      method: 'POST',
      url: '/api/booking',
      payload: {
        ownerName:       'Online Booker E2E',
        ownerPhone:      '08199990001',
        petName:         'Boni E2E',
        petCategory:     'Anjing',
        complaint:       'Sakit perut',
        doctorUserId,
        branchId,
        appointmentDate: dateStr,
        appointmentTime: '10:00',
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data).toHaveProperty('id')
    expect(body.data.ownerName).toBe('Online Booker E2E')
    expect(body.data.status).toBe('pending')
    appointmentId = body.data.id
  })

  it('POST /api/booking — slot yang sama → 409 conflict', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]

    const res = await app.inject({
      method: 'POST',
      url: '/api/booking',
      payload: {
        ownerName: 'Orang Lain',
        ownerPhone: '08100000002',
        petName: 'Kucing X',
        petCategory: 'Kucing',
        complaint: 'Flu',
        doctorUserId,
        branchId,
        appointmentDate: dateStr,
        appointmentTime: '10:00',
      },
    })
    expect(res.statusCode).toBe(409)
  })

  it('GET /api/appointment — admin dapat melihat daftar appointment', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/appointment',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.some((a: any) => a.ownerName === 'Online Booker E2E')).toBe(true)
  })

  it('GET /api/appointment/:id — detail appointment', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/appointment/${appointmentId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.id).toBe(appointmentId)
  })

  it('PUT /api/appointment/:id/confirm — konfirmasi booking berhasil', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/appointment/${appointmentId}/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { note: 'Silakan datang 15 menit sebelum jadwal' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.status).toBe('confirmed')
  })

  it('GET /api/appointment/stats — statistik appointment tersedia', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/appointment/stats',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveProperty('total')
    expect(body.data).toHaveProperty('confirmed')
  })
})
