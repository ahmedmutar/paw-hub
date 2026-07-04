import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, requireRole } from '../../middleware/auth'
import { sendWhatsapp, msgPaymentReceipt } from '../notif/wa.service'

const createSchema = z.object({
  checkUpResultId: z.string(),
  paymentMethodId: z.string().optional(),
  discount: z.number().min(0).default(0),
  items: z.array(z.object({
    detailItemPatientId: z.string(),
    quantity: z.number(),
    amountDiscount: z.number().min(0).default(0),
    detailMedicineGroupCheckUpResultId: z.string().optional(),
  })).optional().default([]),
  services: z.array(z.object({
    detailServicePatientId: z.string(),
    amountDiscount: z.number().min(0).default(0),
  })).optional().default([]),
  medicineGroups: z.array(z.object({
    medicineGroupId: z.string(),
    detailMedicineGroupResultId: z.string(),
    quantity: z.number().int().min(1).default(1),
    amountDiscount: z.number().min(0).default(0),
  })).optional().default([]),
})

export async function pembayaranRoutes(app: FastifyInstance) {
  // List payments
  app.get('/pembayaran', { preHandler: authenticate }, async (req, reply) => {
    const q = req.query as any
    const page = Number(q.page || 1)
    const limit = Number(q.limit || 20)
    const skip = (page - 1) * limit

    const dateFilter: any = {}
    if (q.date) {
      dateFilter.gte = new Date(q.date + 'T00:00:00')
      dateFilter.lte = new Date(q.date + 'T23:59:59')
    }
    if (q.startDate && q.endDate) {
      dateFilter.gte = new Date(q.startDate + 'T00:00:00')
      dateFilter.lte = new Date(q.endDate + 'T23:59:59')
    }

    const where: any = {
      isDeleted: false,
      checkUpResult: { registration: { branchId: req.authUser.branchId } },
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
    }

    const [data, total] = await Promise.all([
      app.prisma.listOfPayment.findMany({
        where, skip, take: limit,
        include: {
          checkUpResult: {
            include: {
              registration: {
                include: { patient: { include: { owner: { select: { ownerName: true } } } } },
              },
            },
          },
          paymentMethod: { select: { methodName: true } },
          createdBy: { select: { fullname: true } },
          paymentItems: { include: { detailItemPatient: { include: { priceItem: { include: { listOfItem: { select: { itemName: true } } } } } } } },
          paymentServices: { include: { detailServicePatient: { include: { priceService: { include: { listOfService: { select: { serviceName: true } } } } } } } },
          paymentMedicineGroups: { include: { medicineGroup: { select: { groupName: true } }, detailMedicineGroup: { select: { quantity: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      app.prisma.listOfPayment.count({ where }),
    ])

    return reply.send({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } })
  })

  // Get single payment detail
  app.get('/pembayaran/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const payment = await app.prisma.listOfPayment.findFirst({
      where: { id: BigInt(id), isDeleted: false },
      include: {
        checkUpResult: {
          include: {
            registration: { include: { patient: { include: { owner: true } }, doctor: { select: { fullname: true } } } },
            doctor: { select: { fullname: true } },
          },
        },
        paymentMethod: true,
        createdBy: { select: { fullname: true } },
        paymentItems: {
          include: {
            detailItemPatient: {
              include: {
                priceItem: {
                  include: { listOfItem: { include: { unitItem: { select: { unitName: true } } } } },
                },
              },
            },
          },
        },
        paymentServices: {
          include: {
            detailServicePatient: {
              include: { priceService: { include: { listOfService: { select: { serviceName: true } } } } },
            },
          },
        },
        paymentMedicineGroups: {
          include: {
            medicineGroup: { include: { priceMedicineGroups: { where: { isDeleted: false }, take: 1 } } },
            detailMedicineGroup: true,
          },
        },
      },
    })
    if (!payment) return reply.status(404).send({ message: 'Pembayaran tidak ditemukan.' })
    return reply.send({ data: payment })
  })

  // Create payment
  app.post('/pembayaran', { preHandler: authenticate }, async (req, reply) => {
    const body = createSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })

    const checkUpId = BigInt(body.data.checkUpResultId)
    const checkUp = await app.prisma.checkUpResult.findFirst({ where: { id: checkUpId, isDeleted: false } })
    if (!checkUp) return reply.status(404).send({ message: 'Data pemeriksaan tidak ditemukan.' })
    if (checkUp.statusPaidOff) return reply.status(400).send({ message: 'Pemeriksaan ini sudah dibayar.' })

    const payment = await app.prisma.$transaction(async (tx) => {
      const p = await tx.listOfPayment.create({
        data: {
          checkUpResultId: checkUpId,
          paymentMethodId: body.data.paymentMethodId ? BigInt(body.data.paymentMethodId) : undefined,
          discount: body.data.discount,
          userId: req.authUser.userId,
        },
      })

      for (const item of body.data.items!) {
        await tx.listOfPaymentItem.create({
          data: {
            listOfPaymentId: p.id,
            checkUpResultId: checkUpId,
            detailItemPatientId: BigInt(item.detailItemPatientId),
            detailMedicineGroupCheckUpResultId: item.detailMedicineGroupCheckUpResultId ? BigInt(item.detailMedicineGroupCheckUpResultId) : undefined,
            quantity: item.quantity,
            amountDiscount: item.amountDiscount,
          },
        })
        await tx.detailItemPatient.update({
          where: { id: BigInt(item.detailItemPatientId) },
          data: { statusPaidOff: true },
        })
      }

      for (const svc of body.data.services!) {
        await tx.listOfPaymentService.create({
          data: {
            listOfPaymentId: p.id,
            checkUpResultId: checkUpId,
            detailServicePatientId: BigInt(svc.detailServicePatientId),
            amountDiscount: svc.amountDiscount,
          },
        })
        await tx.detailServicePatient.update({
          where: { id: BigInt(svc.detailServicePatientId) },
          data: { statusPaidOff: true },
        })
      }

      for (const mg of body.data.medicineGroups!) {
        await tx.listOfPaymentMedicineGroup.create({
          data: {
            listOfPaymentId: p.id,
            medicineGroupId: BigInt(mg.medicineGroupId),
            detailMedicineGroupResultId: BigInt(mg.detailMedicineGroupResultId),
            quantity: mg.quantity,
            amountDiscount: mg.amountDiscount,
          },
        })
        await tx.detailMedicineGroupResult.update({
          where: { id: BigInt(mg.detailMedicineGroupResultId) },
          data: { statusPaidOff: true },
        })
      }

      await tx.checkUpResult.update({
        where: { id: checkUpId },
        data: { statusPaidOff: true, statusFinish: true },
      })
      await tx.registration.update({
        where: { id: checkUp.patientRegistrationId },
        data: { isHideFromDropDown: true },
      })

      return p
    })

    // Kirim WA struk pembayaran (non-blocking)
    try {
      const checkUpFull = await app.prisma.checkUpResult.findUnique({
        where: { id: checkUpId },
        include: {
          registration: {
            include: { patient: { include: { owner: true } } },
          },
        },
      })
      const ownerPhone = checkUpFull?.registration?.patient?.owner?.phoneNumber
      if (ownerPhone) {
        const branchData = await app.prisma.branch.findUnique({ where: { id: req.authUser.branchId } })
        const paymentFull = await app.prisma.listOfPayment.findUnique({
          where: { id: payment.id },
          include: { paymentItems: { include: { detailItemPatient: true } } },
        })
        const total = paymentFull?.paymentItems?.reduce((s: number, i: any) =>
          s + (Number(i.detailItemPatient?.totalPrice || 0) * i.quantity - Number(i.amountDiscount || 0)), 0) ?? 0
        sendWhatsapp(app.prisma, {
          phone: ownerPhone,
          recipientName: checkUpFull?.registration?.patient?.owner?.ownerName,
          message: msgPaymentReceipt({
            ownerName:     checkUpFull?.registration?.patient?.owner?.ownerName ?? '',
            petName:       checkUpFull?.registration?.patient?.petName ?? '',
            invoiceNumber: `INV-${payment.id}`,
            total:         total.toLocaleString('id-ID'),
            branchName:    branchData?.branchName ?? '',
            date:          new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
          }),
          type:    'payment_receipt',
          patientId: checkUpFull?.registration?.patientId ?? undefined,
          branchId:  req.authUser.branchId,
          userId:    req.authUser.userId,
        }).catch(() => {})
      }
    } catch {}

    return reply.status(201).send({ message: 'Pembayaran berhasil diproses.', data: { id: payment.id.toString() } })
  })

  // Delete payment
  app.delete('/pembayaran/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await app.prisma.$transaction(async (tx) => {
      const p = await tx.listOfPayment.findUnique({ where: { id: BigInt(id) }, include: { paymentItems: true, paymentServices: true, paymentMedicineGroups: true } })
      if (!p) throw new Error('Pembayaran tidak ditemukan.')

      // Revert paid status
      for (const item of p.paymentItems) {
        await tx.detailItemPatient.update({ where: { id: item.detailItemPatientId }, data: { statusPaidOff: false } })
      }
      for (const svc of p.paymentServices) {
        await tx.detailServicePatient.update({ where: { id: svc.detailServicePatientId }, data: { statusPaidOff: false } })
      }
      for (const mg of p.paymentMedicineGroups) {
        await tx.detailMedicineGroupResult.update({ where: { id: mg.detailMedicineGroupResultId }, data: { statusPaidOff: false } })
      }

      await tx.checkUpResult.update({
        where: { id: p.checkUpResultId },
        data: { statusPaidOff: false },
      })
      await tx.listOfPayment.update({ where: { id: BigInt(id) }, data: { isDeleted: true, deletedAt: new Date() } })
    })

    return reply.send({ message: 'Pembayaran berhasil dihapus.' })
  })

  // ─── Antrian kasir: checkups selesai yang belum dibayar ────────────────────
  app.get('/pembayaran/antrian-kasir', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = user.role === 'admin' ? {} : { branchId: BigInt(user.branchId) }

    const data = await app.prisma.checkUpResult.findMany({
      where: {
        isDeleted: false,
        statusPaidOff: false,
        registration: { ...branchFilter, isDeleted: false },
      },
      include: {
        registration: {
          include: {
            patient: { include: { owner: { select: { ownerName: true, phoneNumber: true } } } },
            doctor: { select: { fullname: true } },
          },
        },
        doctor: { select: { fullname: true } },
        detailItems: {
          where: { statusPaidOff: false },
          include: { priceItem: { include: { listOfItem: { select: { itemName: true } } } } },
        },
        detailServices: {
          where: { statusPaidOff: false },
          include: { priceService: { include: { listOfService: { select: { serviceName: true } } } } },
        },
        detailMedicineGroups: {
          where: { statusPaidOff: false },
          include: { medicineGroup: { select: { groupName: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Hitung estimasi total tiap checkup
    const result = data.map((c) => {
      const totalItems = c.detailItems.reduce((sum, d) => sum + Number(d.priceOverall), 0)
      const totalServices = c.detailServices.reduce((sum, d) => sum + Number(d.priceOverall), 0)
      const totalMedGroups = c.detailMedicineGroups.reduce((sum, _) => sum + 0, 0) // medicine group harga dari priceItem
      return {
        ...c,
        estimatedTotal: totalItems + totalServices + totalMedGroups,
        itemCount: c.detailItems.length + c.detailServices.length + c.detailMedicineGroups.length,
      }
    })

    return reply.send({ data: result })
  })

  // ─── Tagihan detail untuk kasir ──────────────────────────────────────────────
  app.get('/pembayaran/tagihan/:checkUpId', { preHandler: [authenticate] }, async (req, reply) => {
    const { checkUpId } = req.params as any

    const checkUp = await app.prisma.checkUpResult.findFirst({
      where: { id: BigInt(checkUpId), isDeleted: false },
      include: {
        registration: {
          include: {
            patient: { include: { owner: true } },
            doctor: { select: { fullname: true } },
          },
        },
        doctor: { select: { fullname: true } },
        detailItems: {
          where: { statusPaidOff: false },
          include: {
            priceItem: {
              include: { listOfItem: { include: { unitItem: { select: { unitName: true } } } } },
            },
          },
        },
        detailServices: {
          where: { statusPaidOff: false },
          include: { priceService: { include: { listOfService: { select: { serviceName: true, description: true } } } } },
        },
        detailMedicineGroups: {
          where: { statusPaidOff: false },
          include: {
            medicineGroup: {
              include: {
                priceMedicineGroups: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' }, take: 1 },
              },
            },
          },
        },
      },
    })

    if (!checkUp) return reply.status(404).send({ message: 'Data pemeriksaan tidak ditemukan.' })
    if (checkUp.statusPaidOff) return reply.status(400).send({ message: 'Pemeriksaan ini sudah dibayar.' })

    // Hitung total
    const subtotalItems = checkUp.detailItems.reduce((s, d) => s + Number(d.priceOverall), 0)
    const subtotalServices = checkUp.detailServices.reduce((s, d) => s + Number(d.priceOverall), 0)
    const subtotalMedGroups = checkUp.detailMedicineGroups.reduce((s, d) => {
      const price = d.medicineGroup.priceMedicineGroups[0]?.sellingPrice ?? 0
      return s + Number(price) * d.quantity
    }, 0)
    const subtotal = subtotalItems + subtotalServices + subtotalMedGroups

    return reply.send({ data: { ...checkUp, subtotal, subtotalItems, subtotalServices, subtotalMedGroups } })
  })

  // ─── Stats untuk dashboard ────────────────────────────────────────────────
  app.get('/pembayaran/stats', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = user.role === 'admin' ? {} : { branchId: BigInt(user.branchId) }

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)

    const [todayPayments, totalPendingKasir] = await Promise.all([
      app.prisma.listOfPayment.findMany({
        where: {
          isDeleted: false,
          createdAt: { gte: todayStart, lte: todayEnd },
          checkUpResult: { registration: { ...branchFilter } },
        },
        include: {
          paymentItems:    { select: { detailItemPatient: { select: { priceOverall: true } } } },
          paymentServices: { select: { detailServicePatient: { select: { priceOverall: true } } } },
          paymentMethod:   { select: { methodName: true } },
        },
      }),
      app.prisma.checkUpResult.count({
        where: { isDeleted: false, statusPaidOff: false, registration: { ...branchFilter } },
      }),
    ])

    // Hitung omzet hari ini dari item + service (dikurangi discount)
    const todayRevenue = todayPayments.reduce((sum, p) => {
      const fromItems    = p.paymentItems.reduce((s, i) => s + Number(i.detailItemPatient.priceOverall), 0)
      const fromServices = p.paymentServices.reduce((s, i) => s + Number(i.detailServicePatient.priceOverall), 0)
      return sum + fromItems + fromServices - Number(p.discount)
    }, 0)

    return reply.send({
      data: {
        todayRevenue,
        todayTransactions: todayPayments.length,
        pendingKasir: totalPendingKasir,
      },
    })
  })

  // Payment methods
  app.get('/metode-pembayaran', { preHandler: authenticate }, async (_req, reply) => {
    const methods = await app.prisma.paymentMethod.findMany({ where: { isDeleted: false }, orderBy: { methodName: 'asc' } })
    return reply.send({ data: methods })
  })

  app.post('/metode-pembayaran', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const { methodName } = req.body as { methodName: string }
    if (!methodName) return reply.status(400).send({ message: 'Nama metode diperlukan.' })
    const method = await app.prisma.paymentMethod.create({ data: { methodName } })
    return reply.status(201).send({ data: method })
  })

  app.delete('/metode-pembayaran/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await app.prisma.paymentMethod.update({ where: { id: BigInt(id) }, data: { isDeleted: true } })
    return reply.send({ message: 'Metode pembayaran berhasil dihapus.' })
  })
}
