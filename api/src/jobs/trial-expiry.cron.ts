import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'

export function startTrialExpiryCron(prisma: PrismaClient) {
  // Cek tiap jam — cukup sering supaya tenant yang trial-nya habis cepat ter-suspend,
  // tapi tidak seberat query per-request.
  const schedule = process.env.TRIAL_EXPIRY_CRON_SCHEDULE ?? '0 * * * *'

  cron.schedule(schedule, async () => {
    console.log(`[Trial Expiry Cron] Running — ${new Date().toISOString()}`)
    try {
      const result = await prisma.tenant.updateMany({
        where: {
          status: 'trial',
          trialEndsAt: { lt: new Date() },
          isDeleted: false,
        },
        data: { status: 'suspended' },
      })
      console.log(`[Trial Expiry Cron] Done — ${result.count} tenant disuspend`)
    } catch (err) {
      console.error('[Trial Expiry Cron] Error:', err)
    }
  }, {
    timezone: 'Asia/Jakarta',
  })

  console.log(`[Trial Expiry Cron] Scheduled: "${schedule}" (Asia/Jakarta)`)
}
