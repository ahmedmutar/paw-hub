import { describe, it, expect, vi } from 'vitest'
import { fullMockPrisma } from '../helpers/buildApp'
import { checkPlanLimit, checkPlanFeature } from '../../lib/planLimits'

function fakeApp(prisma: Record<string, unknown>) {
  return { prisma } as any
}

const FREE_PLAN = { name: 'Free', maxBranches: 1, maxUsers: 2, maxPatients: 60, features: {} }
const STARTER_PLAN = {
  name: 'Starter', maxBranches: 1, maxUsers: 10, maxPatients: 500,
  features: { whatsapp: true, booking: true, grooming: true, reminder: true, portal: false },
}

describe('checkPlanLimit', () => {
  it('tenantId null (instalasi lama) tidak dibatasi', async () => {
    const prisma = fullMockPrisma()
    const result = await checkPlanLimit(fakeApp(prisma), null, 'users')
    expect(result.ok).toBe(true)
  })

  it('tenant tanpa langganan aktif tidak dibatasi', async () => {
    const prisma = fullMockPrisma({ tenantSubscription: { findUnique: vi.fn().mockResolvedValue(null) } })
    const result = await checkPlanLimit(fakeApp(prisma), BigInt(1), 'patients')
    expect(result.ok).toBe(true)
  })

  it('diblokir saat sudah mencapai batas maksimal', async () => {
    const prisma = fullMockPrisma({
      tenantSubscription: { findUnique: vi.fn().mockResolvedValue({ plan: FREE_PLAN }) },
      user: { count: vi.fn().mockResolvedValue(2) },
    })
    const result = await checkPlanLimit(fakeApp(prisma), BigInt(1), 'users')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('Free')
  })

  it('diizinkan saat masih di bawah batas', async () => {
    const prisma = fullMockPrisma({
      tenantSubscription: { findUnique: vi.fn().mockResolvedValue({ plan: FREE_PLAN }) },
      user: { count: vi.fn().mockResolvedValue(1) },
    })
    const result = await checkPlanLimit(fakeApp(prisma), BigInt(1), 'users')
    expect(result.ok).toBe(true)
  })

  it('menghitung pasien lewat relasi branch->tenant, bukan kolom tenantId di Patient', async () => {
    const countMock = vi.fn().mockResolvedValue(59)
    const prisma = fullMockPrisma({
      tenantSubscription: { findUnique: vi.fn().mockResolvedValue({ plan: FREE_PLAN }) },
      patient: { count: countMock },
    })
    const result = await checkPlanLimit(fakeApp(prisma), BigInt(1), 'patients')
    expect(countMock).toHaveBeenCalledWith({ where: { branch: { tenantId: BigInt(1) }, isDeleted: false } })
    expect(result.ok).toBe(true)
  })
})

describe('checkPlanFeature', () => {
  it('tenantId null (instalasi lama) tidak dibatasi', async () => {
    const prisma = fullMockPrisma()
    const result = await checkPlanFeature(fakeApp(prisma), null, 'whatsapp')
    expect(result.ok).toBe(true)
  })

  it('diblokir kalau fitur tidak aktif di paket', async () => {
    const prisma = fullMockPrisma({
      tenantSubscription: { findUnique: vi.fn().mockResolvedValue({ plan: FREE_PLAN }) },
    })
    const result = await checkPlanFeature(fakeApp(prisma), BigInt(1), 'booking')
    expect(result.ok).toBe(false)
  })

  it('diizinkan kalau fitur aktif di paket', async () => {
    const prisma = fullMockPrisma({
      tenantSubscription: { findUnique: vi.fn().mockResolvedValue({ plan: STARTER_PLAN }) },
    })
    const result = await checkPlanFeature(fakeApp(prisma), BigInt(1), 'booking')
    expect(result.ok).toBe(true)
  })

  it('portal tetap diblokir walau whatsapp aktif, kalau flag portal false', async () => {
    const prisma = fullMockPrisma({
      tenantSubscription: { findUnique: vi.fn().mockResolvedValue({ plan: STARTER_PLAN }) },
    })
    const result = await checkPlanFeature(fakeApp(prisma), BigInt(1), 'portal')
    expect(result.ok).toBe(false)
  })
})
