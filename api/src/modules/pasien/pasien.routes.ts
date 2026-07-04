import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth'

const patientSchema = z.object({
  petCategory:  z.string().min(1, 'Jenis hewan wajib diisi'),
  petName:      z.string().min(1, 'Nama hewan wajib diisi'),
  petGender:    z.enum(['Jantan', 'Betina']).optional(),
  petYearAge:   z.number().int().min(0).optional(),
  petMonthAge:  z.number().int().min(0).max(11).optional(),
  // Pemilik: pilih existing atau buat baru
  ownerId:      z.string().optional(),
  ownerName:    z.string().optional(),
  ownerAddress: z.string().optional(),
  ownerPhone:   z.string().optional(),
})

const ownerUpdateSchema = z.object({
  ownerName:   z.string().min(1, 'Nama wajib diisi'),
  address:     z.string().optional(),
  phoneNumber: z.string().optional(),
})

export async function pasienRoutes(app: FastifyInstance) {

  // ── GET stats ringkasan pasien ─────────────────────────────────────────────
  app.get('/pasien/stats', { preHandler: authenticate }, async (req, reply) => {
    const branchId = req.authUser.branchId

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [total, addedToday, visitThisMonth, categoryStats] = await Promise.all([
      app.prisma.patient.count({
        where: { branchId, isDeleted: false },
      }),
      app.prisma.patient.count({
        where: { branchId, isDeleted: false, createdAt: { gte: todayStart } },
      }),
      app.prisma.registration.count({
        where: { branchId, isDeleted: false, createdAt: { gte: monthStart } },
      }),
      // Hitung per jenis hewan
      app.prisma.patient.groupBy({
        by: ['petCategory'],
        where: { branchId, isDeleted: false },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ])

    return reply.send({ data: { total, addedToday, visitThisMonth, categoryStats } })
  })

  // ── GET list pemilik (untuk autocomplete) ─────────────────────────────────
  app.get('/pemilik', { preHandler: authenticate }, async (req, reply) => {
    const q = req.query as any
    const owners = await app.prisma.owner.findMany({
      where: {
        branchId: req.authUser.branchId,
        isDeleted: false,
        ...(q.search ? {
          OR: [
            { ownerName:   { contains: q.search, mode: 'insensitive' as const } },
            { phoneNumber: { contains: q.search, mode: 'insensitive' as const } },
          ],
        } : {}),
      },
      orderBy: { ownerName: 'asc' },
      take: 30,
      select: {
        id: true, ownerName: true,
        phoneNumber: true, address: true,
        _count: { select: { patients: { where: { isDeleted: false } } } },
      },
    })
    return reply.send({ data: owners })
  })

  // ── GET list pasien ────────────────────────────────────────────────────────
  app.get('/pasien', { preHandler: authenticate }, async (req, reply) => {
    const q     = req.query as any
    const page  = Number(q.page  || 1)
    const limit = Number(q.limit || 20)
    const skip  = (page - 1) * limit

    const where: any = {
      branchId:  req.authUser.branchId,
      isDeleted: false,
      ...(q.category && { petCategory: q.category }),
      ...(q.search && {
        OR: [
          { petName:  { contains: q.search, mode: 'insensitive' as const } },
          { idMember: { contains: q.search, mode: 'insensitive' as const } },
          { owner: { ownerName: { contains: q.search, mode: 'insensitive' as const } } },
          { owner: { phoneNumber: { contains: q.search, mode: 'insensitive' as const } } },
        ],
      }),
    }

    const [patients, total] = await Promise.all([
      app.prisma.patient.findMany({
        where, skip, take: limit,
        include: {
          owner: { select: { id: true, ownerName: true, phoneNumber: true, address: true } },
          registrations: {
            where:   { isDeleted: false },
            orderBy: { createdAt: 'desc' },
            take:    1,
            select:  { createdAt: true, checkUpResult: { select: { diagnosa: true } } },
          },
          _count: {
            select: { registrations: { where: { isDeleted: false } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      app.prisma.patient.count({ where }),
    ])

    return reply.send({ data: patients, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } })
  })

  // ── GET detail pasien + riwayat kunjungan ──────────────────────────────────
  app.get('/pasien/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const patient = await app.prisma.patient.findFirst({
      where: { id: BigInt(id), isDeleted: false },
      include: {
        owner: true,
        medicalRecord: true,
        registrations: {
          where:   { isDeleted: false },
          include: {
            doctor: { select: { fullname: true } },
            checkUpResult: {
              select: { id: true, diagnosa: true, statusPaidOff: true, statusFinish: true, createdAt: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { registrations: { where: { isDeleted: false } } },
        },
      },
    })

    if (!patient) return reply.status(404).send({ message: 'Pasien tidak ditemukan.' })
    return reply.send({ data: patient })
  })

  // ── POST tambah pasien baru ────────────────────────────────────────────────
  app.post('/pasien', { preHandler: authenticate }, async (req, reply) => {
    const body = patientSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const branchId = req.authUser.branchId
    let ownerId: bigint

    if (body.data.ownerId) {
      // Pakai pemilik yang sudah ada
      ownerId = BigInt(body.data.ownerId)
    } else if (body.data.ownerName) {
      // Buat pemilik baru
      const owner = await app.prisma.owner.create({
        data: {
          ownerName:   body.data.ownerName,
          address:     body.data.ownerAddress,
          phoneNumber: body.data.ownerPhone,
          branchId,
        },
      })
      ownerId = owner.id
    } else {
      return reply.status(400).send({ message: 'Pemilik harus dipilih atau diisi nama baru.' })
    }

    const count  = await app.prisma.patient.count({ where: { branchId } })
    const branch = await app.prisma.branch.findUnique({ where: { id: branchId } })
    const idMember = `BVC-P-${branch?.branchCode ?? 'XX'}-${String(count + 1).padStart(5, '0')}`

    const patient = await app.prisma.patient.create({
      data: {
        idMember,
        petCategory: body.data.petCategory,
        petName:     body.data.petName,
        petGender:   body.data.petGender,
        petYearAge:  body.data.petYearAge,
        petMonthAge: body.data.petMonthAge,
        ownerId,
        branchId,
        userId: req.authUser.userId,
      },
      include: { owner: true },
    })

    // Buat kartu rekam medis otomatis
    await app.prisma.medicalRecord.create({ data: { patientId: patient.id } })

    return reply.status(201).send({ message: 'Pasien berhasil didaftarkan.', data: patient })
  })

  // ── PUT update data pasien ─────────────────────────────────────────────────
  app.put('/pasien/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = patientSchema.partial().safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const patient = await app.prisma.patient.update({
      where: { id: BigInt(id) },
      data: {
        ...(body.data.petCategory !== undefined && { petCategory: body.data.petCategory }),
        ...(body.data.petName     !== undefined && { petName:     body.data.petName }),
        ...(body.data.petGender   !== undefined && { petGender:   body.data.petGender }),
        ...(body.data.petYearAge  !== undefined && { petYearAge:  body.data.petYearAge }),
        ...(body.data.petMonthAge !== undefined && { petMonthAge: body.data.petMonthAge }),
      },
      include: { owner: true },
    })

    return reply.send({ message: 'Data pasien berhasil diperbarui.', data: patient })
  })

  // ── PUT update data pemilik ────────────────────────────────────────────────
  app.put('/pemilik/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = ownerUpdateSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const owner = await app.prisma.owner.update({
      where: { id: BigInt(id) },
      data:  body.data,
    })
    return reply.send({ message: 'Data pemilik berhasil diperbarui.', data: owner })
  })

  // ── DELETE pasien (soft) ───────────────────────────────────────────────────
  app.delete('/pasien/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }

    // Cek apakah ada registrasi aktif
    const activeReg = await app.prisma.registration.findFirst({
      where: {
        patientId:        BigInt(id),
        isDeleted:        false,
        acceptanceStatus: { in: ['pending', 'accepted'] },
        checkUpResult:    { statusPaidOff: false },
      },
    })
    if (activeReg) {
      return reply.status(400).send({ message: 'Tidak dapat menghapus pasien yang masih memiliki kunjungan aktif.' })
    }

    await app.prisma.patient.update({
      where: { id: BigInt(id) },
      data:  { isDeleted: true, deletedAt: new Date() },
    })
    return reply.send({ message: 'Pasien berhasil dihapus.' })
  })
}
