import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export async function jadwalDokterRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma

  // GET /jadwal-dokter — all schedules for branch
  fastify.get('/jadwal-dokter', {
    preHandler: [authenticate],
  }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const schedules = await prisma.doctorSchedule.findMany({
      where: { branchId, isActive: true },
      include: { doctor: { select: { id: true, fullname: true, role: true } } },
      orderBy: [{ doctorId: 'asc' }, { dayOfWeek: 'asc' }],
    })
    return reply.send({
      data: schedules.map(s => ({
        id: s.id.toString(), doctorId: s.doctorId.toString(),
        doctorName: s.doctor.fullname, dayOfWeek: s.dayOfWeek,
        dayName: DAY_NAMES[s.dayOfWeek], shiftStart: s.shiftStart,
        shiftEnd: s.shiftEnd, maxPatients: s.maxPatients, isActive: s.isActive,
      })),
    })
  })

  // GET /jadwal-dokter/:doctorId — schedule for specific doctor
  fastify.get('/jadwal-dokter/:doctorId', {
    preHandler: [authenticate],
  }, async (req: any, reply) => {
    const doctorId = BigInt(req.params.doctorId)
    const { branchId } = req.authUser

    const [schedules, leaves] = await Promise.all([
      prisma.doctorSchedule.findMany({
        where: { doctorId, branchId },
        orderBy: { dayOfWeek: 'asc' },
      }),
      prisma.doctorLeave.findMany({
        where: { doctorId, branchId, leaveDate: { gte: new Date() } },
        orderBy: { leaveDate: 'asc' },
      }),
    ])

    return reply.send({
      data: {
        schedules: schedules.map(s => ({ ...s, id: s.id.toString(), doctorId: s.doctorId.toString(), dayName: DAY_NAMES[s.dayOfWeek] })),
        upcomingLeaves: leaves.map(l => ({ ...l, id: l.id.toString(), doctorId: l.doctorId.toString() })),
      },
    })
  })

  // POST /jadwal-dokter — create or upsert schedule
  fastify.post('/jadwal-dokter', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const { doctorId, dayOfWeek, shiftStart, shiftEnd, maxPatients } = req.body as any
    const { branchId, tenantId } = req.authUser

    const schedule = await prisma.doctorSchedule.upsert({
      where: { doctorId_branchId_dayOfWeek: { doctorId: BigInt(doctorId), branchId, dayOfWeek: Number(dayOfWeek) } },
      update: { shiftStart, shiftEnd, maxPatients: Number(maxPatients ?? 20), isActive: true },
      create: {
        doctorId: BigInt(doctorId), branchId, tenantId, dayOfWeek: Number(dayOfWeek),
        shiftStart, shiftEnd, maxPatients: Number(maxPatients ?? 20),
      },
    })

    return reply.send({ success: true, data: { ...schedule, id: schedule.id.toString(), doctorId: schedule.doctorId.toString() } })
  })

  // PUT /jadwal-dokter/:id — update one schedule
  fastify.put('/jadwal-dokter/:id', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const { shiftStart, shiftEnd, maxPatients, isActive } = req.body as any
    const existing = await prisma.doctorSchedule.findFirst({ where: { id, branchId: req.authUser.branchId } })
    if (!existing) return reply.status(404).send({ message: 'Jadwal tidak ditemukan' })

    const schedule = await prisma.doctorSchedule.update({
      where: { id },
      data: { shiftStart, shiftEnd, maxPatients: maxPatients ? Number(maxPatients) : undefined, isActive },
    })
    return reply.send({ success: true, data: { ...schedule, id: schedule.id.toString() } })
  })

  // DELETE /jadwal-dokter/:id
  fastify.delete('/jadwal-dokter/:id', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const existing = await prisma.doctorSchedule.findFirst({ where: { id, branchId: req.authUser.branchId } })
    if (!existing) return reply.status(404).send({ message: 'Jadwal tidak ditemukan' })

    await prisma.doctorSchedule.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // GET /jadwal-dokter/kalender/week — weekly calendar view, all doctors
  fastify.get('/jadwal-dokter/kalender/week', {
    preHandler: [authenticate],
  }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const { dateFrom } = req.query as { dateFrom?: string }

    const weekStart = dateFrom ? new Date(dateFrom) : (() => {
      const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d
    })()
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6)

    const [schedules, leaves, doctors] = await Promise.all([
      prisma.doctorSchedule.findMany({
        where: { branchId, isActive: true },
        include: { doctor: { select: { id: true, fullname: true } } },
      }),
      prisma.doctorLeave.findMany({
        where: {
          branchId,
          leaveDate: { gte: weekStart, lte: weekEnd },
          status: { in: ['pending', 'approved'] },
        },
        include: { doctor: { select: { id: true, fullname: true } } },
      }),
      prisma.user.findMany({
        where: { branchId, role: 'dokter', isDeleted: false, status: true },
        select: { id: true, fullname: true },
      }),
    ])

    // Build 7-day grid
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(d.getDate() + i)
      return {
        date: d.toISOString().split('T')[0],
        dayOfWeek: d.getDay(),
        dayName: DAY_NAMES[d.getDay()],
        slots: [] as any[],
      }
    })

    for (const day of days) {
      for (const doc of doctors) {
        const sched = schedules.find(s => s.doctorId === doc.id && s.dayOfWeek === day.dayOfWeek)
        const leave = leaves.find(l => l.doctorId === doc.id && l.leaveDate.toISOString().split('T')[0] === day.date)
        day.slots.push({
          doctorId: doc.id.toString(),
          doctorName: doc.fullname,
          hasSchedule: !!sched,
          shiftStart: sched?.shiftStart ?? null,
          shiftEnd: sched?.shiftEnd ?? null,
          maxPatients: sched?.maxPatients ?? 0,
          leave: leave ? { status: leave.status, reason: leave.reason } : null,
          available: !!sched && !leave,
        })
      }
    }

    return reply.send({ data: { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(), days } })
  })

  // GET /jadwal-dokter/available — available doctors for a given date (for booking)
  fastify.get('/jadwal-dokter/available', async (req: any, reply) => {
    const { branchId, date } = req.query as { branchId: string; date: string }
    if (!branchId || !date) return reply.status(400).send({ message: 'branchId dan date wajib' })

    const d = new Date(date)
    const dow = d.getDay()
    const brId = BigInt(branchId)

    const [schedules, leaves] = await Promise.all([
      prisma.doctorSchedule.findMany({
        where: { branchId: brId, dayOfWeek: dow, isActive: true },
        include: { doctor: { select: { id: true, fullname: true, imageProfile: true } } },
      }),
      prisma.doctorLeave.findMany({
        where: { branchId: brId, leaveDate: d, status: 'approved' },
        select: { doctorId: true },
      }),
    ])

    const leaveDoctorIds = new Set(leaves.map(l => l.doctorId.toString()))
    const available = schedules.filter(s => !leaveDoctorIds.has(s.doctorId.toString()))

    return reply.send({
      data: available.map(s => ({
        doctorId: s.doctorId.toString(), doctorName: s.doctor.fullname,
        shiftStart: s.shiftStart, shiftEnd: s.shiftEnd, maxPatients: s.maxPatients,
        imageProfile: s.doctor.imageProfile,
      })),
    })
  })

  // ─── Cuti / Leave ──────────────────────────────────────────────────────────

  // POST /jadwal-dokter/cuti — request leave
  fastify.post('/jadwal-dokter/cuti', {
    preHandler: [authenticate],
  }, async (req: any, reply) => {
    const { doctorId, leaveDate, reason } = req.body as any
    const { branchId, tenantId, role, userId } = req.authUser

    const docId = role === 'dokter' ? userId : BigInt(doctorId)

    const leave = await prisma.doctorLeave.create({
      data: {
        doctorId: docId, branchId, tenantId,
        leaveDate: new Date(leaveDate),
        reason: reason ?? null,
        status: 'pending',
      },
    })
    return reply.send({ success: true, data: { ...leave, id: leave.id.toString(), doctorId: leave.doctorId.toString() } })
  })

  // GET /jadwal-dokter/cuti/list
  fastify.get('/jadwal-dokter/cuti/list', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const leaves = await prisma.doctorLeave.findMany({
      where: { branchId },
      orderBy: { leaveDate: 'desc' },
      take: 50,
      include: {
        doctor: { select: { fullname: true } },
        approver: { select: { fullname: true } },
      },
    })
    return reply.send({
      data: leaves.map(l => ({
        id: l.id.toString(), doctorName: l.doctor.fullname,
        leaveDate: l.leaveDate, reason: l.reason, status: l.status,
        approverName: l.approver?.fullname ?? null, createdAt: l.createdAt,
      })),
    })
  })

  // PATCH /jadwal-dokter/cuti/:id — approve or decline
  fastify.patch('/jadwal-dokter/cuti/:id', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const { status } = req.body as { status: 'approved' | 'declined' }
    if (!['approved', 'declined'].includes(status)) return reply.status(400).send({ message: 'Status tidak valid' })

    const existing = await prisma.doctorLeave.findFirst({ where: { id, branchId: req.authUser.branchId } })
    if (!existing) return reply.status(404).send({ message: 'Data cuti tidak ditemukan' })

    await prisma.doctorLeave.update({
      where: { id },
      data: { status, approvedBy: req.authUser.userId },
    })
    return reply.send({ success: true })
  })
}
