import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, requireRole } from '../../middleware/auth'
import { sendWhatsapp } from '../notif/wa.service'
import { createStaffNotification } from '../../lib/notification'
import { AppointmentStatus } from '@prisma/client'

const APPT_INCLUDE = {
  doctor: { select: { id: true, fullname: true, username: true } },
  branch: { select: { id: true, branchName: true, branchCode: true, address: true, phoneNumber: true, operatingHours: true } },
  patient: { select: { id: true, petName: true, idMember: true } },
}

function formatAppt(a: any) {
  return {
    ...a,
    id:            a.id.toString(),
    doctorUserId:  a.doctorUserId.toString(),
    branchId:      a.branchId.toString(),
    patientId:     a.patientId?.toString()     ?? null,
    registrationId:a.registrationId?.toString()  ?? null,
    handledBy:     a.handledBy?.toString()     ?? null,
    doctor:  a.doctor  ? { ...a.doctor,  id: a.doctor.id.toString()  } : null,
    branch:  a.branch  ? { ...a.branch,  id: a.branch.id.toString()  } : null,
    patient: a.patient ? { ...a.patient, id: a.patient.id.toString() } : null,
  }
}

export async function appointmentRoutes(app: FastifyInstance) {

  // ── GET /booking/config — public endpoint untuk form booking ──────────────
  // Mengembalikan daftar cabang + dokter aktif tanpa auth
  app.get('/booking/config', async (req, reply) => {
    const { branchId } = req.query as any

    const branchWhere = branchId ? { id: BigInt(branchId) } : {}
    const branches = await app.prisma.branch.findMany({
      where: branchWhere,
      select: { id: true, branchName: true, branchCode: true, address: true, phoneNumber: true, operatingHours: true },
      orderBy: { branchName: 'asc' },
    })

    const doctors = await app.prisma.user.findMany({
      where: {
        role: 'dokter',
        status: true,
        isDeleted: false,
        ...(branchId ? { branchId: BigInt(branchId) } : {}),
      },
      select: { id: true, fullname: true, branchId: true },
      orderBy: { fullname: 'asc' },
    })

    return reply.send({
      data: {
        branches: branches.map(b => ({ ...b, id: b.id.toString() })),
        doctors:  doctors.map(d => ({ ...d, id: d.id.toString(), branchId: d.branchId.toString() })),
      },
    })
  })

  // ── POST /booking — public, tanpa auth ───────────────────────────────────
  app.post('/booking', async (req, reply) => {
    const schema = z.object({
      ownerName:       z.string().min(1),
      ownerPhone:      z.string().min(8),
      petName:         z.string().min(1),
      petCategory:     z.string().optional(),
      complaint:       z.string().min(1),
      doctorUserId:    z.string(),
      branchId:        z.string(),
      appointmentDate: z.string(), // YYYY-MM-DD
      appointmentTime: z.string(), // HH:MM
      patientId:       z.string().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid', errors: body.error.flatten().fieldErrors })
    }

    const d = body.data

    // Cek slot tidak double-book untuk dokter yang sama
    const existing = await app.prisma.appointment.findFirst({
      where: {
        doctorUserId:    BigInt(d.doctorUserId),
        appointmentDate: new Date(d.appointmentDate),
        appointmentTime: d.appointmentTime,
        status:          { notIn: ['declined', 'cancelled'] },
      },
    })
    if (existing) {
      return reply.status(409).send({ message: 'Slot waktu tersebut sudah dipesan oleh pasien lain. Silakan pilih waktu lain.' })
    }

    const appt = await app.prisma.appointment.create({
      data: {
        ownerName:       d.ownerName,
        ownerPhone:      d.ownerPhone,
        petName:         d.petName,
        petCategory:     d.petCategory,
        complaint:       d.complaint,
        doctorUserId:    BigInt(d.doctorUserId),
        branchId:        BigInt(d.branchId),
        appointmentDate: new Date(d.appointmentDate),
        appointmentTime: d.appointmentTime,
        patientId:       d.patientId ? BigInt(d.patientId) : undefined,
      },
      include: APPT_INCLUDE,
    })

    // WA konfirmasi booking (non-blocking)
    const tanggal = new Date(d.appointmentDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const waMsg = `Halo *${d.ownerName}*! 📅\n\nBooking konsultasi untuk *${d.petName}* berhasil terdaftar!\n\n🗓 Tanggal: ${tanggal}\n⏰ Jam: ${d.appointmentTime}\n🏥 Klinik: ${appt.branch?.branchName ?? ''}\n👨‍⚕️ Dokter: ${appt.doctor?.fullname ?? ''}\n\nStatus booking Anda masih *menunggu konfirmasi* dari klinik. Kami akan menghubungi Anda setelah dikonfirmasi. Terima kasih! 🐾`

    sendWhatsapp(app.prisma, {
      phone:         d.ownerPhone,
      recipientName: d.ownerName,
      message:       waMsg,
      type:          'queue_confirmation',
      patientId:     d.patientId ? BigInt(d.patientId) : undefined,
      branchId:      BigInt(d.branchId),
      userId:        BigInt(1), // system
    }).catch(() => {})

    createStaffNotification(app.prisma, {
      branchId: BigInt(d.branchId),
      type:     'new_booking',
      title:    'Booking baru',
      message:  `${d.ownerName} booking untuk ${d.petName} pada ${d.appointmentDate} ${d.appointmentTime}.`,
      entityType: 'appointment',
      entityId:   appt.id.toString(),
    }).catch(() => {})

    return reply.status(201).send({
      message: 'Booking berhasil! Kami akan mengkonfirmasi jadwal Anda via WhatsApp.',
      data: formatAppt(appt),
    })
  })

  // ── GET /appointment — list (admin/dokter/resepsionis) ─────────────────────
  app.get('/appointment', { preHandler: authenticate }, async (req, reply) => {
    const q      = req.query as any
    const page   = Number(q.page  || 1)
    const limit  = Number(q.limit || 20)
    const status = q.status as string | undefined
    const date   = q.date   as string | undefined  // YYYY-MM-DD
    const search = q.search as string | undefined

    const where: any = {
      ...(req.authUser.role !== 'admin' ? { branchId: req.authUser.branchId } : {}),
      ...(req.authUser.role === 'dokter' ? { doctorUserId: req.authUser.userId } : {}),
      ...(status ? { status } : {}),
      ...(date   ? { appointmentDate: new Date(date) } : {}),
      ...(search ? {
        OR: [
          { ownerName: { contains: search, mode: 'insensitive' } },
          { petName:   { contains: search, mode: 'insensitive' } },
          { ownerPhone: { contains: search } },
        ],
      } : {}),
    }

    const [data, total] = await Promise.all([
      app.prisma.appointment.findMany({
        where, skip: (page - 1) * limit, take: limit,
        include: APPT_INCLUDE,
        orderBy: [{ appointmentDate: 'asc' }, { appointmentTime: 'asc' }],
      }),
      app.prisma.appointment.count({ where }),
    ])

    return reply.send({ data: data.map(formatAppt), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } })
  })

  // ── GET /appointment/stats ─────────────────────────────────────────────────
  app.get('/appointment/stats', { preHandler: authenticate }, async (req, reply) => {
    const bf    = req.authUser.role !== 'admin' ? { branchId: req.authUser.branchId } : {}
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const [pending, today_count, total, confirmed] = await Promise.all([
      app.prisma.appointment.count({ where: { ...bf, status: 'pending' } }),
      app.prisma.appointment.count({ where: { ...bf, appointmentDate: { gte: today, lt: tomorrow } } }),
      app.prisma.appointment.count({ where: bf }),
      app.prisma.appointment.count({ where: { ...bf, status: 'confirmed' } }),
    ])

    return reply.send({ data: { pending, today: today_count, total, confirmed } })
  })

  // ── GET /appointment/:id ───────────────────────────────────────────────────
  app.get('/appointment/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as any
    const appt = await app.prisma.appointment.findUnique({
      where: { id: BigInt(id) }, include: APPT_INCLUDE,
    })
    if (!appt) return reply.status(404).send({ message: 'Booking tidak ditemukan' })
    return reply.send({ data: formatAppt(appt) })
  })

  // ── PUT /appointment/:id — edit (admin/resepsionis) ────────────────────────
  app.put('/appointment/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as any
    const { appointmentDate, appointmentTime, notes, doctorUserId } = req.body as any

    const appt = await app.prisma.appointment.findUnique({ where: { id: BigInt(id) } })
    if (!appt) return reply.status(404).send({ message: 'Booking tidak ditemukan' })
    if (['converted', 'cancelled'].includes(appt.status)) {
      return reply.status(400).send({ message: 'Booking ini tidak dapat diubah lagi' })
    }

    const updated = await app.prisma.appointment.update({
      where: { id: BigInt(id) },
      data: {
        ...(appointmentDate ? { appointmentDate: new Date(appointmentDate), status: 'rescheduled' as AppointmentStatus } : {}),
        ...(appointmentTime ? { appointmentTime } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(doctorUserId ? { doctorUserId: BigInt(doctorUserId) } : {}),
        handledBy: req.authUser.userId,
      },
      include: APPT_INCLUDE,
    })

    // Kirim WA notif reschedule (non-blocking)
    if (appointmentDate || appointmentTime) {
      const tanggal = new Date(updated.appointmentDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      const waMsg = `Halo *${updated.ownerName}*! 📅\n\nJadwal booking *${updated.petName}* telah diubah:\n\n🗓 Tanggal Baru: ${tanggal}\n⏰ Jam: ${updated.appointmentTime}\n🏥 Klinik: ${updated.branch?.branchName ?? ''}\n\nMohon konfirmasi kehadiran Anda. Hubungi kami jika ada pertanyaan. 🐾`
      sendWhatsapp(app.prisma, {
        phone:         updated.ownerPhone,
        recipientName: updated.ownerName,
        message:       waMsg,
        type:          'queue_confirmation',
        branchId:      updated.branchId,
        userId:        req.authUser.userId,
      }).catch(() => {})
    }

    return reply.send({ data: formatAppt(updated), message: 'Booking berhasil diperbarui' })
  })

  // ── PUT /appointment/:id/confirm — konfirmasi (admin/dokter) ──────────────
  app.put('/appointment/:id/confirm', {
    preHandler: [authenticate, requireRole('admin', 'dokter', 'resepsionis')],
  }, async (req, reply) => {
    const { id } = req.params as any
    const appt = await app.prisma.appointment.findUnique({ where: { id: BigInt(id) }, include: APPT_INCLUDE })
    if (!appt) return reply.status(404).send({ message: 'Booking tidak ditemukan' })
    if (appt.status !== 'pending' && appt.status !== 'rescheduled') {
      return reply.status(400).send({ message: 'Hanya booking pending/rescheduled yang dapat dikonfirmasi' })
    }

    const updated = await app.prisma.appointment.update({
      where: { id: BigInt(id) },
      data: { status: 'confirmed', handledBy: req.authUser.userId },
      include: APPT_INCLUDE,
    })

    const tanggal = new Date(updated.appointmentDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const waMsg = `Halo *${updated.ownerName}*! ✅\n\nBooking *${updated.petName}* telah *dikonfirmasi*!\n\n🗓 Tanggal: ${tanggal}\n⏰ Jam: ${updated.appointmentTime}\n🏥 Klinik: ${updated.branch?.branchName ?? ''}\n👨‍⚕️ Dokter: ${updated.doctor?.fullname ?? ''}\n\nMohon hadir 10 menit sebelum jadwal. Terima kasih! 🐾`
    sendWhatsapp(app.prisma, {
      phone:         updated.ownerPhone,
      recipientName: updated.ownerName,
      message:       waMsg,
      type:          'queue_confirmation',
      branchId:      updated.branchId,
      userId:        req.authUser.userId,
    }).catch(() => {})

    return reply.send({ data: formatAppt(updated), message: 'Booking dikonfirmasi dan notifikasi WA dikirim' })
  })

  // ── PUT /appointment/:id/decline ──────────────────────────────────────────
  app.put('/appointment/:id/decline', {
    preHandler: [authenticate, requireRole('admin', 'dokter', 'resepsionis')],
  }, async (req, reply) => {
    const { id } = req.params as any
    const { reason } = req.body as any

    const appt = await app.prisma.appointment.findUnique({ where: { id: BigInt(id) }, include: APPT_INCLUDE })
    if (!appt) return reply.status(404).send({ message: 'Booking tidak ditemukan' })
    if (['converted', 'cancelled', 'declined'].includes(appt.status)) {
      return reply.status(400).send({ message: 'Status booking tidak bisa diubah lagi' })
    }

    const updated = await app.prisma.appointment.update({
      where: { id: BigInt(id) },
      data: { status: 'declined', declineReason: reason ?? null, handledBy: req.authUser.userId },
      include: APPT_INCLUDE,
    })

    const waMsg = `Halo *${updated.ownerName}*, mohon maaf 🙏\n\nBooking *${updated.petName}* tidak dapat kami terima${reason ? `:\n\n_${reason}_` : '.'}\n\nSilakan hubungi kami untuk membuat jadwal baru di *${updated.branch?.branchName ?? ''}*. Terima kasih atas pengertiannya. 🐾`
    sendWhatsapp(app.prisma, {
      phone:         updated.ownerPhone,
      recipientName: updated.ownerName,
      message:       waMsg,
      type:          'queue_called',
      branchId:      updated.branchId,
      userId:        req.authUser.userId,
    }).catch(() => {})

    return reply.send({ data: formatAppt(updated), message: 'Booking ditolak' })
  })

  // ── PUT /appointment/:id/convert — ubah ke antrian pada hari-H ───────────
  app.put('/appointment/:id/convert', {
    preHandler: [authenticate, requireRole('admin', 'resepsionis')],
  }, async (req, reply) => {
    const { id } = req.params as any
    const appt = await app.prisma.appointment.findUnique({ where: { id: BigInt(id) }, include: APPT_INCLUDE })
    if (!appt) return reply.status(404).send({ message: 'Booking tidak ditemukan' })
    if (appt.status === 'converted') {
      return reply.status(400).send({ message: 'Booking ini sudah dikonversi ke antrian' })
    }
    if (!['confirmed', 'pending'].includes(appt.status)) {
      return reply.status(400).send({ message: 'Hanya booking confirmed/pending yang dapat dikonversi' })
    }

    const branchId = appt.branchId
    const branch   = await app.prisma.branch.findUnique({ where: { id: branchId } })
    const todayCount = await app.prisma.registration.count({ where: { branchId } })
    const today   = new Date()
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    const idNumber = `REG-${dateStr}-${String(todayCount + 1).padStart(4, '0')}`

    const todayQueue = await app.prisma.registration.count({
      where: { branchId, createdAt: { gte: new Date(today.setHours(0, 0, 0, 0)) } },
    })
    const queueNumber = todayQueue + 1

    const reg = await app.prisma.registration.create({
      data: {
        idNumber,
        queueNumber,
        complaint:    appt.complaint,
        registrant:   appt.ownerName,
        branchId,
        doctorUserId: appt.doctorUserId,
        patientId:    appt.patientId!,
        userId:       req.authUser.userId,
        visitType:    'baru',
      },
    })

    const updated = await app.prisma.appointment.update({
      where: { id: BigInt(id) },
      data: { status: 'converted', registrationId: reg.id, handledBy: req.authUser.userId },
      include: APPT_INCLUDE,
    })

    return reply.send({
      data: formatAppt(updated),
      registration: { id: reg.id.toString(), idNumber, queueNumber },
      message: `Booking berhasil dikonversi ke antrian ${idNumber}`,
    })
  })

  // ── DELETE /appointment/:id — cancel ─────────────────────────────────────
  app.delete('/appointment/:id', {
    preHandler: [authenticate, requireRole('admin', 'resepsionis')],
  }, async (req, reply) => {
    const { id } = req.params as any
    const appt = await app.prisma.appointment.findUnique({ where: { id: BigInt(id) } })
    if (!appt) return reply.status(404).send({ message: 'Booking tidak ditemukan' })
    if (appt.status === 'converted') {
      return reply.status(400).send({ message: 'Booking yang sudah dikonversi tidak dapat dibatalkan' })
    }
    await app.prisma.appointment.update({
      where: { id: BigInt(id) },
      data: { status: 'cancelled', handledBy: req.authUser.userId },
    })
    return reply.send({ message: 'Booking dibatalkan' })
  })

  // ── GET /appointment/slots — cek slot tersedia untuk dokter + tanggal ─────
  app.get('/appointment/slots', async (req, reply) => {
    const { doctorUserId, date } = req.query as any
    if (!doctorUserId || !date) {
      return reply.status(400).send({ message: 'doctorUserId dan date wajib diisi' })
    }

    const booked = await app.prisma.appointment.findMany({
      where: {
        doctorUserId:    BigInt(doctorUserId),
        appointmentDate: new Date(date),
        status:          { notIn: ['declined', 'cancelled'] },
      },
      select: { appointmentTime: true },
    })

    const bookedSlots = booked.map(b => b.appointmentTime)

    // Slot jam operasional 08:00 - 16:00, tiap 30 menit
    const slots: { time: string; available: boolean }[] = []
    for (let h = 8; h < 17; h++) {
      for (const m of [0, 30]) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        slots.push({ time, available: !bookedSlots.includes(time) })
      }
    }

    return reply.send({ data: slots })
  })
}
