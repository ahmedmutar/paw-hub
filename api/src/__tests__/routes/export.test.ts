import { describe, it, expect, vi } from 'vitest'
import { mockAuthMiddleware } from '../helpers/mockAuth'
mockAuthMiddleware()

import { buildApp, fullMockPrisma, DEFAULT_AUTH_USER } from '../helpers/buildApp'
import { exportRoutes } from '../../modules/export/export.routes'

// DEFAULT_AUTH_USER: role admin, branchId=1, tenantId=1.
// ListOfPayment tidak punya branchId/tenantId langsung — cuma bisa dicek
// lewat relasi checkUpResultId -> registration.branch.tenantId, pola yang
// sama persis dengan endpoint /export/laporan & /export/pasien di file yang
// sama (yang sudah benar), tapi tidak diterapkan di /export/invoice/:id.

function simulateFindFirst(record: Record<string, any>) {
  return vi.fn((args: any) => {
    const where = args?.where ?? {}
    if ('id' in where && String(where.id) !== String(record.id)) return Promise.resolve(null)
    const tenantId = where.checkUpResult?.registration?.branch?.tenantId
    if (tenantId !== undefined && String(tenantId) !== String(record.tenantId)) return Promise.resolve(null)
    return Promise.resolve(record)
  })
}

const OTHER_TENANT_PAYMENT = {
  id: BigInt(50), tenantId: BigInt(99), discount: 0,
  paymentMethod: { methodName: 'Cash' }, createdBy: { fullname: 'Kasir Lain' },
  paymentItems: [], paymentServices: [], paymentMedicineGroups: [],
  checkUpResult: { registration: { patient: { owner: { ownerName: 'Orang Lain' } }, branch: { branchName: 'Cabang Lain', address: '', phoneNumber: '' } } },
}
const OWN_PAYMENT = { ...OTHER_TENANT_PAYMENT, id: BigInt(1), tenantId: BigInt(1) }

describe('export.routes — isolasi antar-tenant (IDOR)', () => {
  it('GET /export/invoice/:paymentId milik tenant lain harus 404, bukan bocorkan struk', async () => {
    const prisma = fullMockPrisma({ listOfPayment: { findFirst: simulateFindFirst(OTHER_TENANT_PAYMENT) } })
    const app = await buildApp(exportRoutes, prisma, DEFAULT_AUTH_USER)

    const res = await app.inject({ method: 'GET', url: '/api/export/invoice/50' })

    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('GET /export/invoice/:paymentId milik tenant sendiri tetap 200 (kontrol positif)', async () => {
    const prisma = fullMockPrisma({ listOfPayment: { findFirst: simulateFindFirst(OWN_PAYMENT) } })
    const app = await buildApp(exportRoutes, prisma, DEFAULT_AUTH_USER)

    const res = await app.inject({ method: 'GET', url: '/api/export/invoice/1' })

    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
