import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Receipt, TrendingDown, TrendingUp, Calendar, Tag,
  Plus, Search, Edit2, Trash2, X, ChevronLeft, ChevronRight,
  AlertCircle, ArrowDown, ArrowUp,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Operasional', 'Obat & Supplies', 'Gaji & SDM',
  'Perawatan Alat', 'Marketing & Promosi', 'Sewa & Utilitas', 'Lain-lain',
] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_COLORS: Record<string, string> = {
  'Operasional':         'bg-blue-100 text-blue-700',
  'Obat & Supplies':     'bg-emerald-100 text-emerald-700',
  'Gaji & SDM':          'bg-violet-100 text-violet-700',
  'Perawatan Alat':      'bg-orange-100 text-orange-700',
  'Marketing & Promosi': 'bg-pink-100 text-pink-700',
  'Sewa & Utilitas':     'bg-sky-100 text-sky-700',
  'Lain-lain':           'bg-gray-100 text-gray-600',
}

interface Expense {
  id: string
  dateSpend: string
  category: string
  itemName: string
  notes?: string
  quantity: string
  amount: string
  amountOverall: string
  spender: { fullname: string }
  createdAt: string
}

interface Stats {
  today: { total: number; count: number }
  thisMonth: { total: number; count: number }
  lastMonth: { total: number }
  growthPct: string | null
  byCategory: { category: string; total: number; count: number; pct: string }[]
}

const fmt = (n: number | string) =>
  Number(n).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

// ─── Form Modal ───────────────────────────────────────────────────────────────

function ExpenseModal({
  editing, onClose, onSuccess,
}: { editing?: Expense | null; onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    dateSpend:  editing?.dateSpend ? editing.dateSpend.split('T')[0] : new Date().toISOString().split('T')[0],
    category:   (editing?.category ?? 'Operasional') as Category,
    itemName:   editing?.itemName ?? '',
    notes:      editing?.notes ?? '',
    quantity:   editing ? String(Number(editing.quantity)) : '1',
    amount:     editing ? String(Number(editing.amount)) : '',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (body: any) =>
      editing ? api.put(`/pengeluaran/${editing.id}`, body) : api.post('/pengeluaran', body),
    onSuccess,
    onError: (e: any) => setError(e.response?.data?.message ?? 'Terjadi kesalahan.'),
  })

  const total = form.quantity && form.amount
    ? Number(form.quantity) * Number(form.amount) : 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.itemName.trim()) return setError('Nama item wajib diisi.')
    if (!form.quantity || Number(form.quantity) <= 0) return setError('Jumlah harus lebih dari 0.')
    if (!form.amount || Number(form.amount) <= 0) return setError('Harga satuan harus lebih dari 0.')
    mutation.mutate(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-display font-semibold text-gray-900">
            {editing ? 'Edit Pengeluaran' : 'Catat Pengeluaran'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tanggal *</label>
              <input className="input w-full" type="date" value={form.dateSpend}
                onChange={e => setForm(f => ({ ...f, dateSpend: e.target.value }))} />
            </div>
            <div>
              <label className="label">Kategori *</label>
              <select className="input w-full" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Nama Item / Keterangan *</label>
            <input className="input w-full" value={form.itemName}
              onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))}
              placeholder="Beli deterjen, bayar listrik, dll..." />
          </div>

          <div>
            <label className="label">Catatan</label>
            <textarea className="input w-full resize-none" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Opsional..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Jumlah / Qty *</label>
              <input className="input w-full" type="number" min="0.01" step="0.01"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="1" />
            </div>
            <div>
              <label className="label">Harga Satuan (Rp) *</label>
              <input className="input w-full" type="number" min="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0" />
            </div>
          </div>

          {/* Preview total */}
          {total > 0 && (
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
              <span className="text-sm text-red-700">Total Pengeluaran</span>
              <span className="font-bold text-red-700 text-lg">{fmt(total)}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Batal</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Menyimpan...' : editing ? 'Simpan' : 'Catat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Confirm Delete ───────────────────────────────────────────────────────────

function ConfirmDelete({
  item, onCancel, onConfirm, loading,
}: { item: Expense; onCancel: () => void; onConfirm: () => void; loading?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <p className="font-semibold text-gray-900 mb-1">Hapus Pengeluaran?</p>
        <p className="text-sm text-gray-500 mb-4">
          <b>{item.itemName}</b> — {fmt(item.amountOverall)}<br />
          Tindakan ini tidak dapat dibatalkan.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary flex-1">Batal</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? 'Menghapus...' : 'Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsSection({ stats }: { stats: Stats }) {
  const isUp = stats.growthPct !== null && Number(stats.growthPct) > 0

  return (
    <div className="grid md:grid-cols-4 gap-4 mb-6">
      {/* Hari ini */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-red-50"><Receipt className="w-4 h-4 text-red-600" /></div>
        </div>
        <p className="text-2xl font-bold text-gray-900">{fmt(stats.today.total)}</p>
        <p className="text-xs text-gray-400 mt-0.5">Pengeluaran Hari Ini · {stats.today.count} item</p>
      </div>

      {/* Bulan ini */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-orange-50"><Calendar className="w-4 h-4 text-orange-600" /></div>
        </div>
        <p className="text-2xl font-bold text-gray-900">{fmt(stats.thisMonth.total)}</p>
        <p className="text-xs text-gray-400 mt-0.5">Bulan Ini · {stats.thisMonth.count} item</p>
      </div>

      {/* Bulan lalu */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-gray-100"><TrendingDown className="w-4 h-4 text-gray-500" /></div>
        </div>
        <p className="text-2xl font-bold text-gray-900">{fmt(stats.lastMonth.total)}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <p className="text-xs text-gray-400">Bulan Lalu</p>
          {stats.growthPct !== null && (
            <span className={cn('flex items-center text-xs font-semibold', isUp ? 'text-red-500' : 'text-emerald-500')}>
              {isUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {Math.abs(Number(stats.growthPct))}%
            </span>
          )}
        </div>
      </div>

      {/* Top kategori */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-violet-50"><Tag className="w-4 h-4 text-violet-600" /></div>
        </div>
        {stats.byCategory[0] ? (
          <>
            <p className="text-sm font-bold text-gray-900 truncate">{stats.byCategory[0].category}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {fmt(stats.byCategory[0].total)} · {stats.byCategory[0].pct}% bulan ini
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-400">Belum ada data</p>
        )}
        <p className="text-[10px] text-gray-300 mt-0.5">Kategori terbesar</p>
      </div>
    </div>
  )
}

// ─── Category Breakdown ───────────────────────────────────────────────────────

function CategoryBreakdown({ stats }: { stats: Stats }) {
  if (!stats.byCategory.length) return null
  const total = stats.thisMonth.total

  return (
    <div className="card p-5 mb-6">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">Breakdown Kategori — Bulan Ini</h3>
      <div className="space-y-3">
        {stats.byCategory.map(cat => (
          <div key={cat.category}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', CATEGORY_COLORS[cat.category] ?? 'bg-gray-100 text-gray-600')}>
                  {cat.category}
                </span>
                <span className="text-xs text-gray-400">{cat.count} item</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900">{fmt(cat.total)}</span>
                <span className="text-xs text-gray-400 ml-1">({cat.pct}%)</span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-red-400 transition-all"
                style={{ width: `${cat.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function PengeluaranPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState<Expense | null>(null)

  // Default filter: bulan ini
  const nowStr = new Date().toISOString().split('T')[0]
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  const { data: statsData } = useQuery<{ data: Stats }>({
    queryKey: ['pengeluaran-stats'],
    queryFn: () => api.get('/pengeluaran/stats').then(r => r.data),
  })

  const { data, isLoading } = useQuery<{
    data: Expense[]; total: number; page: number; limit: number; totalAmount: number
  }>({
    queryKey: ['pengeluaran', q, category, dateFrom, dateTo, page],
    queryFn: () => api.get('/pengeluaran', {
      params: { q, category, dateFrom: dateFrom || firstOfMonth, dateTo: dateTo || nowStr, page, limit: 20 },
    }).then(r => r.data),
    placeholderData: (prev: any) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/pengeluaran/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pengeluaran'] })
      qc.invalidateQueries({ queryKey: ['pengeluaran-stats'] })
      setDeleting(null)
    },
  })

  const totalPages = Math.ceil((data?.total ?? 0) / 20)

  const handleSuccess = () => {
    qc.invalidateQueries({ queryKey: ['pengeluaran'] })
    qc.invalidateQueries({ queryKey: ['pengeluaran-stats'] })
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    setShowForm(false)
    setEditing(null)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-display font-bold text-gray-900">Pengeluaran</h1>
        <p className="text-sm text-gray-400 mt-0.5">Catat dan pantau semua pengeluaran operasional klinik</p>
      </div>

      {/* Stats */}
      {statsData?.data && <StatsSection stats={statsData.data} />}

      {/* Category Breakdown */}
      {statsData?.data && <CategoryBreakdown stats={statsData.data} />}

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Cari nama item..."
            value={q} onChange={e => { setQ(e.target.value); setPage(1) }} />
        </div>
        <select className="input w-44" value={category}
          onChange={e => { setCategory(e.target.value); setPage(1) }}>
          <option value="">Semua Kategori</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="input w-36" type="date" value={dateFrom || firstOfMonth}
          onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          title="Dari tanggal" />
        <input className="input w-36" type="date" value={dateTo || nowStr}
          onChange={e => { setDateTo(e.target.value); setPage(1) }}
          title="Sampai tanggal" />
        <button
          onClick={() => { setShowForm(true); setEditing(null) }}
          className="btn-primary flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Catat Pengeluaran
        </button>
      </div>

      {/* Total filtered */}
      {data && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500">
            {data.total} item ditemukan
          </span>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg">
            <span className="text-xs text-red-600">Total periode:</span>
            <span className="text-sm font-bold text-red-700">{fmt(data.totalAmount)}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kategori</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Item</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Harga Satuan</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pencatat</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : !data?.data.length ? (
                <tr>
                  <td colSpan={8} className="text-center py-14">
                    <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400">Belum ada data pengeluaran.</p>
                    <button onClick={() => setShowForm(true)}
                      className="mt-3 btn-primary text-sm">
                      + Catat Sekarang
                    </button>
                  </td>
                </tr>
              ) : data.data.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                    {format(new Date(item.dateSpend), 'd MMM yyyy', { locale: localeId })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', CATEGORY_COLORS[item.category] ?? 'bg-gray-100 text-gray-600')}>
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.itemName}</p>
                    {item.notes && <p className="text-xs text-gray-400 truncate max-w-48">{item.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {Number(item.quantity).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {fmt(item.amount)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">
                    {fmt(item.amountOverall)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {item.spender.fullname}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditing(item); setShowForm(true) }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleting(item)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              {data?.total} item — Hal {page}/{totalPages}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <ExpenseModal
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSuccess={handleSuccess}
        />
      )}
      {deleting && (
        <ConfirmDelete
          item={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
