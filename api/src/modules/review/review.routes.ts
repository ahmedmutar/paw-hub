import { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { authenticate, requireRole } from '../../middleware/auth'
import { audit, getIp } from '../../lib/audit'

const FONNTE_TOKEN = process.env.FONNTE_TOKEN ?? ''

async function sendWA(phone: string, message: string) {
  const clean = phone.replace(/[^0-9]/g, '').replace(/^0/, '62')
  return fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { Authorization: FONNTE_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: clean, message, delay: 1 }),
  }).then(r => r.json()).catch(() => null)
}

export async function reviewRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma

  // POST /review/send — manually send survey to specific registration
  fastify.post('/review/send', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const { registrationId } = req.body as { registrationId: string }
    const regId = BigInt(registrationId)

    const reg = await prisma.registration.findFirst({
      where: { id: regId, branchId: req.authUser.branchId },
      include: {
        patient: { include: { owner: true } },
        doctor: true,
        review: true,
      },
    })
    if (!reg) return reply.status(404).send({ message: 'Pendaftaran tidak ditemukan' })
    if (reg.review) return reply.status(400).send({ message: 'Survey sudah pernah dikirim' })

    const token = randomUUID()
    const owner = reg.patient.owner
    if (!owner.phoneNumber) return reply.status(400).send({ message: 'Owner tidak memiliki nomor telepon' })

    const review = await prisma.reviewRecord.create({
      data: {
        registrationId: regId,
        patientId: reg.patientId,
        doctorId: reg.doctorUserId,
        branchId: reg.branchId,
        surveyToken: token,
        sentAt: new Date(),
      },
    })

    const appUrl = process.env.APP_URL ?? 'https://pawhub.id'
    const msg = `Halo ${owner.ownerName} 👋\n\nBagaimana pengalaman kunjungan *${reg.patient.petName}* ke klinik kami?\n\nBerikan penilaian di sini:\n${appUrl}/review/${token}\n\nCukup ketuk tautan di atas dan pilih bintang 1-5. Terima kasih! 🐾`

    sendWA(owner.phoneNumber, msg).catch(() => {})

    return reply.send({ success: true, data: { reviewId: review.id.toString(), token } })
  })

  // POST /review/send-bulk — send survey to all registrations from yesterday (auto-cron use)
  fastify.post('/review/send-bulk', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const { branchId, tenantId } = req.authUser
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const dayEnd = new Date(yesterday)
    dayEnd.setHours(23, 59, 59, 999)

    const regs = await prisma.registration.findMany({
      where: {
        branchId,
        createdAt: { gte: yesterday, lte: dayEnd },
        review: null,
        checkUpResult: { statusFinish: true },
      },
      include: {
        patient: { include: { owner: true } },
        doctor: true,
      },
    })

    let sent = 0
    for (const reg of regs) {
      if (!reg.patient.owner.phoneNumber) continue
      const token = randomUUID()
      await prisma.reviewRecord.create({
        data: {
          registrationId: reg.id,
          patientId: reg.patientId,
          doctorId: reg.doctorUserId,
          branchId: reg.branchId,
          tenantId,
          surveyToken: token,
          sentAt: new Date(),
        },
      }).catch(() => null)

      const appUrl = process.env.APP_URL ?? 'https://pawhub.id'
      const msg = `Halo ${reg.patient.owner.ownerName} 👋\n\nBagaimana pengalaman *${reg.patient.petName}* kemarin?\n\nBerikan penilaian: ${appUrl}/review/${token}\n\nTerima kasih! 🐾`
      sendWA(reg.patient.owner.phoneNumber, msg).catch(() => {})
      sent++
      await new Promise(r => setTimeout(r, 500))
    }

    return reply.send({ success: true, data: { sent, total: regs.length } })
  })

  // GET /review/public/:token — public rating page (no auth)
  fastify.get('/review/public/:token', async (req: any, reply) => {
    const review = await prisma.reviewRecord.findUnique({
      where: { surveyToken: req.params.token },
      include: { patient: true, doctor: { select: { fullname: true } }, branch: { select: { branchName: true } } },
    })
    if (!review) return reply.status(404).send({ message: 'Survey tidak ditemukan' })
    if (review.repliedAt) return reply.send({ data: { alreadyRated: true, rating: review.rating } })
    return reply.send({
      data: {
        alreadyRated: false,
        petName: review.patient.petName,
        doctorName: review.doctor.fullname,
        branchName: review.branch.branchName,
        visitDate: review.sentAt,
      },
    })
  })

  // POST /review/rate/:token — submit rating (public, no auth)
  fastify.post('/review/rate/:token', async (req: any, reply) => {
    const { rating, comment } = req.body as { rating: number; comment?: string }
    if (!rating || rating < 1 || rating > 5) return reply.status(400).send({ message: 'Rating harus antara 1-5' })

    const review = await prisma.reviewRecord.findUnique({ where: { surveyToken: req.params.token } })
    if (!review) return reply.status(404).send({ message: 'Survey tidak ditemukan' })
    if (review.repliedAt) return reply.status(400).send({ message: 'Sudah memberikan penilaian' })

    await prisma.reviewRecord.update({
      where: { id: review.id },
      data: { rating, comment: comment ?? null, repliedAt: new Date() },
    })

    return reply.send({ success: true, message: 'Terima kasih atas penilaian Anda!' })
  })

  // GET /review/list — admin view all reviews
  fastify.get('/review/list', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const { page = 1, limit = 20, minRating, maxRating, doctorId, onlyRated } = req.query as any
    const { branchId } = req.authUser
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { branchId }
    if (minRating) where.rating = { ...where.rating, gte: Number(minRating) }
    if (maxRating) where.rating = { ...where.rating, lte: Number(maxRating) }
    if (doctorId) where.doctorId = BigInt(doctorId)
    if (onlyRated === 'true') where.repliedAt = { not: null }

    const [reviews, total] = await Promise.all([
      prisma.reviewRecord.findMany({
        where, skip, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { petName: true } },
          doctor: { select: { fullname: true } },
          registration: { select: { createdAt: true } },
        },
      }),
      prisma.reviewRecord.count({ where }),
    ])

    return reply.send({
      data: reviews.map(r => ({
        id: r.id.toString(), rating: r.rating, comment: r.comment,
        petName: r.patient.petName, doctorName: r.doctor.fullname,
        isPublished: r.isPublished, sentAt: r.sentAt, repliedAt: r.repliedAt,
        visitDate: r.registration.createdAt,
      })),
      total, totalPages: Math.ceil(total / Number(limit)), page: Number(page),
    })
  })

  // PATCH /review/:id/publish — toggle publish status
  fastify.patch('/review/:id/publish', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const { isPublished } = req.body as { isPublished: boolean }

    const existing = await prisma.reviewRecord.findFirst({ where: { id, branchId: req.authUser.branchId } })
    if (!existing) return reply.status(404).send({ message: 'Ulasan tidak ditemukan' })

    await prisma.reviewRecord.update({ where: { id }, data: { isPublished } })
    return reply.send({ success: true })
  })

  // GET /review/stats — aggregated stats per doctor, monthly trends
  fastify.get('/review/stats', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const { branchId } = req.authUser

    const [overall, byDoctor, starDistribution] = await Promise.all([
      prisma.reviewRecord.aggregate({
        where: { branchId, rating: { not: null } },
        _avg: { rating: true }, _count: { id: true },
      }),
      prisma.reviewRecord.groupBy({
        by: ['doctorId'],
        where: { branchId, rating: { not: null } },
        _avg: { rating: true }, _count: { id: true },
        orderBy: { _avg: { rating: 'desc' } },
      }),
      prisma.$queryRaw<{ rating: number; count: bigint }[]>`
        SELECT rating, COUNT(*) as count FROM review_records
        WHERE branch_id = ${branchId} AND rating IS NOT NULL
        GROUP BY rating ORDER BY rating
      `,
    ])

    const doctorIds = byDoctor.map(d => d.doctorId)
    const doctors = await prisma.user.findMany({
      where: { id: { in: doctorIds } }, select: { id: true, fullname: true },
    })
    const doctorMap = Object.fromEntries(doctors.map(d => [d.id.toString(), d.fullname]))

    const alertCount = await prisma.reviewRecord.count({ where: { branchId, rating: { lte: 2 }, repliedAt: { not: null } } })

    return reply.send({
      data: {
        avgRating: overall._avg.rating ? Number(overall._avg.rating).toFixed(2) : null,
        totalReviews: overall._count.id,
        alertCount,
        byDoctor: byDoctor.map(d => ({
          doctorId: d.doctorId.toString(),
          doctorName: doctorMap[d.doctorId.toString()] ?? '—',
          avgRating: Number(d._avg.rating ?? 0).toFixed(2),
          count: d._count.id,
        })),
        starDistribution: starDistribution.map(s => ({ rating: s.rating, count: Number(s.count) })),
      },
    })
  })
}
