import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight,
  Stethoscope, Tag, Clock, TrendingUp, DollarSign,
  ChevronDown, ChevronRight, AlertCircle, History,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatRupiah, formatDate } from '@/lib/utils'
import {
  Button, Input, Textarea, Dialog, DialogContent,
  Badge, EmptyState, Spinner,
} from '@/components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Category {
  id: string; categoryName: string
  _count: { listOfServices: number }
}

interface Service {
  id: string; serviceName: string; description?: string
  durationMinutes?: number; isActive: boolean
  serviceCategory: { id: string; categoryName: string }
  priceServices: Array<{
    id: string; sellingPrice: string; capitalPrice: string
    doctorFee: string; petshopFee: string; createdAt: string
    _count: { detailServicePatients: number }
  }>
}

interface Stats {
  totalServices: number; totalCategories: number
  activeServices: number; usedThisMonth: number
  topServices: Array<{ serviceName: string; count: number; revenue: string }>
}

// ─── Form state helpers ───────────────────────────────────────────────────────
const emptyServiceForm = () => ({
  serviceName: '', description: '', durationMinutes: '',
  serviceCategoryId: '',
  sellingPrice: '', capitalPrice: '', doctorFee: '', petshopFee: '',
})

const emptyPriceForm = () => ({
  sellingPrice: '', capitalPrice: '', doctorFee: '', petshopFee: '',
})

// ─── Category Modal ───────────────────────────────────────────────────────────
function CategoryModal({ open, onClose, editing }: {
  open: boolean; onClose: () => void; editing?: Category | null
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(editing?.categoryName ?? '')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => editing
      ? api.put(`/layanan/kategori/${editing.id}`, { categoryName: name })
      : api.post('/layanan/kategori', { categoryName: name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['layanan-kategori'] })
      qc.invalidateQueries({ queryKey: ['layanan-stats'] })
      onClose()
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        title={editing ? 'Edit Kategori' : 'Tambah Kategori'}
        description="Kategori digunakan untuk mengelompokkan layanan."
      >
        <div className="space-y-4">
          <Input
            label="Nama Kategori"
            required
            placeholder="Mis. Konsultasi, Grooming, Bedah..."
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            error={error}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
            <Button className="flex-1" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              {editing ? 'Simpan Perubahan' : 'Tambah Kategori'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Service Modal (tambah / edit) ────────────────────────────────────────────
function ServiceModal({ open, onClose, categories, editing }: {
  open: boolean; onClose: () => void
  categories: Category[]; editing?: Service | null
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState(() =>
    editing ? {
      serviceName:       editing.serviceName,
      description:       editing.description ?? '',
      durationMinutes:   editing.durationMinutes ? String(editing.durationMinutes) : '',
      serviceCategoryId: editing.serviceCategory.id,
      sellingPrice:      editing.priceServices[0] ? String(Number(editing.priceServices[0].sellingPrice)) : '',
      capitalPrice:      editing.priceServices[0] ? String(Number(editing.priceServices[0].capitalPrice)) : '',
      doctorFee:         editing.priceServices[0] ? String(Number(editing.priceServices[0].doctorFee)) : '',
      petshopFee:        editing.priceServices[0] ? String(Number(editing.priceServices[0].petshopFee)) : '',
    } : emptyServiceForm()
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.serviceName.trim())    e.serviceName       = 'Nama wajib diisi'
    if (!form.serviceCategoryId)     e.serviceCategoryId = 'Pilih kategori'
    if (!form.sellingPrice)          e.sellingPrice      = 'Harga jual wajib diisi'
    if (Number(form.sellingPrice) < 0) e.sellingPrice    = 'Harga tidak boleh negatif'
    if (Number(form.doctorFee) > Number(form.sellingPrice))
      e.doctorFee = 'Fee dokter melebihi harga jual'
    return e
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        serviceName:       form.serviceName.trim(),
        description:       form.description || undefined,
        durationMinutes:   form.durationMinutes ? Number(form.durationMinutes) : undefined,
        serviceCategoryId: form.serviceCategoryId,
        sellingPrice:      Number(form.sellingPrice),
        capitalPrice:      Number(form.capitalPrice) || 0,
        doctorFee:         Number(form.doctorFee) || 0,
        petshopFee:        Number(form.petshopFee) || 0,
      }
      if (editing) {
        // Update info + harga baru jika berubah
        await api.put(`/layanan/${editing.id}`, {
          serviceName:       payload.serviceName,
          description:       payload.description,
          durationMinutes:   payload.durationMinutes,
          serviceCategoryId: payload.serviceCategoryId,
        })
        const oldPrice = editing.priceServices[0]
        if (!oldPrice ||
          Number(oldPrice.sellingPrice) !== payload.sellingPrice ||
          Number(oldPrice.capitalPrice) !== payload.capitalPrice ||
          Number(oldPrice.doctorFee)    !== payload.doctorFee ||
          Number(oldPrice.petshopFee)   !== payload.petshopFee
        ) {
          await api.post(`/layanan/${editing.id}/harga`, {
            sellingPrice: payload.sellingPrice,
            capitalPrice: payload.capitalPrice,
            doctorFee:    payload.doctorFee,
            petshopFee:   payload.petshopFee,
          })
        }
      } else {
        await api.post('/layanan', payload)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['layanan-list'] })
      qc.invalidateQueries({ queryKey: ['layanan-stats'] })
      onClose()
    },
    onError: (e: any) => setErrors({ general: e.response?.data?.message ?? 'Gagal menyimpan.' }),
  })

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    mutation.mutate()
  }

  const selling = Number(form.sellingPrice) || 0
  const capital = Number(form.capitalPrice) || 0
  const dFee    = Number(form.doctorFee)    || 0
  const margin  = selling - capital

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        title={editing ? `Edit: ${editing.serviceName}` : 'Tambah Layanan'}
        description="Isi informasi layanan dan harga."
        className="max-w-xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Info layanan */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Informasi Layanan</p>
            <Input
              label="Nama Layanan" required placeholder="Mis. Vaksinasi Rabies, Grooming Medium..."
              value={form.serviceName} onChange={(e) => set('serviceName', e.target.value)}
              error={errors.serviceName}
            />
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Kategori <span className="text-red-500">*</span>
              </label>
              <select
                value={form.serviceCategoryId}
                onChange={(e) => set('serviceCategoryId', e.target.value)}
                className={`w-full px-3 py-2 text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.serviceCategoryId ? 'border-red-400' : 'border-gray-300'}`}
              >
                <option value="">— Pilih kategori —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.categoryName}</option>
                ))}
              </select>
              {errors.serviceCategoryId && <p className="text-xs text-red-500 mt-1">{errors.serviceCategoryId}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Textarea
                label="Deskripsi (opsional)" rows={2}
                placeholder="Keterangan singkat layanan..."
                value={form.description} onChange={(e) => set('description', e.target.value)}
              />
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Durasi (menit)</label>
                <input
                  type="number" min="1" placeholder="Mis. 30, 60..."
                  value={form.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Harga */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Penetapan Harga</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Harga Jual (Rp)" required type="number" min="0"
                placeholder="0" value={form.sellingPrice}
                onChange={(e) => set('sellingPrice', e.target.value)}
                error={errors.sellingPrice}
              />
              <Input
                label="Harga Modal (Rp)" type="number" min="0"
                placeholder="0" value={form.capitalPrice}
                onChange={(e) => set('capitalPrice', e.target.value)}
              />
              <Input
                label="Fee Dokter (Rp)" type="number" min="0"
                placeholder="0" value={form.doctorFee}
                onChange={(e) => set('doctorFee', e.target.value)}
                error={errors.doctorFee}
              />
              <Input
                label="Fee Lainnya (Rp)" type="number" min="0"
                placeholder="0" value={form.petshopFee}
                onChange={(e) => set('petshopFee', e.target.value)}
              />
            </div>

            {/* Margin preview */}
            {selling > 0 && (
              <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl text-center">
                <div>
                  <p className="text-xs text-gray-400">Margin</p>
                  <p className={`text-sm font-bold ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatRupiah(margin)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Margin %</p>
                  <p className={`text-sm font-bold ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {selling > 0 ? ((margin / selling) * 100).toFixed(1) : 0}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Fee Dokter %</p>
                  <p className="text-sm font-bold text-blue-600">
                    {selling > 0 ? ((dFee / selling) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>
            )}
          </div>

          {errors.general && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
            <Button className="flex-1" loading={mutation.isPending} onClick={handleSubmit}>
              {editing ? 'Simpan Perubahan' : 'Tambah Layanan'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Riwayat Harga Modal ──────────────────────────────────────────────────────
function PriceHistoryModal({ open, onClose, serviceId, serviceName }: {
  open: boolean; onClose: () => void; serviceId: string; serviceName: string
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['layanan-harga', serviceId],
    queryFn: async () => (await api.get(`/layanan/${serviceId}/harga`)).data.data as Array<{
      id: string; sellingPrice: string; capitalPrice: string
      doctorFee: string; isDeleted: boolean; createdAt: string
    }>,
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent title={`Riwayat Harga — ${serviceName}`} className="max-w-md">
        {isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : !data?.length ? (
          <p className="text-sm text-gray-400 text-center py-6">Belum ada riwayat harga.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {data.map((h, i) => (
              <div key={h.id} className={`p-3 rounded-lg border ${h.isDeleted ? 'bg-gray-50 opacity-60' : 'bg-primary-50 border-primary-100'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${h.isDeleted ? 'bg-gray-200 text-gray-500' : 'bg-primary-100 text-primary-700'}`}>
                    {h.isDeleted ? 'Lama' : '✓ Aktif'}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(h.createdAt, 'd MMM yyyy, HH:mm')}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <div><span className="text-gray-400">Jual: </span><span className="font-semibold">{formatRupiah(Number(h.sellingPrice))}</span></div>
                  <div><span className="text-gray-400">Modal: </span><span>{formatRupiah(Number(h.capitalPrice))}</span></div>
                  <div><span className="text-gray-400">Fee dokter: </span><span>{formatRupiah(Number(h.doctorFee))}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Service Row ──────────────────────────────────────────────────────────────
function ServiceRow({ service, onEdit, onToggle, onDelete, onViewHistory }: {
  service: Service
  onEdit:        (s: Service) => void
  onToggle:      (s: Service) => void
  onDelete:      (s: Service) => void
  onViewHistory: (s: Service) => void
}) {
  const price       = service.priceServices[0]
  const usedCount   = price?._count?.detailServicePatients ?? 0
  const selling     = price ? Number(price.sellingPrice) : 0
  const capital     = price ? Number(price.capitalPrice) : 0
  const margin      = selling - capital
  const marginPct   = selling > 0 ? ((margin / selling) * 100).toFixed(0) : 0

  return (
    <div className={`px-5 py-4 hover:bg-gray-50 transition-colors ${!service.isActive ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-medium text-gray-900 text-sm">{service.serviceName}</span>
            {!service.isActive && <Badge variant="gray">Nonaktif</Badge>}
            {service.durationMinutes && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />{service.durationMinutes} mnt
              </span>
            )}
            {usedCount > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                {usedCount}× bulan ini
              </span>
            )}
          </div>
          {service.description && (
            <p className="text-xs text-gray-400 mb-1.5 line-clamp-1">{service.description}</p>
          )}
          {price ? (
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="font-semibold text-gray-800">{formatRupiah(selling)}</span>
              <span className="text-gray-300">·</span>
              <span className="text-gray-500">Modal {formatRupiah(capital)}</span>
              <span className={`font-medium ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                Margin {marginPct}%
              </span>
              {Number(price.doctorFee) > 0 && (
                <span className="text-blue-500">Fee dr. {formatRupiah(Number(price.doctorFee))}</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-amber-600">⚠ Belum ada harga</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onViewHistory(service)}
            title="Riwayat harga"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onToggle(service)}
            title={service.isActive ? 'Nonaktifkan' : 'Aktifkan'}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            {service.isActive
              ? <ToggleRight className="w-4 h-4 text-primary-500" />
              : <ToggleLeft  className="w-4 h-4 text-gray-400" />}
          </button>
          <button
            onClick={() => onEdit(service)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-primary-50 hover:text-primary-600 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(service)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Halaman Utama ─────────────────────────────────────────────────────────────
export default function LayananPage() {
  const qc = useQueryClient()

  const [search,         setSearch]         = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterActive,   setFilterActive]   = useState('')
  const [showCatModal,   setShowCatModal]   = useState(false)
  const [editingCat,     setEditingCat]     = useState<Category | null>(null)
  const [showSvcModal,   setShowSvcModal]   = useState(false)
  const [editingSvc,     setEditingSvc]     = useState<Service | null>(null)
  const [historyFor,     setHistoryFor]     = useState<Service | null>(null)
  const [deletingId,     setDeletingId]     = useState<string | null>(null)

  // ── Queries ──
  const { data: statsData } = useQuery({
    queryKey: ['layanan-stats'],
    queryFn:  async () => (await api.get('/layanan/stats')).data.data as Stats,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['layanan-kategori'],
    queryFn:  async () => (await api.get('/layanan/kategori')).data.data as Category[],
  })

  const { data: listData, isLoading } = useQuery({
    queryKey: ['layanan-list', search, filterCategory, filterActive],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search)         params.set('search', search)
      if (filterCategory) params.set('categoryId', filterCategory)
      if (filterActive)   params.set('isActive', filterActive)
      return (await api.get(`/layanan?${params}&limit=100`)).data.data as Service[]
    },
  })

  // ── Toggle status ──
  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/layanan/${id}/toggle-status`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['layanan-list'] }),
  })

  // ── Delete ──
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/layanan/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['layanan-list'] })
      qc.invalidateQueries({ queryKey: ['layanan-stats'] })
      setDeletingId(null)
    },
    onError: (e: any) => alert(e.response?.data?.message ?? 'Gagal menghapus.'),
  })

  // ── Delete category ──
  const deleteCatMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/layanan/kategori/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['layanan-kategori'] })
      qc.invalidateQueries({ queryKey: ['layanan-stats'] })
    },
    onError: (e: any) => alert(e.response?.data?.message ?? 'Gagal menghapus kategori.'),
  })

  const stats     = statsData
  const services  = listData ?? []

  // Group by category untuk tampilan
  const grouped = categories.reduce<Record<string, Service[]>>((acc, cat) => {
    acc[cat.id] = services.filter((s) => s.serviceCategory.id === cat.id)
    return acc
  }, {})
  const uncategorized = services.filter((s) => !categories.find(c => c.id === s.serviceCategory.id))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl text-gray-900">Layanan & Jasa</h2>
          <p className="text-sm text-gray-500 mt-0.5">Kelola layanan klinik, harga, dan kategori</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditingCat(null); setShowCatModal(true) }}>
            <Tag className="w-3.5 h-3.5" />
            Tambah Kategori
          </Button>
          <Button size="sm" onClick={() => { setEditingSvc(null); setShowSvcModal(true) }}>
            <Plus className="w-4 h-4" />
            Tambah Layanan
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Layanan',  value: stats.totalServices,   icon: <Stethoscope className="w-4 h-4" />, color: 'text-primary-600', bg: 'bg-primary-50' },
            { label: 'Kategori',       value: stats.totalCategories, icon: <Tag className="w-4 h-4" />,         color: 'text-indigo-600',  bg: 'bg-indigo-50' },
            { label: 'Aktif',          value: stats.activeServices,  icon: <ToggleRight className="w-4 h-4" />,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Dipakai Bln Ini',value: stats.usedThisMonth,   icon: <TrendingUp className="w-4 h-4" />,   color: 'text-blue-600',    bg: 'bg-blue-50' },
          ].map((s) => (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${s.bg} ${s.color} flex items-center justify-center`}>{s.icon}</div>
              <div>
                <p className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* ── Top layanan sidebar ── */}
        {stats?.topServices && stats.topServices.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary-500" />
              <p className="font-semibold text-gray-800 text-sm">Top Layanan Bulan Ini</p>
            </div>
            <div className="space-y-3">
              {stats.topServices.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold
                    ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.serviceName}</p>
                    <p className="text-xs text-gray-400">{s.count}× · {formatRupiah(Number(s.revenue))}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Daftar layanan ── */}
        <div className={stats?.topServices?.length ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {/* Filter bar */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari layanan..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.categoryName}</option>
              ))}
            </select>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Semua Status</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : services.length === 0 && categories.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Stethoscope className="w-10 h-10" />}
                title="Belum ada layanan"
                description='Mulai dengan klik "Tambah Kategori", lalu tambahkan layanan.'
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Render per kategori */}
              {categories.map((cat) => {
                const catServices = grouped[cat.id] ?? []
                if (catServices.length === 0 && (search || filterCategory)) return null
                return (
                  <div key={cat.id} className="card overflow-hidden">
                    {/* Header kategori */}
                    <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-semibold text-gray-700 text-sm">{cat.categoryName}</span>
                        <span className="text-xs text-gray-400">({catServices.length} layanan)</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingCat(cat); setShowCatModal(true) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-white hover:text-primary-600 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        {cat._count.listOfServices === 0 && (
                          <button
                            onClick={() => deleteCatMutation.mutate(cat.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-white hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {catServices.length === 0 ? (
                      <div className="px-5 py-3">
                        <p className="text-sm text-gray-400">Belum ada layanan di kategori ini.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {catServices.map((svc) => (
                          <ServiceRow
                            key={svc.id}
                            service={svc}
                            onEdit={(s) => { setEditingSvc(s); setShowSvcModal(true) }}
                            onToggle={(s) => toggleMutation.mutate(s.id)}
                            onDelete={(s) => setDeletingId(s.id)}
                            onViewHistory={(s) => setHistoryFor(s)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Layanan tanpa kategori yang cocok */}
              {uncategorized.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
                    <span className="text-sm font-semibold text-amber-700">Lainnya</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {uncategorized.map((svc) => (
                      <ServiceRow
                        key={svc.id}
                        service={svc}
                        onEdit={(s) => { setEditingSvc(s); setShowSvcModal(true) }}
                        onToggle={(s) => toggleMutation.mutate(s.id)}
                        onDelete={(s) => setDeletingId(s.id)}
                        onViewHistory={(s) => setHistoryFor(s)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete confirm ── */}
      <Dialog open={!!deletingId} onOpenChange={(o) => { if (!o) setDeletingId(null) }}>
        <DialogContent title="Hapus Layanan?" description="Layanan yang sudah digunakan di pemeriksaan tidak dapat dihapus.">
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeletingId(null)}>Batal</Button>
            <Button variant="danger" className="flex-1" loading={deleteMutation.isPending}
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}>
              Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modals ── */}
      <CategoryModal
        open={showCatModal}
        onClose={() => { setShowCatModal(false); setEditingCat(null) }}
        editing={editingCat}
      />

      {showSvcModal && (
        <ServiceModal
          open={showSvcModal}
          onClose={() => { setShowSvcModal(false); setEditingSvc(null) }}
          categories={categories}
          editing={editingSvc}
        />
      )}

      {historyFor && (
        <PriceHistoryModal
          open={!!historyFor}
          onClose={() => setHistoryFor(null)}
          serviceId={historyFor.id}
          serviceName={historyFor.serviceName}
        />
      )}
    </div>
  )
}
