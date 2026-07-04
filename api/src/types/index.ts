import { UserRole } from '@prisma/client'

export interface JwtPayload {
  userId: string
  username: string
  role: UserRole
  branchId: string
  tenantId: string | null
}

export interface AuthUser {
  userId: bigint
  username: string
  fullname: string
  role: UserRole
  branchId: bigint
  branchName: string
  tenantId: bigint | null
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser
  }
}
