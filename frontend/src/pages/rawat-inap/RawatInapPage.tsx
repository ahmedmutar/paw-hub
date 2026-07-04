import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import {
  BedDouble, Clock, CheckCircle, XCircle, LogOut,
  Plus, Search, ChevronLeft, ChevronRight, MoreVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface InPatient {
  id: string
  idNumber: string
  complaint: string
  registrant: string
  estimateDay?: number
  realityDay?: number
  acceptanceStatus: 'pending' | 'accepted' | 'declined' | 'cancelled'
  createdAt: string
  patient: {
    id: string
    idMember: string
    petName: string
    petCategory: string
    petGender: string
    owner: { id: string; ownerName: string; phoneNumber: string } | null
  } | null
  branch: { id: string; branchName: string } | null
}

interface Patient {
  id: string
  idMember: string
  petName: string
  petCategory: string
  owner?: { ownerName: string; phoneNumber: string }
}

interface DoctorUser {
  id: string
  fullname: string
  username: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  accepted:  'bg-green-100  text-green-700',
  declined:  'bg-red-100    text-red-700',
  cancelled: 'bg-gray-100   text-gray-600',
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Menunggu',
  accepted:  'Dirawat',
  declined:  'Ditolak',
  cancelled: 'Selesai',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600')}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

// ── Register Modal ────────────────────────────────────────────────────────────

const defaultForm = {
  patientId: '', doctorUserId: '', complaint: '', registrant: '', estimateDay: '',
}

function RegisterModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm]         = useState(defaultForm)
  const [patientSearch, setPSearch] = useState('')
  const [docSearch, setDocSearch]   = useState('')
  const [errors, setErrors]     = useState<Record<string, string>>({})
  const [msg, setMsg]           = useState('')

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ['ri-patient-search', patientSearch],
    queryFn: () => api.get(`/pasien?search=${patientSearch}&limit=10`).then((r: any) => r.data.data),
    enabled: patientSearch.length > 1,
  })

  const { data: doctors } = useQuery<DoctorUser[]>({
    queryKey: ['ri-doctor-search', docSearch],
    queryFn: () => api.get(`/user?role=dokter&search=${docSearch}&limit=10`).then((r: any) => r.data.data),
    enabled: true,
  })

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedDoctor, setSelectedDoctor]   = useState<DoctorUser | null>(null)

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/rawat-inap', data),
    onSuccess: () => { onSuccess(); onClose() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal mendaftar rawat inap'),
  })

  function validate() {
    const err: Record<string, string> = {}
    if (!form.patientId)    err.patientId    = 'Pilih pasien'
    if (!form.doctorUserId) err.doctorUserId = 'Pilih dokter'
    if (!form.complaint.trim())   err.complaint   = 'Keluhan wajib diisi'
    if (!form.registrant.trim())  err.registrant  = 'Nama pendaftar wajib diisi'
    setErrors(err)
    return Object.keys(err).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    mutation.mutate({
      patientId:    form.patientId,
      doctorUserId: form.doctorUserId,
      complaint:    form.complaint,
      registrant:   form.registrant,
      estimateDay:  form.estimateDay ? Number(form.estimateDay) : undefined,
    })
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Daftar Rawat Inap</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">

          {/* Pasien search */}
          <div>
            <label className="label">Pasien *</label>
            {selectedPatient ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 border border-primary-200">
                <span className="flex-1 text-sm font-medium text-primary-700">
                  {selectedPatient.petName} — {selectedPatient.owner?.ownerName}
                </span>
                <button type="button" onClick={() => { setSelectedPatient(null); setForm(p => ({ ...p, patientId: '' })) }}
                  className="text-primary-400 hover:text-primary-600 text-xs">Ganti</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input className="input pl-9" placeholder="Cari nama hewan / pemilik..."
                    value={patientSearch} onChange={e => setPSearch(e.target.value)} />
                </div>
                {patients && patients.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm max-h-40 overflow-y-auto">
                    {patients.map(p => (
                      <button type="button" key={p.id}
                        onClick={() => { setSelectedPatient(p); setForm(f => ({ ...f, patientId: p.id })); setPSearch('') }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0">
                        <span className="font-medium">{p.petName}</span>
                        <span className="text-gray-400 ml-2 text-xs">{p.idMember} · {p.owner?.ownerName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {errors.patientId && <p className="text-red-500 text-xs mt-1">{errors.patientId}</p>}
          </div>

          {/* Dokter */}
          <div>
            <label className="label">Dokter *</label>
            {selectedDoctor ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                <span className="flex-1 text-sm font-medium text-blue-700">{selectedDoctor.fullname}</span>
                <button type="button" onClick={() => { setSelectedDoctor(null); setForm(p => ({ ...p, doctorUserId: '' })) }}
                  className="text-blue-400 hover:text-blue-600 text-xs">Ganti</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input className="input pl-9" placeholder="Cari dokter..."
                    value={docSearch} onChange={e => setDocSearch(e.target.value)} />
                </div>
                {doctors && doctors.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm max-h-32 overflow-y-auto">
                    {doctors.filter(d => !docSearch || d.fullname.toLowerCase().includes(docSearch.toLowerCase())).map(d => (
                      <button type="button" key={d.id}
                        onClick={() => { setSelectedDoctor(d); setForm(f => ({ ...f, doctorUserId: d.id })); setDocSearch('') }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0">
                        {d.fullname}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {errors.doctorUserId && <p className="text-red-500 text-xs mt-1">{errors.doctorUserId}</p>}
          </div>

          {/* Keluhan */}
          <div>
            <label className="label">Keluhan *</label>
            <textarea className="input min-h-[80px]" value={form.complaint} onChange={set('complaint')} placeholder="Deskripsi keluhan..." />
            {errors.complaint && <p className="text-red-500 text-xs mt-1">{errors.complaint}</p>}
          </div>

          {/* Pendaftar + Estimasi Hari */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nama Pendaftar *</label>
              <input className="input" value={form.registrant} onChange={set('registrant')} placeholder="Nama pemilik / wali" />
              {errors.registrant && <p className="text-red-500 text-xs mt-1">{errors.registrant}</p>}
            </div>
            <div>
              <label className="label">Estimasi Hari</label>
              <input className="input" type="number" min={1} value={form.estimateDay} onChange={set('estimateDay')} placeholder="Hari" />
            </div>
          </div>

          {msg && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{msg}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Batal</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? 'Mendaftar...' : 'Daftar Rawat Inap'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Status Change Modal ───────────────────────────────────────────────────────

function StatusModal({ ri, onClose, onSuccess }: { ri: InPatient; onClose: () => void; onSuccess: () => void }) {
  const [realityDay, setRealityDay] = useState(ri.realityDay?.toString() ?? '')
  const [msg, setMsg] = useState('')

  const mutation = useMutation({
    mutationFn: ({ status, rd }: { status: string; rd?: number }) =>
      api.put(`/rawat-inap/${ri.id}/status`, { status, realityDay: rd }),
    onSuccess: () => { onSuccess(); onClose() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal mengubah status'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Ubah Status Rawat Inap</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-gray-800">{ri.patient?.petName}</p>
            <p className="text-gray-500">{ri.idNumber} · Status: <StatusBadge status={ri.acceptanceStatus} /></p>
          </div>

          {ri.acceptanceStatus === 'accepted' && (
            <div>
              <label className="label">Hari Aktual Perawatan</label>
              <input className="input" type="number" min={1} value={realityDay}
                onChange={e => setRealityDay(e.target.value)} placeholder="Jumlah hari nyata" />
            </div>
          )}

          {msg && <p className="text-red-500 text-sm">{msg}</p>}

          <div className="space-y-2">
            {ri.acceptanceStatus === 'pending' && (
              <>
                <button
                  onClick={() => mutation.mutate({ status: 'accepted' })}
                  disabled={mutation.isPending}
                  className="w-full btn-primary bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Terima Pasien
                </button>
                <button
                  onClick={() => mutation.mutate({ status: 'declined' })}
                  disabled={mutation.isPending}
                  className="w-full btn-secondary text-red-600 border-red-200 hover:bg-red-50 flex items-center justify-center gap-2">
                  <XCircle className="w-4 h-4" /> Tolak
                </button>
              </>
            )}
            {ri.acceptanceStatus === 'accepted' && (
              <button
                onClick={() => mutation.mutate({ status: 'cancelled', rd: realityDay ? Number(realityDay) : undefined })}
                disabled={mutation.isPending}
                className="w-full btn-primary bg-gray-600 hover:bg-gray-700 flex items-center justify-center gap-2">
                <LogOut className="w-4 h-4" /> Discharge / Selesai
              </button>
            )}
            <button onClick={onClose} className="w-full btn-secondary">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ ri, onClose, onStatusChange }: { ri: InPatient; onClose: () => void; onStatusChange: () => void }) {
  const fmt = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Detail Rawat Inap</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400">{ri.idNumber}</p>
              <p className="text-lg font-bold text-gray-800">{ri.patient?.petName ?? '-'}</p>
              <p className="text-sm text-gray-500">{ri.patient?.petCategory} · {ri.patient?.owner?.ownerName}</p>
            </div>
            <StatusBadge status={ri.acceptanceStatus} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Cabang</p>
              <p className="font-medium">{ri.branch?.branchName ?? '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Pendaftar</p>
              <p className="font-medium">{ri.registrant}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Estimasi Hari</p>
              <p className="font-medium">{ri.estimateDay ?? '-'} hari</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Hari Aktual</p>
              <p className="font-medium">{ri.realityDay ?? '-'} hari</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 col-span-2">
              <p className="text-gray-400 text-xs mb-1">Tgl Masuk</p>
              <p className="font-medium">{fmt(ri.createdAt)}</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">Keluhan</p>
            <p className="text-sm">{ri.complaint}</p>
          </div>

          <div className="flex gap-2">
            {(ri.acceptanceStatus === 'pending' || ri.acceptanceStatus === 'accepted') && (
              <button onClick={onStatusChange} className="btn-primary flex-1">Ubah Status</button>
            )}
            <button onClick={onClose} className="btn-secondary flex-1">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { label: 'Semua', value: '' },
  { label: 'Menunggu', value: 'pending' },
  { label: 'Dirawat', value: 'accepted' },
  { label: 'Selesai', value: 'cancelled' },
  { label: 'Ditolak', value: 'declined' },
]

export default function RawatInapPage() {
  const { user }               = useAuthStore()
  const qc                     = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]    = useState('')
  const [page, setPage]        = useState(1)
  const [showRegister, setShowRegister]   = useState(false)
  const [selectedRI, setSelectedRI]       = useState<InPatient | null>(null)
  const [showDetail, setShowDetail]       = useState(false)
  const [showStatus, setShowStatus]       = useState(false)

  const statsQ = useQuery({
    queryKey: ['ri-stats'],
    queryFn: () => api.get('/rawat-inap/stats').then((r: any) => r.data.data),
  })

  const listQ = useQuery<{ data: InPatient[]; meta: any }>({
    queryKey: ['rawat-inap', statusFilter, search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '15' })
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)
      return api.get(`/rawat-inap?${params}`).then((r: any) => r.data)
    },
  })

  const stats = statsQ.data
  const list  = listQ.data?.data ?? []
  const meta  = listQ.data?.meta

  function refetch() {
    qc.invalidateQueries({ queryKey: ['rawat-inap'] })
    qc.invalidateQueries({ queryKey: ['ri-stats'] })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rawat Inap</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manajemen pasien rawat inap</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'resepsionis' || user?.role === 'dokter') && (
          <button onClick={() => setShowRegister(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Daftar Rawat Inap
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Menunggu',       value: stats?.pending,   icon: Clock,        color: 'text-yellow-600 bg-yellow-100' },
          { label: 'Sedang Dirawat', value: stats?.accepted,  icon: BedDouble,    color: 'text-green-600  bg-green-100'  },
          { label: 'Bulan Ini',      value: stats?.thisMonth, icon: CheckCircle,  color: 'text-blue-600   bg-blue-100'   },
          { label: 'Total',          value: stats?.total,     icon: MoreVertical, color: 'text-gray-600   bg-gray-100'   },
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-4">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', s.color)}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value ?? '-'}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Status tabs */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button key={f.value}
                onClick={() => { setStatusFilter(f.value); setPage(1) }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  statusFilter === f.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative sm:ml-auto">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input className="input pl-9 w-56" placeholder="Cari nama hewan..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['No. RI', 'Hewan', 'Pemilik', 'Cabang', 'Tgl Masuk', 'Estimasi', 'Status', ''].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {listQ.isLoading && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Memuat data...</td></tr>
              )}
              {!listQ.isLoading && list.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Tidak ada data rawat inap</td></tr>
              )}
              {list.map(ri => (
                <tr key={ri.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedRI(ri); setShowDetail(true) }}>
                  <td className="py-3 px-3 font-mono text-xs text-gray-600">{ri.idNumber}</td>
                  <td className="py-3 px-3">
                    <p className="font-medium text-gray-800">{ri.patient?.petName ?? '-'}</p>
                    <p className="text-xs text-gray-400">{ri.patient?.petCategory}</p>
                  </td>
                  <td className="py-3 px-3 text-gray-600">{ri.patient?.owner?.ownerName ?? '-'}</td>
                  <td className="py-3 px-3 text-gray-500 text-xs">{ri.branch?.branchName ?? '-'}</td>
                  <td className="py-3 px-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(ri.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-3 px-3 text-center text-gray-600">
                    {ri.estimateDay ? `${ri.estimateDay} hr` : '-'}
                  </td>
                  <td className="py-3 px-3"><StatusBadge status={ri.acceptanceStatus} /></td>
                  <td className="py-3 px-3">
                    {(ri.acceptanceStatus === 'pending' || ri.acceptanceStatus === 'accepted') && (
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedRI(ri); setShowStatus(true) }}
                        className="text-xs text-primary-600 hover:underline font-medium">
                        Ubah Status
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-400">
              Halaman {meta.page} dari {meta.totalPages} ({meta.total} data)
            </p>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showRegister && (
        <RegisterModal onClose={() => setShowRegister(false)} onSuccess={refetch} />
      )}
      {showDetail && selectedRI && (
        <DetailModal
          ri={selectedRI}
          onClose={() => { setShowDetail(false); setSelectedRI(null) }}
          onStatusChange={() => { setShowDetail(false); setShowStatus(true) }}
        />
      )}
      {showStatus && selectedRI && (
        <StatusModal
          ri={selectedRI}
          onClose={() => { setShowStatus(false); setSelectedRI(null) }}
          onSuccess={refetch}
        />
      )}
    </div>
  )
}
