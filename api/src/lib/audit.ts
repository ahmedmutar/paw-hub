import { PrismaClient } from '@prisma/client'

interface AuditOptions {
  tenantId?: bigint | null
  userId?: bigint | null
  username?: string
  action: string       // 'create' | 'update' | 'delete' | 'login' | 'export' | 'view'
  resource: string     // 'patient' | 'payment' | 'registration' | ...
  resourceId?: string | bigint
  details?: Record<string, any>
  ipAddress?: string
}

export async function audit(prisma: PrismaClient, opts: AuditOptions) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId:   opts.tenantId ?? null,
        userId:     opts.userId   ?? null,
        username:   opts.username,
        action:     opts.action,
        resource:   opts.resource,
        resourceId: opts.resourceId?.toString(),
        details:    opts.details ?? undefined,
        ipAddress:  opts.ipAddress,
      },
    })
  } catch {
    // audit non-blocking — jangan lempar error ke caller
  }
}

// Helper untuk extract IP dari Fastify request
export function getIp(req: any): string | undefined {
  return req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
    ?? req.ip
    ?? undefined
}
