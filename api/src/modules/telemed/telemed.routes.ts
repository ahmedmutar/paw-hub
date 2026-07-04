// @ts-nocheck
import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'

const FONNTE_TOKEN = process.env.FONNTE_TOKEN ?? ''

async function sendWA(phone: string, message: string) {
  const clean = phone.replace(/[^0-9]/g, '').replace(/^0/, '62')
  return fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { Authorization: FONNTE_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: clean, message }),
  }).catch(() => {})
}

export async function telemedRoutes(app: FastifyInstance) {
  // Owner request konsultasi (via portal)
  app.post('/telemed/request', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { branchId, tenantId } = req.authUser
    const { patientId, ownerId, doctorId, complaint, scheduledAt, fee, channel } = req.body as any

    const session = await req.server.prisma.telemedSession.create({
      data: {
        patientId: BigInt(patientId), ownerId: BigInt(ownerId), doctorId: BigInt(doctorId),
        branchId, tenantId, complaint, channel: channel ?? 'chat',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        fee: Number(fee ?? 0),
      },
      include: {
        patient: { select: { petName: true, petCategory: true } },
        owner: { select: { ownerName: true, phoneNumber: true } },
        doctor: { select: { fullname: true, phoneNumber: true } },
      },
    })

    // Notify doctor
    if (FONNTE_TOKEN && session.doctor.phoneNumber) {
      sendWA(session.doctor.phoneNumber,
        `*Permintaan Konsultasi Online*\n\nPasien: ${session.patient.petName}\nPemilik: ${session.owner.ownerName}\nKeluhan: ${complaint}\n\nSilakan konfirmasi di sistem VetCore.`)
    }

    return reply.status(201).send({ data: session })
  })

  // List sessions (admin/dokter)
  app.get('/telemed/sessions', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { branchId, role, userId } = req.authUser
    const { status, page = 1, limit = 20 } = req.query as any
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {
      ...(role !== 'superadmin' && { branchId }),
      ...(role === 'dokter' && { doctorId: userId }),
      ...(status && { status }),
    }

    const [total, sessions] = await Promise.all([
      req.server.prisma.telemedSession.count({ where }),
      req.server.prisma.telemedSession.findMany({
        where, skip, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { petName: true, petCategory: true } },
          owner: { select: { ownerName: true, phoneNumber: true } },
          doctor: { select: { fullname: true } },
        },
      }),
    ])
    return reply.send({ data: sessions, total, page: Number(page) })
  })

  // Detail sesi
  app.get('/telemed/session/:id', { preHandler: [authenticate] }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const session = await req.server.prisma.telemedSession.findUnique({
      where: { id },
      include: {
        patient: { select: { petName: true, petCategory: true, petYearAge: true, petMonthAge: true } },
        owner: { select: { ownerName: true, phoneNumber: true, address: true } },
        doctor: { select: { fullname: true } },
      },
    })
    if (!session) return reply.status(404).send({ message: 'Sesi tidak ditemukan' })
    return reply.send({ data: session })
  })

  // Dokter konfirmasi
  app.patch('/telemed/session/:id/confirm', { preHandler: [authenticate, requireRole('dokter', 'admin')] }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const session = await req.server.prisma.telemedSession.update({
      where: { id },
      data: { status: 'confirmed', startedAt: new Date() },
      include: { owner: true, patient: true },
    })
    if (FONNTE_TOKEN && session.owner.phoneNumber) {
      sendWA(session.owner.phoneNumber,
        `*Konsultasi Online Dikonfirmasi*\n\nKonsultasi untuk ${session.patient.petName} telah dikonfirmasi oleh dokter. Silakan mulai konsultasi Anda.`)
    }
    return reply.send({ data: session })
  })

  // Dokter tambah catatan dan e-resep
  app.patch('/telemed/session/:id/notes', { preHandler: [authenticate, requireRole('dokter', 'admin')] }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const { doctorNotes, ePrescription, status } = req.body as any
    const session = await req.server.prisma.telemedSession.update({
      where: { id },
      data: {
        doctorNotes, ePrescription,
        status: status ?? 'done',
        endedAt: status === 'done' ? new Date() : undefined,
      },
      include: { owner: true, patient: true },
    })

    // Kirim e-resep ke owner via WA
    if (FONNTE_TOKEN && ePrescription && session.owner.phoneNumber) {
      sendWA(session.owner.phoneNumber,
        `*E-Resep Digital*\n\nPasien: ${session.patient.petName}\n\n${ePrescription}\n\nSilakan ambil obat di klinik atau kami antar ke alamat Anda.`)
    }
    return reply.send({ data: session })
  })

  // Kasir — tandai lunas
  app.post('/telemed/billing/:id', { preHandler: [authenticate, requireRole('admin', 'kasir')] }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const { fee } = req.body as any
    const session = await req.server.prisma.telemedSession.update({
      where: { id },
      data: { isPaid: true, fee: fee ? Number(fee) : undefined },
    })
    return reply.send({ data: session })
  })

  // Rekap statistik
  app.get('/telemed/rekap', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const { month, year } = req.query as any
    const m = Number(month ?? new Date().getMonth() + 1)
    const y = Number(year ?? new Date().getFullYear())
    const dateFrom = new Date(y, m - 1, 1)
    const dateTo = new Date(y, m, 0, 23, 59, 59)

    const sessions = await req.server.prisma.telemedSession.findMany({
      where: { branchId, createdAt: { gte: dateFrom, lte: dateTo } },
      include: { doctor: { select: { fullname: true } } },
    })

    const done = sessions.filter(s => s.status === 'done')
    const totalRevenue = done.filter(s => s.isPaid).reduce((acc, s) => acc + Number(s.fee), 0)
    const avgRating = done.filter(s => s.rating).reduce((acc, s, _, arr) => acc + (s.rating ?? 0) / arr.length, 0)

    return reply.send({
      data: {
        total: sessions.length, done: done.length, pending: sessions.filter(s => s.status === 'pending').length,
        cancelled: sessions.filter(s => s.status === 'cancelled').length,
        totalRevenue, avgRating: Math.round(avgRating * 10) / 10,
      },
    })
  })
}
