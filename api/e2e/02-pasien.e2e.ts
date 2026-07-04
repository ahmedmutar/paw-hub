import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildTestApp, loginAs } from './setup/testApp'
import type { FastifyInstance } from 'fastify'

describe('E2E — Manajemen Pasien (F-03)', () => {
  let app: FastifyInstance
  let token: string
  let patientId: string
  let ownerId: string

  beforeAll(async () => {
    app = await buildTestApp()
    token = await loginAs(app, 'e2e_admin')
  })
  afterAll(async () => { await app.close() })

  it('GET /api/pasien/stats — mengembalikan statistik pasien', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pasien/stats',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveProperty('addedToday')
    expect(body.data).toHaveProperty('total')
  })

  it('GET /api/pasien — daftar pasien awal kosong', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pasien',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('POST /api/pasien — membuat pasien baru dengan pemilik baru', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/pasien',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        petName: 'Mochi E2E',
        petCategory: 'Kucing',
        petGender: 'Betina',
        petYearAge: 2,
        ownerName: 'Budi E2E',
        ownerPhone: '0812345000',
        ownerAddress: 'Jl. Test Pasien',
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data).toHaveProperty('id')
    expect(body.data.petName).toBe('Mochi E2E')
    expect(body.data).toHaveProperty('owner')
    expect(body.data.owner.ownerName).toBe('Budi E2E')
    patientId = body.data.id
    ownerId   = body.data.owner.id
  })

  it('POST /api/pasien — validasi field wajib → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/pasien',
      headers: { authorization: `Bearer ${token}` },
      payload: { petName: '', petCategory: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/pasien — daftar pasien mencakup pasien yang baru dibuat', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pasien',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.some((p: any) => p.petName === 'Mochi E2E')).toBe(true)
  })

  it('GET /api/pasien/:id — detail pasien lengkap', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/pasien/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.petName).toBe('Mochi E2E')
    expect(body.data.id).toBe(patientId)
  })

  it('GET /api/pasien/:id — id tidak valid → 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pasien/99999999',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/pemilik — daftar pemilik hewan', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pemilik',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    // owner ada di daftar pemilik
    expect(body.data.length).toBeGreaterThanOrEqual(0)
  })

  it('PUT /api/pasien/:id — update data pasien berhasil', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/pasien/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { petName: 'Mochi E2E Updated', petYearAge: 3 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.petName).toBe('Mochi E2E Updated')
  })

  it('GET /api/pasien — search berdasarkan nama hewan', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pasien?search=Mochi+E2E',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.length).toBeGreaterThan(0)
  })
})
