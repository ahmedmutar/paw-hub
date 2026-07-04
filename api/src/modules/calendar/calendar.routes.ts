// @ts-nocheck
import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'

const FONNTE_TOKEN = process.env.FONNTE_TOKEN ?? ''

export async function calendarRoutes(app: FastifyInstance) {
  // Status sync
  app.get('/calendar/status', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { userId } = req.authUser
    const sync = await req.server.prisma.doctorCalendarSync.findUnique({ where: { doctorId: userId } })
    return reply.send({ data: sync ?? { syncEnabled: false, googleEmail: null, lastSyncAt: null } })
  })

  // Connect (mock OAuth — saves token from request)
  app.post('/calendar/connect', { preHandler: [authenticate, requireRole('dokter', 'admin')] }, async (req: any, reply) => {
    const { userId } = req.authUser
    const { googleEmail, googleAccessToken, googleRefreshToken } = req.body as any

    const sync = await req.server.prisma.doctorCalendarSync.upsert({
      where: { doctorId: userId },
      create: { doctorId: userId, googleEmail, googleAccessToken, googleRefreshToken, syncEnabled: true },
      update: { googleEmail, googleAccessToken, googleRefreshToken, syncEnabled: true },
    })
    return reply.send({ data: sync })
  })

  // Disconnect
  app.delete('/calendar/disconnect', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { userId } = req.authUser
    await req.server.prisma.doctorCalendarSync.upsert({
      where: { doctorId: userId },
      create: { doctorId: userId, syncEnabled: false },
      update: { syncEnabled: false, googleAccessToken: null, googleRefreshToken: null, googleEmail: null },
    })
    return reply.send({ message: 'Koneksi Google Calendar diputus' })
  })

  // Manual sync (mock — list upcoming schedules as events)
  app.post('/calendar/sync', { preHandler: [authenticate, requireRole('dokter', 'admin')] }, async (req: any, reply) => {
    const { userId } = req.authUser
    const sync = await req.server.prisma.doctorCalendarSync.findUnique({ where: { doctorId: userId } })
    if (!sync?.syncEnabled) return reply.status(400).send({ message: 'Google Calendar belum terhubung' })

    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    const appointments = await req.server.prisma.appointment.findMany({
      where: { doctorUserId: userId, appointmentDate: { gte: today, lte: nextWeek }, status: { notIn: ['cancelled'] } },
      include: { patient: { select: { petName: true } }, owner: { select: { ownerName: true } } },
    })

    await req.server.prisma.doctorCalendarSync.update({ where: { doctorId: userId }, data: { lastSyncAt: new Date() } })

    return reply.send({
      data: {
        syncedAt: new Date(),
        eventCount: appointments.length,
        events: appointments.map(a => ({
          title: `Konsultasi: ${a.patient.petName} (${a.owner.ownerName})`,
          date: a.appointmentDate,
          time: a.appointmentTime,
        })),
      },
    })
  })

  // WA jadwal mingguan untuk semua dokter
  app.post('/calendar/wa-reminder', { preHandler: [authenticate, requireRole('admin', 'superadmin')] }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const today = new Date()
    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + (8 - today.getDay()) % 7 || 7)
    const nextSunday = new Date(nextMonday)
    nextSunday.setDate(nextMonday.getDate() + 6)

    const doctors = await req.server.prisma.user.findMany({
      where: { branchId, role: 'dokter', isDeleted: false, status: true },
      include: {
        doctorSchedules: { where: { isActive: true }, orderBy: { dayOfWeek: 'asc' } },
      },
    })

    const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    let sent = 0
    for (const doctor of doctors) {
      if (!doctor.phoneNumber || !FONNTE_TOKEN) continue
      const scheduleText = doctor.doctorSchedules.map(s =>
        `  ${DAY_NAMES[s.dayOfWeek]}: ${s.shiftStart}–${s.shiftEnd}`
      ).join('\n') || '  (tidak ada jadwal)'

      const phone = doctor.phoneNumber.replace(/[^0-9]/g, '').replace(/^0/, '62')
      fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: FONNTE_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: phone,
          message: `*Jadwal Minggu Depan*\n\nHalo dr. ${doctor.fullname},\n\nBerikut jadwal Anda minggu depan (${nextMonday.toLocaleDateString('id-ID')} – ${nextSunday.toLocaleDateString('id-ID')}):\n\n${scheduleText}\n\nHubungi admin jika ada perubahan. Terima kasih!`,
        }),
      }).catch(() => {})
      sent++
      await new Promise(r => setTimeout(r, 500))
    }

    return reply.send({ message: `Reminder dikirim ke ${sent} dokter` })
  })
}
