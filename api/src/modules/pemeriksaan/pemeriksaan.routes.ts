import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, requireRole } from '../../middleware/auth'

// ─── Helper: simpan WeightRecord jika weightKg diisi ─────────────────────────
async function upsertWeightRecord(
  tx: any,
  checkUpId: bigint,
  patientId: bigint,
  weightKg: number,
  userId: bigint,
) {
  await tx.weightRecord.upsert({
    where: { checkUpResultId: checkUpId },
    create: {
      patientId,
      checkUpResultId: checkUpId,
      weightKg,
      recordedAt: new Date(),
      userId,
    },
    update: { weightKg, recordedAt: new Date() },
  })
}

// CheckUpResult tidak punya branchId langsung — cuma bisa dicek lewat relasi
// patientRegistrationId -> registration.branchId. Modul ini juga tidak punya
// pola tenant-wide untuk admin (GET list mengunci SEMUA role ke branchId
// sendiri), jadi filter kepemilikannya konsisten dikunci ke branchId sendiri.
function checkUpBranchFilter(user: any) {
  return { registration: { branchId: BigInt(user.branchId) } }
}

export async function pemeriksaanRoutes(app: FastifyInstance) {

  // ── GET master items (autocomplete) ────────────────────────────────────────
  app.get('/master/items', { preHandler: authenticate }, async (req, reply) => {
    const q = req.query as any
    const branchId = req.authUser.branchId

    const items = await app.prisma.listOfItem.findMany({
      where: {
        branchId, isDeleted: false,
        ...(q.search ? { itemName: { contains: q.search, mode: 'insensitive' as const } } : {}),
      },
      include: {
        unitItem:     { select: { unitName: true } },
        categoryItem: { select: { categoryName: true } },
        priceItems:   { where: { isDeleted: false }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { itemName: 'asc' },
      take: 30,
    })

    const result = items
      .filter((i) => i.priceItems.length > 0)
      .map((i) => ({
        id:           i.id,
        itemName:     i.itemName,
        unit:         i.unitItem.unitName,
        category:     i.categoryItem.categoryName,
        totalItem:    i.totalItem,
        priceItemId:  i.priceItems[0].id,
        sellingPrice: i.priceItems[0].sellingPrice,
      }))

    return reply.send({ data: result })
  })

  // ── GET master services (autocomplete) ────────────────────────────────────
  app.get('/master/services', { preHandler: authenticate }, async (req, reply) => {
    const q = req.query as any
    const branchId = req.authUser.branchId

    const services = await app.prisma.listOfService.findMany({
      where: {
        branchId, isDeleted: false,
        ...(q.search ? { serviceName: { contains: q.search, mode: 'insensitive' as const } } : {}),
      },
      include: {
        serviceCategory: { select: { categoryName: true } },
        priceServices:   { where: { isDeleted: false }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { serviceName: 'asc' },
      take: 30,
    })

    const result = services
      .filter((s) => s.priceServices.length > 0)
      .map((s) => ({
        id:             s.id,
        serviceName:    s.serviceName,
        category:       s.serviceCategory.categoryName,
        priceServiceId: s.priceServices[0].id,
        sellingPrice:   s.priceServices[0].sellingPrice,
      }))

    return reply.send({ data: result })
  })

  // ── GET master medicine groups (autocomplete) ─────────────────────────────
  app.get('/master/medicine-groups', { preHandler: authenticate }, async (req, reply) => {
    const q = req.query as any
    const branchId = req.authUser.branchId

    const groups = await app.prisma.medicineGroup.findMany({
      where: {
        branchId, isDeleted: false,
        ...(q.search ? { groupName: { contains: q.search, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { groupName: 'asc' },
      take: 30,
    })

    return reply.send({ data: groups })
  })

  // ── GET pemeriksaan by registrationId ─────────────────────────────────────
  app.get('/pemeriksaan/registrasi/:registrationId', { preHandler: authenticate }, async (req, reply) => {
    const { registrationId } = req.params as { registrationId: string }

    const result = await app.prisma.checkUpResult.findFirst({
      where: { patientRegistrationId: BigInt(registrationId), isDeleted: false },
      include: {
        registration: {
          include: {
            patient: {
              include: {
                owner: true,
                medicalRecord: true,
                registrations: {
                  where: { isDeleted: false },
                  include: { checkUpResult: { select: { diagnosa: true, createdAt: true } } },
                  orderBy: { createdAt: 'desc' },
                  take: 5,
                },
                weightRecords: { orderBy: { recordedAt: 'desc' }, take: 6 },
                vaccinations:  { orderBy: { administeredAt: 'desc' }, take: 3 },
              },
            },
            doctor: { select: { fullname: true } },
          },
        },
        detailItems: {
          where: { statusPaidOff: false },
          include: {
            priceItem: {
              include: {
                listOfItem: {
                  select: { itemName: true, unitItem: { select: { unitName: true } } },
                },
              },
            },
          },
        },
        detailServices: {
          include: {
            priceService: {
              include: { listOfService: { select: { serviceName: true } } },
            },
          },
        },
        detailMedicineGroups: {
          include: { medicineGroup: { select: { groupName: true } } },
        },
        weightRecord: true,
      },
    })

    return reply.send({ data: result ?? null })
  })

  // ── GET list pemeriksaan (semua) ──────────────────────────────────────────
  app.get('/pemeriksaan', { preHandler: authenticate }, async (req, reply) => {
    const q     = req.query as any
    const page  = Number(q.page  || 1)
    const limit = Number(q.limit || 20)
    const skip  = (page - 1) * limit

    const where: any = {
      isDeleted: false,
      registration: { branchId: req.authUser.branchId, isDeleted: false },
    }
    if (req.authUser.role === 'dokter') where.userId = req.authUser.userId
    if (q.status === 'belum-bayar') { where.statusPaidOff = false; where.statusFinish = true }
    if (q.status === 'sudah-bayar') where.statusPaidOff = true
    if (q.status === 'selesai')     where.statusFinish  = true

    const [data, total] = await Promise.all([
      app.prisma.checkUpResult.findMany({
        where, skip, take: limit,
        include: {
          registration: {
            include: {
              patient: { include: { owner: { select: { ownerName: true } } } },
            },
          },
          doctor: { select: { fullname: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      app.prisma.checkUpResult.count({ where }),
    ])

    return reply.send({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } })
  })

  // ── GET detail pemeriksaan (by checkUpResultId) ───────────────────────────
  app.get('/pemeriksaan/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const result = await app.prisma.checkUpResult.findFirst({
      where: { id: BigInt(id), isDeleted: false, ...checkUpBranchFilter(req.authUser) },
      include: {
        registration: {
          include: {
            patient: {
              include: {
                owner: true,
                medicalRecord: true,
                weightRecords: { orderBy: { recordedAt: 'desc' }, take: 6 },
                vaccinations:  { orderBy: { administeredAt: 'desc' }, take: 3 },
              },
            },
            doctor: { select: { fullname: true } },
          },
        },
        doctor: { select: { fullname: true } },
        images: true,
        detailItems: {
          include: {
            priceItem: {
              include: {
                listOfItem: {
                  select: { itemName: true, unitItem: { select: { unitName: true } } },
                },
              },
            },
          },
        },
        detailServices: {
          include: {
            priceService: {
              include: { listOfService: { select: { serviceName: true } } },
            },
          },
        },
        detailMedicineGroups: {
          include: { medicineGroup: { select: { groupName: true } } },
        },
        weightRecord: true,
      },
    })

    if (!result) return reply.status(404).send({ message: 'Data pemeriksaan tidak ditemukan.' })
    return reply.send({ data: result })
  })

  // ── POST mulai pemeriksaan (buat checkUpResult kosong) ────────────────────
  app.post('/pemeriksaan/mulai', {
    preHandler: [authenticate, requireRole('admin', 'dokter')],
  }, async (req, reply) => {
    const schema = z.object({ patientRegistrationId: z.string() })
    const body   = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.' })

    const registrationId = BigInt(body.data.patientRegistrationId)

    const existing = await app.prisma.checkUpResult.findFirst({
      where: { patientRegistrationId: registrationId, isDeleted: false },
    })
    if (existing) return reply.send({ message: 'Pemeriksaan sudah dimulai.', data: existing })

    // Pastikan registration sudah accepted
    const reg = await app.prisma.registration.findUnique({ where: { id: registrationId } })
    if (!reg) return reply.status(404).send({ message: 'Registrasi tidak ditemukan.' })
    if (reg.acceptanceStatus !== 'accepted') {
      return reply.status(400).send({ message: 'Pendaftaran belum diterima. Terima dulu sebelum mulai periksa.' })
    }

    const checkUp = await app.prisma.checkUpResult.create({
      data: {
        patientRegistrationId: registrationId,
        userId: req.authUser.userId,
      },
    })

    return reply.status(201).send({ message: 'Pemeriksaan dimulai.', data: checkUp })
  })

  // ── PUT update data pemeriksaan (anamnesa, vital signs, diagnosa) ─────────
  app.put('/pemeriksaan/:id', {
    preHandler: [authenticate, requireRole('admin', 'dokter')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const schema = z.object({
      anamnesa:                 z.string().optional(),
      sign:                     z.string().optional(),
      diagnosa:                 z.string().optional(),
      prognosis:                z.string().optional(),
      homeInstructions:         z.string().optional(),
      weightKg:                 z.number().positive().optional(),
      temperature:              z.number().positive().optional(),
      heartRate:                z.number().int().positive().optional(),
      respiratoryRate:          z.number().int().positive().optional(),
      statusOutpatientInpatient: z.number().int().min(0).max(1).optional(),
      statusFinish:             z.boolean().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })

    const existing = await app.prisma.checkUpResult.findFirst({
      where: { id: BigInt(id), ...checkUpBranchFilter(req.authUser) },
      include: { registration: { include: { patient: { select: { id: true } } } } },
    })
    if (!existing) return reply.status(404).send({ message: 'Pemeriksaan tidak ditemukan.' })

    const { weightKg, ...rest } = body.data

    const result = await app.prisma.$transaction(async (tx) => {
      const updated = await tx.checkUpResult.update({
        where: { id: BigInt(id) },
        data: { ...rest, ...(weightKg !== undefined ? { weightKg } : {}) },
      })

      // Auto-record berat badan
      if (weightKg !== undefined) {
        await upsertWeightRecord(
          tx,
          BigInt(id),
          existing.registration.patient.id,
          weightKg,
          req.authUser.userId,
        )
      }

      return updated
    })

    return reply.send({ message: 'Pemeriksaan berhasil diperbarui.', data: result })
  })

  // ── POST tambah item ke pemeriksaan ───────────────────────────────────────
  app.post('/pemeriksaan/:id/items', {
    preHandler: [authenticate, requireRole('admin', 'dokter')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const schema = z.object({
      priceItemId:           z.string(),
      quantity:              z.number().positive(),
      priceOverall:          z.number().min(0),
      detailMedicineGroupId: z.string().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })

    const checkUp = await app.prisma.checkUpResult.findFirst({ where: { id: BigInt(id), ...checkUpBranchFilter(req.authUser) } })
    if (!checkUp) return reply.status(404).send({ message: 'Pemeriksaan tidak ditemukan.' })
    if (checkUp.statusFinish) return reply.status(400).send({ message: 'Pemeriksaan sudah selesai.' })

    const result = await app.prisma.$transaction(async (tx) => {
      const detail = await tx.detailItemPatient.create({
        data: {
          checkUpResultId:      BigInt(id),
          priceItemId:          BigInt(body.data.priceItemId),
          quantity:             body.data.quantity,
          priceOverall:         body.data.priceOverall,
          detailMedicineGroupId: body.data.detailMedicineGroupId
            ? BigInt(body.data.detailMedicineGroupId) : undefined,
          userId: req.authUser.userId,
        },
        include: {
          priceItem: {
            include: {
              listOfItem: { select: { itemName: true, unitItem: { select: { unitName: true } } } },
            },
          },
        },
      })

      // Kurangi stok
      const priceItem = await tx.priceItem.findUnique({ where: { id: BigInt(body.data.priceItemId) } })
      if (priceItem) {
        await tx.listOfItem.update({
          where: { id: priceItem.listOfItemId },
          data:  { totalItem: { decrement: body.data.quantity } },
        })
        await tx.stockMovement.create({
          data: {
            listOfItemId: priceItem.listOfItemId,
            quantity:     body.data.quantity,
            status:       'keluar',
            notes:        `Pemeriksaan #${id}`,
            userId:       req.authUser.userId,
          },
        })
      }

      return detail
    })

    return reply.status(201).send({ message: 'Item berhasil ditambahkan.', data: result })
  })

  // ── DELETE hapus item dari pemeriksaan ────────────────────────────────────
  app.delete('/pemeriksaan/:id/items/:itemId', {
    preHandler: [authenticate, requireRole('admin', 'dokter')],
  }, async (req, reply) => {
    const { id, itemId } = req.params as { id: string; itemId: string }

    const checkUp = await app.prisma.checkUpResult.findFirst({ where: { id: BigInt(id), ...checkUpBranchFilter(req.authUser) } })
    if (!checkUp) return reply.status(404).send({ message: 'Pemeriksaan tidak ditemukan.' })
    if (checkUp.statusFinish) return reply.status(400).send({ message: 'Pemeriksaan sudah selesai.' })

    const detail = await app.prisma.detailItemPatient.findFirst({ where: { id: BigInt(itemId), checkUpResultId: BigInt(id) } })
    if (!detail) return reply.status(404).send({ message: 'Item tidak ditemukan.' })

    await app.prisma.$transaction(async (tx) => {
      await tx.detailItemPatient.delete({ where: { id: BigInt(itemId) } })

      // Kembalikan stok
      const priceItem = await tx.priceItem.findUnique({ where: { id: detail.priceItemId } })
      if (priceItem) {
        await tx.listOfItem.update({
          where: { id: priceItem.listOfItemId },
          data:  { totalItem: { increment: detail.quantity } },
        })
        await tx.stockMovement.create({
          data: {
            listOfItemId: priceItem.listOfItemId,
            quantity:     detail.quantity,
            status:       'masuk',
            notes:        `Dibatalkan dari pemeriksaan #${id}`,
            userId:       req.authUser.userId,
          },
        })
      }
    })

    return reply.send({ message: 'Item berhasil dihapus.' })
  })

  // ── POST tambah layanan ke pemeriksaan ────────────────────────────────────
  app.post('/pemeriksaan/:id/services', {
    preHandler: [authenticate, requireRole('admin', 'dokter')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const schema = z.object({
      priceServiceId: z.string(),
      quantity:       z.number().int().min(1).default(1),
      priceOverall:   z.number().min(0),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })

    const checkUp = await app.prisma.checkUpResult.findFirst({ where: { id: BigInt(id), ...checkUpBranchFilter(req.authUser) } })
    if (!checkUp) return reply.status(404).send({ message: 'Pemeriksaan tidak ditemukan.' })
    if (checkUp.statusFinish) return reply.status(400).send({ message: 'Pemeriksaan sudah selesai.' })

    const detail = await app.prisma.detailServicePatient.create({
      data: {
        checkUpResultId: BigInt(id),
        priceServiceId:  BigInt(body.data.priceServiceId),
        quantity:        body.data.quantity,
        priceOverall:    body.data.priceOverall,
        userId:          req.authUser.userId,
      },
      include: {
        priceService: {
          include: { listOfService: { select: { serviceName: true } } },
        },
      },
    })

    return reply.status(201).send({ message: 'Layanan berhasil ditambahkan.', data: detail })
  })

  // ── DELETE hapus layanan dari pemeriksaan ─────────────────────────────────
  app.delete('/pemeriksaan/:id/services/:serviceId', {
    preHandler: [authenticate, requireRole('admin', 'dokter')],
  }, async (req, reply) => {
    const { id, serviceId } = req.params as { id: string; serviceId: string }

    const checkUp = await app.prisma.checkUpResult.findFirst({ where: { id: BigInt(id), ...checkUpBranchFilter(req.authUser) } })
    if (!checkUp) return reply.status(404).send({ message: 'Pemeriksaan tidak ditemukan.' })
    if (checkUp.statusFinish) return reply.status(400).send({ message: 'Pemeriksaan sudah selesai.' })

    const detail = await app.prisma.detailServicePatient.findFirst({ where: { id: BigInt(serviceId), checkUpResultId: BigInt(id) } })
    if (!detail) return reply.status(404).send({ message: 'Layanan tidak ditemukan.' })

    await app.prisma.detailServicePatient.delete({ where: { id: BigInt(serviceId) } })
    return reply.send({ message: 'Layanan berhasil dihapus.' })
  })

  // ── POST tambah kelompok obat ke pemeriksaan ──────────────────────────────
  app.post('/pemeriksaan/:id/medicine-groups', {
    preHandler: [authenticate, requireRole('admin', 'dokter')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const schema = z.object({
      medicineGroupId: z.string(),
      quantity:        z.number().int().min(1).default(1),
      remark:          z.string().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })

    const checkUp = await app.prisma.checkUpResult.findFirst({ where: { id: BigInt(id), ...checkUpBranchFilter(req.authUser) } })
    if (!checkUp) return reply.status(404).send({ message: 'Pemeriksaan tidak ditemukan.' })
    if (checkUp.statusFinish) return reply.status(400).send({ message: 'Pemeriksaan sudah selesai.' })

    const detail = await app.prisma.detailMedicineGroupResult.create({
      data: {
        checkUpResultId: BigInt(id),
        medicineGroupId: BigInt(body.data.medicineGroupId),
        quantity:        body.data.quantity,
        remark:          body.data.remark,
        userId:          req.authUser.userId,
      },
      include: { medicineGroup: { select: { groupName: true } } },
    })

    return reply.status(201).send({ message: 'Kelompok obat berhasil ditambahkan.', data: detail })
  })

  // ── DELETE hapus kelompok obat dari pemeriksaan ───────────────────────────
  app.delete('/pemeriksaan/:id/medicine-groups/:mgId', {
    preHandler: [authenticate, requireRole('admin', 'dokter')],
  }, async (req, reply) => {
    const { id, mgId } = req.params as { id: string; mgId: string }

    const checkUp = await app.prisma.checkUpResult.findFirst({ where: { id: BigInt(id), ...checkUpBranchFilter(req.authUser) } })
    if (!checkUp) return reply.status(404).send({ message: 'Pemeriksaan tidak ditemukan.' })
    if (checkUp.statusFinish) return reply.status(400).send({ message: 'Pemeriksaan sudah selesai.' })

    const detail = await app.prisma.detailMedicineGroupResult.findFirst({ where: { id: BigInt(mgId), checkUpResultId: BigInt(id) } })
    if (!detail) return reply.status(404).send({ message: 'Kelompok obat tidak ditemukan.' })

    await app.prisma.detailMedicineGroupResult.delete({ where: { id: BigInt(mgId) } })
    return reply.send({ message: 'Kelompok obat berhasil dihapus.' })
  })

  // ── POST tandai pemeriksaan selesai ───────────────────────────────────────
  app.post('/pemeriksaan/:id/selesai', {
    preHandler: [authenticate, requireRole('admin', 'dokter')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const checkUp = await app.prisma.checkUpResult.findFirst({
      where: { id: BigInt(id), ...checkUpBranchFilter(req.authUser) },
      include: {
        registration: {
          include: { patient: true, doctor: { select: { id: true } } },
        },
      },
    })
    if (!checkUp) return reply.status(404).send({ message: 'Pemeriksaan tidak ditemukan.' })
    if (checkUp.statusFinish) return reply.status(400).send({ message: 'Pemeriksaan sudah ditandai selesai.' })

    await app.prisma.checkUpResult.update({
      where: { id: BigInt(id) },
      data:  { statusFinish: true },
    })

    return reply.send({ message: 'Pemeriksaan ditandai selesai. Pasien siap pembayaran.' })
  })

  // ── DELETE pemeriksaan (soft, admin only) ─────────────────────────────────
  app.delete('/pemeriksaan/:id', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await app.prisma.checkUpResult.findFirst({ where: { id: BigInt(id), ...checkUpBranchFilter(req.authUser) } })
    if (!existing) return reply.status(404).send({ message: 'Data pemeriksaan tidak ditemukan.' })

    await app.prisma.checkUpResult.update({
      where: { id: BigInt(id) },
      data:  { isDeleted: true, deletedAt: new Date() },
    })
    return reply.send({ message: 'Data pemeriksaan berhasil dihapus.' })
  })
}
