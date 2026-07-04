import { useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight,
  Printer, ChevronLeft, ChevronRight, RefreshCw, Calendar,
  DollarSign, ShoppingCart, Receipt, BarChart3, FileDown,
} from 'lucide-react'
import { api } from '@/lib/api'

// ─── Utilities ───────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const fmtShort = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} jt`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} rb`
  return String(n)
}

const today = () => new Date().toISOString().split('T')[0]

const MONTH_NAMES = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
]

// ─── Shared Components ────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color, growth,
}: {
  label: string; value: string | number; sub?: string
  icon: any; color: string; growth?: string | null
}) {
  const growthNum = growth != null ? parseFloat(growth) : null
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      {growthNum != null && (
        <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${growthNum > 0 ? 'text-green-600' : growthNum < 0 ? 'text-red-500' : 'text-gray-400'}`}>
          {growthNum > 0 ? <ArrowUpRight size={13} /> : growthNum < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
          {growthNum > 0 ? '+' : ''}{growth}% vs bulan lalu
        </div>
      )}
    </div>
  )
}

function ProfitBadge({ profit, margin }: { profit: number; margin: string }) {
  const isProfit = profit >= 0
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${isProfit ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
      {isProfit ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
      {isProfit ? 'Laba' : 'Rugi'} {fmt(Math.abs(profit))} ({margin}%)
    </div>
  )
}

function BarChart({ data, valueKey, labelKey }: { data: any[]; valueKey: string; labelKey: string }) {
  if (!data?.length) return <p className="text-sm text-gray-400 text-center py-6">Tidak ada data</p>
  const max = Math.max(...data.map((d) => Math.abs(d[valueKey])), 1)
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const val = d[valueKey]
        const pct = Math.abs(val / max) * 100
        const neg = val < 0
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-20 shrink-0 text-right truncate">{d[labelKey]}</span>
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${neg ? 'bg-red-400' : 'bg-indigo-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-700 w-28 shrink-0">{fmtShort(val)}</span>
          </div>
        )
      })}
    </div>
  )
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    'Tunai': 'bg-green-100 text-green-700',
    'Cash': 'bg-green-100 text-green-700',
    'Transfer': 'bg-blue-100 text-blue-700',
    'QRIS': 'bg-purple-100 text-purple-700',
    'Debit': 'bg-orange-100 text-orange-700',
    'Kredit': 'bg-pink-100 text-pink-700',
  }
  const cls = colors[method] ?? 'bg-gray-100 text-gray-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{method}</span>
}

const CATEGORY_COLORS: Record<string, string> = {
  'Operasional': 'bg-blue-100 text-blue-700',
  'Obat & Supplies': 'bg-green-100 text-green-700',
  'Gaji & SDM': 'bg-purple-100 text-purple-700',
  'Perawatan Alat': 'bg-orange-100 text-orange-700',
  'Marketing & Promosi': 'bg-pink-100 text-pink-700',
  'Sewa & Utilitas': 'bg-yellow-100 text-yellow-700',
  'Lain-lain': 'bg-gray-100 text-gray-600',
}

function CategoryBadge({ cat }: { cat: string }) {
  const cls = CATEGORY_COLORS[cat] ?? 'bg-gray-100 text-gray-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{cat}</span>
}

function PrintBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded-lg transition"
    >
      <Printer size={15} /> Cetak
    </button>
  )
}

async function downloadExcel(type: 'harian' | 'bulanan', date: string) {
  const res = await api.get('/export/laporan', { params: { type, date }, responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = `laporan-${type}-${date}.xlsx`; a.click()
  URL.revokeObjectURL(url)
}


function ExcelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition">
      <FileDown size={15} /> Excel
    </button>
  )
}

// ─── TAB: Harian ─────────────────────────────────────────────────────────────

function HarianTab() {
  const [date, setDate] = useState(today())
  const printRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['laporan-harian', date],
    queryFn: () => api.get(`/laporan/harian?date=${date}`).then((r: any) => r.data.data),
  })

  const prevDay = () => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    setDate(d.toISOString().split('T')[0])
  }
  const nextDay = () => {
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    const t = new Date(today())
    if (d <= t) setDate(d.toISOString().split('T')[0])
  }

  const handlePrint = () => {
    const content = printRef.current?.innerHTML
    const w = window.open('', '_blank')
    if (!w || !content) return
    w.document.write(`
      <html><head><title>Laporan Harian ${date}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
        th { background: #f5f5f5; font-weight: bold; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 14px; margin: 12px 0 6px; }
        .sum { font-weight: bold; font-size: 13px; }
        .right { text-align: right; }
        .green { color: #16a34a; }
        .red { color: #dc2626; }
      </style></head><body>${content}</body></html>
    `)
    w.document.close()
    w.print()
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevDay} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronLeft size={16} />
          </button>
          <div className="relative">
            <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date" value={date} max={today()}
              onChange={(e) => setDate(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button onClick={nextDay} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50" disabled={date === today()}>
            <ChevronRight size={16} />
          </button>
          <button onClick={() => refetch()} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        {data && (
          <div className="flex items-center gap-2">
            <PrintBtn onClick={handlePrint} />
            <ExcelBtn onClick={() => downloadExcel('harian', date)} />
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      )}

      {data && (
        <>
          {/* Printable content */}
          <div ref={printRef} id="print-area">
            {/* Print header (hidden on screen) */}
            <div className="hidden print:block mb-4">
              <h1 className="text-xl font-bold">Laporan Keuangan Harian</h1>
              <p className="text-gray-600">{fmtDate(date)}</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Omzet" value={fmtShort(data.revenue.total)} sub={`${data.revenue.count} transaksi`} icon={DollarSign} color="bg-indigo-500" />
              <StatCard label="Pengeluaran" value={fmtShort(data.expense.total)} sub={`${data.expense.count} item`} icon={ShoppingCart} color="bg-rose-500" />
              <StatCard label="Laba / Rugi" value={fmtShort(data.profit)} sub={`Margin ${data.profitMargin}%`} icon={TrendingUp} color={data.profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'} />
              <StatCard label="Transaksi" value={data.revenue.count} sub={fmtDate(date)} icon={Receipt} color="bg-violet-500" />
            </div>

            {/* Profit Summary */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Ringkasan {fmtDate(date)}</h3>
              <div className="flex flex-wrap gap-6 items-center">
                <div>
                  <p className="text-xs text-gray-400">Total Omzet</p>
                  <p className="text-lg font-bold text-indigo-600">{fmt(data.revenue.total)}</p>
                </div>
                <div className="text-gray-300 text-2xl font-light">−</div>
                <div>
                  <p className="text-xs text-gray-400">Total Pengeluaran</p>
                  <p className="text-lg font-bold text-rose-600">{fmt(data.expense.total)}</p>
                </div>
                <div className="text-gray-300 text-2xl font-light">=</div>
                <div>
                  <ProfitBadge profit={data.profit} margin={data.profitMargin} />
                </div>
              </div>
            </div>

            {/* Revenue by method + Expense by category */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Omzet per Metode Bayar</h3>
                {data.revenue.byMethod.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">Belum ada transaksi</p>
                ) : (
                  <div className="space-y-2">
                    {data.revenue.byMethod.map((m: any) => (
                      <div key={m.method} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                        <div className="flex items-center gap-2">
                          <MethodBadge method={m.method} />
                          <span className="text-xs text-gray-400">{m.count}x</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{fmt(m.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Pengeluaran per Kategori</h3>
                {data.expense.byCategory.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">Belum ada pengeluaran</p>
                ) : (
                  <div className="space-y-2">
                    {data.expense.byCategory.map((c: any) => (
                      <div key={c.category} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                        <div className="flex items-center gap-2">
                          <CategoryBadge cat={c.category} />
                          <span className="text-xs text-gray-400">{c.count}x</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{fmt(c.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Transactions list */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Daftar Transaksi ({data.transactions.length})</h3>
              {data.transactions.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Belum ada transaksi hari ini</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Waktu</th>
                        <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Pasien</th>
                        <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Pemilik</th>
                        <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Metode</th>
                        <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Diskon</th>
                        <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.transactions.map((t: any) => (
                        <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-500">
                            {new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2 px-3 font-medium">{t.petName}</td>
                          <td className="py-2 px-3 text-gray-600">{t.ownerName}</td>
                          <td className="py-2 px-3"><MethodBadge method={t.paymentMethod} /></td>
                          <td className="py-2 px-3 text-rose-500">{t.discount > 0 ? `-${fmt(t.discount)}` : '-'}</td>
                          <td className="py-2 px-3 text-right font-semibold text-indigo-700">{fmt(t.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50">
                        <td colSpan={5} className="py-2 px-3 text-sm font-semibold">Total</td>
                        <td className="py-2 px-3 text-right text-sm font-bold text-indigo-700">{fmt(data.revenue.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Expenses list */}
            {data.expenses.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Daftar Pengeluaran ({data.expenses.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Kategori</th>
                        <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Nama Item</th>
                        <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Qty × Harga</th>
                        <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Dicatat oleh</th>
                        <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.expenses.map((e: any) => (
                        <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-3"><CategoryBadge cat={e.category} /></td>
                          <td className="py-2 px-3 font-medium">{e.itemName}</td>
                          <td className="py-2 px-3 text-gray-500">{e.quantity} × {fmt(e.amount)}</td>
                          <td className="py-2 px-3 text-gray-500">{e.spender}</td>
                          <td className="py-2 px-3 text-right font-semibold text-rose-600">{fmt(e.amountOverall)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50">
                        <td colSpan={4} className="py-2 px-3 text-sm font-semibold">Total Pengeluaran</td>
                        <td className="py-2 px-3 text-right text-sm font-bold text-rose-600">{fmt(data.expense.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── TAB: Bulanan ─────────────────────────────────────────────────────────────

function BulananTab() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [view, setView] = useState<'harian' | 'mingguan'>('harian')
  const printRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['laporan-bulanan', month, year],
    queryFn: () => api.get(`/laporan/bulanan?month=${month}&year=${year}`).then((r: any) => r.data.data),
  })

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    const next = month === 12 ? { m: 1, y: year + 1 } : { m: month + 1, y: year }
    if (next.y < now.getFullYear() || (next.y === now.getFullYear() && next.m <= now.getMonth() + 1)) {
      setMonth(next.m); setYear(next.y)
    }
  }

  const handlePrint = () => {
    const content = printRef.current?.innerHTML
    const w = window.open('', '_blank')
    if (!w || !content) return
    w.document.write(`<html><head><title>Laporan Bulanan ${MONTH_NAMES[month-1]} ${year}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #ddd;padding:5px 8px}th{background:#f5f5f5}h1{font-size:16px}h2{font-size:13px;margin:12px 0 4px}</style>
      </head><body>${content}</body></html>`)
    w.document.close(); w.print()
  }

  const growthColor = (g: string | null) => {
    if (!g) return 'text-gray-400'
    const n = parseFloat(g)
    return n > 0 ? 'text-green-600' : n < 0 ? 'text-red-500' : 'text-gray-400'
  }
  const growthIcon = (g: string | null) => {
    if (!g) return null
    const n = parseFloat(g)
    if (n > 0) return <ArrowUpRight size={12} />
    if (n < 0) return <ArrowDownRight size={12} />
    return <Minus size={12} />
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-gray-700 min-w-[140px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronRight size={16} /></button>
          <button onClick={() => refetch()} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['harian', 'mingguan'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition ${view === v ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {v}
              </button>
            ))}
          </div>
          {data && (
            <div className="flex items-center gap-2">
              <PrintBtn onClick={handlePrint} />
              <ExcelBtn onClick={() => downloadExcel('bulanan', `${year}-${String(month).padStart(2, '0')}-01`)} />
            </div>
          )}
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>}

      {data && (
        <div ref={printRef} className="space-y-5">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="Omzet Bulan Ini" value={fmtShort(data.current.revenue)}
              sub={`${data.current.transactions} transaksi`} icon={DollarSign} color="bg-indigo-500"
              growth={data.growth.revenue} />
            <StatCard label="Pengeluaran" value={fmtShort(data.current.expense)}
              sub={`Rata-rata ${fmtShort(data.current.avgDailyExpense)}/hari`} icon={ShoppingCart} color="bg-rose-500"
              growth={data.growth.expense} />
            <StatCard label="Laba / Rugi" value={fmtShort(data.current.profit)}
              sub={`Margin ${data.current.profitMargin}%`} icon={TrendingUp} color={data.current.profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}
              growth={data.growth.profit} />
          </div>

          {/* Comparison */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Perbandingan dengan Bulan Lalu</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Metrik</th>
                    <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">{MONTH_NAMES[month - 1]} {year}</th>
                    <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Bulan Lalu</th>
                    <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Perubahan</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Omzet', curr: data.current.revenue, last: data.lastMonth.revenue, growth: data.growth.revenue },
                    { label: 'Pengeluaran', curr: data.current.expense, last: data.lastMonth.expense, growth: data.growth.expense },
                    { label: 'Laba/Rugi', curr: data.current.profit, last: data.lastMonth.profit, growth: data.growth.profit },
                    { label: 'Transaksi', curr: data.current.transactions, last: data.lastMonth.transactions, growth: null, isCount: true },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-gray-50">
                      <td className="py-2.5 px-3 font-medium">{row.label}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-indigo-700">
                        {row.isCount ? row.curr : fmt(row.curr)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-500">
                        {row.isCount ? row.last : fmt(row.last)}
                      </td>
                      <td className={`py-2.5 px-3 text-right text-xs font-medium ${growthColor(row.growth)}`}>
                        <span className="flex items-center justify-end gap-0.5">
                          {growthIcon(row.growth)}
                          {row.growth != null ? `${parseFloat(row.growth) > 0 ? '+' : ''}${row.growth}%` : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart: Per hari / Per minggu */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              {view === 'harian' ? 'Trend Harian' : 'Rekap Mingguan'} — {MONTH_NAMES[month - 1]} {year}
            </h3>

            {view === 'harian' ? (
              <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                {data.daily.map((d: any) => {
                  const isToday = d.date === today()
                  return (
                    <div key={d.date} className={`grid grid-cols-[80px_1fr_1fr_1fr_80px] gap-2 items-center py-1.5 px-2 rounded-lg ${isToday ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                      <span className={`text-xs font-medium ${isToday ? 'text-indigo-600' : 'text-gray-500'}`}>
                        {new Date(d.date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                      </span>
                      {/* Revenue bar */}
                      <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                        {d.revenue > 0 && (
                          <div
                            className="h-full bg-indigo-400 rounded-full"
                            style={{ width: `${Math.min(100, (d.revenue / Math.max(...data.daily.map((x: any) => x.revenue), 1)) * 100)}%` }}
                          />
                        )}
                      </div>
                      {/* Expense bar */}
                      <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                        {d.expense > 0 && (
                          <div
                            className="h-full bg-rose-400 rounded-full"
                            style={{ width: `${Math.min(100, (d.expense / Math.max(...data.daily.map((x: any) => x.expense), 1)) * 100)}%` }}
                          />
                        )}
                      </div>
                      {/* Profit bar */}
                      <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                        {d.profit !== 0 && (
                          <div
                            className={`h-full rounded-full ${d.profit >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                            style={{ width: `${Math.min(100, (Math.abs(d.profit) / Math.max(...data.daily.map((x: any) => Math.abs(x.profit)), 1)) * 100)}%` }}
                          />
                        )}
                      </div>
                      <span className={`text-xs text-right font-semibold ${d.transactions > 0 ? 'text-indigo-700' : 'text-gray-300'}`}>
                        {d.transactions > 0 ? `${d.transactions}tx` : '-'}
                      </span>
                    </div>
                  )
                })}
                {/* Legend */}
                <div className="flex gap-4 mt-2 pt-2 border-t border-gray-100">
                  {[['Omzet', 'bg-indigo-400'], ['Pengeluaran', 'bg-rose-400'], ['Laba/Rugi', 'bg-emerald-400']].map(([l, c]) => (
                    <div key={l} className="flex items-center gap-1.5 text-xs text-gray-500">
                      <div className={`w-3 h-3 rounded-sm ${c}`} /> {l}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Minggu</th>
                      <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Periode</th>
                      <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Omzet</th>
                      <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Pengeluaran</th>
                      <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Laba/Rugi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.weekly.map((w: any) => (
                      <tr key={w.week} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-medium">Minggu {w.week}</td>
                        <td className="py-2.5 px-3 text-gray-500 text-xs">
                          {new Date(w.dateFrom + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} –{' '}
                          {new Date(w.dateTo + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-indigo-700">{fmt(w.revenue)}</td>
                        <td className="py-2.5 px-3 text-right text-rose-600">{fmt(w.expense)}</td>
                        <td className={`py-2.5 px-3 text-right font-semibold ${w.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {w.profit >= 0 ? '+' : ''}{fmt(w.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td colSpan={2} className="py-2 px-3">Total {MONTH_NAMES[month - 1]}</td>
                      <td className="py-2 px-3 text-right text-indigo-700">{fmt(data.current.revenue)}</td>
                      <td className="py-2 px-3 text-right text-rose-600">{fmt(data.current.expense)}</td>
                      <td className={`py-2 px-3 text-right ${data.current.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {fmt(data.current.profit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* By method & category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Omzet per Metode Bayar</h3>
              <BarChart data={data.byMethod} valueKey="total" labelKey="method" />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Pengeluaran per Kategori</h3>
              <BarChart data={data.byCategory} valueKey="total" labelKey="category" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB: Rekap ───────────────────────────────────────────────────────────────

function RekapTab() {
  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(today())
  const [submitted, setSubmitted] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['laporan-rekap', dateFrom, dateTo, submitted],
    queryFn: () => api.get(`/laporan/rekap?dateFrom=${dateFrom}&dateTo=${dateTo}`).then((r: any) => r.data.data),
    enabled: submitted,
  })

  const handlePrint = () => {
    const content = printRef.current?.innerHTML
    const w = window.open('', '_blank')
    if (!w || !content) return
    w.document.write(`<html><head><title>Laporan Rekap ${dateFrom} s/d ${dateTo}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #ddd;padding:5px 8px}th{background:#f5f5f5}h1{font-size:16px}h2{font-size:13px;margin:12px 0 4px}</style>
      </head><body>${content}</body></html>`)
    w.document.close(); w.print()
  }

  const fmtDateRange = () => {
    const f = new Date(dateFrom + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    const t = new Date(dateTo + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    return `${f} – ${t}`
  }

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Dari Tanggal</label>
            <input type="date" value={dateFrom} max={dateTo}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Sampai Tanggal</label>
            <input type="date" value={dateTo} min={dateFrom} max={today()}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <button
            onClick={() => { setSubmitted(true); refetch() }}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition flex items-center gap-2"
          >
            <BarChart3 size={14} /> Tampilkan
          </button>
          {/* Quick ranges */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: '7 Hari', days: 7 },
              { label: '30 Hari', days: 30 },
              { label: '90 Hari', days: 90 },
            ].map(({ label, days }) => (
              <button key={label}
                onClick={() => {
                  const t = today()
                  const f = new Date(t)
                  f.setDate(f.getDate() - days + 1)
                  setDateFrom(f.toISOString().split('T')[0])
                  setDateTo(t)
                  setSubmitted(true)
                }}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>}

      {data && (
        <div ref={printRef} className="space-y-5">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-5 text-white">
            <p className="text-indigo-200 text-xs uppercase tracking-wide">Laporan Rekap</p>
            <h2 className="text-lg font-bold mt-1">{fmtDateRange()}</h2>
            <p className="text-indigo-200 text-sm mt-0.5">{data.period.days} hari • {data.summary.transactions} transaksi</p>
          </div>

          {/* Summary KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Omzet" value={fmtShort(data.summary.revenue)} sub={`${data.summary.transactions} transaksi`} icon={DollarSign} color="bg-indigo-500" />
            <StatCard label="Total Pengeluaran" value={fmtShort(data.summary.expense)} sub={`Rata-rata ${fmtShort(data.summary.avgDailyExpense)}/hari`} icon={ShoppingCart} color="bg-rose-500" />
            <StatCard label="Laba / Rugi" value={fmtShort(data.summary.profit)} sub={`Margin ${data.summary.profitMargin}%`} icon={TrendingUp} color={data.summary.profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'} />
            <StatCard label="Rata-rata Harian" value={fmtShort(data.summary.avgDailyRevenue)} sub={`${data.period.days} hari periode`} icon={BarChart3} color="bg-violet-500" />
          </div>

          {/* P&L Box */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Laporan Laba Rugi</h3>
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Total Pendapatan (Omzet)</span>
                <span className="text-sm font-semibold text-indigo-700">{fmt(data.summary.revenue)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Total Pengeluaran</span>
                <span className="text-sm font-semibold text-rose-600">({fmt(data.summary.expense)})</span>
              </div>
              <div className={`flex justify-between py-3 px-3 rounded-lg ${data.summary.profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <span className="text-sm font-bold">Laba / Rugi Bersih</span>
                <span className={`text-sm font-bold ${data.summary.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {data.summary.profit >= 0 ? '' : '('}{fmt(Math.abs(data.summary.profit))}{data.summary.profit < 0 ? ')' : ''}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-xs text-gray-400">Profit Margin</span>
                <span className="text-xs font-medium text-gray-600">{data.summary.profitMargin}%</span>
              </div>
            </div>
          </div>

          {/* Monthly breakdown (if multi-month) */}
          {data.monthly.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Rekap per Bulan</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Bulan</th>
                      <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Omzet</th>
                      <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Pengeluaran</th>
                      <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Laba/Rugi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.map((m: any) => {
                      const [y, mn] = m.yearMonth.split('-')
                      return (
                        <tr key={m.yearMonth} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-medium">{MONTH_NAMES[parseInt(mn) - 1]} {y}</td>
                          <td className="py-2.5 px-3 text-right text-indigo-700">{fmt(m.revenue)}</td>
                          <td className="py-2.5 px-3 text-right text-rose-600">{fmt(m.expense)}</td>
                          <td className={`py-2.5 px-3 text-right font-semibold ${m.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {m.profit >= 0 ? '+' : ''}{fmt(m.profit)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Breakdown columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* By payment method */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Omzet per Metode Pembayaran</h3>
              {data.byMethod.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Belum ada data</p>
              ) : (
                <div className="space-y-3">
                  {data.byMethod.map((m: any) => (
                    <div key={m.method}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <MethodBadge method={m.method} />
                          <span className="text-xs text-gray-400">{m.count}x</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-800">{fmt(m.total)}</span>
                          <span className="text-xs text-gray-400 ml-1">({m.pct}%)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${m.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By expense category */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Pengeluaran per Kategori</h3>
              {data.byCategory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Belum ada data</p>
              ) : (
                <div className="space-y-3">
                  {data.byCategory.map((c: any) => (
                    <div key={c.category}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <CategoryBadge cat={c.category} />
                          <span className="text-xs text-gray-400">{c.count}x</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-800">{fmt(c.total)}</span>
                          <span className="text-xs text-gray-400 ml-1">({c.pct}%)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-400 rounded-full" style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Detail transactions */}
          {data.transactions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Detail Transaksi ({data.transactions.length})</h3>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Tanggal</th>
                      <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Pasien</th>
                      <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Pemilik</th>
                      <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Metode</th>
                      <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((t: any) => (
                      <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-500 text-xs">
                          {new Date(t.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="py-2 px-3 font-medium">{t.petName}</td>
                        <td className="py-2 px-3 text-gray-600">{t.ownerName}</td>
                        <td className="py-2 px-3"><MethodBadge method={t.paymentMethod} /></td>
                        <td className="py-2 px-3 text-right font-semibold text-indigo-700">{fmt(t.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <PrintBtn onClick={handlePrint} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Harian',   path: '/laporan/harian' },
  { label: 'Bulanan',  path: '/laporan/bulanan' },
  { label: 'Mingguan', path: '/laporan/mingguan' },
  { label: 'Rekap',    path: '/laporan/rekap' },
]

export default function LaporanPage() {
  const location = useLocation()
  const navigate = useNavigate()

  // Mingguan → render same as Bulanan
  const activeTab = location.pathname.startsWith('/laporan/mingguan')
    ? '/laporan/bulanan'
    : TABS.find((t) => location.pathname.startsWith(t.path))?.path ?? '/laporan/harian'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Keuangan</h1>
          <p className="text-sm text-gray-500 mt-0.5">Analisis pendapatan, pengeluaran, dan laba/rugi klinik</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 gap-0">
        {TABS.map((tab) => {
          const isActive = tab.path === activeTab || (tab.path === '/laporan/bulanan' && location.pathname === '/laporan/mingguan')
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div>
        {(activeTab === '/laporan/harian') && <HarianTab />}
        {(activeTab === '/laporan/bulanan' || location.pathname === '/laporan/mingguan') && <BulananTab />}
        {(activeTab === '/laporan/rekap') && <RekapTab />}
      </div>
    </div>
  )
}
