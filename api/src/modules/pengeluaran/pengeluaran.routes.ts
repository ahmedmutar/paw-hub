import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../middleware/auth'

export const EXPENSE_CATEGORIES = [
  'Operasional',
  'Obat & Supplies',
  'Gaji & SDM',
  'Perawatan Alat',
  'Marketing & Promosi',
  'Sewa & Utilitas',
  'Lain-lain',
] as const

export async function pengeluaranRoutes(app: FastifyInstance) {

  // ─── Stats ──────────────────────────────────────────────────────────────────
  app.get('/pengeluaran/stats', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = user.role === 'admin' ? {} : { branchId: BigInt(user.branchId) }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    const [thisMonth, lastMonth, today, byCategory] = await Promise.all([
      // Total bulan ini
      app.prisma.expense.aggregate({
        where: { ...branchFilter, isDeleted: false, dateSpend: { gte: monthStart, lte: monthEnd } },
        _sum: { amountOverall: true },
        _count: { id: true },
      }),
      // Total bulan lalu
      app.prisma.expense.aggregate({
        where: { ...branchFilter, isDeleted: false, dateSpend: { gte: lastMonthStart, lte: lastMonthEnd } },
        _sum: { amountOverall: true },
      }),
      // Hari ini
      app.prisma.expense.aggregate({
        where: { ...branchFilter, isDeleted: false, dateSpend: { gte: todayStart, lte: todayEnd } },
        _sum: { amountOverall: true },
        _count: { id: true },
      }),
      // Per kategori bulan ini
      app.prisma.expense.groupBy({
        by: ['category'],
        where: { ...branchFilter, isDeleted: false, dateSpend: { gte: monthStart, lte: monthEnd } },
        _sum: { amountOverall: true },
        _count: { id: true },
        orderBy: { _sum: { amountOverall: 'desc' } },
      }),
    ])

    const thisMonthTotal = Number(thisMonth._sum.amountOverall ?? 0)
    const lastMonthTotal = Number(lastMonth._sum.amountOverall ?? 0)
    const growthPct = lastMonthTotal > 0
      ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(1)
      : null

    return reply.send({
      data: {
        today: { total: Number(today._sum.amountOverall ?? 0), count: today._count.id },
        thisMonth: { total: thisMonthTotal, count: thisMonth._count.id },
        lastMonth: { total: lastMonthTotal },
        growthPct,
        byCategory: byCategory.map(c => ({
          category: c.category,
          total: Number(c._sum.amountOverall ?? 0),
          count: c._count.id,
          pct: thisMonthTotal > 0
            ? ((Number(c._sum.amountOverall ?? 0) / thisMonthTotal) * 100).toFixed(1)
            : '0',
        })),
      },
    })
  })

  // ─── List ────────────────────────────────────────────────────────────────────
  app.get('/pengeluaran', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = user.role === 'admin' ? {} : { branchId: BigInt(user.branchId) }
    const { q = '', category, dateFrom, dateTo, page = '1', limit = '20' } = req.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = {
      ...branchFilter,
      isDeleted: false,
      ...(q ? { itemName: { contains: q, mode: 'insensitive' } } : {}),
      ...(category ? { category } : {}),
    }

    if (dateFrom || dateTo) {
      where.dateSpend = {}
      if (dateFrom) where.dateSpend.gte = new Date(dateFrom)
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59)
        where.dateSpend.lte = end
      }
    }

    const [data, total, aggregate] = await Promise.all([
      app.prisma.expense.findMany({
        where,
        include: { spender: { select: { fullname: true } } },
        orderBy: { dateSpend: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      app.prisma.expense.count({ where }),
      app.prisma.expense.aggregate({
        where,
        _sum: { amountOverall: true },
      }),
    ])

    return reply.send({
      data,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalAmount: Number(aggregate._sum.amountOverall ?? 0),
    })
  })

  // ─── Create ──────────────────────────────────────────────────────────────────
  app.post('/pengeluaran', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const { dateSpend, category, itemName, notes, quantity, amount, branchId } = req.body as any

    if (!itemName?.trim()) return reply.status(400).send({ message: 'Nama item wajib diisi.' })
    if (!quantity || parseFloat(quantity) <= 0) return reply.status(400).send({ message: 'Jumlah harus lebih dari 0.' })
    if (!amount || parseFloat(amount) <= 0) return reply.status(400).send({ message: 'Harga satuan harus lebih dari 0.' })

    const qty = parseFloat(quantity)
    const amt = parseFloat(amount)
    const targetBranchId = user.role === 'admin' ? BigInt(branchId ?? user.branchId) : BigInt(user.branchId)

    const data = await app.prisma.expense.create({
      data: {
        dateSpend: dateSpend ? new Date(dateSpend) : new Date(),
        userIdSpender: BigInt(user.userId),
        branchId: targetBranchId,
        category: category || 'Lain-lain',
        itemName: itemName.trim(),
        notes: notes?.trim() || null,
        quantity: qty,
        amount: amt,
        amountOverall: qty * amt,
        userId: BigInt(user.userId),
      },
      include: { spender: { select: { fullname: true } } },
    })

    return reply.status(201).send({ data })
  })

  // ─── Update ──────────────────────────────────────────────────────────────────
  app.put('/pengeluaran/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const { dateSpend, category, itemName, notes, quantity, amount } = req.body as any

    const existing = await app.prisma.expense.findUnique({ where: { id: BigInt(id) } })
    if (!existing || existing.isDeleted) return reply.status(404).send({ message: 'Data tidak ditemukan.' })

    const qty = quantity != null ? parseFloat(quantity) : Number(existing.quantity)
    const amt = amount != null ? parseFloat(amount) : Number(existing.amount)

    const data = await app.prisma.expense.update({
      where: { id: BigInt(id) },
      data: {
        dateSpend: dateSpend ? new Date(dateSpend) : existing.dateSpend,
        category: category || existing.category,
        itemName: itemName?.trim() ?? existing.itemName,
        notes: notes?.trim() ?? existing.notes,
        quantity: qty,
        amount: amt,
        amountOverall: qty * amt,
      },
      include: { spender: { select: { fullname: true } } },
    })

    return reply.send({ data })
  })

  // ─── Delete ──────────────────────────────────────────────────────────────────
  app.delete('/pengeluaran/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const existing = await app.prisma.expense.findUnique({ where: { id: BigInt(id) } })
    if (!existing || existing.isDeleted) return reply.status(404).send({ message: 'Data tidak ditemukan.' })

    await app.prisma.expense.update({
      where: { id: BigInt(id) },
      data: { isDeleted: true, deletedAt: new Date() },
    })
    return reply.send({ message: 'Data pengeluaran dihapus.' })
  })

  // ─── Rekap bulanan (untuk laporan) ───────────────────────────────────────────
  app.get('/pengeluaran/rekap-bulanan', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = user.role === 'admin' ? {} : { branchId: BigInt(user.branchId) }
    const { year = new Date().getFullYear().toString() } = req.query as any

    const data = await app.prisma.expense.groupBy({
      by: ['category'],
      where: {
        ...branchFilter,
        isDeleted: false,
        dateSpend: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31T23:59:59`),
        },
      },
      _sum: { amountOverall: true },
      _count: { id: true },
    })

    // Per bulan breakdown
    const monthly = await Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        const start = new Date(`${year}-${String(m).padStart(2, '0')}-01`)
        const end = new Date(parseInt(year), m, 0, 23, 59, 59)
        return app.prisma.expense.aggregate({
          where: { ...branchFilter, isDeleted: false, dateSpend: { gte: start, lte: end } },
          _sum: { amountOverall: true },
          _count: { id: true },
        }).then(r => ({ month: m, total: Number(r._sum.amountOverall ?? 0), count: r._count.id }))
      })
    )

    return reply.send({
      data: {
        byCategory: data.map(d => ({ category: d.category, total: Number(d._sum.amountOverall ?? 0), count: d._count.id })),
        monthly,
      },
    })
  })

  // ─── Categories list ─────────────────────────────────────────────────────────
  app.get('/pengeluaran/categories', { preHandler: [authenticate] }, async (_req, reply) => {
    return reply.send({ data: EXPENSE_CATEGORIES })
  })
}
