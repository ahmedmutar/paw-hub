import { FastifyRequest, FastifyReply } from 'fastify'
import { UserRole } from '@prisma/client'

// Rute yang tetap boleh diakses walau langganan tenant sedang suspended/cancelled,
// supaya admin klinik masih bisa lihat status paket & melakukan upgrade/pembayaran.
const BILLING_PATH_PREFIX = '/api/billing'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const payload = request.user as any

    const user = await request.server.prisma.user.findFirst({
      where: { id: BigInt(payload.userId), isDeleted: false, status: true },
      include: {
        branch: { select: { branchName: true } },
        tenant: { select: { status: true } },
      },
    })

    if (!user) {
      return reply.status(401).send({ message: 'Akun tidak ditemukan atau tidak aktif.' })
    }

    const isSuspended = user.tenant && (user.tenant.status === 'suspended' || user.tenant.status === 'cancelled')
    const isBillingRoute = request.url.startsWith(BILLING_PATH_PREFIX)

    if (user.role !== 'superadmin' && isSuspended && !isBillingRoute) {
      return reply.status(402).send({
        message: 'Masa trial atau langganan klinik Anda sudah berakhir. Silakan upgrade paket untuk melanjutkan.',
        code: 'TENANT_SUSPENDED',
      })
    }

    request.authUser = {
      userId:     user.id,
      username:   user.username,
      fullname:   user.fullname,
      role:       user.role,
      branchId:   user.branchId,
      branchName: user.branch.branchName,
      tenantId:   user.tenantId ?? null,
    }
  } catch {
    return reply.status(401).send({ message: 'Token tidak valid atau sudah kadaluarsa.' })
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // superadmin melewati semua pengecekan role
    if (request.authUser.role === 'superadmin') return
    if (!roles.includes(request.authUser.role)) {
      return reply.status(403).send({ message: 'Anda tidak memiliki akses ke fitur ini.' })
    }
  }
}

export function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply, done: Function) {
  if (request.authUser.role !== 'superadmin') {
    return reply.status(403).send({ message: 'Akses ditolak. Hanya superadmin platform.' })
  }
  done()
}

// Helper: filter tenant untuk query Prisma
export function tenantFilter(authUser: AuthUser): { tenantId?: bigint } {
  if (authUser.role === 'superadmin') return {}
  if (authUser.tenantId) return { tenantId: authUser.tenantId }
  return {}
}

import { AuthUser } from '../types'
