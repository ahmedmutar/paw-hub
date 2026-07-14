import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Package, AlertTriangle, TrendingDown, Tag, Ruler,
  Plus, Search, Edit2, Trash2, ChevronLeft, ChevronRight,
  ArrowUpCircle, ArrowDownCircle, RefreshCw, History,
  ToggleLeft, ToggleRight, DollarSign, X, ChevronDown, Clock,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryItem {
  id: string; categoryName: string; branchId: string
  _count?: { listOfItems: number }
}
interface UnitItem {
  id: string; unitName: string; branchId: string
  _count?: { listOfItems: number }
}
interface PriceItem {
  id: string; sellingPrice: string; capitalPrice: string; doctorFee: string
  isDeleted: boolean; createdAt: string
}
interface ListOfItem {
  id: string; itemName: string; description?: string
  totalItem: string; limitItem?: string; expiredDate?: string
  isActive: boolean; isDeleted: boolean; createdAt: string; updatedAt: string
  unitItemId: string; categoryItemId: string; branchId: string
  unitItem: UnitItem
  categoryItem: CategoryItem
  priceItems: PriceItem[]
}
interface StockMovement {
  id: string; listOfItemId: string; quantity: string; status: string
  notes?: string; userId: string; createdAt: string
  listOfItem: ListOfItem & { unitItem: UnitItem; categoryItem: CategoryItem }
}
interface Stats {
  totalItems: number; lowStock: number; outOfStock: number
  totalCategories: number; totalUnits: number; recentMovements: number
  nearExpiry: number
}

const fmt = (n: string | number) =>
  Number(n).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

const fmtNum = (n: string | number) => Number(n).toLocaleString('id-ID')

// ─── Mini Components ─────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {[
        { label: 'Total Barang',     value: stats.totalItems,       icon: Package,       color: 'text-primary-600',  bg: 'bg-primary-50' },
        { label: 'Stok Minim',       value: stats.lowStock,         icon: TrendingDown,  color: 'text-amber-600',    bg: 'bg-amber-50' },
        { label: 'Stok Habis',       value: stats.outOfStock,       icon: AlertTriangle, color: 'text-red-600',      bg: 'bg-red-50' },
        { label: 'Kategori',         value: stats.totalCategories,  icon: Tag,           color: 'text-violet-600',   bg: 'bg-violet-50' },
        { label: 'Satuan',           value: stats.totalUnits,       icon: Ruler,         color: 'text-sky-600',      bg: 'bg-sky-50' },
        { label: 'Mutasi (7 hari)',  value: stats.recentMovements,  icon: RefreshCw,     color: 'text-emerald-600',  bg: 'bg-emerald-50' },
      ].map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn('p-1.5 rounded-lg', bg)}>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-400 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

function ConfirmModal({
  message, onConfirm, onCancel, loading,
}: { message: string; onConfirm: () => void; onCancel: () => void; loading?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <p className="text-gray-800 mb-4">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-secondary">Batal</button>
          <button onClick={onConfirm} className="btn-danger" disabled={loading}>
            {loading ? 'Menghapus...' : 'Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: Stok Barang ─────────────────────────────────────────────────────────

function BarangTab() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ListOfItem | null>(null)
  const [showMutasi, setShowMutasi] = useState<ListOfItem | null>(null)
  const [showHarga, setShowHarga] = useState<ListOfItem | null>(null)
  const [showHargaHistory, setShowHargaHistory] = useState<ListOfItem | null>(null)
  const [deleting, setDeleting] = useState<ListOfItem | null>(null)

  const { data: kategoris } = useQuery<{ data: CategoryItem[] }>({
    queryKey: ['gudang-kategori'],
    queryFn: () => api.get('/gudang/kategori').then(r => r.data),
  })

  const { data, isLoading } = useQuery<{ data: ListOfItem[]; total: number; page: number; limit: number }>({
    queryKey: ['gudang-barang', q, categoryId, status, page],
    queryFn: () => api.get('/gudang/barang', { params: { q, categoryId, status, page, limit: 20 } }).then(r => r.data),
    placeholderData: (prev: any) => prev,
  })

  const toggleMutation = useMutation({
    mutationFn: (item: ListOfItem) =>
      api.put(`/gudang/barang/${item.id}`, { isActive: !item.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gudang-barang'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/gudang/barang/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gudang-barang'] })
      qc.invalidateQueries({ queryKey: ['gudang-stats'] })
      setDeleting(null)
    },
  })

  const totalPages = Math.ceil((data?.total ?? 0) / 20)

  const getStockStatus = (item: ListOfItem) => {
    const total = Number(item.totalItem)
    const limit = item.limitItem ? Number(item.limitItem) : null
    if (total <= 0) return { label: 'Habis', cls: 'badge-danger' }
    if (limit !== null && total <= limit) return { label: 'Minim', cls: 'badge-warning' }
    return { label: 'Tersedia', cls: 'badge-success' }
  }

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Cari nama barang…"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1) }}
          />
        </div>
        <select
          className="input w-44"
          value={categoryId}
          onChange={e => { setCategoryId(e.target.value); setPage(1) }}
        >
          <option value="">Semua Kategori</option>
          {kategoris?.data.map(k => <option key={k.id} value={k.id}>{k.categoryName}</option>)}
        </select>
        <select
          className="input w-36"
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
        >
          <option value="">Semua Status</option>
          <option value="low">Stok Minim</option>
          <option value="out">Stok Habis</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
        <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Tambah Barang
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nama Barang</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kategori</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stok</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Satuan</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Harga Jual</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Modal</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : !data?.data.length ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Belum ada data barang.</td></tr>
              ) : data.data.map(item => {
                const stockSt = getStockStatus(item)
                const latestPrice = item.priceItems[0]
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.itemName}</div>
                      {item.description && <div className="text-xs text-gray-400 truncate max-w-48">{item.description}</div>}
                      {item.expiredDate && (
                        <div className="text-xs text-amber-600">
                          Exp: {format(new Date(item.expiredDate), 'd MMM yyyy', { locale: localeId })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.categoryItem.categoryName}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-semibold', Number(item.totalItem) <= 0 ? 'text-red-600' : Number(item.limitItem) && Number(item.totalItem) <= Number(item.limitItem) ? 'text-amber-600' : 'text-gray-900')}>
                        {fmtNum(item.totalItem)}
                      </span>
                      {item.limitItem && (
                        <div className="text-xs text-gray-400">min {fmtNum(item.limitItem)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.unitItem.unitName}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {latestPrice ? fmt(latestPrice.sellingPrice) : <span className="text-gray-400 text-xs">Belum diset</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {latestPrice ? fmt(latestPrice.capitalPrice) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('badge text-xs', stockSt.cls)}>{stockSt.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setShowMutasi(item)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500"
                          title="Mutasi Stok"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setShowHarga(item)}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-green-600"
                          title="Update Harga"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setShowHargaHistory(item)}
                          className="p-1.5 rounded-lg hover:bg-violet-50 text-violet-600"
                          title="Riwayat Harga"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleMutation.mutate(item)}
                          className={cn('p-1.5 rounded-lg', item.isActive ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-green-50 text-green-600')}
                          title={item.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          {item.isActive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => { setEditing(item); setShowForm(true) }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleting(item)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              Total {data?.total} barang — Hal {page} / {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <BarangFormModal
          editing={editing}
          kategoris={kategoris?.data ?? []}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['gudang-barang'] })
            qc.invalidateQueries({ queryKey: ['gudang-stats'] })
            setShowForm(false); setEditing(null)
          }}
        />
      )}
      {showMutasi && (
        <MutasiStokModal
          item={showMutasi}
          onClose={() => setShowMutasi(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['gudang-barang'] })
            qc.invalidateQueries({ queryKey: ['gudang-stats'] })
            qc.invalidateQueries({ queryKey: ['gudang-mutasi'] })
            setShowMutasi(null)
          }}
        />
      )}
      {showHarga && (
        <HargaModal
          item={showHarga}
          onClose={() => setShowHarga(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['gudang-barang'] })
            setShowHarga(null)
          }}
        />
      )}
      {showHargaHistory && (
        <HargaHistoryModal
          item={showHargaHistory}
          onClose={() => setShowHargaHistory(null)}
        />
      )}
      {deleting && (
        <ConfirmModal
          message={`Hapus barang "${deleting.itemName}"? Tindakan ini tidak dapat dibatalkan.`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  )
}

// ─── Barang Form Modal ────────────────────────────────────────────────────────

function BarangFormModal({
  editing, kategoris, onClose, onSuccess,
}: {
  editing: ListOfItem | null
  kategoris: CategoryItem[]
  onClose: () => void
  onSuccess: () => void
}) {
  const { data: satuans } = useQuery<{ data: UnitItem[] }>({
    queryKey: ['gudang-satuan'],
    queryFn: () => api.get('/gudang/satuan').then(r => r.data),
  })
  const { data: branches } = useQuery<{ data: any[] }>({
    queryKey: ['cabang'],
    queryFn: () => api.get('/cabang').then(r => r.data),
  })
  const { user } = useAuthStore()

  const [form, setForm] = useState({
    itemName: editing?.itemName ?? '',
    description: editing?.description ?? '',
    limitItem: editing?.limitItem ?? '',
    expiredDate: editing?.expiredDate ? editing.expiredDate.split('T')[0] : '',
    unitItemId: editing?.unitItemId ?? '',
    categoryItemId: editing?.categoryItemId ?? '',
    branchId: editing?.branchId ?? user?.branchId ?? '',
    sellingPrice: editing?.priceItems[0]?.sellingPrice ?? '',
    capitalPrice: editing?.priceItems[0]?.capitalPrice ?? '',
    doctorFee: editing?.priceItems[0]?.doctorFee ?? '0',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (body: any) =>
      editing
        ? api.put(`/gudang/barang/${editing.id}`, body)
        : api.post('/gudang/barang', body),
    onSuccess,
    onError: (e: any) => setError(e.response?.data?.message ?? 'Terjadi kesalahan.'),
  })

  const margin = form.sellingPrice && form.capitalPrice
    ? Number(form.sellingPrice) - Number(form.capitalPrice)
    : null
  const marginPct = margin !== null && Number(form.capitalPrice) > 0
    ? ((margin / Number(form.capitalPrice)) * 100).toFixed(1)
    : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.itemName.trim()) return setError('Nama barang wajib diisi.')
    if (!form.unitItemId) return setError('Satuan wajib dipilih.')
    if (!form.categoryItemId) return setError('Kategori wajib dipilih.')
    mutation.mutate(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl my-8 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-display font-semibold text-gray-900">
            {editing ? 'Edit Barang' : 'Tambah Barang'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

          <div>
            <label className="label">Nama Barang *</label>
            <input className="input w-full" value={form.itemName}
              onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} placeholder="Amoxicillin 500mg" />
          </div>

          <div>
            <label className="label">Deskripsi</label>
            <textarea className="input w-full resize-none" rows={2} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Opsional..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kategori *</label>
              <select className="input w-full" value={form.categoryItemId}
                onChange={e => setForm(f => ({ ...f, categoryItemId: e.target.value }))}>
                <option value="">Pilih kategori</option>
                {kategoris.map(k => <option key={k.id} value={k.id}>{k.categoryName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Satuan *</label>
              <select className="input w-full" value={form.unitItemId}
                onChange={e => setForm(f => ({ ...f, unitItemId: e.target.value }))}>
                <option value="">Pilih satuan</option>
                {satuans?.data.map(s => <option key={s.id} value={s.id}>{s.unitName}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Stok Minimum</label>
              <input className="input w-full" type="number" min="0" value={form.limitItem}
                onChange={e => setForm(f => ({ ...f, limitItem: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="label">Tgl Kadaluarsa</label>
              <input className="input w-full" type="date" value={form.expiredDate}
                onChange={e => setForm(f => ({ ...f, expiredDate: e.target.value }))} />
            </div>
          </div>

          {user?.role === 'admin' && branches?.data && (
            <div>
              <label className="label">Cabang</label>
              <select className="input w-full" value={form.branchId}
                onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}>
                {branches.data.map((b: any) => <option key={b.id} value={b.id}>{b.branchName}</option>)}
              </select>
            </div>
          )}

          {!editing && (
            <>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-700 mb-3">Harga Awal (Opsional)</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Harga Jual (Rp)</label>
                  <input className="input w-full" type="number" min="0" value={form.sellingPrice}
                    onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label className="label">Harga Modal (Rp)</label>
                  <input className="input w-full" type="number" min="0" value={form.capitalPrice}
                    onChange={e => setForm(f => ({ ...f, capitalPrice: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="label">Jasa Dokter (Rp)</label>
                <input className="input w-full" type="number" min="0" value={form.doctorFee}
                  onChange={e => setForm(f => ({ ...f, doctorFee: e.target.value }))} placeholder="0" />
              </div>
              {margin !== null && (
                <div className="flex gap-3 text-sm">
                  <span className="text-gray-500">Margin:</span>
                  <span className={cn('font-semibold', margin >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {fmt(margin)} ({marginPct}%)
                  </span>
                </div>
              )}
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Batal</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Menyimpan...' : editing ? 'Simpan' : 'Tambah'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Mutasi Stok Modal ────────────────────────────────────────────────────────

function MutasiStokModal({ item, onClose, onSuccess }: {
  item: ListOfItem; onClose: () => void; onSuccess: () => void
}) {
  const [form, setForm] = useState({ status: 'masuk', quantity: '', notes: '' })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (body: any) => api.post('/gudang/mutasi', body),
    onSuccess,
    onError: (e: any) => setError(e.response?.data?.message ?? 'Terjadi kesalahan.'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.quantity || Number(form.quantity) <= 0) return setError('Jumlah harus lebih dari 0.')
    mutation.mutate({ listOfItemId: item.id, ...form, quantity: Number(form.quantity) })
  }

  const isAdjust = form.status === 'adjustment'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-display font-semibold text-gray-900">Mutasi Stok</h2>
            <p className="text-sm text-gray-400">{item.itemName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            {[
              { val: 'masuk', label: 'Stok Masuk', icon: ArrowUpCircle, color: 'text-green-600' },
              { val: 'keluar', label: 'Stok Keluar', icon: ArrowDownCircle, color: 'text-red-600' },
              { val: 'adjustment', label: 'Penyesuaian', icon: RefreshCw, color: 'text-blue-600' },
            ].map(({ val, label, icon: Icon, color }) => (
              <button
                key={val}
                type="button"
                onClick={() => setForm(f => ({ ...f, status: val }))}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all',
                  form.status === val ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', form.status === val && color)} />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-sm text-gray-500">Stok saat ini</span>
            <span className="font-bold text-gray-900">
              {fmtNum(item.totalItem)} {item.unitItem.unitName}
            </span>
          </div>

          <div>
            <label className="label">
              {isAdjust ? 'Stok Baru (Set Langsung)' : 'Jumlah'} *
            </label>
            <div className="flex gap-2 items-center">
              <input
                className="input flex-1"
                type="number"
                min="0"
                step="0.01"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder={isAdjust ? 'Jumlah stok aktual' : '0'}
              />
              <span className="text-sm text-gray-500 whitespace-nowrap">{item.unitItem.unitName}</span>
            </div>
            {!isAdjust && form.quantity && (
              <p className="text-xs text-gray-400 mt-1">
                Stok setelah: {fmtNum(
                  form.status === 'masuk'
                    ? Number(item.totalItem) + Number(form.quantity)
                    : Number(item.totalItem) - Number(form.quantity)
                )} {item.unitItem.unitName}
              </p>
            )}
            {isAdjust && form.quantity && (
              <p className="text-xs text-gray-400 mt-1">
                Perubahan: {Number(form.quantity) >= Number(item.totalItem) ? '+' : ''}
                {fmtNum(Number(form.quantity) - Number(item.totalItem))} {item.unitItem.unitName}
              </p>
            )}
          </div>

          <div>
            <label className="label">Catatan</label>
            <input className="input w-full" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Opsional..." />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Batal</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Memproses...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Harga Modal ─────────────────────────────────────────────────────────────

function HargaModal({ item, onClose, onSuccess }: {
  item: ListOfItem; onClose: () => void; onSuccess: () => void
}) {
  const latest = item.priceItems[0]
  const [form, setForm] = useState({
    sellingPrice: latest?.sellingPrice ?? '',
    capitalPrice: latest?.capitalPrice ?? '',
    doctorFee: latest?.doctorFee ?? '0',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (body: any) => api.post(`/gudang/barang/${item.id}/harga`, body),
    onSuccess,
    onError: (e: any) => setError(e.response?.data?.message ?? 'Terjadi kesalahan.'),
  })

  const margin = form.sellingPrice && form.capitalPrice
    ? Number(form.sellingPrice) - Number(form.capitalPrice) : null
  const marginPct = margin !== null && Number(form.capitalPrice) > 0
    ? ((margin / Number(form.capitalPrice)) * 100).toFixed(1) : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.sellingPrice || !form.capitalPrice) return setError('Harga jual dan modal wajib diisi.')
    mutation.mutate(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-display font-semibold text-gray-900">Update Harga</h2>
            <p className="text-sm text-gray-400 truncate max-w-48">{item.itemName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
          <div>
            <label className="label">Harga Jual (Rp) *</label>
            <input className="input w-full" type="number" min="0" value={form.sellingPrice}
              onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} />
          </div>
          <div>
            <label className="label">Harga Modal (Rp) *</label>
            <input className="input w-full" type="number" min="0" value={form.capitalPrice}
              onChange={e => setForm(f => ({ ...f, capitalPrice: e.target.value }))} />
          </div>
          <div>
            <label className="label">Jasa Dokter (Rp)</label>
            <input className="input w-full" type="number" min="0" value={form.doctorFee}
              onChange={e => setForm(f => ({ ...f, doctorFee: e.target.value }))} />
          </div>
          {margin !== null && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
              <span className="text-gray-500">Margin:</span>
              <span className={cn('font-semibold', margin >= 0 ? 'text-green-600' : 'text-red-600')}>
                {fmt(margin)} ({marginPct}%)
              </span>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Batal</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Menyimpan...' : 'Update Harga'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Harga History Modal ──────────────────────────────────────────────────────

function HargaHistoryModal({ item, onClose }: { item: ListOfItem; onClose: () => void }) {
  const { data } = useQuery<{ data: PriceItem[] }>({
    queryKey: ['harga-history', item.id],
    queryFn: () => api.get(`/gudang/barang/${item.id}/harga/riwayat`).then(r => r.data),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-display font-semibold text-gray-900">Riwayat Harga</h2>
            <p className="text-sm text-gray-400 truncate max-w-64">{item.itemName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {!data?.data.length ? (
            <p className="text-gray-400 text-center py-8">Belum ada riwayat harga.</p>
          ) : data.data.map((p, i) => (
            <div key={p.id} className={cn('p-4 rounded-xl border', i === 0 && !p.isDeleted ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50')}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">
                  {format(new Date(p.createdAt), 'd MMM yyyy HH:mm', { locale: localeId })}
                </span>
                {i === 0 && !p.isDeleted
                  ? <span className="badge badge-success text-xs">Aktif</span>
                  : <span className="badge badge-secondary text-xs">Lama</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-xs text-gray-400">Jual</p><p className="font-semibold">{fmt(p.sellingPrice)}</p></div>
                <div><p className="text-xs text-gray-400">Modal</p><p className="font-semibold">{fmt(p.capitalPrice)}</p></div>
                <div><p className="text-xs text-gray-400">Fee Dokter</p><p className="font-semibold">{fmt(p.doctorFee)}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── TAB: Mutasi Stok ─────────────────────────────────────────────────────────

function MutasiTab() {
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<{ data: StockMovement[]; total: number }>({
    queryKey: ['gudang-mutasi', status, dateFrom, dateTo, page],
    queryFn: () =>
      api.get('/gudang/mutasi', { params: { status, dateFrom, dateTo, page, limit: 30 } }).then(r => r.data),
    placeholderData: (prev: any) => prev,
  })

  const statusConfig: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    masuk:      { label: 'Masuk',       cls: 'badge-success', icon: ArrowUpCircle },
    keluar:     { label: 'Keluar',      cls: 'badge-danger',  icon: ArrowDownCircle },
    adjustment: { label: 'Penyesuaian', cls: 'badge-primary', icon: RefreshCw },
  }

  const totalPages = Math.ceil((data?.total ?? 0) / 30)

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select className="input w-40" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
          <option value="">Semua Jenis</option>
          <option value="masuk">Stok Masuk</option>
          <option value="keluar">Stok Keluar</option>
          <option value="adjustment">Penyesuaian</option>
        </select>
        <input className="input w-36" type="date" value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          placeholder="Dari tanggal" title="Dari tanggal" />
        <input className="input w-36" type="date" value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1) }}
          placeholder="Sampai tanggal" title="Sampai tanggal" />
        {(dateFrom || dateTo || status) && (
          <button onClick={() => { setStatus(''); setDateFrom(''); setDateTo(''); setPage(1) }}
            className="btn-secondary">Reset Filter</button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Waktu</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Barang</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Jenis</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Jumlah</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : !data?.data.length ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">Belum ada data mutasi.</td></tr>
              ) : data.data.map(m => {
                const cfg = statusConfig[m.status]
                const Icon = cfg?.icon ?? RefreshCw
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {format(new Date(m.createdAt), 'd MMM yyyy HH:mm', { locale: localeId })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{m.listOfItem.itemName}</div>
                      <div className="text-xs text-gray-400">{m.listOfItem.categoryItem.categoryName}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('badge text-xs inline-flex items-center gap-1', cfg?.cls)}>
                        <Icon className="w-3 h-3" />
                        {cfg?.label}
                      </span>
                    </td>
                    <td className={cn('px-4 py-3 text-right font-semibold',
                      m.status === 'masuk' ? 'text-green-600' : m.status === 'keluar' ? 'text-red-600' : 'text-blue-600'
                    )}>
                      {m.status === 'masuk' ? '+' : m.status === 'keluar' ? '-' : '='}
                      {fmtNum(m.quantity)} {m.listOfItem.unitItem.unitName}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.notes ?? '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">Total {data?.total} mutasi — Hal {page}/{totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB: Kategori & Satuan ───────────────────────────────────────────────────

function MasterDataTab() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [catForm, setCatForm] = useState({ open: false, editing: null as CategoryItem | null, name: '', error: '' })
  const [unitForm, setUnitForm] = useState({ open: false, editing: null as UnitItem | null, name: '', error: '' })
  const [deletingCat, setDeletingCat] = useState<CategoryItem | null>(null)
  const [deletingUnit, setDeletingUnit] = useState<UnitItem | null>(null)

  const { data: kategoris, isLoading: loadKat } = useQuery<{ data: CategoryItem[] }>({
    queryKey: ['gudang-kategori'],
    queryFn: () => api.get('/gudang/kategori').then(r => r.data),
  })
  const { data: satuans, isLoading: loadSat } = useQuery<{ data: UnitItem[] }>({
    queryKey: ['gudang-satuan'],
    queryFn: () => api.get('/gudang/satuan').then(r => r.data),
  })

  const catMutation = useMutation({
    mutationFn: (body: any) =>
      catForm.editing
        ? api.put(`/gudang/kategori/${catForm.editing.id}`, body)
        : api.post('/gudang/kategori', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gudang-kategori'] })
      qc.invalidateQueries({ queryKey: ['gudang-stats'] })
      setCatForm({ open: false, editing: null, name: '', error: '' })
    },
    onError: (e: any) => setCatForm(f => ({ ...f, error: e.response?.data?.message ?? 'Gagal.' })),
  })

  const catDeleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/gudang/kategori/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gudang-kategori'] })
      qc.invalidateQueries({ queryKey: ['gudang-stats'] })
      setDeletingCat(null)
    },
  })

  const unitMutation = useMutation({
    mutationFn: (body: any) =>
      unitForm.editing
        ? api.put(`/gudang/satuan/${unitForm.editing.id}`, body)
        : api.post('/gudang/satuan', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gudang-satuan'] })
      qc.invalidateQueries({ queryKey: ['gudang-stats'] })
      setUnitForm({ open: false, editing: null, name: '', error: '' })
    },
    onError: (e: any) => setUnitForm(f => ({ ...f, error: e.response?.data?.message ?? 'Gagal.' })),
  })

  const unitDeleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/gudang/satuan/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gudang-satuan'] })
      qc.invalidateQueries({ queryKey: ['gudang-stats'] })
      setDeletingUnit(null)
    },
  })

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Kategori */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-violet-600" />
            <h3 className="font-semibold text-gray-900">Kategori Barang</h3>
          </div>
          <button
            onClick={() => setCatForm({ open: true, editing: null, name: '', error: '' })}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah
          </button>
        </div>

        {catForm.open && (
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            {catForm.error && <p className="text-xs text-red-600 mb-2">{catForm.error}</p>}
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                value={catForm.name}
                onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nama kategori…"
                onKeyDown={e => e.key === 'Enter' && catMutation.mutate({ categoryName: catForm.name, branchId: user?.branchId })}
                autoFocus
              />
              <button
                onClick={() => catMutation.mutate({ categoryName: catForm.name, branchId: user?.branchId })}
                className="btn-primary text-sm px-3" disabled={catMutation.isPending || !catForm.name.trim()}
              >
                {catForm.editing ? 'Simpan' : 'Tambah'}
              </button>
              <button onClick={() => setCatForm({ open: false, editing: null, name: '', error: '' })}
                className="btn-secondary text-sm px-3">Batal</button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-50">
          {loadKat ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></div>
            ))
          ) : !kategoris?.data.length ? (
            <p className="text-gray-400 text-sm text-center py-8">Belum ada kategori.</p>
          ) : kategoris.data.map(k => (
            <div key={k.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-900">{k.categoryName}</p>
                <p className="text-xs text-gray-400">{k._count?.listOfItems ?? 0} barang</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setCatForm({ open: true, editing: k, name: k.categoryName, error: '' })}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeletingCat(k)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Satuan */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-sky-600" />
            <h3 className="font-semibold text-gray-900">Satuan Barang</h3>
          </div>
          <button
            onClick={() => setUnitForm({ open: true, editing: null, name: '', error: '' })}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah
          </button>
        </div>

        {unitForm.open && (
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            {unitForm.error && <p className="text-xs text-red-600 mb-2">{unitForm.error}</p>}
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                value={unitForm.name}
                onChange={e => setUnitForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nama satuan (Tablet, Botol, dll)…"
                onKeyDown={e => e.key === 'Enter' && unitMutation.mutate({ unitName: unitForm.name, branchId: user?.branchId })}
                autoFocus
              />
              <button
                onClick={() => unitMutation.mutate({ unitName: unitForm.name, branchId: user?.branchId })}
                className="btn-primary text-sm px-3" disabled={unitMutation.isPending || !unitForm.name.trim()}
              >
                {unitForm.editing ? 'Simpan' : 'Tambah'}
              </button>
              <button onClick={() => setUnitForm({ open: false, editing: null, name: '', error: '' })}
                className="btn-secondary text-sm px-3">Batal</button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-50">
          {loadSat ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></div>
            ))
          ) : !satuans?.data.length ? (
            <p className="text-gray-400 text-sm text-center py-8">Belum ada satuan.</p>
          ) : satuans.data.map(s => (
            <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-900">{s.unitName}</p>
                <p className="text-xs text-gray-400">{s._count?.listOfItems ?? 0} barang</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setUnitForm({ open: true, editing: s, name: s.unitName, error: '' })}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeletingUnit(s)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {deletingCat && (
        <ConfirmModal
          message={`Hapus kategori "${deletingCat.categoryName}"?`}
          onCancel={() => setDeletingCat(null)}
          onConfirm={() => catDeleteMutation.mutate(deletingCat.id)}
          loading={catDeleteMutation.isPending}
        />
      )}
      {deletingUnit && (
        <ConfirmModal
          message={`Hapus satuan "${deletingUnit.unitName}"?`}
          onCancel={() => setDeletingUnit(null)}
          onConfirm={() => unitDeleteMutation.mutate(deletingUnit.id)}
          loading={unitDeleteMutation.isPending}
        />
      )}
    </div>
  )
}

// ─── TAB: Stok Minim ─────────────────────────────────────────────────────────

function LowStockTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<{ data: ListOfItem[] }>({
    queryKey: ['gudang-low-stock'],
    queryFn: () => api.get('/gudang/low-stock').then(r => r.data),
  })

  const [showMutasi, setShowMutasi] = useState<ListOfItem | null>(null)

  return (
    <div>
      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <p className="text-sm text-amber-800">
          Berikut adalah barang dengan stok di bawah batas minimum atau sudah habis. Segera lakukan restok.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Barang</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kategori</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stok</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Min Stok</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : !data?.data.length ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-10 h-10 text-gray-200" />
                      <p className="text-gray-400">Semua stok dalam kondisi aman 👍</p>
                    </div>
                  </td>
                </tr>
              ) : data.data.map(item => {
                const total = Number(item.totalItem)
                const isOut = total <= 0
                return (
                  <tr key={item.id} className={cn('hover:bg-gray-50', isOut && 'bg-red-50/30')}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{item.itemName}</p>
                      <p className="text-xs text-gray-400">{item.unitItem?.unitName}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.categoryItem?.categoryName}</td>
                    <td className={cn('px-4 py-3 text-right font-bold', isOut ? 'text-red-600' : 'text-amber-600')}>
                      {fmtNum(item.totalItem)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {item.limitItem ? fmtNum(item.limitItem) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isOut
                        ? <span className="badge badge-danger text-xs">Habis</span>
                        : <span className="badge badge-warning text-xs">Minim</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setShowMutasi(item)}
                        className="btn-primary text-xs py-1 px-3 flex items-center gap-1 mx-auto"
                      >
                        <ArrowUpCircle className="w-3 h-3" /> Restok
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showMutasi && (
        <MutasiStokModal
          item={showMutasi}
          onClose={() => setShowMutasi(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['gudang-low-stock'] })
            qc.invalidateQueries({ queryKey: ['gudang-barang'] })
            qc.invalidateQueries({ queryKey: ['gudang-stats'] })
            setShowMutasi(null)
          }}
        />
      )}
    </div>
  )
}

// ─── TAB: Kadaluwarsa ────────────────────────────────────────────────────────

function ExpiryTab() {
  const { data, isLoading } = useQuery<{ data: ListOfItem[] }>({
    queryKey: ['gudang-near-expiry'],
    queryFn: () => api.get('/gudang/near-expiry').then(r => r.data),
  })

  return (
    <div>
      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
        <Clock className="w-5 h-5 text-amber-500 shrink-0" />
        <p className="text-sm text-amber-800">
          Barang dengan tanggal kadaluwarsa dalam 30 hari ke depan, termasuk yang sudah lewat. Segera tarik atau prioritaskan pemakaiannya.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Barang</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kategori</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stok</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kadaluwarsa</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : !data?.data.length ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-10 h-10 text-gray-200" />
                      <p className="text-gray-400">Belum ada yang mendekati kadaluwarsa 👍</p>
                    </div>
                  </td>
                </tr>
              ) : data.data.map(item => {
                const expired = item.expiredDate ? new Date(item.expiredDate) < new Date() : false
                return (
                  <tr key={item.id} className={cn('hover:bg-gray-50', expired && 'bg-red-50/30')}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{item.itemName}</p>
                      <p className="text-xs text-gray-400">{item.unitItem?.unitName}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.categoryItem?.categoryName}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-700">{fmtNum(item.totalItem)}</td>
                    <td className={cn('px-4 py-3 text-right font-medium', expired ? 'text-red-600' : 'text-amber-600')}>
                      {item.expiredDate ? format(new Date(item.expiredDate), 'd MMM yyyy', { locale: localeId }) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {expired
                        ? <span className="badge badge-danger text-xs">Kadaluwarsa</span>
                        : <span className="badge badge-warning text-xs">Segera</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'barang',   label: 'Stok Barang',     icon: Package },
  { key: 'mutasi',   label: 'Mutasi Stok',      icon: RefreshCw },
  { key: 'lowstock', label: 'Stok Minim',       icon: AlertTriangle },
  { key: 'expiry',   label: 'Kadaluwarsa',      icon: Clock },
  { key: 'master',   label: 'Kategori & Satuan', icon: Tag },
] as const
type TabKey = (typeof TABS)[number]['key']

export default function GudangPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('barang')

  const { data: stats } = useQuery<{ data: Stats }>({
    queryKey: ['gudang-stats'],
    queryFn: () => api.get('/gudang/stats').then(r => r.data),
    refetchInterval: 60_000,
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-display font-bold text-gray-900">Gudang & Inventori</h1>
        <p className="text-sm text-gray-400 mt-0.5">Kelola stok barang, harga, dan mutasi inventori</p>
      </div>

      {stats?.data && <StatsBar stats={stats.data} />}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === key
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
            {key === 'lowstock' && (stats?.data?.outOfStock ?? 0) + (stats?.data?.lowStock ?? 0) > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 text-xs font-bold bg-red-100 text-red-600 rounded-full">
                {(stats?.data?.outOfStock ?? 0) + (stats?.data?.lowStock ?? 0)}
              </span>
            )}
            {key === 'expiry' && (stats?.data?.nearExpiry ?? 0) > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-full">
                {stats?.data?.nearExpiry}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'barang'   && <BarangTab />}
      {activeTab === 'mutasi'   && <MutasiTab />}
      {activeTab === 'lowstock' && <LowStockTab />}
      {activeTab === 'expiry'   && <ExpiryTab />}
      {activeTab === 'master'   && <MasterDataTab />}
    </div>
  )
}
