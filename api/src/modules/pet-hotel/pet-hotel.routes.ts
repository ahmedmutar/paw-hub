// @ts-nocheck
import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'

// HotelRoom/HotelBooking punya branchId (superadmin bypass, sisanya dikunci
// ke cabang sendiri — mengikuti pola yang sudah dipakai list endpoint modul ini).
function hotelBranchFilter(user: any) {
  return user.role === 'superadmin' ? {} : { branchId: BigInt(user.branchId) }
}

export async function petHotelRoutes(app: FastifyInstance) {
  // ── Kamar ──────────────────────────────────────────────────────────────────
  app.get('/pet-hotel/kamar', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { branchId, role, tenantId } = req.authUser
    const rows = await req.server.prisma.hotelRoom.findMany({
      where: role === 'superadmin' ? {} : { branchId },
      orderBy: [{ roomType: 'asc' }, { roomName: 'asc' }],
    })
    return reply.send({ data: rows })
  })

  app.post('/pet-hotel/kamar', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { branchId, tenantId } = req.authUser
    const { roomName, roomType, capacity, pricePerNight, description } = req.body as any
    const room = await req.server.prisma.hotelRoom.create({
      data: { branchId, tenantId, roomName, roomType: roomType ?? 'reguler', capacity: Number(capacity ?? 1), pricePerNight: Number(pricePerNight), description },
    })
    return reply.status(201).send({ data: room })
  })

  app.put('/pet-hotel/kamar/:id', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const { roomName, roomType, capacity, pricePerNight, description, isActive } = req.body as any
    const existing = await req.server.prisma.hotelRoom.findFirst({ where: { id, ...hotelBranchFilter(req.authUser) } })
    if (!existing) return reply.status(404).send({ message: 'Kamar tidak ditemukan' })

    const room = await req.server.prisma.hotelRoom.update({
      where: { id },
      data: { roomName, roomType, capacity: capacity ? Number(capacity) : undefined, pricePerNight: pricePerNight ? Number(pricePerNight) : undefined, description, isActive },
    })
    return reply.send({ data: room })
  })

  // ── Occupancy calendar ──────────────────────────────────────────────────────
  app.get('/pet-hotel/occupancy', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { branchId, role } = req.authUser
    const { month, year } = req.query as any
    const m = Number(month ?? new Date().getMonth() + 1)
    const y = Number(year ?? new Date().getFullYear())
    const dateFrom = new Date(y, m - 1, 1)
    const dateTo = new Date(y, m, 0, 23, 59, 59)

    const bookings = await req.server.prisma.hotelBooking.findMany({
      where: {
        ...(role !== 'superadmin' && { branchId }),
        checkIn: { lte: dateTo },
        checkOut: { gte: dateFrom },
        status: { not: 'cancelled' },
      },
      include: {
        room: { select: { roomName: true, roomType: true } },
        patient: { select: { petName: true, petCategory: true } },
        owner: { select: { ownerName: true, phoneNumber: true } },
      },
    })
    return reply.send({ data: bookings })
  })

  // ── Bookings ────────────────────────────────────────────────────────────────
  app.get('/pet-hotel/booking', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { branchId, role } = req.authUser
    const { status, page = 1, limit = 20 } = req.query as any
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {
      ...(role !== 'superadmin' && { branchId }),
      ...(status && { status }),
    }
    const [total, bookings] = await Promise.all([
      req.server.prisma.hotelBooking.count({ where }),
      req.server.prisma.hotelBooking.findMany({
        where, skip, take: Number(limit),
        orderBy: { checkIn: 'desc' },
        include: {
          room: { select: { roomName: true, roomType: true, pricePerNight: true } },
          patient: { select: { petName: true, petCategory: true } },
          owner: { select: { ownerName: true, phoneNumber: true } },
        },
      }),
    ])
    return reply.send({ data: bookings, total, page: Number(page) })
  })

  app.post('/pet-hotel/booking', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { branchId, tenantId } = req.authUser
    const { roomId, patientId, ownerId, checkIn, checkOut, specialNeeds, notes } = req.body as any

    const ci = new Date(checkIn)
    const co = new Date(checkOut)
    const totalNights = Math.max(1, Math.ceil((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24)))

    const room = await req.server.prisma.hotelRoom.findFirst({ where: { id: BigInt(roomId), ...hotelBranchFilter(req.authUser) } })
    if (!room) return reply.status(404).send({ message: 'Kamar tidak ditemukan' })

    // Check room availability
    const conflict = await req.server.prisma.hotelBooking.findFirst({
      where: {
        roomId: BigInt(roomId),
        status: { notIn: ['cancelled', 'checkedout'] },
        checkIn: { lt: co },
        checkOut: { gt: ci },
      },
    })
    if (conflict) return reply.status(409).send({ message: 'Kamar sudah dipesan pada tanggal tersebut' })

    const totalPrice = Number(room.pricePerNight) * totalNights
    const booking = await req.server.prisma.hotelBooking.create({
      data: {
        roomId: BigInt(roomId), patientId: BigInt(patientId), ownerId: BigInt(ownerId),
        branchId, tenantId, checkIn: ci, checkOut: co, totalNights, totalPrice, specialNeeds, notes,
      },
      include: {
        room: { select: { roomName: true, pricePerNight: true } },
        patient: { select: { petName: true } },
        owner: { select: { ownerName: true, phoneNumber: true } },
      },
    })
    return reply.status(201).send({ data: booking })
  })

  app.patch('/pet-hotel/booking/:id/status', { preHandler: [authenticate] }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const { status } = req.body as any
    const existing = await req.server.prisma.hotelBooking.findFirst({ where: { id, ...hotelBranchFilter(req.authUser) } })
    if (!existing) return reply.status(404).send({ message: 'Booking tidak ditemukan' })

    const booking = await req.server.prisma.hotelBooking.update({ where: { id }, data: { status } })
    return reply.send({ data: booking })
  })

  // ── Kasir / bayar ──────────────────────────────────────────────────────────
  app.post('/pet-hotel/kasir/:id', { preHandler: [authenticate, requireRole('admin', 'kasir')] }, async (req: any, reply) => {
    const id = BigInt(req.params.id)
    const { additionalServices = [] } = req.body as any
    const extra = (additionalServices as { name: string; price: number }[]).reduce((s, x) => s + Number(x.price), 0)

    const booking = await req.server.prisma.hotelBooking.findFirst({ where: { id, ...hotelBranchFilter(req.authUser) } })
    if (!booking) return reply.status(404).send({ message: 'Booking tidak ditemukan' })

    const updated = await req.server.prisma.hotelBooking.update({
      where: { id },
      data: { isPaid: true, status: 'checkedout', totalPrice: Number(booking.totalPrice) + extra },
    })
    return reply.send({ data: updated })
  })

  // ── Care log ───────────────────────────────────────────────────────────────
  app.get('/pet-hotel/care-log/:bookingId', { preHandler: [authenticate] }, async (req: any, reply) => {
    const bookingId = BigInt(req.params.bookingId)
    const booking = await req.server.prisma.hotelBooking.findFirst({ where: { id: bookingId, ...hotelBranchFilter(req.authUser) } })
    if (!booking) return reply.status(404).send({ message: 'Booking tidak ditemukan' })

    const logs = await req.server.prisma.hotelCareLog.findMany({
      where: { bookingId },
      include: { staff: { select: { fullname: true } } },
      orderBy: { logDate: 'desc' },
    })
    return reply.send({ data: logs })
  })

  app.post('/pet-hotel/care-log/:bookingId', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { userId } = req.authUser
    const bookingId = BigInt(req.params.bookingId)
    const { logDate, mealNote, drinkNote, activityNote, conditionNote, photoUrl } = req.body as any

    const booking = await req.server.prisma.hotelBooking.findFirst({
      where: { id: bookingId, ...hotelBranchFilter(req.authUser) },
      include: { owner: true, patient: true },
    })
    if (!booking) return reply.status(404).send({ message: 'Booking tidak ditemukan' })

    const log = await req.server.prisma.hotelCareLog.create({
      data: {
        bookingId, staffId: userId, logDate: new Date(logDate),
        mealNote, drinkNote, activityNote, conditionNote, photoUrl,
      },
    })

    // Send WA to owner non-blocking
    const FONNTE_TOKEN = process.env.FONNTE_TOKEN ?? ''
    if (FONNTE_TOKEN && booking.owner.phoneNumber) {
      const phone = booking.owner.phoneNumber.replace(/[^0-9]/g, '').replace(/^0/, '62')
      const msg = `*Update Harian Pet Hotel*\n\nHalo ${booking.owner.ownerName}! Berikut update ${booking.patient.petName} hari ini:\n\n🍽 Makan: ${mealNote ?? '-'}\n💧 Minum: ${drinkNote ?? '-'}\n🏃 Aktivitas: ${activityNote ?? '-'}\n❤️ Kondisi: ${conditionNote ?? '-'}\n\nTerima kasih telah mempercayakan perawatan hewan Anda kepada kami!`
      fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: FONNTE_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: phone, message: msg }),
      }).catch(() => {})
    }

    return reply.status(201).send({ data: log })
  })

  // ── Laporan ────────────────────────────────────────────────────────────────
  app.get('/pet-hotel/laporan', { preHandler: [authenticate, requireRole('admin')] }, async (req: any, reply) => {
    const { branchId } = req.authUser
    const { month, year } = req.query as any
    const m = Number(month ?? new Date().getMonth() + 1)
    const y = Number(year ?? new Date().getFullYear())
    const dateFrom = new Date(y, m - 1, 1)
    const dateTo = new Date(y, m, 0, 23, 59, 59)

    const [bookings, totalRooms] = await Promise.all([
      req.server.prisma.hotelBooking.findMany({
        where: { branchId, checkIn: { gte: dateFrom, lte: dateTo }, status: { not: 'cancelled' } },
        include: { room: { select: { roomName: true, roomType: true } } },
      }),
      req.server.prisma.hotelRoom.count({ where: { branchId, isActive: true } }),
    ])

    const totalRevenue = bookings.filter(b => b.isPaid).reduce((s, b) => s + Number(b.totalPrice), 0)
    const occupancyRate = totalRooms > 0 ? Math.round((bookings.length / totalRooms) * 100) : 0

    return reply.send({
      data: {
        totalBookings: bookings.length, totalRevenue, occupancyRate,
        byType: {
          vip: bookings.filter(b => b.room.roomType === 'vip').length,
          reguler: bookings.filter(b => b.room.roomType === 'reguler').length,
          isolasi: bookings.filter(b => b.room.roomType === 'isolasi').length,
        },
        bookings,
      },
    })
  })
}
