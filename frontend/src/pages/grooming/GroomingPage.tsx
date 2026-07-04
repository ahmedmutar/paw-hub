import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import {
  Scissors, Clock, CheckCircle2, DollarSign, Plus, Play, Check,
  CreditCard, X, Search, ChevronDown, Edit2, Trash2, Package
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface GroomingSession {
  id: string; queueNumber: number; status: string; isPaid: boolean
  totalPrice: number; discount: number; notes?: string
  scheduledAt?: string; startedAt?: string; completedAt?: string
  patient: { id: string; petName: string; species: string; breed?: string; owner: { id: string; ownerName: string; phoneNumber?: string } }
  groomer: { id: string; fullname: string }
  package: { id: string; packageName: string; durationMin: number }
  branch: { id: string; branchName: string }
  createdAt: string
}

interface GroomingPackage {
  id: string; packageName: string; description?: string; price: number
  durationMin: number; branchId: string; isActive: boolean
  branch?: { id: string; branchName: string }
}

interface Stats { waiting: number; inProgress: number; doneToday: number; revenueToday: number }

// ── API helpers ───────────────────────────────────────────────────────────────
const fetchStats     = () => api.get('/grooming/stats').then((r: any) => r.data.data as Stats)
const fetchAntrian   = () => api.get('/grooming/antrian').then((r: any) => r.data.data as GroomingSession[])
const fetchSesi      = (p: any) => api.get('/grooming/sesi', { params: p }).then((r: any) => r.data)
const fetchPaket     = (p: any) => api.get('/grooming/paket', { params: p }).then((r: any) => r.data.data as GroomingPackage[])
const fetchGroomers  = () => api.get('/grooming/groomer').then((r: any) => r.data.data as { id: string; fullname: string; role: string }[])
const fetchPatients  = (s: string) => api.get('/pasien', { params: { search: s, limit: 20 } }).then((r: any) => r.data.data)
const fetchBranches  = () => api.get('/cabang').then((r: any) => r.data.data)

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}><Icon className="w-5 h-5 text-white" /></div>
      <div><p className="text-sm text-gray-500">{label}</p><p className="text-xl font-bold text-gray-800">{value}</p></div>
    </div>
  )
}

// ── Session Card (Antrian) ────────────────────────────────────────────────────
function SessionCard({ s, onAction }: { s: GroomingSession; onAction: (s: GroomingSession, action: string) => void }) {
  const statusColor: Record<string, string> = {
    waiting: 'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    done: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }
  const statusLabel: Record<string, string> = {
    waiting: 'Menunggu', in_progress: 'Sedang Grooming', done: 'Selesai', cancelled: 'Batal',
  }

  return (
    <div className="bg-white rounded-xl border p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-teal-600">#{s.queueNumber}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[s.status]}`}>{statusLabel[s.status]}</span>
            {s.isPaid && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">Lunas</span>}
          </div>
          <p className="font-semibold text-gray-800 mt-1">{s.patient?.petName} <span className="text-gray-500 font-normal text-sm">({s.patient?.species})</span></p>
          <p className="text-sm text-gray-500">{s.patient?.owner?.ownerName} · {s.patient?.owner?.phoneNumber ?? '-'}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium text-gray-700">{s.package?.packageName}</p>
          <p className="text-gray-400">{s.package?.durationMin} menit</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="text-gray-400">Groomer: </span>
          <span className="font-medium text-gray-700">{s.groomer?.fullname}</span>
        </div>
        <span className="font-semibold text-gray-800">
          Rp {s.totalPrice.toLocaleString('id-ID')}
          {s.discount > 0 && <span className="text-xs text-gray-400 ml-1">(-{s.discount.toLocaleString('id-ID')})</span>}
        </span>
      </div>

      <div className="flex gap-2 pt-1 border-t">
        {s.status === 'waiting' && (
          <>
            <button onClick={() => onAction(s, 'mulai')} className="flex-1 flex items-center justify-center gap-1 bg-blue-500 hover:bg-blue-600 text-white text-sm py-1.5 rounded-lg">
              <Play className="w-3.5 h-3.5" /> Mulai
            </button>
            <button onClick={() => onAction(s, 'cancel')} className="flex items-center justify-center gap-1 border border-red-200 text-red-500 hover:bg-red-50 text-sm py-1.5 px-3 rounded-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {s.status === 'in_progress' && (
          <>
            <button onClick={() => onAction(s, 'selesai')} className="flex-1 flex items-center justify-center gap-1 bg-green-500 hover:bg-green-600 text-white text-sm py-1.5 rounded-lg">
              <Check className="w-3.5 h-3.5" /> Selesai
            </button>
            <button onClick={() => onAction(s, 'cancel')} className="flex items-center justify-center gap-1 border border-red-200 text-red-500 hover:bg-red-50 text-sm py-1.5 px-3 rounded-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {s.status === 'done' && !s.isPaid && (
          <button onClick={() => onAction(s, 'bayar')} className="flex-1 flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-sm py-1.5 rounded-lg">
            <CreditCard className="w-3.5 h-3.5" /> Tandai Lunas
          </button>
        )}
      </div>
    </div>
  )
}

// ── Daftar Sesi Modal ─────────────────────────────────────────────────────────
function DaftarSesiModal({ open, onClose, qc }: { open: boolean; onClose: () => void; qc: ReturnType<typeof useQueryClient> }) {
  const { user } = useAuthStore()
  const [form, setForm] = useState({ patientId: '', groomerId: '', packageId: '', scheduledAt: '', notes: '', discount: 0 })
  const [patientSearch, setPatientSearch] = useState('')
  const [showPatientDrop, setShowPatientDrop] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<any>(null)

  const { data: patients = [] } = useQuery({ queryKey: ['patient-search', patientSearch], queryFn: () => fetchPatients(patientSearch), enabled: patientSearch.length >= 2 })
  const { data: groomers = [] } = useQuery({ queryKey: ['grooming-groomers'], queryFn: fetchGroomers })
  const { data: packages = [] } = useQuery({ queryKey: ['grooming-paket-all'], queryFn: () => fetchPaket({}) })

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/grooming/sesi', data).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grooming-stats'] })
      qc.invalidateQueries({ queryKey: ['grooming-antrian'] })
      qc.invalidateQueries({ queryKey: ['grooming-sesi'] })
      onClose()
    },
  })

  const selectedPkg = packages.find((p: GroomingPackage) => p.id === form.packageId)

  const handleSubmit = () => {
    if (!form.patientId || !form.groomerId || !form.packageId) return
    createMut.mutate({
      patientId: Number(form.patientId),
      groomerId: Number(form.groomerId),
      packageId: Number(form.packageId),
      scheduledAt: form.scheduledAt || undefined,
      notes: form.notes || undefined,
      discount: form.discount,
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-gray-800">Daftar Sesi Grooming</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Pasien */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Pasien <span className="text-red-500">*</span></label>
            {selectedPatient ? (
              <div className="flex items-center gap-2 p-2 border rounded-lg bg-teal-50">
                <span className="flex-1 text-sm font-medium text-teal-700">{selectedPatient.petName} — {selectedPatient.owner?.ownerName}</span>
                <button onClick={() => { setSelectedPatient(null); setForm(f => ({ ...f, patientId: '' })) }} className="text-gray-400"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input value={patientSearch} onChange={e => { setPatientSearch(e.target.value); setShowPatientDrop(true) }}
                  onFocus={() => setShowPatientDrop(true)} placeholder="Cari nama hewan..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                {showPatientDrop && patients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {patients.map((p: any) => (
                      <button key={p.id} onClick={() => { setSelectedPatient(p); setForm(f => ({ ...f, patientId: p.id })); setShowPatientDrop(false) }}
                        className="w-full text-left px-3 py-2 hover:bg-teal-50 text-sm">
                        <span className="font-medium">{p.petName}</span> <span className="text-gray-500">— {p.owner?.ownerName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Paket */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paket Grooming <span className="text-red-500">*</span></label>
            <select value={form.packageId} onChange={e => setForm(f => ({ ...f, packageId: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">-- Pilih Paket --</option>
              {packages.filter((p: GroomingPackage) => p.isActive).map((p: GroomingPackage) => (
                <option key={p.id} value={p.id}>{p.packageName} — Rp {p.price.toLocaleString('id-ID')} ({p.durationMin} mnt)</option>
              ))}
            </select>
            {selectedPkg && (
              <p className="text-xs text-gray-500 mt-1">{selectedPkg.description}</p>
            )}
          </div>

          {/* Groomer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Groomer <span className="text-red-500">*</span></label>
            <select value={form.groomerId} onChange={e => setForm(f => ({ ...f, groomerId: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">-- Pilih Groomer --</option>
              {groomers.map(g => <option key={g.id} value={g.id}>{g.fullname} ({g.role})</option>)}
            </select>
          </div>

          {/* Jadwal & Diskon */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jadwal (opsional)</label>
              <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Diskon (Rp)</label>
              <input type="number" min={0} value={form.discount} onChange={e => setForm(f => ({ ...f, discount: Number(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>

          {/* Total */}
          {selectedPkg && (
            <div className="bg-teal-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Harga Paket</span>
                <span>Rp {selectedPkg.price.toLocaleString('id-ID')}</span>
              </div>
              {form.discount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Diskon</span>
                  <span>- Rp {form.discount.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-teal-700 border-t mt-1 pt-1">
                <span>Total</span>
                <span>Rp {(selectedPkg.price - form.discount).toLocaleString('id-ID')}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              placeholder="Catatan tambahan..." className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Batal</button>
          <button onClick={handleSubmit} disabled={createMut.isPending || !form.patientId || !form.groomerId || !form.packageId}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm rounded-lg">
            {createMut.isPending ? 'Menyimpan...' : 'Daftar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Paket Modal ───────────────────────────────────────────────────────────────
function PaketModal({ open, onClose, paket, qc }: { open: boolean; onClose: () => void; paket?: GroomingPackage; qc: ReturnType<typeof useQueryClient> }) {
  const [form, setForm] = useState({
    packageName: paket?.packageName ?? '',
    description: paket?.description ?? '',
    price:       paket?.price ?? 0,
    durationMin: paket?.durationMin ?? 60,
    branchId:    paket?.branchId ?? '',
    isActive:    paket?.isActive ?? true,
  })

  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: fetchBranches })

  const saveMut = useMutation({
    mutationFn: (data: any) => paket
      ? api.put(`/grooming/paket/${paket.id}`, data).then((r: any) => r.data)
      : api.post('/grooming/paket', data).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grooming-paket'] })
      qc.invalidateQueries({ queryKey: ['grooming-paket-all'] })
      onClose()
    },
  })

  const handleSubmit = () => {
    if (!form.packageName || !form.branchId || form.price <= 0) return
    saveMut.mutate({ ...form, branchId: Number(form.branchId), price: Number(form.price), durationMin: Number(form.durationMin) })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-gray-800">{paket ? 'Edit Paket' : 'Tambah Paket Grooming'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Paket <span className="text-red-500">*</span></label>
            <input value={form.packageName} onChange={e => setForm(f => ({ ...f, packageName: e.target.value }))} placeholder="ex: Basic Bath & Dry"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Harga (Rp) <span className="text-red-500">*</span></label>
              <input type="number" min={0} value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durasi (menit)</label>
              <input type="number" min={15} value={form.durationMin} onChange={e => setForm(f => ({ ...f, durationMin: Number(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          {!paket && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cabang <span className="text-red-500">*</span></label>
              <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">-- Pilih Cabang --</option>
                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.branchName}</option>)}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 rounded text-teal-500" />
            <span className="text-sm text-gray-700">Paket aktif</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Batal</button>
          <button onClick={handleSubmit} disabled={saveMut.isPending}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm rounded-lg">
            {saveMut.isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GroomingPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const qc = useQueryClient()

  const [tab, setTab] = useState<'antrian' | 'sesi' | 'paket'>('antrian')
  const [showDaftar, setShowDaftar] = useState(false)
  const [showPaket, setShowPaket] = useState(false)
  const [editPaket, setEditPaket] = useState<GroomingPackage | undefined>()

  // Sesi filter
  const [sesiFilter, setSesiFilter] = useState({ search: '', status: '', date: '' })
  const [sesiPage, setSesiPage] = useState(1)

  // Paket filter
  const [paketSearch, setPaketSearch] = useState('')

  const { data: stats } = useQuery({ queryKey: ['grooming-stats'], queryFn: fetchStats, refetchInterval: 30000 })
  const { data: antrian = [], isLoading: antrianLoading } = useQuery({ queryKey: ['grooming-antrian'], queryFn: fetchAntrian, refetchInterval: 15000, enabled: tab === 'antrian' })
  const { data: sesiData, isLoading: sesiLoading } = useQuery({
    queryKey: ['grooming-sesi', sesiFilter, sesiPage],
    queryFn: () => fetchSesi({ ...sesiFilter, page: sesiPage }),
    enabled: tab === 'sesi',
  })
  const { data: paketList = [], isLoading: paketLoading } = useQuery({
    queryKey: ['grooming-paket', paketSearch],
    queryFn: () => fetchPaket({ search: paketSearch }),
    enabled: tab === 'paket',
  })

  const statusMut = useMutation({
    mutationFn: ({ id, action, notes }: { id: string; action: string; notes?: string }) =>
      api.put(`/grooming/sesi/${id}/status`, { action, notes }).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grooming-stats'] })
      qc.invalidateQueries({ queryKey: ['grooming-antrian'] })
      qc.invalidateQueries({ queryKey: ['grooming-sesi'] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/grooming/sesi/${id}`).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grooming-sesi'] }),
  })

  const deletePaketMut = useMutation({
    mutationFn: (id: string) => api.delete(`/grooming/paket/${id}`).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grooming-paket'] })
      qc.invalidateQueries({ queryKey: ['grooming-paket-all'] })
    },
  })

  const handleAction = (s: GroomingSession, action: string) => {
    if (action === 'cancel' && !confirm(`Batalkan sesi #${s.queueNumber} untuk ${s.patient?.petName}?`)) return
    if (action === 'bayar' && !confirm(`Tandai lunas sesi #${s.queueNumber}?`)) return
    statusMut.mutate({ id: s.id, action })
  }

  const sesiList: GroomingSession[] = sesiData?.data ?? []
  const sesiTotal: number = sesiData?.total ?? 0
  const sesiTotalPages: number = sesiData?.totalPages ?? 1

  const statusColor: Record<string, string> = {
    waiting: 'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    done: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }
  const statusLabel: Record<string, string> = {
    waiting: 'Menunggu', in_progress: 'Grooming', done: 'Selesai', cancelled: 'Batal',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Grooming</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manajemen layanan grooming hewan</p>
        </div>
        <button onClick={() => setShowDaftar(true)}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Daftar Grooming
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Menunggu" value={stats?.waiting ?? 0} icon={Clock} color="bg-yellow-400" />
        <StatCard label="Sedang Grooming" value={stats?.inProgress ?? 0} icon={Scissors} color="bg-blue-500" />
        <StatCard label="Selesai Hari Ini" value={stats?.doneToday ?? 0} icon={CheckCircle2} color="bg-green-500" />
        <StatCard label="Omzet Hari Ini" value={`Rp ${(stats?.revenueToday ?? 0).toLocaleString('id-ID')}`} icon={DollarSign} color="bg-teal-500" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['antrian', 'sesi', 'paket'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow text-teal-600' : 'text-gray-600 hover:text-gray-800'}`}>
            {t === 'antrian' ? 'Antrian Aktif' : t === 'sesi' ? 'Riwayat Sesi' : 'Paket Grooming'}
          </button>
        ))}
      </div>

      {/* ── TAB ANTRIAN ── */}
      {tab === 'antrian' && (
        <div>
          {antrianLoading ? (
            <div className="text-center text-gray-400 py-12">Memuat antrian...</div>
          ) : antrian.length === 0 ? (
            <div className="text-center text-gray-400 py-16 bg-white rounded-xl border">
              <Scissors className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Tidak ada antrian aktif</p>
              <p className="text-sm mt-1">Daftarkan sesi grooming untuk mulai</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {antrian.map(s => <SessionCard key={s.id} s={s} onAction={handleAction} />)}
            </div>
          )}
        </div>
      )}

      {/* ── TAB SESI ── */}
      {tab === 'sesi' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input value={sesiFilter.search} onChange={e => { setSesiFilter(f => ({ ...f, search: e.target.value })); setSesiPage(1) }}
                placeholder="Cari hewan / pemilik / groomer..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <select value={sesiFilter.status} onChange={e => { setSesiFilter(f => ({ ...f, status: e.target.value })); setSesiPage(1) }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">Semua Status</option>
              <option value="waiting">Menunggu</option>
              <option value="in_progress">Sedang Grooming</option>
              <option value="done">Selesai</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
            <input type="date" value={sesiFilter.date} onChange={e => { setSesiFilter(f => ({ ...f, date: e.target.value })); setSesiPage(1) }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">#</th>
                  <th className="text-left px-4 py-3 font-medium">Hewan / Pemilik</th>
                  <th className="text-left px-4 py-3 font-medium">Paket</th>
                  <th className="text-left px-4 py-3 font-medium">Groomer</th>
                  <th className="text-left px-4 py-3 font-medium">Total</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                  {isAdmin && <th className="text-left px-4 py-3 font-medium">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {sesiLoading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">Memuat data...</td></tr>
                ) : sesiList.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">Tidak ada sesi</td></tr>
                ) : sesiList.map(s => (
                  <tr key={s.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-teal-600">#{s.queueNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{s.patient?.petName} <span className="text-gray-400 text-xs">({s.patient?.species})</span></p>
                      <p className="text-xs text-gray-500">{s.patient?.owner?.ownerName}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.package?.packageName}</td>
                    <td className="px-4 py-3 text-gray-700">{s.groomer?.fullname}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">Rp {s.totalPrice.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[s.status]}`}>{statusLabel[s.status]}</span>
                      {s.isPaid && <span className="ml-1 text-xs px-2 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700">Lunas</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(s.createdAt).toLocaleDateString('id-ID')}</td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <button onClick={() => { if (confirm('Hapus sesi ini?')) deleteMut.mutate(s.id) }}
                          className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {sesiTotalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{sesiTotal} sesi ditemukan</span>
              <div className="flex gap-2">
                <button disabled={sesiPage <= 1} onClick={() => setSesiPage(p => p - 1)}
                  className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40">Sebelumnya</button>
                <span className="px-3 py-1.5 bg-teal-50 text-teal-600 rounded-lg">{sesiPage} / {sesiTotalPages}</span>
                <button disabled={sesiPage >= sesiTotalPages} onClick={() => setSesiPage(p => p + 1)}
                  className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40">Selanjutnya</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB PAKET ── */}
      {tab === 'paket' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input value={paketSearch} onChange={e => setPaketSearch(e.target.value)}
                placeholder="Cari paket..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            {isAdmin && (
              <button onClick={() => { setEditPaket(undefined); setShowPaket(true) }}
                className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" /> Tambah Paket
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paketLoading ? (
              <div className="col-span-3 text-center text-gray-400 py-8">Memuat paket...</div>
            ) : paketList.length === 0 ? (
              <div className="col-span-3 text-center text-gray-400 py-12 bg-white rounded-xl border">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Belum ada paket grooming</p>
              </div>
            ) : paketList.map((p: GroomingPackage) => (
              <div key={p.id} className={`bg-white rounded-xl border p-4 ${!p.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{p.packageName}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{p.branch?.branchName}</p>
                  </div>
                  {!p.isActive && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Nonaktif</span>}
                </div>
                {p.description && <p className="text-sm text-gray-500 mt-2">{p.description}</p>}
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div>
                    <p className="text-lg font-bold text-teal-600">Rp {p.price.toLocaleString('id-ID')}</p>
                    <p className="text-xs text-gray-400">{p.durationMin} menit</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button onClick={() => { setEditPaket(p); setShowPaket(true) }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => { if (confirm('Hapus paket ini?')) deletePaketMut.mutate(p.id) }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <DaftarSesiModal open={showDaftar} onClose={() => setShowDaftar(false)} qc={qc} />
      {showPaket && (
        <PaketModal open={showPaket} onClose={() => { setShowPaket(false); setEditPaket(undefined) }} paket={editPaket} qc={qc} />
      )}
    </div>
  )
}
