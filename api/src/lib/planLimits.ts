import { PrismaClient } from '@prisma/client'

export type PlanLimitResource = 'branches' | 'users' | 'patients'
export type PlanFeature = 'whatsapp' | 'booking' | 'grooming' | 'reminder' | 'portal' | 'priority_support'

type GateResult = { ok: true } | { ok: false; message: string }

// Minimal shape so this is callable both from route handlers (pass the
// Fastify app, which has .prisma decorated) and from plain services like
// reminder.service.ts that only hold a bare PrismaClient.
type PrismaCtx = { prisma: PrismaClient }

const RESOURCE_LABEL: Record<PlanLimitResource, string> = {
  branches: 'cabang',
  users:    'user',
  patients: 'pasien',
}

async function getActivePlan(app: PrismaCtx, tenantId: bigint) {
  const sub = await app.prisma.tenantSubscription.findUnique({
    where:   { tenantId },
    include: { plan: true },
  })
  return sub?.plan ?? null
}

/**
 * Cek apakah tenant masih di bawah batas maksimal paketnya untuk suatu resource.
 * tenantId null (instalasi lama tanpa tenant) atau tenant tanpa langganan aktif
 * tidak dibatasi di sini — supaya tidak mengunci instalasi non-SaaS.
 */
export async function checkPlanLimit(
  app: PrismaCtx,
  tenantId: bigint | null | undefined,
  resource: PlanLimitResource,
): Promise<GateResult> {
  if (!tenantId) return { ok: true }

  const plan = await getActivePlan(app, tenantId)
  if (!plan) return { ok: true }

  const used = await (
    resource === 'branches' ? app.prisma.branch.count({ where: { tenantId, isDeleted: false } }) :
    resource === 'users'    ? app.prisma.user.count({ where: { branch: { tenantId }, isDeleted: false } }) :
    app.prisma.patient.count({ where: { branch: { tenantId }, isDeleted: false } })
  )

  const limit =
    resource === 'branches' ? plan.maxBranches :
    resource === 'users'    ? plan.maxUsers :
    plan.maxPatients

  if (used >= limit) {
    return {
      ok: false,
      message: `Paket ${plan.name} Anda sudah mencapai batas maksimal ${limit} ${RESOURCE_LABEL[resource]}. Silakan upgrade paket untuk menambah.`,
    }
  }
  return { ok: true }
}

/**
 * Cek apakah suatu fitur aktif di paket tenant. tenantId null atau tenant
 * tanpa langganan aktif tidak dibatasi (lihat catatan di checkPlanLimit).
 */
export async function checkPlanFeature(
  app: PrismaCtx,
  tenantId: bigint | null | undefined,
  feature: PlanFeature,
): Promise<GateResult> {
  if (!tenantId) return { ok: true }

  const plan = await getActivePlan(app, tenantId)
  if (!plan) return { ok: true }

  const features = (plan.features as Record<string, boolean>) ?? {}
  if (!features[feature]) {
    return {
      ok: false,
      message: `Fitur ini tidak tersedia di paket ${plan.name} Anda. Silakan upgrade paket untuk mengaktifkan fitur ini.`,
    }
  }
  return { ok: true }
}
