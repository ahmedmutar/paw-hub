// @ts-nocheck
import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/auth'

export async function publicClinicRoutes(app: FastifyInstance) {
  // Public clinic info (no auth)
  app.get('/public/clinic/:branchId', async (req: any, reply) => {
    const branchId = BigInt(req.params.branchId)
    const branch = await req.server.prisma.branch.findUnique({
      where: { id: branchId, isActive: true, isDeleted: false },
      select: {
        id: true, branchName: true, address: true, phoneNumber: true,
        email: true, operatingHours: true,
      },
    })
    if (!branch) return reply.status(404).send({ message: 'Klinik tidak ditemukan' })

    const [doctors, services, reviewStats] = await Promise.all([
      req.server.prisma.user.findMany({
        where: { branchId, role: 'dokter', isDeleted: false, status: true },
        select: { id: true, fullname: true, imageProfile: true },
      }),
      req.server.prisma.listOfService.findMany({
        where: { branchId, isDeleted: false },
        include: { serviceCategory: { select: { serviceCategoryName: true } } },
        take: 20,
      }),
      req.server.prisma.reviewRecord.aggregate({
        where: { branchId, rating: { not: null }, isPublished: true },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ])

    const testimonials = await req.server.prisma.reviewRecord.findMany({
      where: { branchId, rating: { gte: 4 }, isPublished: true },
      select: { rating: true, comment: true, repliedAt: true, patient: { select: { petName: true, petCategory: true } } },
      orderBy: { rating: 'desc' },
      take: 6,
    })

    return reply.send({
      data: {
        ...branch,
        doctors,
        services,
        avgRating: reviewStats._avg.rating ? Math.round(Number(reviewStats._avg.rating) * 10) / 10 : null,
        reviewCount: reviewStats._count.rating,
        testimonials,
      },
    })
  })

  // Update clinic profile (admin)
  app.patch('/public/clinic/profile', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const { address, phoneNumber, email, operatingHours, paymentInstruction } = req.body as any
    const branch = await req.server.prisma.branch.update({
      where: { id: branchId },
      data: { address, phoneNumber, email, operatingHours, paymentInstruction },
    })
    return reply.send({ data: branch })
  })
}
