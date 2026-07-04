import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildTestApp, loginAs } from './setup/testApp'
import type { FastifyInstance } from 'fastify'

describe('E2E — Auth (F-01)', () => {
  let app: FastifyInstance

  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })

  it('POST /api/masuk — login berhasil dengan kredensial valid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/masuk',
      payload: { username: 'e2e_admin', password: 'e2epass123' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveProperty('accessToken')
    expect(body.data).toHaveProperty('refreshToken')
    expect(body.data.user.username).toBe('e2e_admin')
    expect(body.data.user.role).toBe('admin')
  })

  it('POST /api/masuk — login gagal dengan password salah', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/masuk',
      payload: { username: 'e2e_admin', password: 'wrong_password' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().message).toContain('salah')
  })

  it('POST /api/masuk — login gagal dengan username tidak ada', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/masuk',
      payload: { username: 'tidak_ada', password: 'e2epass123' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/masuk — validasi input kosong → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/masuk',
      payload: { username: '', password: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/refresh — refresh token valid menghasilkan accessToken baru', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/masuk',
      payload: { username: 'e2e_admin', password: 'e2epass123' },
    })
    const { refreshToken } = loginRes.json().data

    const res = await app.inject({
      method: 'POST',
      url: '/api/refresh',
      payload: { refreshToken },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveProperty('accessToken')
  })

  it('POST /api/refresh — refresh token tidak valid → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/refresh',
      payload: { refreshToken: 'token-palsu-tidak-valid' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /health — endpoint publik dapat diakses tanpa token', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('ok')
  })

  it('GET /api/pasien — tanpa token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/pasien' })
    expect(res.statusCode).toBe(401)
  })

  it('Dokter dapat login dengan role berbeda', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/masuk',
      payload: { username: 'e2e_dokter', password: 'e2epass123' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.user.role).toBe('dokter')
  })
})
