import { PrismaClient, StaffNotificationType } from '@prisma/client'

export async function createStaffNotification(
  prisma: PrismaClient,
  params: {
    branchId: bigint
    type: StaffNotificationType
    title: string
    message: string
    entityType?: string
    entityId?: string
  }
) {
  return prisma.staffNotification.create({
    data: {
      branchId:   params.branchId,
      type:       params.type,
      title:      params.title,
      message:    params.message,
      entityType: params.entityType,
      entityId:   params.entityId,
    },
  })
}
