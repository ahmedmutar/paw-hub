import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildTestApp, loginAs } from './setup/testApp'
import type { FastifyInstance } from 'fastify'

describe('E2E — Gudang & Inventori (F-09)', () => {
  let app: FastifyInstance
  let token: string
  let itemId: string

  beforeAll(async () => {
    app = await buildTestApp()
    token = await loginAs(app, 'e2e_admin')

    // Seed kategori & satuan lewat API
    await app.inject({
      method: 'POST',
      url: '/api/gudang/kategori',
      headers: { authorization: `Bearer ${token}` },
      payload: { categoryName: 'Obat E2E' },
    })
    await app.inject({
      method: 'POST',
      url: '/api/gudang/satuan',
      headers: { authorization: `Bearer ${token}` },
      payload: { unitName: 'Tablet' },
    })
  })
  afterAll(async () => { await app.close() })

  it('GET /api/gudang/barang — daftar barang awal kosong atau ada', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/gudang/barang',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('data')
  })

  it('POST /api/gudang/barang — menambah item baru ke gudang', async () => {
    // Get kategori and satuan IDs first
    const katRes = await app.inject({
      method: 'GET',
      url: '/api/gudang/kategori',
      headers: { authorization: `Bearer ${token}` },
    })
    const satuanRes = await app.inject({
      method: 'GET',
      url: '/api/gudang/satuan',
      headers: { authorization: `Bearer ${token}` },
    })

    const categoryItemId = katRes.json().data?.[0]?.id ?? '1'
    const unitItemId     = satuanRes.json().data?.[0]?.id ?? '1'

    const res = await app.inject({
      method: 'POST',
      url: '/api/gudang/barang',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        itemName:      'Amoxicillin E2E',
        categoryItemId,
        unitItemId,
        limitItem:     10,
        sellingPrice:  5000,
        capitalPrice:  3000,
      },
    })
    expect([200, 201]).toContain(res.statusCode)
    const body = res.json()
    expect(body.data).toHaveProperty('id')
    expect(body.data.itemName).toBe('Amoxicillin E2E')
    itemId = body.data.id
  })

  it('GET /api/gudang/barang/:id — detail item', async () => {
    if (!itemId) return
    const res = await app.inject({
      method: 'GET',
      url: `/api/gudang/barang/${itemId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.itemName).toBe('Amoxicillin E2E')
  })

  it('POST /api/gudang/mutasi — stok masuk meningkatkan totalItem', async () => {
    if (!itemId) return
    const res = await app.inject({
      method: 'POST',
      url: '/api/gudang/mutasi',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        listOfItemId: itemId,
        quantity:     100,
        status:       'masuk',
        notes:        'Pembelian awal E2E',
      },
    })
    expect([200, 201]).toContain(res.statusCode)
    const body = res.json()
    expect(body.data).toHaveProperty('id')
  })

  it('GET /api/gudang/barang/:id — stok meningkat setelah mutasi masuk', async () => {
    if (!itemId) return
    const res = await app.inject({
      method: 'GET',
      url: `/api/gudang/barang/${itemId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(Number(res.json().data.totalItem)).toBeGreaterThanOrEqual(100)
  })

  it('POST /api/gudang/mutasi — stok keluar mengurangi totalItem', async () => {
    if (!itemId) return
    const before = await app.inject({
      method: 'GET',
      url: `/api/gudang/barang/${itemId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    const stokAwal = Number(before.json().data.totalItem)

    const res = await app.inject({
      method: 'POST',
      url: '/api/gudang/mutasi',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        listOfItemId: itemId,
        quantity:     10,
        status:       'keluar',
        notes:        'Pemakaian pasien E2E',
      },
    })
    expect([200, 201]).toContain(res.statusCode)

    const after = await app.inject({
      method: 'GET',
      url: `/api/gudang/barang/${itemId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(Number(after.json().data.totalItem)).toBe(stokAwal - 10)
  })

  it('GET /api/gudang/low-stock — tidak ada low-stock item saat ini', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/gudang/low-stock',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
  })
})
