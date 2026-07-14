import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, requireRole } from '../../middleware/auth'

// ─── Schema validasi ──────────────────────────────────────────────────────────

const updateKartuSchema = z.object({
  bloodType: z.string().optional(),
  allergies: z.string().optional(),
  chronicConditions: z.string().optional(),
  specialNotes: z.string().optional(),
})

const weightSchema = z.object({
  weightKg: z.number().positive('Berat harus lebih dari 0'),
  recordedAt: z.string().datetime().optional(),
})

const vaccinationSchema = z.object({
  vaccineName: z.string().min(1, 'Nama vaksin wajib diisi'),
  batchNumber: z.string().optional(),
  administeredAt: z.string(),
  nextDueAt: z.string().optional(),
  notes: z.string().optional(),
  checkUpResultId: z.string().optional(),
})

const dewormingSchema = z.object({
  medicationName: z.string().min(1, 'Nama obat wajib diisi'),
  administeredAt: z.string(),
  nextDueAt: z.string().optional(),
  notes: z.string().optional(),
  checkUpResultId: z.string().optional(),
})

const procedureSchema = z.object({
  procedureName: z.string().min(1, 'Nama prosedur wajib diisi'),
  performedAt: z.string(),
  notes: z.string().optional(),
  checkUpResultId: z.string().optional(),
})

// Patient punya branchId langsung (bukan tenantId), jadi filter kepemilikan
// custom mirip modul lain: admin dikunci ke seluruh cabang di tenant-nya,
// non-admin dikunci ke cabang sendiri.
function patientBranchFilter(user: any) {
  if (user.role !== 'admin') return { branchId: BigInt(user.branchId) }
  // Instalasi lama tanpa tenant (tenantId null) — jangan crash, admin lihat semua cabang.
  return user.tenantId ? { branch: { tenantId: BigInt(user.tenantId) } } : {}
}

// VaccinationRecord/DewormingRecord/MajorProcedureRecord tidak punya branchId
// sama sekali — kepemilikannya cuma bisa dicek lewat relasi ke patient.
function childRecordFilter(user: any) {
  return { patient: patientBranchFilter(user) }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function rekamMedisRoutes(app: FastifyInstance) {
  // Hanya dokter dan admin yang bisa akses rekam medis
  const guard = [authenticate, requireRole('admin', 'dokter')]

  // ── GET rekam medis lengkap per pasien ──────────────────────────────────────
  app.get('/rekam-medis/:patientId', { preHandler: guard }, async (req, reply) => {
    const user = req.authUser
    const { patientId } = req.params as { patientId: string }
    const pid = BigInt(patientId)

    // Ambil semua data sekaligus
    const [patient, medicalRecord, weightHistory, vaccinations, dewormings, procedures, visitHistory] =
      await Promise.all([
        app.prisma.patient.findFirst({
          where: { id: pid, isDeleted: false, ...patientBranchFilter(user) },
          include: { owner: true, branch: { select: { branchName: true } } },
        }),

        app.prisma.medicalRecord.findUnique({
          where: { patientId: pid },
        }),

        app.prisma.weightRecord.findMany({
          where: { patientId: pid },
          orderBy: { recordedAt: 'asc' },
          include: { checkUpResult: { select: { id: true } } },
        }),

        app.prisma.vaccinationRecord.findMany({
          where: { patientId: pid },
          orderBy: { administeredAt: 'desc' },
          include: { checkUpResult: { select: { id: true } } },
        }),

        app.prisma.dewormingRecord.findMany({
          where: { patientId: pid },
          orderBy: { administeredAt: 'desc' },
          include: { checkUpResult: { select: { id: true } } },
        }),

        app.prisma.majorProcedureRecord.findMany({
          where: { patientId: pid },
          orderBy: { performedAt: 'desc' },
          include: { checkUpResult: { select: { id: true } } },
        }),

        // Riwayat kunjungan (10 terakhir)
        app.prisma.registration.findMany({
          where: { patientId: pid, isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            doctor: { select: { fullname: true } },
            checkUpResult: {
              select: {
                id: true,
                diagnosa: true,
                statusPaidOff: true,
                statusFinish: true,
                createdAt: true,
                weightRecord: { select: { weightKg: true } },
              },
            },
          },
        }),
      ])

    if (!patient) {
      return reply.status(404).send({ message: 'Pasien tidak ditemukan.' })
    }

    return reply.send({
      data: {
        patient,
        medicalRecord,
        weightHistory,
        vaccinations,
        dewormings,
        procedures,
        visitHistory,
      },
    })
  })

  // ── UPDATE kartu rekam medis (alergi, kondisi kronis, dll) ─────────────────
  app.put('/rekam-medis/:patientId/kartu', { preHandler: guard }, async (req, reply) => {
    const user = req.authUser
    const { patientId } = req.params as { patientId: string }
    const body = updateKartuSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const pid = BigInt(patientId)
    const patient = await app.prisma.patient.findFirst({ where: { id: pid, isDeleted: false, ...patientBranchFilter(user) } })
    if (!patient) return reply.status(404).send({ message: 'Pasien tidak ditemukan.' })

    // Upsert — buat jika belum ada, update jika sudah ada
    const record = await app.prisma.medicalRecord.upsert({
      where: { patientId: pid },
      create: { patientId: pid, ...body.data },
      update: body.data,
    })

    return reply.send({ message: 'Kartu rekam medis berhasil diperbarui.', data: record })
  })

  // ── ADD catatan berat badan ─────────────────────────────────────────────────
  app.post('/rekam-medis/:patientId/berat', { preHandler: guard }, async (req, reply) => {
    const user = req.authUser
    const { patientId } = req.params as { patientId: string }
    const body = weightSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const pid = BigInt(patientId)
    const patient = await app.prisma.patient.findFirst({ where: { id: pid, isDeleted: false, ...patientBranchFilter(user) } })
    if (!patient) return reply.status(404).send({ message: 'Pasien tidak ditemukan.' })

    const { checkUpResultId } = req.query as { checkUpResultId?: string }

    // Jika terhubung ke kunjungan, cek sudah ada atau belum
    if (checkUpResultId) {
      const existing = await app.prisma.weightRecord.findUnique({
        where: { checkUpResultId: BigInt(checkUpResultId) },
      })
      if (existing) {
        // Update jika sudah ada
        const updated = await app.prisma.weightRecord.update({
          where: { checkUpResultId: BigInt(checkUpResultId) },
          data: { weightKg: body.data.weightKg, recordedAt: body.data.recordedAt ? new Date(body.data.recordedAt) : new Date() },
        })
        return reply.send({ message: 'Berat badan berhasil diperbarui.', data: updated })
      }
    }

    const record = await app.prisma.weightRecord.create({
      data: {
        patientId: pid,
        checkUpResultId: checkUpResultId ? BigInt(checkUpResultId) : undefined as any,
        weightKg: body.data.weightKg,
        recordedAt: body.data.recordedAt ? new Date(body.data.recordedAt) : new Date(),
        userId: req.authUser.userId,
      },
    })

    return reply.status(201).send({ message: 'Berat badan berhasil dicatat.', data: record })
  })

  // ── ADD vaksinasi ───────────────────────────────────────────────────────────
  app.post('/rekam-medis/:patientId/vaksinasi', { preHandler: guard }, async (req, reply) => {
    const user = req.authUser
    const { patientId } = req.params as { patientId: string }
    const body = vaccinationSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const patient = await app.prisma.patient.findFirst({ where: { id: BigInt(patientId), isDeleted: false, ...patientBranchFilter(user) } })
    if (!patient) return reply.status(404).send({ message: 'Pasien tidak ditemukan.' })

    const record = await app.prisma.vaccinationRecord.create({
      data: {
        patientId: BigInt(patientId),
        vaccineName: body.data.vaccineName,
        batchNumber: body.data.batchNumber,
        administeredAt: new Date(body.data.administeredAt),
        nextDueAt: body.data.nextDueAt ? new Date(body.data.nextDueAt) : undefined,
        notes: body.data.notes,
        checkUpResultId: body.data.checkUpResultId ? BigInt(body.data.checkUpResultId) : undefined,
        userId: req.authUser.userId,
      },
    })

    return reply.status(201).send({ message: 'Data vaksinasi berhasil dicatat.', data: record })
  })

  // ── UPDATE vaksinasi ────────────────────────────────────────────────────────
  app.put('/rekam-medis/vaksinasi/:id', { preHandler: guard }, async (req, reply) => {
    const user = req.authUser
    const { id } = req.params as { id: string }
    const body = vaccinationSchema.partial().safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.' })

    const existing = await app.prisma.vaccinationRecord.findFirst({ where: { id: BigInt(id), ...childRecordFilter(user) } })
    if (!existing) return reply.status(404).send({ message: 'Data vaksinasi tidak ditemukan.' })

    const { checkUpResultId: _v, ...vData } = body.data
    const record = await app.prisma.vaccinationRecord.update({
      where: { id: BigInt(id) },
      data: {
        ...vData,
        administeredAt: body.data.administeredAt ? new Date(body.data.administeredAt) : undefined,
        nextDueAt: body.data.nextDueAt ? new Date(body.data.nextDueAt) : undefined,
      },
    })

    return reply.send({ message: 'Data vaksinasi berhasil diperbarui.', data: record })
  })

  // ── DELETE vaksinasi ────────────────────────────────────────────────────────
  app.delete('/rekam-medis/vaksinasi/:id', { preHandler: guard }, async (req, reply) => {
    const user = req.authUser
    const { id } = req.params as { id: string }
    const existing = await app.prisma.vaccinationRecord.findFirst({ where: { id: BigInt(id), ...childRecordFilter(user) } })
    if (!existing) return reply.status(404).send({ message: 'Data vaksinasi tidak ditemukan.' })

    await app.prisma.vaccinationRecord.delete({ where: { id: BigInt(id) } })
    return reply.send({ message: 'Data vaksinasi berhasil dihapus.' })
  })

  // ── ADD obat cacing ─────────────────────────────────────────────────────────
  app.post('/rekam-medis/:patientId/obat-cacing', { preHandler: guard }, async (req, reply) => {
    const user = req.authUser
    const { patientId } = req.params as { patientId: string }
    const body = dewormingSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const patient = await app.prisma.patient.findFirst({ where: { id: BigInt(patientId), isDeleted: false, ...patientBranchFilter(user) } })
    if (!patient) return reply.status(404).send({ message: 'Pasien tidak ditemukan.' })

    const record = await app.prisma.dewormingRecord.create({
      data: {
        patientId: BigInt(patientId),
        medicationName: body.data.medicationName,
        administeredAt: new Date(body.data.administeredAt),
        nextDueAt: body.data.nextDueAt ? new Date(body.data.nextDueAt) : undefined,
        notes: body.data.notes,
        checkUpResultId: body.data.checkUpResultId ? BigInt(body.data.checkUpResultId) : undefined,
        userId: req.authUser.userId,
      },
    })

    return reply.status(201).send({ message: 'Data obat cacing berhasil dicatat.', data: record })
  })

  // ── UPDATE obat cacing ──────────────────────────────────────────────────────
  app.put('/rekam-medis/obat-cacing/:id', { preHandler: guard }, async (req, reply) => {
    const user = req.authUser
    const { id } = req.params as { id: string }
    const body = dewormingSchema.partial().safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.' })

    const existing = await app.prisma.dewormingRecord.findFirst({ where: { id: BigInt(id), ...childRecordFilter(user) } })
    if (!existing) return reply.status(404).send({ message: 'Data obat cacing tidak ditemukan.' })

    const { checkUpResultId: _d, ...dData } = body.data
    const record = await app.prisma.dewormingRecord.update({
      where: { id: BigInt(id) },
      data: {
        ...dData,
        administeredAt: body.data.administeredAt ? new Date(body.data.administeredAt) : undefined,
        nextDueAt: body.data.nextDueAt ? new Date(body.data.nextDueAt) : undefined,
      },
    })

    return reply.send({ message: 'Data obat cacing berhasil diperbarui.', data: record })
  })

  // ── DELETE obat cacing ──────────────────────────────────────────────────────
  app.delete('/rekam-medis/obat-cacing/:id', { preHandler: guard }, async (req, reply) => {
    const user = req.authUser
    const { id } = req.params as { id: string }
    const existing = await app.prisma.dewormingRecord.findFirst({ where: { id: BigInt(id), ...childRecordFilter(user) } })
    if (!existing) return reply.status(404).send({ message: 'Data obat cacing tidak ditemukan.' })

    await app.prisma.dewormingRecord.delete({ where: { id: BigInt(id) } })
    return reply.send({ message: 'Data obat cacing berhasil dihapus.' })
  })

  // ── ADD tindakan besar ──────────────────────────────────────────────────────
  app.post('/rekam-medis/:patientId/tindakan', { preHandler: guard }, async (req, reply) => {
    const user = req.authUser
    const { patientId } = req.params as { patientId: string }
    const body = procedureSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ message: 'Input tidak valid.', errors: body.error.flatten().fieldErrors })
    }

    const patient = await app.prisma.patient.findFirst({ where: { id: BigInt(patientId), isDeleted: false, ...patientBranchFilter(user) } })
    if (!patient) return reply.status(404).send({ message: 'Pasien tidak ditemukan.' })

    const record = await app.prisma.majorProcedureRecord.create({
      data: {
        patientId: BigInt(patientId),
        procedureName: body.data.procedureName,
        performedAt: new Date(body.data.performedAt),
        notes: body.data.notes,
        checkUpResultId: body.data.checkUpResultId ? BigInt(body.data.checkUpResultId) : undefined,
        userId: req.authUser.userId,
      },
    })

    return reply.status(201).send({ message: 'Data tindakan berhasil dicatat.', data: record })
  })

  // ── UPDATE tindakan ─────────────────────────────────────────────────────────
  app.put('/rekam-medis/tindakan/:id', { preHandler: guard }, async (req, reply) => {
    const user = req.authUser
    const { id } = req.params as { id: string }
    const body = procedureSchema.partial().safeParse(req.body)
    if (!body.success) return reply.status(400).send({ message: 'Input tidak valid.' })

    const existing = await app.prisma.majorProcedureRecord.findFirst({ where: { id: BigInt(id), ...childRecordFilter(user) } })
    if (!existing) return reply.status(404).send({ message: 'Data tindakan tidak ditemukan.' })

    const { checkUpResultId: _p, ...pData } = body.data
    const record = await app.prisma.majorProcedureRecord.update({
      where: { id: BigInt(id) },
      data: {
        ...pData,
        performedAt: body.data.performedAt ? new Date(body.data.performedAt) : undefined,
      },
    })

    return reply.send({ message: 'Data tindakan berhasil diperbarui.', data: record })
  })

  // ── DELETE tindakan ─────────────────────────────────────────────────────────
  app.delete('/rekam-medis/tindakan/:id', { preHandler: guard }, async (req, reply) => {
    const user = req.authUser
    const { id } = req.params as { id: string }
    const existing = await app.prisma.majorProcedureRecord.findFirst({ where: { id: BigInt(id), ...childRecordFilter(user) } })
    if (!existing) return reply.status(404).send({ message: 'Data tindakan tidak ditemukan.' })

    await app.prisma.majorProcedureRecord.delete({ where: { id: BigInt(id) } })
    return reply.send({ message: 'Data tindakan berhasil dihapus.' })
  })
}
