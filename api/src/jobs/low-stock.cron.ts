import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { createStaffNotification } from '../lib/notification'

export function startLowStockCron(prisma: PrismaClient) {
  // Cek tiap 3 jam — cukup sering tanpa membanjiri notifikasi berulang-ulang
  const schedule = process.env.LOW_STOCK_CRON_SCHEDULE ?? '0 */3 * * *'

  cron.schedule(schedule, async () => {
    console.log(`[Low Stock Cron] Running — ${new Date().toISOString()}`)
    try {
      const items = await prisma.listOfItem.findMany({
        where: { isDeleted: false, isActive: true, limitItem: { not: null } },
        select: { id: true, itemName: true, totalItem: true, limitItem: true, branchId: true },
      })
      const lowStock = items.filter((i) => Number(i.totalItem) <= Number(i.limitItem))

      let created = 0
      for (const item of lowStock) {
        // Hindari spam — skip kalau sudah ada notifikasi belum dibaca untuk item yang sama
        // dalam 24 jam terakhir.
        const recent = await prisma.staffNotification.findFirst({
          where: {
            branchId:   item.branchId,
            type:       'low_stock',
            entityType: 'item',
            entityId:   item.id.toString(),
            createdAt:  { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        })
        if (recent) continue

        const isOut = Number(item.totalItem) <= 0
        await createStaffNotification(prisma, {
          branchId:   item.branchId,
          type:       'low_stock',
          title:      isOut ? 'Stok habis' : 'Stok menipis',
          message:    `${item.itemName} tersisa ${item.totalItem} (batas minimum ${item.limitItem}).`,
          entityType: 'item',
          entityId:   item.id.toString(),
        })
        created++
      }
      console.log(`[Low Stock Cron] Done — ${created} notifikasi baru dari ${lowStock.length} item stok menipis`)
    } catch (err) {
      console.error('[Low Stock Cron] Error:', err)
    }
  }, {
    timezone: 'Asia/Jakarta',
  })

  console.log(`[Low Stock Cron] Scheduled: "${schedule}" (Asia/Jakarta)`)
}
