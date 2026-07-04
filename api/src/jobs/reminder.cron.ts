import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { runReminderScan } from '../modules/reminder/reminder.service'

export function startReminderCron(prisma: PrismaClient) {
  // Jalankan setiap hari jam 08:00 pagi WIB (UTC+7 = 01:00 UTC)
  // Cron: menit jam hari bulan hari-minggu
  const schedule = process.env.REMINDER_CRON_SCHEDULE ?? '0 1 * * *'

  cron.schedule(schedule, async () => {
    const daysAhead = Number(process.env.REMINDER_DAYS_AHEAD ?? 7)
    console.log(`[Reminder Cron] Running scan — ${new Date().toISOString()}, lookahead: ${daysAhead} hari`)
    try {
      const result = await runReminderScan(prisma, daysAhead)
      console.log(`[Reminder Cron] Done — vac: ${result.vaccination}, dew: ${result.deworming}, errors: ${result.errors}`)
    } catch (err) {
      console.error('[Reminder Cron] Error:', err)
    }
  }, {
    timezone: 'Asia/Jakarta',
  })

  console.log(`[Reminder Cron] Scheduled: "${schedule}" (Asia/Jakarta)`)
}
