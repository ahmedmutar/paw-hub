import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'
import { runReminderScan } from './reminder.service'

// VaccinationRecord/DewormingRecord/ReminderLog tidak punya branchId
// langsung — cuma lewat relasi patientId -> patient.branchId. Admin dikunci
// ke seluruh cabang di tenant-nya, non-admin dikunci ke cabang sendiri.
function reminderBranchFilter(user: any) {
  return user.role === 'admin'
    ? { patient: { branch: { tenantId: BigInt(user.tenantId) } } }
    : { patient: { branchId: BigInt(user.branchId) } }
}

export async function reminderRoutes(app: FastifyInstance) {

  // ── GET /reminder/upcoming — hewan jatuh tempo N hari ke depan ──────────
  app.get('/reminder/upcoming', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const q       = req.query as any
    const days    = Number(q.days ?? 30)
    const type    = q.type as string | undefined   // 'vaccination' | 'deworming'
    const search  = q.search as string | undefined
    const page    = Number(q.page  ?? 1)
    const limit   = Number(q.limit ?? 30)

    const now  = new Date(); now.setHours(0, 0, 0, 0)
    const to   = new Date(now); to.setDate(to.getDate() + days)

    const bf = reminderBranchFilter(req.authUser)
    const searchFilter = search
      ? { patient: { OR: [
          { petName:  { contains: search, mode: 'insensitive' as const } },
          { owner:    { ownerName: { contains: search, mode: 'insensitive' as const } } },
        ] } }
      : {}

    const dateRange = { gte: now, lte: to }

    const [vaccinations, dewormings] = await Promise.all([
      (type !== 'deworming') ? app.prisma.vaccinationRecord.findMany({
        where: { nextDueAt: dateRange, ...bf, ...searchFilter },
        include: {
          patient: {
            select: {
              id: true, petName: true, petCategory: true, branchId: true,
              owner: { select: { id: true, ownerName: true, phoneNumber: true } },
              branch: { select: { id: true, branchName: true } },
            },
          },
        },
        orderBy: { nextDueAt: 'asc' },
      }) : Promise.resolve([]),

      (type !== 'vaccination') ? app.prisma.dewormingRecord.findMany({
        where: { nextDueAt: dateRange, ...bf, ...searchFilter },
        include: {
          patient: {
            select: {
              id: true, petName: true, petCategory: true, branchId: true,
              owner: { select: { id: true, ownerName: true, phoneNumber: true } },
              branch: { select: { id: true, branchName: true } },
            },
          },
        },
        orderBy: { nextDueAt: 'asc' },
      }) : Promise.resolve([]),
    ])

    // Merge dan ambil status reminder log
    const vacIds = vaccinations.map(v => v.id)
    const dewIds = dewormings.map(d => d.id)

    const [vacLogs, dewLogs] = await Promise.all([
      vacIds.length > 0 ? app.prisma.reminderLog.findMany({
        where: { type: 'vaccination', recordId: { in: vacIds } },
      }) : Promise.resolve([]),
      dewIds.length > 0 ? app.prisma.reminderLog.findMany({
        where: { type: 'deworming', recordId: { in: dewIds } },
      }) : Promise.resolve([]),
    ])

    const vacLogMap = new Map(vacLogs.map(l => [l.recordId.toString(), l]))
    const dewLogMap = new Map(dewLogs.map(l => [l.recordId.toString(), l]))

    const merged = [
      ...vaccinations.map(r => ({
        type:      'vaccination',
        recordId:  r.id.toString(),
        name:      r.vaccineName,
        dueDate:   r.nextDueAt,
        patient:   formatPatient(r.patient),
        reminder:  formatLog(vacLogMap.get(r.id.toString()) ?? null),
      })),
      ...dewormings.map(r => ({
        type:      'deworming',
        recordId:  r.id.toString(),
        name:      r.medicationName,
        dueDate:   r.nextDueAt,
        patient:   formatPatient(r.patient),
        reminder:  formatLog(dewLogMap.get(r.id.toString()) ?? null),
      })),
    ].sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())

    const total = merged.length
    const paged = merged.slice((page - 1) * limit, page * limit)

    return reply.send({
      data: paged,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  })

  // ── GET /reminder/stats ───────────────────────────────────────────────────
  app.get('/reminder/stats', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const now   = new Date(); now.setHours(0, 0, 0, 0)
    const in7   = new Date(now); in7.setDate(in7.getDate() + 7)
    const in30  = new Date(now); in30.setDate(in30.getDate() + 30)

    const bf = reminderBranchFilter(req.authUser)

    const [vac7, dew7, vac30, dew30, sentToday, failed] = await Promise.all([
      app.prisma.vaccinationRecord.count({ where: { nextDueAt: { gte: now, lte: in7 },  ...bf } }),
      app.prisma.dewormingRecord.count({  where: { nextDueAt: { gte: now, lte: in7 },  ...bf } }),
      app.prisma.vaccinationRecord.count({ where: { nextDueAt: { gte: now, lte: in30 }, ...bf } }),
      app.prisma.dewormingRecord.count({  where: { nextDueAt: { gte: now, lte: in30 }, ...bf } }),
      app.prisma.reminderLog.count({
        where: { sentAt: { gte: now }, status: 'sent', ...bf },
      }),
      app.prisma.reminderLog.count({ where: { status: 'failed', ...bf } }),
    ])

    return reply.send({
      data: {
        due7:     vac7  + dew7,
        due30:    vac30 + dew30,
        sentToday,
        failed,
        breakdown7: { vaccination: vac7, deworming: dew7 },
      },
    })
  })

  // ── GET /reminder/log — riwayat pengiriman reminder ──────────────────────
  app.get('/reminder/log', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const q     = req.query as any
    const page  = Number(q.page ?? 1)
    const limit = Number(q.limit ?? 30)
    const type  = q.type as string | undefined
    const status = q.status as string | undefined

    const where: any = {
      ...reminderBranchFilter(req.authUser),
      ...(type   ? { type }   : {}),
      ...(status ? { status } : {}),
    }

    const [data, total] = await Promise.all([
      app.prisma.reminderLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true, petName: true,
              owner: { select: { ownerName: true, phoneNumber: true } },
            },
          },
        },
      }),
      app.prisma.reminderLog.count({ where }),
    ])

    return reply.send({
      data: data.map(l => ({
        ...l,
        id:        l.id.toString(),
        patientId: l.patientId.toString(),
        recordId:  l.recordId.toString(),
        patient: l.patient ? {
          ...l.patient,
          id: l.patient.id.toString(),
          owner: l.patient.owner,
        } : null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  })

  // ── POST /reminder/run — jalankan scan manual (admin) ────────────────────
  app.post('/reminder/run', { preHandler: [authenticate, requireRole('admin')] }, async (req, reply) => {
    const { days = 7 } = req.body as any

    // Jalankan non-blocking, kembalikan response segera
    const result = await runReminderScan(app.prisma, Number(days))

    return reply.send({
      message: `Scan selesai: ${result.vaccination} reminder vaksinasi, ${result.deworming} reminder cacing dikirim.`,
      data: result,
    })
  })

  // ── POST /reminder/send-manual/:type/:recordId — kirim satu reminder ─────
  app.post('/reminder/send-manual/:type/:recordId', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req, reply) => {
    const { type, recordId } = req.params as any

    if (!['vaccination', 'deworming'].includes(type)) {
      return reply.status(400).send({ message: 'type harus vaccination atau deworming' })
    }

    const bf = reminderBranchFilter(req.authUser)
    const model: any = type === 'vaccination' ? app.prisma.vaccinationRecord : app.prisma.dewormingRecord
    const record = await model.findFirst({ where: { id: BigInt(recordId), ...bf } })
    if (!record) return reply.status(404).send({ message: 'Record tidak ditemukan' })

    // Reset log supaya bisa dikirim ulang
    await app.prisma.reminderLog.deleteMany({
      where: { type, recordId: BigInt(recordId) },
    })

    const result = await runReminderScan(app.prisma, 365) // scan lebar untuk tangkap record ini

    return reply.send({ message: 'Reminder berhasil dikirim', data: result })
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPatient(p: any) {
  if (!p) return null
  return {
    id:          p.id.toString(),
    petName:     p.petName,
    petCategory: p.petCategory,
    branchId:    p.branchId?.toString(),
    branch:      p.branch ? { ...p.branch, id: p.branch.id.toString() } : null,
    owner:       p.owner  ? { ...p.owner,  id: p.owner.id?.toString()  } : null,
  }
}

function formatLog(l: any) {
  if (!l) return null
  return {
    id:        l.id.toString(),
    status:    l.status,
    sentAt:    l.sentAt,
    errorMsg:  l.errorMsg,
    createdAt: l.createdAt,
  }
}
