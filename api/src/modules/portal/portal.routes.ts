import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import jwt from '@fastify/jwt'
import { sendWhatsapp } from '../notif/wa.service'

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function formatOwner(o: any) {
  return { ...o, id: o.id.toString(), branchId: o.branchId.toString() }
}

function formatPatient(p: any) {
  return {
    ...p,
    id:       p.id.toString(),
    ownerId:  p.ownerId.toString(),
    branchId: p.branchId.toString(),
  }
}

// Middleware: verifikasi portal JWT (berbeda dari JWT staff)
async function portalAuth(req: any, reply: any) {
  try {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) throw new Error('No token')
    const token = auth.slice(7)
    const payload = req.server.jwt.verify(token) as any
    if (payload.type !== 'owner_portal') throw new Error('Invalid token type')
    req.ownerId = BigInt(payload.ownerId)
  } catch {
    return reply.status(401).send({ message: 'Sesi tidak valid. Silakan login ulang.' })
  }
}

export async function portalRoutes(app: FastifyInstance) {

  // ── POST /portal/request-otp ──────────────────────────────────────────────
  app.post('/portal/request-otp', async (req, reply) => {
    const schema = z.object({ phone: z.string().min(8) })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Nomor telepon tidak valid' })

    const phone = body.data.phone.replace(/\D/g, '')

    // Cari owner berdasarkan nomor telepon
    const owner = await app.prisma.owner.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { phoneNumber: phone },
          { phoneNumber: `0${phone.slice(2)}` },  // 628xxx → 08xxx
          { phoneNumber: `+${phone}` },
        ],
      },
    })
    if (!owner) {
      // Jangan reveal apakah nomor terdaftar atau tidak
      return reply.send({ message: 'Jika nomor Anda terdaftar, OTP akan dikirim dalam beberapa detik.' })
    }

    // Hapus OTP lama yang belum terpakai
    await app.prisma.ownerOTP.deleteMany({
      where: { ownerId: owner.id, used: false },
    })

    const otp       = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 menit

    await app.prisma.ownerOTP.create({
      data: { ownerId: owner.id, otp, expiresAt },
    })

    const waMsg = `*VetCore* — Kode OTP Anda:\n\n*${otp}*\n\nKode ini berlaku selama 5 menit. Jangan bagikan kepada siapapun.`

    sendWhatsapp(app.prisma, {
      phone:         owner.phoneNumber!,
      recipientName: owner.ownerName,
      message:       waMsg,
      type:          'custom',
      branchId:      owner.branchId,
      userId:        BigInt(1),
    }).catch(() => {})

    return reply.send({ message: 'Jika nomor Anda terdaftar, OTP akan dikirim dalam beberapa detik.' })
  })

  // ── POST /portal/verify-otp ───────────────────────────────────────────────
  app.post('/portal/verify-otp', async (req, reply) => {
    const schema = z.object({ phone: z.string().min(8), otp: z.string().length(6) })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid' })

    const phone = body.data.phone.replace(/\D/g, '')

    const owner = await app.prisma.owner.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { phoneNumber: phone },
          { phoneNumber: `0${phone.slice(2)}` },
          { phoneNumber: `+${phone}` },
        ],
      },
    })
    if (!owner) return reply.status(401).send({ message: 'OTP tidak valid atau sudah kadaluarsa' })

    const record = await app.prisma.ownerOTP.findFirst({
      where: {
        ownerId:   owner.id,
        otp:       body.data.otp,
        used:      false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!record) return reply.status(401).send({ message: 'OTP tidak valid atau sudah kadaluarsa' })

    // Tandai OTP sebagai terpakai
    await app.prisma.ownerOTP.update({ where: { id: record.id }, data: { used: true } })

    // Issue portal JWT (TTL 24 jam)
    const token = app.jwt.sign(
      { ownerId: owner.id.toString(), type: 'owner_portal' },
      { expiresIn: '24h' },
    )

    return reply.send({
      token,
      owner: formatOwner(owner),
      message: 'Login berhasil',
    })
  })

  // ── GET /portal/me — info owner yang sedang login ─────────────────────────
  app.get('/portal/me', { preHandler: portalAuth }, async (req: any, reply) => {
    const owner = await app.prisma.owner.findUnique({
      where: { id: req.ownerId },
      include: { branch: { select: { id: true, branchName: true, address: true, phoneNumber: true } } },
    })
    if (!owner) return reply.status(404).send({ message: 'Data pemilik tidak ditemukan' })
    return reply.send({ data: { ...formatOwner(owner), branch: owner.branch ? { ...owner.branch, id: owner.branch.id.toString() } : null } })
  })

  // ── GET /portal/my-pets — semua hewan milik owner ────────────────────────
  app.get('/portal/my-pets', { preHandler: portalAuth }, async (req: any, reply) => {
    const patients = await app.prisma.patient.findMany({
      where:   { ownerId: req.ownerId, isDeleted: false },
      include: {
        branch:       { select: { id: true, branchName: true } },
        vaccinations: { orderBy: { nextDueAt: 'asc' }, take: 1, where: { nextDueAt: { gte: new Date() } } },
        dewormings:   { orderBy: { nextDueAt: 'asc' }, take: 1, where: { nextDueAt: { gte: new Date() } } },
        _count:       { select: { registrations: true } },
      },
      orderBy: { petName: 'asc' },
    })

    return reply.send({
      data: patients.map(p => ({
        ...formatPatient(p),
        branch: p.branch ? { ...p.branch, id: p.branch.id.toString() } : null,
        nextVaccination: p.vaccinations[0] ?? null,
        nextDeworming:   p.dewormings[0]   ?? null,
        visitCount:      p._count.registrations,
      })),
    })
  })

  // ── GET /portal/my-pets/:patientId/history — riwayat kunjungan ───────────
  app.get('/portal/my-pets/:patientId/history', { preHandler: portalAuth }, async (req: any, reply) => {
    const { patientId } = req.params as any

    // Pastikan hewan ini milik owner yang login
    const patient = await app.prisma.patient.findFirst({
      where: { id: BigInt(patientId), ownerId: req.ownerId, isDeleted: false },
    })
    if (!patient) return reply.status(404).send({ message: 'Data hewan tidak ditemukan' })

    const registrations = await app.prisma.registration.findMany({
      where:   { patientId: BigInt(patientId), acceptanceStatus: 'accepted' },
      orderBy: { createdAt: 'desc' },
      take:    20,
      include: {
        doctor:  { select: { fullname: true } },
        branch:  { select: { branchName: true } },
        checkUpResult: {
          select: {
            id: true, diagnosa: true, homeInstructions: true, createdAt: true,
            payments: { select: { id: true, createdAt: true, discount: true }, take: 1 },
          },
        },
      },
    })

    return reply.send({
      data: registrations.map((r: any) => ({
        id:           r.id.toString(),
        idNumber:     r.idNumber,
        visitDate:    r.createdAt,
        complaint:    r.complaint,
        visitType:    r.visitType,
        doctor:       r.doctor?.fullname ?? '-',
        branch:       r.branch?.branchName ?? '-',
        diagnosa:     r.checkUpResult?.diagnosa ?? null,
        notes:        r.checkUpResult?.homeInstructions ?? null,
        checkUpId:    r.checkUpResult?.id.toString() ?? null,
        hasPaid:      (r.checkUpResult?.payments?.length ?? 0) > 0,
        paymentId:    r.checkUpResult?.payments?.[0]?.id.toString() ?? null,
      })),
    })
  })

  // ── GET /portal/my-pets/:patientId/schedule — jadwal vaksin & cacing ──────
  app.get('/portal/my-pets/:patientId/schedule', { preHandler: portalAuth }, async (req: any, reply) => {
    const { patientId } = req.params as any

    const patient = await app.prisma.patient.findFirst({
      where: { id: BigInt(patientId), ownerId: req.ownerId, isDeleted: false },
    })
    if (!patient) return reply.status(404).send({ message: 'Data hewan tidak ditemukan' })

    const [vaccinations, dewormings] = await Promise.all([
      app.prisma.vaccinationRecord.findMany({
        where:   { patientId: BigInt(patientId) },
        orderBy: { administeredAt: 'desc' },
      }),
      app.prisma.dewormingRecord.findMany({
        where:   { patientId: BigInt(patientId) },
        orderBy: { administeredAt: 'desc' },
      }),
    ])

    return reply.send({
      data: {
        vaccinations: vaccinations.map(v => ({ ...v, id: v.id.toString(), patientId: v.patientId.toString(), checkUpResultId: v.checkUpResultId?.toString() ?? null, userId: v.userId.toString() })),
        dewormings:   dewormings.map(d => ({ ...d, id: d.id.toString(), patientId: d.patientId.toString(), checkUpResultId: d.checkUpResultId?.toString() ?? null, userId: d.userId.toString() })),
      },
    })
  })

  // ── GET /portal/my-pets/:patientId/payments — riwayat pembayaran ──────────
  app.get('/portal/my-pets/:patientId/payments', { preHandler: portalAuth }, async (req: any, reply) => {
    const { patientId } = req.params as any

    const patient = await app.prisma.patient.findFirst({
      where: { id: BigInt(patientId), ownerId: req.ownerId, isDeleted: false },
    })
    if (!patient) return reply.status(404).send({ message: 'Data hewan tidak ditemukan' })

    const checkUps = await app.prisma.checkUpResult.findMany({
      where: {
        registration: { patientId: BigInt(patientId) },
        statusPaidOff: true,
        isDeleted: false,
      },
      include: {
        payments: {
          take: 1,
          include: {
            paymentMethod:   { select: { methodName: true } },
            paymentItems:    { select: { id: true, quantity: true, detailItemPatient: { select: { priceOverall: true, priceItem: { select: { listOfItem: { select: { itemName: true } } } } } } } },
            paymentServices: { select: { id: true, detailServicePatient: { select: { priceOverall: true, priceService: { select: { listOfService: { select: { serviceName: true } } } } } } } },
          },
        },
        registration: { select: { idNumber: true, createdAt: true, branch: { select: { branchName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({
      data: checkUps.map((cu: any) => {
        const p = cu.payments?.[0]
        if (!p) return null
        const items    = (p.paymentItems ?? []).map((i: any) => ({
          name:  i.detailItemPatient?.priceItem?.listOfItem?.itemName ?? '-',
          qty:   Number(i.quantity),
          price: Number(i.detailItemPatient?.priceOverall ?? 0),
        }))
        const services = (p.paymentServices ?? []).map((s: any) => ({
          name:  s.detailServicePatient?.priceService?.listOfService?.serviceName ?? '-',
          qty:   1,
          price: Number(s.detailServicePatient?.priceOverall ?? 0),
        }))
        const subtotal = [...items, ...services].reduce((acc: number, i: any) => acc + i.price * i.qty, 0)
        const total    = subtotal - Number(p.discount ?? 0)
        return {
          paymentId:      p.id.toString(),
          invoiceNumber:  `INV-${p.id}`,
          visitDate:      cu.registration?.createdAt,
          registrationNo: cu.registration?.idNumber,
          branch:         cu.registration?.branch?.branchName ?? '-',
          paymentMethod:  p.paymentMethod?.methodName ?? '-',
          discount:       Number(p.discount ?? 0),
          total,
          items:          [...items, ...services],
        }
      }).filter(Boolean),
    })
  })
}
