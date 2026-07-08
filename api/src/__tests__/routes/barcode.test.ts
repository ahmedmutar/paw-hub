import { describe, it, expect, vi } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { barcodeRoutes } from '../../modules/barcode/barcode.routes'

// DEFAULT_AUTH_USER: role admin, branchId=1, tenantId=1.
// ListOfItem punya branchId langsung. GET /scan dan /items sudah benar
// filter branchId, tapi POST /generate/:itemId dan GET /print/:itemId
// sebelumnya sama sekali tidak filter branchId (print bahkan tanpa
// requireRole sama sekali).

const OTHER_BRANCH_ITEM = { id: BigInt(50), branchId: BigInt(2), isDeleted: false, itemName: 'Obat Lain', barcodeId: null, totalItem: 10, unitItem: { unitName: 'Box' }, priceItems: [] }

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    if ('branchId' in where && String(where.branchId) !== String(record.branchId)) return Promise.resolve(null)
    return Promise.resolve(record)
  })
}

describe('barcode.routes — isolasi antar-cabang (IDOR)', () => {
  it('POST /gudang/barcode/generate/:itemId milik cabang lain harus 404, dan kode HARUS menggunakan pengecekan kepemilikan (findFirst dipanggil)', async () => {
    const updateMock = vi.fn().mockResolvedValue({ ...OTHER_BRANCH_ITEM, barcodeId: 'VET-000050-ABCD' })
    const findFirstMock = simulateFindFirst(OTHER_BRANCH_ITEM)
    const prisma = fullMockPrisma({ listOfItem: { findFirst: findFirstMock, update: updateMock } })
    const app = await buildApp(barcodeRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'POST', url: '/api/gudang/barcode/generate/50' })
    expect(findFirstMock).toHaveBeenCalled()
    expect(res.statusCode).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('GET /gudang/barcode/print/:itemId milik cabang lain harus 404, dan kode HARUS menggunakan pengecekan kepemilikan (findFirst dipanggil)', async () => {
    const findFirstMock = simulateFindFirst({ ...OTHER_BRANCH_ITEM, barcodeId: 'VET-000050-ABCD' })
    const prisma = fullMockPrisma({ listOfItem: { findFirst: findFirstMock } })
    const app = await buildApp(barcodeRoutes, prisma, DEFAULT_AUTH_USER)
    const res = await app.inject({ method: 'GET', url: '/api/gudang/barcode/print/50' })
    expect(findFirstMock).toHaveBeenCalled()
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})
