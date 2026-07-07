import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, requireRole } from '../../middleware/auth'

const categorySchema = z.object({
  categoryName: z.string().min(1, 'Nama kategori wajib diisi'),
})

const serviceSchema = z.object({
  serviceName:       z.string().min(1, 'Nama layanan wajib diisi'),
  description:       z.string().optional(),
  durationMinutes:   z.number().int().min(1).optional(),
  serviceCategoryId: z.string().min(1, 'Kategori wajib dipilih'),
})

const priceSchema = z.object({
  sellingPrice: z.number().min(0, 'Harga jual tidak boleh negatif'),
  capitalPrice: z.number().min(0).default(0),
  doctorFee:    z.number().min(0).default(0),
  petshopFee:   z.number().min(0).default(0),
})

export async function layananRoutes(app: FastifyInstance) {

  // ══ KATEGORI LAYANAN ═══════════════════════════════════════════════════════

  // GET all kategori
  app.get('/layanan/kategori', { preHandler: authenticate }, async (req, reply) => {
    const branchId = req.authUser.branchId

    const categories = await app.prisma.serviceCategory.findMany({
      where: { branchId, isDeleted: false },
      include: {
        _count: {
          select: { listOfServices: { where: { isDeleted: false } } },
        },
      },
      orderBy: { categoryName: 'asc' },
    })

    return reply.send({ data: categories })
  })

  // POST buat kategori
  app.post('/layanan/kategori', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req, reply) => {
    const body = categorySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })

    const existing = await app.prisma.serviceCategory.findFirst({
      where: { branchId: req.authUser.branchId, categoryName: body.data.categoryName, isDeleted: false },
    })
    if (existing) return reply.status(400).send({ message: 'Kategori dengan nama tersebut sudah ada.' })

    const category = await app.prisma.serviceCategory.create({
      data: { categoryName: body.data.categoryName, branchId: req.authUser.branchId },
    })
    return reply.status(201).send({ message: 'Kategori berhasil dibuat.', data: category })
  })

  // PUT edit kategori
  app.put('/layanan/kategori/:id', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = categorySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.' })

    const existing = await app.prisma.serviceCategory.findFirst({
      where: { id: BigInt(id), branchId: req.authUser.branchId, isDeleted: false },
    })
    if (!existing) return reply.status(404).send({ message: 'Kategori tidak ditemukan.' })

    const category = await app.prisma.serviceCategory.update({
      where: { id: BigInt(id) },
      data:  { categoryName: body.data.categoryName },
    })
    return reply.send({ message: 'Kategori berhasil diperbarui.', data: category })
  })

  // DELETE kategori (soft, hanya jika tidak ada layanan aktif)
  app.delete('/layanan/kategori/:id', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const existingCategory = await app.prisma.serviceCategory.findFirst({
      where: { id: BigInt(id), branchId: req.authUser.branchId, isDeleted: false },
    })
    if (!existingCategory) return reply.status(404).send({ message: 'Kategori tidak ditemukan.' })

    const activeServices = await app.prisma.listOfService.count({
      where: { serviceCategoryId: BigInt(id), isDeleted: false },
    })
    if (activeServices > 0) {
      return reply.status(400).send({ message: `Tidak dapat menghapus kategori yang masih memiliki ${activeServices} layanan aktif.` })
    }

    await app.prisma.serviceCategory.update({
      where: { id: BigInt(id) },
      data:  { isDeleted: true },
    })
    return reply.send({ message: 'Kategori berhasil dihapus.' })
  })

  // ══ DAFTAR LAYANAN ═════════════════════════════════════════════════════════

  // GET list layanan + filter + stats
  app.get('/layanan', { preHandler: authenticate }, async (req, reply) => {
    const q        = req.query as any
    const page     = Number(q.page  || 1)
    const limit    = Number(q.limit || 50)
    const skip     = (page - 1) * limit
    const branchId = req.authUser.branchId

    const monthStart = new Date()
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

    const where: any = {
      branchId, isDeleted: false,
      ...(q.categoryId && { serviceCategoryId: BigInt(q.categoryId) }),
      ...(q.isActive !== undefined && { isActive: q.isActive === 'true' }),
      ...(q.search && { serviceName: { contains: q.search, mode: 'insensitive' as const } }),
    }

    const [services, total] = await Promise.all([
      app.prisma.listOfService.findMany({
        where, skip, take: limit,
        include: {
          serviceCategory: { select: { id: true, categoryName: true } },
          priceServices: {
            where:   { isDeleted: false },
            orderBy: { createdAt: 'desc' },
            take:    1,
            include: {
              _count: {
                select: {
                  detailServicePatients: {
                    where: { createdAt: { gte: monthStart } },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ serviceCategory: { categoryName: 'asc' } }, { serviceName: 'asc' }],
      }),
      app.prisma.listOfService.count({ where }),
    ])

    return reply.send({ data: services, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } })
  })

  // GET stats ringkasan modul
  app.get('/layanan/stats', { preHandler: authenticate }, async (req, reply) => {
    const branchId   = req.authUser.branchId
    const monthStart = new Date()
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

    const [totalServices, totalCategories, activeServices, usedThisMonth] = await Promise.all([
      app.prisma.listOfService.count({ where: { branchId, isDeleted: false } }),
      app.prisma.serviceCategory.count({ where: { branchId, isDeleted: false } }),
      app.prisma.listOfService.count({ where: { branchId, isDeleted: false, isActive: true } }),
      app.prisma.detailServicePatient.count({
        where: {
          createdAt: { gte: monthStart },
          priceService: { listOfService: { branchId, isDeleted: false } },
        },
      }),
    ])

    // Top 5 layanan terbanyak dipakai bulan ini
    const topServices = await app.prisma.detailServicePatient.groupBy({
      by: ['priceServiceId'],
      where: {
        createdAt: { gte: monthStart },
        priceService: { listOfService: { branchId, isDeleted: false } },
      },
      _count: { id: true },
      _sum:   { priceOverall: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    })

    const topWithNames = await Promise.all(
      topServices.map(async (t) => {
        const ps = await app.prisma.priceService.findUnique({
          where:   { id: t.priceServiceId },
          include: { listOfService: { select: { serviceName: true } } },
        })
        return {
          serviceName: ps?.listOfService.serviceName ?? '—',
          count:       t._count.id,
          revenue:     t._sum.priceOverall ?? 0,
        }
      })
    )

    return reply.send({
      data: { totalServices, totalCategories, activeServices, usedThisMonth, topServices: topWithNames },
    })
  })

  // GET detail satu layanan
  app.get('/layanan/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const service = await app.prisma.listOfService.findFirst({
      where: { id: BigInt(id), branchId: req.authUser.branchId, isDeleted: false },
      include: {
        serviceCategory: { select: { id: true, categoryName: true } },
        priceServices: {
          where:   { isDeleted: false },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!service) return reply.status(404).send({ message: 'Layanan tidak ditemukan.' })
    return reply.send({ data: service })
  })

  // POST buat layanan baru
  app.post('/layanan', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req, reply) => {
    const schema = serviceSchema.merge(priceSchema)
    const body   = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })

    // Validasi fee tidak melebihi harga jual
    if (body.data.doctorFee > body.data.sellingPrice) {
      return reply.status(400).send({ message: 'Fee dokter tidak boleh melebihi harga jual.' })
    }

    const service = await app.prisma.$transaction(async (tx) => {
      const svc = await tx.listOfService.create({
        data: {
          serviceName:       body.data.serviceName,
          description:       body.data.description,
          durationMinutes:   body.data.durationMinutes,
          serviceCategoryId: BigInt(body.data.serviceCategoryId),
          branchId:          req.authUser.branchId,
        },
      })
      await tx.priceService.create({
        data: {
          listOfServiceId: svc.id,
          sellingPrice:    body.data.sellingPrice,
          capitalPrice:    body.data.capitalPrice,
          doctorFee:       body.data.doctorFee,
          petshopFee:      body.data.petshopFee,
        },
      })
      return svc
    })

    return reply.status(201).send({ message: 'Layanan berhasil ditambahkan.', data: service })
  })

  // PUT update info layanan
  app.put('/layanan/:id', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body   = serviceSchema.partial().safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.' })

    const existingService = await app.prisma.listOfService.findFirst({
      where: { id: BigInt(id), branchId: req.authUser.branchId, isDeleted: false },
    })
    if (!existingService) return reply.status(404).send({ message: 'Layanan tidak ditemukan.' })

    const service = await app.prisma.listOfService.update({
      where: { id: BigInt(id) },
      data: {
        ...(body.data.serviceName       !== undefined && { serviceName:       body.data.serviceName }),
        ...(body.data.description       !== undefined && { description:       body.data.description }),
        ...(body.data.durationMinutes   !== undefined && { durationMinutes:   body.data.durationMinutes }),
        ...(body.data.serviceCategoryId !== undefined && { serviceCategoryId: BigInt(body.data.serviceCategoryId) }),
      },
    })
    return reply.send({ message: 'Layanan berhasil diperbarui.', data: service })
  })

  // PATCH toggle aktif/nonaktif
  app.patch('/layanan/:id/toggle-status', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const service = await app.prisma.listOfService.findFirst({
      where: { id: BigInt(id), branchId: req.authUser.branchId, isDeleted: false },
    })
    if (!service) return reply.status(404).send({ message: 'Layanan tidak ditemukan.' })

    const updated = await app.prisma.listOfService.update({
      where: { id: BigInt(id) },
      data:  { isActive: !service.isActive },
    })
    return reply.send({
      message: `Layanan ${updated.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
      data: updated,
    })
  })

  // DELETE layanan (soft)
  app.delete('/layanan/:id', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const existingService = await app.prisma.listOfService.findFirst({
      where: { id: BigInt(id), branchId: req.authUser.branchId, isDeleted: false },
    })
    if (!existingService) return reply.status(404).send({ message: 'Layanan tidak ditemukan.' })

    const inUse = await app.prisma.detailServicePatient.count({
      where: { priceService: { listOfServiceId: BigInt(id) } },
    })
    if (inUse > 0) {
      return reply.status(400).send({ message: `Layanan tidak dapat dihapus karena sudah digunakan di ${inUse} pemeriksaan.` })
    }

    await app.prisma.listOfService.update({
      where: { id: BigInt(id) },
      data:  { isDeleted: true },
    })
    return reply.send({ message: 'Layanan berhasil dihapus.' })
  })

  // ══ HARGA LAYANAN ══════════════════════════════════════════════════════════

  // POST update harga (buat entry baru, lama di-soft-delete → preserve history)
  app.post('/layanan/:id/harga', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body   = priceSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })

    if (body.data.doctorFee > body.data.sellingPrice) {
      return reply.status(400).send({ message: 'Fee dokter tidak boleh melebihi harga jual.' })
    }

    const existingService = await app.prisma.listOfService.findFirst({
      where: { id: BigInt(id), branchId: req.authUser.branchId, isDeleted: false },
    })
    if (!existingService) return reply.status(404).send({ message: 'Layanan tidak ditemukan.' })

    const price = await app.prisma.$transaction(async (tx) => {
      // Soft-delete harga lama
      await tx.priceService.updateMany({
        where: { listOfServiceId: BigInt(id), isDeleted: false },
        data:  { isDeleted: true },
      })
      // Buat harga baru
      return tx.priceService.create({
        data: {
          listOfServiceId: BigInt(id),
          sellingPrice:    body.data.sellingPrice,
          capitalPrice:    body.data.capitalPrice,
          doctorFee:       body.data.doctorFee,
          petshopFee:      body.data.petshopFee,
        },
      })
    })

    return reply.status(201).send({ message: 'Harga berhasil diperbarui.', data: price })
  })

  // GET riwayat harga
  app.get('/layanan/:id/harga', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const existingService = await app.prisma.listOfService.findFirst({
      where: { id: BigInt(id), branchId: req.authUser.branchId, isDeleted: false },
    })
    if (!existingService) return reply.status(404).send({ message: 'Layanan tidak ditemukan.' })

    const history = await app.prisma.priceService.findMany({
      where:   { listOfServiceId: BigInt(id) },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ data: history })
  })
}
