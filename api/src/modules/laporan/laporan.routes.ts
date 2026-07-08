import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/auth'

// ─── helpers ────────────────────────────────────────────────────────────────

function calcPaymentRevenue(payment: any): number {
  const items = (payment.paymentItems ?? []).reduce(
    (s: number, i: any) => s + Number(i.detailItemPatient?.priceOverall ?? 0),
    0,
  )
  const services = (payment.paymentServices ?? []).reduce(
    (s: number, sv: any) => s + Number(sv.detailServicePatient?.priceOverall ?? 0),
    0,
  )
  return items + services - Number(payment.discount ?? 0)
}

const PAYMENT_INCLUDE = {
  paymentMethod: { select: { methodName: true } },
  paymentItems: {
    where: { isDeleted: false },
    include: { detailItemPatient: { select: { priceOverall: true } } },
  },
  paymentServices: {
    where: { isDeleted: false },
    include: { detailServicePatient: { select: { priceOverall: true } } },
  },
  checkUpResult: {
    select: {
      registration: {
        select: {
          branchId: true,
          branch: { select: { branchName: true } },
          patient: {
            select: {
              petName: true,
              owner: { select: { ownerName: true } },
            },
          },
        },
      },
    },
  },
}

// Expense tidak punya tenantId langsung — cuma branchId. Admin dikunci ke
// seluruh cabang di tenant-nya, non-admin dikunci ke cabang sendiri.
function laporanBranchFilter(user: any) {
  return user.role === 'admin'
    ? { branch: { tenantId: BigInt(user.tenantId) } }
    : { branchId: BigInt(user.branchId) }
}

function buildPaymentWhere(branchFilter: any, start: Date, end: Date) {
  return {
    isDeleted: false,
    createdAt: { gte: start, lte: end },
    checkUpResult: { registration: { ...branchFilter } },
  }
}

function buildExpenseWhere(branchFilter: any, start: Date, end: Date) {
  return {
    ...branchFilter,
    isDeleted: false,
    dateSpend: { gte: start, lte: end },
  }
}

function fmt(n: number) {
  return Math.round(n)
}

// ─── routes ─────────────────────────────────────────────────────────────────

export async function laporanRoutes(app: FastifyInstance) {

  // ══════════════════════════════════════════════════════════════════════
  // GET /laporan/harian?date=YYYY-MM-DD
  // Daily P&L: revenue, expenses, profit + breakdowns
  // ══════════════════════════════════════════════════════════════════════
  app.get('/laporan/harian', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = laporanBranchFilter(user)

    const { date } = req.query as any
    const d = date ? new Date(date) : new Date()
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
    const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)

    // Payments of the day
    const payments = await app.prisma.listOfPayment.findMany({
      where: buildPaymentWhere(branchFilter, start, end),
      include: PAYMENT_INCLUDE,
    })

    // Expenses of the day
    const expenses = await app.prisma.expense.findMany({
      where: buildExpenseWhere(branchFilter, start, end),
      include: { spender: { select: { fullname: true } } },
      orderBy: { dateSpend: 'asc' },
    })

    // ── aggregate revenue ──
    const totalRevenue = payments.reduce((s, p) => s + calcPaymentRevenue(p), 0)

    // By payment method
    const byMethod: Record<string, { total: number; count: number }> = {}
    payments.forEach((p) => {
      const method = p.paymentMethod?.methodName ?? 'Tidak diketahui'
      if (!byMethod[method]) byMethod[method] = { total: 0, count: 0 }
      byMethod[method].total += calcPaymentRevenue(p)
      byMethod[method].count++
    })

    // ── aggregate expenses ──
    const totalExpense = expenses.reduce((s, e) => s + Number(e.amountOverall), 0)

    const byCategory: Record<string, { total: number; count: number }> = {}
    expenses.forEach((e) => {
      if (!byCategory[e.category]) byCategory[e.category] = { total: 0, count: 0 }
      byCategory[e.category].total += Number(e.amountOverall)
      byCategory[e.category].count++
    })

    const profit = totalRevenue - totalExpense

    return reply.send({
      data: {
        date: start.toISOString().split('T')[0],
        revenue: {
          total: fmt(totalRevenue),
          count: payments.length,
          byMethod: Object.entries(byMethod).map(([method, v]) => ({ method, ...v, total: fmt(v.total) })),
        },
        expense: {
          total: fmt(totalExpense),
          count: expenses.length,
          byCategory: Object.entries(byCategory).map(([category, v]) => ({ category, ...v, total: fmt(v.total) })),
        },
        profit: fmt(profit),
        profitMargin: totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0',
        transactions: payments.map((p) => ({
          id: p.id,
          createdAt: p.createdAt,
          petName: p.checkUpResult?.registration?.patient?.petName ?? '-',
          ownerName: p.checkUpResult?.registration?.patient?.owner?.ownerName ?? '-',
          paymentMethod: p.paymentMethod?.methodName ?? '-',
          revenue: fmt(calcPaymentRevenue(p)),
          discount: fmt(Number(p.discount)),
        })),
        expenses: expenses.map((e) => ({
          id: e.id,
          dateSpend: e.dateSpend,
          category: e.category,
          itemName: e.itemName,
          quantity: Number(e.quantity),
          amount: Number(e.amount),
          amountOverall: fmt(Number(e.amountOverall)),
          spender: (e as any).spender?.fullname ?? '-',
        })),
      },
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  // GET /laporan/bulanan?month=1-12&year=2025
  // Monthly: per-day breakdown + comparison last month + weekly summary
  // ══════════════════════════════════════════════════════════════════════
  app.get('/laporan/bulanan', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = laporanBranchFilter(user)

    const now = new Date()
    const { month = String(now.getMonth() + 1), year = String(now.getFullYear()) } = req.query as any

    const m = parseInt(month) - 1  // 0-indexed
    const y = parseInt(year)

    const monthStart = new Date(y, m, 1)
    const monthEnd   = new Date(y, m + 1, 0, 23, 59, 59)

    const lastM = m === 0 ? 11 : m - 1
    const lastY = m === 0 ? y - 1 : y
    const lastMonthStart = new Date(lastY, lastM, 1)
    const lastMonthEnd   = new Date(lastY, lastM + 1, 0, 23, 59, 59)

    // Fetch current + last month in parallel
    const [payments, expenses, lastPayments, lastExpenses] = await Promise.all([
      app.prisma.listOfPayment.findMany({
        where: buildPaymentWhere(branchFilter, monthStart, monthEnd),
        include: PAYMENT_INCLUDE,
      }),
      app.prisma.expense.findMany({
        where: buildExpenseWhere(branchFilter, monthStart, monthEnd),
      }),
      app.prisma.listOfPayment.findMany({
        where: buildPaymentWhere(branchFilter, lastMonthStart, lastMonthEnd),
        include: {
          paymentItems: {
            where: { isDeleted: false },
            include: { detailItemPatient: { select: { priceOverall: true } } },
          },
          paymentServices: {
            where: { isDeleted: false },
            include: { detailServicePatient: { select: { priceOverall: true } } },
          },
        },
      }),
      app.prisma.expense.findMany({
        where: buildExpenseWhere(branchFilter, lastMonthStart, lastMonthEnd),
      }),
    ])

    // Current month aggregates
    const totalRevenue = payments.reduce((s, p) => s + calcPaymentRevenue(p), 0)
    const totalExpense = expenses.reduce((s, e) => s + Number(e.amountOverall), 0)
    const profit = totalRevenue - totalExpense

    // Last month aggregates
    const lastRevenue = lastPayments.reduce((s, p) => s + calcPaymentRevenue(p), 0)
    const lastExpense = lastExpenses.reduce((s, e) => s + Number(e.amountOverall), 0)
    const lastProfit  = lastRevenue - lastExpense

    const revenueGrowth = lastRevenue > 0
      ? ((totalRevenue - lastRevenue) / lastRevenue * 100).toFixed(1)
      : null
    const expenseGrowth = lastExpense > 0
      ? ((totalExpense - lastExpense) / lastExpense * 100).toFixed(1)
      : null
    const profitGrowth = lastProfit !== 0
      ? ((profit - lastProfit) / Math.abs(lastProfit) * 100).toFixed(1)
      : null

    // ── Per-day breakdown ──
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const dailyMap: Record<string, { revenue: number; expense: number; transactions: number; expCount: number }> = {}
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      dailyMap[key] = { revenue: 0, expense: 0, transactions: 0, expCount: 0 }
    }

    payments.forEach((p) => {
      const key = p.createdAt.toISOString().split('T')[0]
      if (dailyMap[key]) {
        dailyMap[key].revenue += calcPaymentRevenue(p)
        dailyMap[key].transactions++
      }
    })
    expenses.forEach((e) => {
      const key = e.dateSpend.toISOString().split('T')[0]
      if (dailyMap[key]) {
        dailyMap[key].expense += Number(e.amountOverall)
        dailyMap[key].expCount++
      }
    })

    const daily = Object.entries(dailyMap).map(([date, v]) => ({
      date,
      revenue: fmt(v.revenue),
      expense: fmt(v.expense),
      profit: fmt(v.revenue - v.expense),
      transactions: v.transactions,
    }))

    // ── Weekly summary (weeks of the month) ──
    const weeks: { week: number; dateFrom: string; dateTo: string; revenue: number; expense: number; profit: number }[] = []
    let weekNum = 1
    let cursor = 1
    while (cursor <= daysInMonth) {
      const weekEnd = Math.min(cursor + 6, daysInMonth)
      const fromKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(cursor).padStart(2, '0')}`
      const toKey   = `${y}-${String(m + 1).padStart(2, '0')}-${String(weekEnd).padStart(2, '0')}`
      let wRev = 0, wExp = 0
      for (let d = cursor; d <= weekEnd; d++) {
        const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        wRev += dailyMap[k]?.revenue ?? 0
        wExp += dailyMap[k]?.expense ?? 0
      }
      weeks.push({ week: weekNum, dateFrom: fromKey, dateTo: toKey, revenue: fmt(wRev), expense: fmt(wExp), profit: fmt(wRev - wExp) })
      weekNum++
      cursor += 7
    }

    // ── By payment method ──
    const byMethod: Record<string, number> = {}
    payments.forEach((p) => {
      const method = p.paymentMethod?.methodName ?? 'Tidak diketahui'
      byMethod[method] = (byMethod[method] ?? 0) + calcPaymentRevenue(p)
    })

    // ── By expense category ──
    const byCategory: Record<string, number> = {}
    expenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amountOverall)
    })

    const daysCount = daysInMonth

    return reply.send({
      data: {
        period: { month: m + 1, year: y },
        current: {
          revenue: fmt(totalRevenue),
          expense: fmt(totalExpense),
          profit: fmt(profit),
          transactions: payments.length,
          profitMargin: totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0',
          avgDailyRevenue: fmt(totalRevenue / daysCount),
          avgDailyExpense: fmt(totalExpense / daysCount),
        },
        lastMonth: {
          revenue: fmt(lastRevenue),
          expense: fmt(lastExpense),
          profit: fmt(lastProfit),
          transactions: lastPayments.length,
        },
        growth: { revenue: revenueGrowth, expense: expenseGrowth, profit: profitGrowth },
        byMethod: Object.entries(byMethod).map(([method, total]) => ({ method, total: fmt(total) })),
        byCategory: Object.entries(byCategory).map(([category, total]) => ({ category, total: fmt(total) })),
        daily,
        weekly: weeks,
      },
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  // GET /laporan/rekap?dateFrom=&dateTo=
  // Custom period: full breakdown (revenue + expense + profit)
  // ══════════════════════════════════════════════════════════════════════
  app.get('/laporan/rekap', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = laporanBranchFilter(user)

    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear  = now.getFullYear()

    const { dateFrom, dateTo } = req.query as any
    const start = dateFrom
      ? new Date(dateFrom + 'T00:00:00')
      : new Date(currentYear, currentMonth, 1)
    const end = dateTo
      ? new Date(dateTo + 'T23:59:59')
      : new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)

    const [payments, expenses] = await Promise.all([
      app.prisma.listOfPayment.findMany({
        where: buildPaymentWhere(branchFilter, start, end),
        include: PAYMENT_INCLUDE,
      }),
      app.prisma.expense.findMany({
        where: buildExpenseWhere(branchFilter, start, end),
        include: { spender: { select: { fullname: true } } },
        orderBy: { dateSpend: 'asc' },
      }),
    ])

    const totalRevenue = payments.reduce((s, p) => s + calcPaymentRevenue(p), 0)
    const totalExpense = expenses.reduce((s, e) => s + Number(e.amountOverall), 0)
    const profit = totalRevenue - totalExpense

    // By payment method
    const byMethod: Record<string, { total: number; count: number }> = {}
    payments.forEach((p) => {
      const method = p.paymentMethod?.methodName ?? 'Tidak diketahui'
      if (!byMethod[method]) byMethod[method] = { total: 0, count: 0 }
      byMethod[method].total += calcPaymentRevenue(p)
      byMethod[method].count++
    })

    // By expense category
    const byCategory: Record<string, { total: number; count: number }> = {}
    expenses.forEach((e) => {
      if (!byCategory[e.category]) byCategory[e.category] = { total: 0, count: 0 }
      byCategory[e.category].total += Number(e.amountOverall)
      byCategory[e.category].count++
    })

    // ── Per-month breakdown (in case range spans multiple months) ──
    const monthlyMap: Record<string, { revenue: number; expense: number }> = {}
    payments.forEach((p) => {
      const key = p.createdAt.toISOString().substring(0, 7) // YYYY-MM
      if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, expense: 0 }
      monthlyMap[key].revenue += calcPaymentRevenue(p)
    })
    expenses.forEach((e) => {
      const key = e.dateSpend.toISOString().substring(0, 7)
      if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, expense: 0 }
      monthlyMap[key].expense += Number(e.amountOverall)
    })
    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([yearMonth, v]) => ({
        yearMonth,
        revenue: fmt(v.revenue),
        expense: fmt(v.expense),
        profit: fmt(v.revenue - v.expense),
      }))

    // Days in range (for averages)
    const daysDiff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)

    return reply.send({
      data: {
        period: {
          dateFrom: start.toISOString().split('T')[0],
          dateTo:   end.toISOString().split('T')[0],
          days: daysDiff,
        },
        summary: {
          revenue: fmt(totalRevenue),
          expense: fmt(totalExpense),
          profit: fmt(profit),
          profitMargin: totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0',
          transactions: payments.length,
          avgDailyRevenue: fmt(totalRevenue / daysDiff),
          avgDailyExpense: fmt(totalExpense / daysDiff),
        },
        byMethod: Object.entries(byMethod).map(([method, v]) => ({
          method,
          total: fmt(v.total),
          count: v.count,
          pct: totalRevenue > 0 ? ((v.total / totalRevenue) * 100).toFixed(1) : '0',
        })),
        byCategory: Object.entries(byCategory).map(([category, v]) => ({
          category,
          total: fmt(v.total),
          count: v.count,
          pct: totalExpense > 0 ? ((v.total / totalExpense) * 100).toFixed(1) : '0',
        })),
        monthly,
        expenses: expenses.map((e) => ({
          id: e.id,
          dateSpend: e.dateSpend,
          category: e.category,
          itemName: e.itemName,
          amountOverall: fmt(Number(e.amountOverall)),
          spender: (e as any).spender?.fullname ?? '-',
        })),
        transactions: payments.map((p) => ({
          id: p.id,
          createdAt: p.createdAt,
          petName: p.checkUpResult?.registration?.patient?.petName ?? '-',
          ownerName: p.checkUpResult?.registration?.patient?.owner?.ownerName ?? '-',
          paymentMethod: p.paymentMethod?.methodName ?? '-',
          revenue: fmt(calcPaymentRevenue(p)),
        })),
      },
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  // GET /laporan/ringkasan?year=2025
  // Yearly monthly summary (for overview / rekap tahunan)
  // ══════════════════════════════════════════════════════════════════════
  app.get('/laporan/ringkasan', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as any).authUser
    const branchFilter = laporanBranchFilter(user)
    const { year = String(new Date().getFullYear()) } = req.query as any
    const y = parseInt(year)

    const yearStart = new Date(y, 0, 1)
    const yearEnd   = new Date(y, 11, 31, 23, 59, 59)

    const [payments, expenses] = await Promise.all([
      app.prisma.listOfPayment.findMany({
        where: buildPaymentWhere(branchFilter, yearStart, yearEnd),
        include: {
          paymentItems: {
            where: { isDeleted: false },
            include: { detailItemPatient: { select: { priceOverall: true } } },
          },
          paymentServices: {
            where: { isDeleted: false },
            include: { detailServicePatient: { select: { priceOverall: true } } },
          },
        },
      }),
      app.prisma.expense.findMany({
        where: buildExpenseWhere(branchFilter, yearStart, yearEnd),
        select: { dateSpend: true, amountOverall: true },
      }),
    ])

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(y, i, 1).toLocaleString('id-ID', { month: 'long' }),
      revenue: 0,
      expense: 0,
      profit: 0,
      transactions: 0,
    }))

    payments.forEach((p: any) => {
      const m = new Date(p.createdAt).getMonth()
      months[m].revenue += calcPaymentRevenue(p)
      months[m].transactions++
    })
    expenses.forEach((e) => {
      const m = new Date(e.dateSpend).getMonth()
      months[m].expense += Number(e.amountOverall)
    })
    months.forEach((m) => {
      m.profit = m.revenue - m.expense
      m.revenue = fmt(m.revenue)
      m.expense = fmt(m.expense)
      m.profit = fmt(m.profit)
    })

    const totalRevenue = months.reduce((s, m) => s + m.revenue, 0)
    const totalExpense = months.reduce((s, m) => s + m.expense, 0)

    return reply.send({
      data: {
        year: y,
        summary: {
          revenue: totalRevenue,
          expense: totalExpense,
          profit: totalRevenue - totalExpense,
          transactions: payments.length,
        },
        monthly: months,
      },
    })
  })
}
