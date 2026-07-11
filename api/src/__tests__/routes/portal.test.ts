import { describe, it, expect, vi } from 'vitest'
import { buildApp, fullMockPrisma } from '../helpers/buildApp'
import { portalRoutes } from '../../modules/portal/portal.routes'

const mockOwner = { id: BigInt(1), ownerName: 'Budi', phoneNumber: '08123456789', branchId: BigInt(1), tenantId: BigInt(1), isDeleted: false }

describe('POST /portal/request-otp — fitur Owner Portal harus sesuai paket klinik', () => {
  it('tidak mengirim OTP kalau paket klinik tidak punya fitur portal (respons tetap generik)', async () => {
    const otpCreateMock = vi.fn()
    const waLogCreateMock = vi.fn()
    const prisma = fullMockPrisma({
      owner: { findFirst: vi.fn().mockResolvedValue(mockOwner) },
      ownerOTP: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: otpCreateMock },
      branch: { findUnique: vi.fn().mockResolvedValue({ id: BigInt(1), tenantId: BigInt(1) }) },
      whatsappLog: { create: waLogCreateMock },
      tenantSubscription: {
        findUnique: vi.fn().mockResolvedValue({ plan: { name: 'Starter', features: { portal: false } } }),
      },
    })
    const app = await buildApp(portalRoutes, prisma)

    const res = await app.inject({ method: 'POST', url: '/api/portal/request-otp', payload: { phone: '08123456789' } })

    // Respons tetap generik (tidak boleh reveal status paket lewat status code beda)
    expect(res.statusCode).toBe(200)
    expect(otpCreateMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('mengirim OTP normal kalau paket klinik punya fitur portal', async () => {
    const otpCreateMock = vi.fn().mockResolvedValue({ id: BigInt(1) })
    const prisma = fullMockPrisma({
      owner: { findFirst: vi.fn().mockResolvedValue(mockOwner) },
      ownerOTP: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: otpCreateMock },
      branch: { findUnique: vi.fn().mockResolvedValue({ id: BigInt(1), tenantId: BigInt(1) }) },
      whatsappLog: { create: vi.fn().mockResolvedValue({ id: BigInt(1) }) },
      tenantSubscription: {
        findUnique: vi.fn().mockResolvedValue({ plan: { name: 'Pro', features: { portal: true } } }),
      },
    })
    const app = await buildApp(portalRoutes, prisma)

    const res = await app.inject({ method: 'POST', url: '/api/portal/request-otp', payload: { phone: '08123456789' } })

    expect(res.statusCode).toBe(200)
    expect(otpCreateMock).toHaveBeenCalled()
    await app.close()
  })
})
