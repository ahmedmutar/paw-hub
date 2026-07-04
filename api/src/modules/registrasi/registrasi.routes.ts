import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, requireRole } from '../../middleware/auth'
import { sendWhatsapp, msgQueueConfirmation, msgQueueCalled } from '../notif/wa.service'
import { createStaffNotification } from '../../lib/notification'

const createSchema = z.object({
  patientId:    z.string().min(1, 'Pasien wajib dipilih'),
  doctorUserId: z.string().min(1, 'Dokter wajib dipilih'),
  complaint:    z.string().min(1, 'Keluhan wajib diisi'),
  registrant:   z.string().min(1, 'Nama pendaftar wajib diisi'),
  visitType:    z.enum(['baru', 'kontrol']).default('baru'),
  isPriority:   z.boolean().default(false),
})

export async function registrasiRoutes(app: FastifyInstance) {

  // ── GET stats hari ini ─────────────────────────────────────────────────────
  app.get('/registrasi/stats', { preHandler: authenticate }, async (req, reply) => {
    const branchId  = req.authUser.branchId
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)
    const dateRange  = { gte: todayStart, lte: todayEnd }

    const baseWhere = { branchId, isDeleted: false, createdAt: dateRange }

    const [total, pending, accepted, selesai, cancelled] = await Promise.all([
      app.prisma.registration.count({ where: { ...baseWhere } }),
      app.prisma.registration.count({ where: { ...baseWhere, acceptanceStatus: 'pending' } }),
      app.prisma.registration.count({ where: { ...baseWhere, acceptanceStatus: 'accepted' } }),
      app.prisma.registration.count({
        where: { ...baseWhere, acceptanceStatus: 'accepted', checkUpResult: { statusFinish: true } },
      }),
      app.prisma.registration.count({ where: { ...baseWhere, acceptanceStatus: 'cancelled' } }),
    ])

    return reply.send({ data: { total, pending, accepted, selesai, cancelled } })
  })

  // ── GET antrian hari ini (queue board) ────────────────────────────────────
  app.get('/registrasi/antrian-hari-ini', { preHandler: authenticate }, async (req, reply) => {
    const q = req.query as any
    const branchId   = req.authUser.branchId
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)

    const where: any = {
      branchId,
      isDeleted: false,
      createdAt: { gte: todayStart, lte: todayEnd },
    }

    if (req.authUser.role === 'dokter') where.doctorUserId = req.authUser.userId
    if (q.doctorId) where.doctorUserId = BigInt(q.doctorId)
    if (q.status && q.status !== 'semua') where.acceptanceStatus = q.status

    const data = await app.prisma.registration.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true, petName: true, petCategory: true, petGender: true,
            petYearAge: true, petMonthAge: true, idMember: true,
            owner: { select: { ownerName: true, phoneNumber: true } },
            medicalRecord: { select: { allergies: true, chronicConditions: true } },
          },
        },
        doctor:       { select: { id: true, fullname: true } },
        checkUpResult: { select: { id: true, statusFinish: true, statusPaidOff: true, diagnosa: true } },
      },
      orderBy: [
        { isPriority: 'desc' },   // darurat naik ke atas
        { queueNumber: 'asc' },
      ],
    })

    return reply.send({ data })
  })

  // ── GET list dokter + beban hari ini ──────────────────────────────────────
  app.get('/registrasi/dokter', { preHandler: authenticate }, async (req, reply) => {
    const branchId   = req.authUser.branchId
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)

    const doctors = await app.prisma.user.findMany({
      where: { branchId, role: 'dokter', status: true, isDeleted: false },
      select: {
        id: true, fullname: true,
        registrations: {
          where: {
            branchId, isDeleted: false,
            acceptanceStatus: { notIn: ['cancelled', 'declined'] },
            createdAt: { gte: todayStart, lte: todayEnd },
          },
          select: { id: true },
        },
      },
      orderBy: { fullname: 'asc' },
    })

    const result = doctors.map((d) => ({
      id:        d.id,
      fullname:  d.fullname,
      todayLoad: (d.registrations as any[]).length,
    }))

    return reply.send({ data: result })
  })

  // ── GET list registrasi (semua hari, paginasi) ────────────────────────────
  app.get('/registrasi', { preHandler: authenticate }, async (req, reply) => {
    const q     = req.query as any
    const page  = Number(q.page  || 1)
    const limit = Number(q.limit || 20)
    const skip  = (page - 1) * limit

    const where: any = {
      branchId:  req.authUser.branchId,
      isDeleted: false,
      ...(q.status   && { acceptanceStatus: q.status }),
      ...(q.doctorId && { doctorUserId: BigInt(q.doctorId) }),
      ...(q.date && {
        createdAt: {
          gte: new Date(q.date + 'T00:00:00'),
          lte: new Date(q.date + 'T23:59:59'),
        },
      }),
      ...(q.search && {
        patient: {
          OR: [
            { petName:  { contains: q.search, mode: 'insensitive' as const } },
            { idMember: { contains: q.search, mode: 'insensitive' as const } },
            { owner: { ownerName: { contains: q.search, mode: 'insensitive' as const } } },
          ],
        },
      }),
    }

    if (req.authUser.role === 'dokter') where.doctorUserId = req.authUser.userId

    const [data, total] = await Promise.all([
      app.prisma.registration.findMany({
        where, skip, take: limit,
        include: {
          patient: {
            include: { owner: { select: { ownerName: true, phoneNumber: true } } },
          },
          doctor:        { select: { fullname: true } },
          checkUpResult: { select: { id: true, statusPaidOff: true, statusFinish: true } },
        },
        orderBy: [{ isPriority: 'desc' }, { createdAt: 'desc' }],
      }),
      app.prisma.registration.count({ where }),
    ])

    return reply.send({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } })
  })

  // ── GET detail satu registrasi ────────────────────────────────────────────
  app.get('/registrasi/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const reg = await app.prisma.registration.findFirst({
      where: { id: BigInt(id), isDeleted: false },
      include: {
        patient: {
          include: {
            owner: true,
            medicalRecord: true,
            _count: { select: { registrations: { where: { isDeleted: false } } } },
          },
        },
        doctor:          { select: { id: true, fullname: true } },
        checkUpResult:   true,
        doctorAcceptance: { include: { doctor: { select: { fullname: true } } } },
      },
    })
    if (!reg) return reply.status(404).send({ message: 'Registrasi tidak ditemukan.' })
    return reply.send({ data: reg })
  })

  // ── GET dropdown pasien siap bayar ────────────────────────────────────────
  app.get('/registrasi/siap-bayar', { preHandler: authenticate }, async (req, reply) => {
    const data = await app.prisma.registration.findMany({
      where: {
        branchId:          req.authUser.branchId,
        isDeleted:         false,
        acceptanceStatus:  'accepted',
        isHideFromDropDown: false,
        checkUpResult: { statusPaidOff: false, statusFinish: true },
      },
      include: {
        patient: {
          select: {
            petName: true, petCategory: true,
            owner: { select: { ownerName: true } },
          },
        },
        checkUpResult: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ data })
  })

  // ── POST buat registrasi baru ─────────────────────────────────────────────
  app.post('/registrasi', { preHandler: authenticate }, async (req, reply) => {
    const body = createSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const branchId = req.authUser.branchId

    // Nomor antrian hari ini
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)
    const todayCount = await app.prisma.registration.count({
      where: { branchId, isDeleted: false, createdAt: { gte: todayStart, lte: todayEnd } },
    })
    const queueNumber = todayCount + 1

    // ID unik REG-YYYYMMDD-XXXX
    const totalCount = await app.prisma.registration.count({ where: { branchId } })
    const today      = new Date()
    const dateStr    = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    const idNumber   = `REG-${dateStr}-${String(totalCount + 1).padStart(4, '0')}`

    const reg = await app.prisma.registration.create({
      data: {
        idNumber,
        patientId:    BigInt(body.data.patientId),
        doctorUserId: BigInt(body.data.doctorUserId),
        userId:       req.authUser.userId,
        branchId,
        complaint:    body.data.complaint,
        registrant:   body.data.registrant,
        visitType:    body.data.visitType,
        queueNumber,
        isPriority:   body.data.isPriority,
      },
      include: {
        patient: { include: { owner: true } },
        doctor:  { select: { fullname: true } },
      },
    })

    // Kirim WA konfirmasi antrian (non-blocking)
    const ownerPhone = reg.patient?.owner?.phoneNumber
    if (ownerPhone) {
      const branchData = await app.prisma.branch.findUnique({ where: { id: branchId } })
      sendWhatsapp(app.prisma, {
        phone:          ownerPhone,
        recipientName:  reg.patient?.owner?.ownerName,
        message:        msgQueueConfirmation({
          petName:     reg.patient?.petName ?? '',
          ownerName:   reg.patient?.owner?.ownerName ?? '',
          queueNumber: String(reg.queueNumber),
          branchName:  branchData?.branchName ?? '',
        }),
        type:           'queue_confirmation',
        patientId:      reg.patientId,
        registrationId: reg.id,
        branchId,
        userId:         req.authUser.userId,
      }).catch(() => {})
    }

    createStaffNotification(app.prisma, {
      branchId,
      type:       'queue_new',
      title:      'Antrian baru',
      message:    `Antrian #${reg.queueNumber} — ${reg.patient?.petName ?? ''} (${reg.patient?.owner?.ownerName ?? ''}).`,
      entityType: 'registration',
      entityId:   reg.id.toString(),
    }).catch(() => {})

    return reply.status(201).send({ message: 'Pendaftaran berhasil dibuat.', data: reg })
  })

  // ── PUT update registrasi (hanya saat masih pending) ──────────────────────
  app.put('/registrasi/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = createSchema.partial().safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.' })

    const existing = await app.prisma.registration.findUnique({ where: { id: BigInt(id) } })
    if (!existing) return reply.status(404).send({ message: 'Registrasi tidak ditemukan.' })
    if (existing.acceptanceStatus !== 'pending') {
      return reply.status(400).send({ message: 'Hanya registrasi yang masih pending yang bisa diubah.' })
    }

    const data: any = {}
    if (body.data.patientId)    data.patientId    = BigInt(body.data.patientId)
    if (body.data.doctorUserId) data.doctorUserId = BigInt(body.data.doctorUserId)
    if (body.data.complaint)    data.complaint    = body.data.complaint
    if (body.data.registrant)   data.registrant   = body.data.registrant
    if (body.data.visitType !== undefined) data.visitType  = body.data.visitType
    if (body.data.isPriority !== undefined) data.isPriority = body.data.isPriority

    const reg = await app.prisma.registration.update({
      where:   { id: BigInt(id) },
      data,
      include: { patient: true, doctor: { select: { fullname: true } } },
    })
    return reply.send({ message: 'Pendaftaran berhasil diperbarui.', data: reg })
  })

  // ── POST terima (dokter/admin) ─────────────────────────────────────────────
  app.post('/registrasi/:id/terima', {
    preHandler: [authenticate, requireRole('admin', 'dokter')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const reg = await app.prisma.registration.update({
      where: { id: BigInt(id) },
      data:  { acceptanceStatus: 'accepted' },
      include: { patient: { include: { owner: true } } },
    })
    await app.prisma.doctorAcceptance.upsert({
      where:  { registrationId: reg.id },
      create: { registrationId: reg.id, userId: req.authUser.userId },
      update: { userId: req.authUser.userId },
    })

    // Kirim WA "giliran dipanggil" (non-blocking)
    const ownerPhone = reg.patient?.owner?.phoneNumber
    if (ownerPhone) {
      const branchData = await app.prisma.branch.findUnique({ where: { id: reg.branchId } })
      sendWhatsapp(app.prisma, {
        phone:          ownerPhone,
        recipientName:  reg.patient?.owner?.ownerName,
        message:        msgQueueCalled({
          petName:     reg.patient?.petName ?? '',
          ownerName:   reg.patient?.owner?.ownerName ?? '',
          queueNumber: String(reg.queueNumber),
          branchName:  branchData?.branchName ?? '',
        }),
        type:           'queue_called',
        patientId:      reg.patientId,
        registrationId: reg.id,
        branchId:       reg.branchId,
        userId:         req.authUser.userId,
      }).catch(() => {})
    }

    return reply.send({ message: 'Pendaftaran diterima.' })
  })

  // ── POST tolak (dokter/admin) ──────────────────────────────────────────────
  app.post('/registrasi/:id/tolak', {
    preHandler: [authenticate, requireRole('admin', 'dokter')],
  }, async (req, reply) => {
    const { id }   = req.params as { id: string }
    const { reason } = (req.body as any) ?? {}
    await app.prisma.registration.update({
      where: { id: BigInt(id) },
      data:  { acceptanceStatus: 'declined', cancelReason: reason ?? null },
    })
    return reply.send({ message: 'Pendaftaran ditolak.' })
  })

  // ── POST batalkan (resepsionis/admin) ─────────────────────────────────────
  app.post('/registrasi/:id/batalkan', { preHandler: authenticate }, async (req, reply) => {
    const { id }   = req.params as { id: string }
    const { reason } = (req.body as any) ?? {}

    const existing = await app.prisma.registration.findUnique({ where: { id: BigInt(id) } })
    if (!existing) return reply.status(404).send({ message: 'Registrasi tidak ditemukan.' })
    if (existing.acceptanceStatus === 'accepted' && !['admin', 'resepsionis'].includes(req.authUser.role)) {
      return reply.status(403).send({ message: 'Hanya admin atau resepsionis yang dapat membatalkan yang sudah diterima.' })
    }

    await app.prisma.registration.update({
      where: { id: BigInt(id) },
      data:  { acceptanceStatus: 'cancelled', cancelReason: reason ?? null },
    })
    return reply.send({ message: 'Pendaftaran dibatalkan.' })
  })

  // ── DELETE registrasi (soft) ───────────────────────────────────────────────
  app.delete('/registrasi/:id', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await app.prisma.registration.findUnique({ where: { id: BigInt(id) } })
    if (!existing) return reply.status(404).send({ message: 'Registrasi tidak ditemukan.' })
    const hasCheckUp = await app.prisma.checkUpResult.findFirst({ where: { patientRegistrationId: BigInt(id) } })
    if (existing.acceptanceStatus === 'accepted' && hasCheckUp) {
      return reply.status(400).send({ message: 'Tidak dapat menghapus registrasi yang sudah ada hasil pemeriksaan.' })
    }
    await app.prisma.registration.update({
      where: { id: BigInt(id) },
      data:  { isDeleted: true, deletedAt: new Date() },
    })
    return reply.send({ message: 'Pendaftaran berhasil dihapus.' })
  })

  // ── RAWAT INAP ─────────────────────────────────────────────────────────────

  const RI_INCLUDE = {
    patient: {
      select: {
        id: true, idMember: true, petName: true, petCategory: true, petGender: true,
        owner: { select: { id: true, ownerName: true, phoneNumber: true } },
      },
    },
    branch: { select: { id: true, branchName: true } },
  }

  function formatRI(r: any) {
    return {
      ...r,
      id: r.id.toString(),
      patientId: r.patientId.toString(),
      doctorUserId: r.doctorUserId.toString(),
      branchId: r.branchId.toString(),
      userId: r.userId.toString(),
      patient: r.patient
        ? { ...r.patient, id: r.patient.id.toString(), ownerId: r.patient.ownerId?.toString(),
            owner: r.patient.owner ? { ...r.patient.owner, id: r.patient.owner.id.toString() } : null }
        : null,
      branch: r.branch ? { ...r.branch, id: r.branch.id.toString() } : null,
    }
  }

  app.get('/rawat-inap/stats', { preHandler: authenticate }, async (req, reply) => {
    const branchId = req.authUser.branchId
    const bf = req.authUser.role === 'admin' ? {} : { branchId }

    const [pending, accepted, thisMonth, total] = await Promise.all([
      app.prisma.inPatient.count({ where: { ...bf, isDeleted: false, acceptanceStatus: 'pending' } }),
      app.prisma.inPatient.count({ where: { ...bf, isDeleted: false, acceptanceStatus: 'accepted' } }),
      app.prisma.inPatient.count({
        where: {
          ...bf, isDeleted: false,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      app.prisma.inPatient.count({ where: { ...bf, isDeleted: false } }),
    ])

    return reply.send({ data: { pending, accepted, thisMonth, total } })
  })

  app.get('/rawat-inap/aktif', { preHandler: authenticate }, async (req, reply) => {
    const branchId = req.authUser.branchId
    const where: any = {
      isDeleted: false,
      acceptanceStatus: { in: ['pending', 'accepted'] },
      ...(req.authUser.role !== 'admin' ? { branchId } : {}),
      ...(req.authUser.role === 'dokter' ? { doctorUserId: req.authUser.userId } : {}),
    }

    const data = await app.prisma.inPatient.findMany({
      where,
      include: RI_INCLUDE,
      orderBy: [{ acceptanceStatus: 'asc' }, { createdAt: 'desc' }],
    })
    return reply.send({ data: data.map(formatRI) })
  })

  app.get('/rawat-inap', { preHandler: authenticate }, async (req, reply) => {
    const q      = req.query as any
    const page   = Number(q.page  || 1)
    const limit  = Number(q.limit || 20)
    const status = q.status as string | undefined
    const search = q.search as string | undefined

    const where: any = {
      isDeleted: false,
      ...(req.authUser.role !== 'admin' ? { branchId: req.authUser.branchId } : {}),
      ...(req.authUser.role === 'dokter' ? { doctorUserId: req.authUser.userId } : {}),
      ...(status ? { acceptanceStatus: status } : {}),
      ...(search ? { patient: { petName: { contains: search, mode: 'insensitive' } } } : {}),
    }

    const [data, total] = await Promise.all([
      app.prisma.inPatient.findMany({
        where, skip: (page - 1) * limit, take: limit,
        include: RI_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      app.prisma.inPatient.count({ where }),
    ])
    return reply.send({ data: data.map(formatRI), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } })
  })

  app.get('/rawat-inap/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as any
    const ri = await app.prisma.inPatient.findFirst({
      where: { id: BigInt(id), isDeleted: false },
      include: RI_INCLUDE,
    })
    if (!ri) return reply.status(404).send({ message: 'Data rawat inap tidak ditemukan' })
    return reply.send({ data: formatRI(ri) })
  })

  app.post('/rawat-inap', { preHandler: authenticate }, async (req, reply) => {
    const schema = z.object({
      patientId:    z.string(),
      doctorUserId: z.string(),
      complaint:    z.string().min(1),
      registrant:   z.string().min(1),
      estimateDay:  z.number().int().min(1).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const branchId = req.authUser.branchId
    const branch   = await app.prisma.branch.findUnique({ where: { id: branchId } })
    const count    = await app.prisma.inPatient.count({ where: { branchId } })
    const idNumber = `RI-${branch?.branchCode || 'XX'}-${String(count + 1).padStart(4, '0')}`

    const inPatient = await app.prisma.inPatient.create({
      data: {
        idNumber,
        patientId:    BigInt(body.data.patientId),
        doctorUserId: BigInt(body.data.doctorUserId),
        branchId,
        complaint:    body.data.complaint,
        registrant:   body.data.registrant,
        estimateDay:  body.data.estimateDay,
        userId:       req.authUser.userId,
      },
      include: RI_INCLUDE,
    })

    return reply.status(201).send({ message: 'Rawat inap berhasil didaftarkan.', data: formatRI(inPatient) })
  })

  app.put('/rawat-inap/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as any
    const { complaint, estimateDay, realityDay, registrant } = req.body as any

    const ri = await app.prisma.inPatient.findFirst({ where: { id: BigInt(id), isDeleted: false } })
    if (!ri) return reply.status(404).send({ message: 'Data rawat inap tidak ditemukan' })

    const updated = await app.prisma.inPatient.update({
      where: { id: BigInt(id) },
      data: {
        ...(complaint   !== undefined ? { complaint }                        : {}),
        ...(estimateDay !== undefined ? { estimateDay: Number(estimateDay) } : {}),
        ...(realityDay  !== undefined ? { realityDay:  Number(realityDay)  } : {}),
        ...(registrant  !== undefined ? { registrant }                       : {}),
      },
      include: RI_INCLUDE,
    })
    return reply.send({ data: formatRI(updated), message: 'Data rawat inap berhasil diperbarui' })
  })

  // Ubah status: accept / decline / discharge (cancelled)
  app.put('/rawat-inap/:id/status', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as any
    const { status, realityDay } = req.body as any

    const allowed = ['accepted', 'declined', 'cancelled']
    if (!allowed.includes(status)) {
      return reply.status(400).send({ message: `Status harus salah satu dari: ${allowed.join(', ')}` })
    }

    const ri = await app.prisma.inPatient.findFirst({ where: { id: BigInt(id), isDeleted: false } })
    if (!ri) return reply.status(404).send({ message: 'Data rawat inap tidak ditemukan' })

    const updated = await app.prisma.inPatient.update({
      where: { id: BigInt(id) },
      data: {
        acceptanceStatus: status,
        ...(status === 'cancelled' && realityDay ? { realityDay: Number(realityDay) } : {}),
      },
      include: RI_INCLUDE,
    })

    const msg: Record<string, string> = {
      accepted: 'Pasien berhasil diterima rawat inap',
      declined: 'Rawat inap berhasil ditolak',
      cancelled: 'Pasien berhasil di-discharge',
    }
    return reply.send({ data: formatRI(updated), message: msg[status] })
  })

  app.delete('/rawat-inap/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const { id } = req.params as any
    const ri = await app.prisma.inPatient.findFirst({ where: { id: BigInt(id), isDeleted: false } })
    if (!ri) return reply.status(404).send({ message: 'Data rawat inap tidak ditemukan' })

    await app.prisma.inPatient.update({
      where: { id: BigInt(id) },
      data: { isDeleted: true, deletedAt: new Date() },
    })
    return reply.send({ message: 'Data rawat inap berhasil dihapus' })
  })
}
