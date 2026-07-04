import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Calendar, Clock, CheckCircle, XCircle, RefreshCw,
  Search, ChevronLeft, ChevronRight, ArrowRight, User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string
  ownerName: string
  ownerPhone: string
  petName: string
  petCategory?: string
  complaint: string
  notes?: string
  status: 'pending' | 'confirmed' | 'declined' | 'rescheduled' | 'converted' | 'cancelled'
  declineReason?: string
  appointmentDate: string
  appointmentTime: string
  registrationId?: string
  doctor?: { id: string; fullname: string } | null
  branch?: { id: string; branchName: string } | null
  patient?: { id: string; petName: string } | null
  createdAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-700',
  confirmed:  'bg-blue-100   text-blue-700',
  rescheduled:'bg-purple-100 text-purple-700',
  converted:  'bg-green-100  text-green-700',
  declined:   'bg-red-100    text-red-700',
  cancelled:  'bg-gray-100   text-gray-500',
}

const STATUS_LABEL: Record<string, string> = {
  pending:    'Menunggu',
  confirmed:  'Terkonfirmasi',
  rescheduled:'Dijadwal Ulang',
  converted:  'Masuk Antrian',
  declined:   'Ditolak',
  cancelled:  'Dibatalkan',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600')}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Action Modal ──────────────────────────────────────────────────────────────

function ActionModal({ appt, onClose, onSuccess }: { appt: Appointment; onClose: () => void; onSuccess: () => void }) {
  const [declineReason, setDeclineReason] = useState('')
  const [newDate, setNewDate] = useState(appt.appointmentDate.slice(0, 10))
  const [newTime, setNewTime] = useState(appt.appointmentTime)
  const [mode, setMode] = useState<'main' | 'decline' | 'reschedule'>('main')
  const [msg, setMsg]   = useState('')

  const confirmMut = useMutation({
    mutationFn: () => api.put(`/appointment/${appt.id}/confirm`, {}),
    onSuccess: () => { onSuccess(); onClose() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal'),
  })
  const declineMut = useMutation({
    mutationFn: () => api.put(`/appointment/${appt.id}/decline`, { reason: declineReason }),
    onSuccess: () => { onSuccess(); onClose() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal'),
  })
  const reschedMut = useMutation({
    mutationFn: () => api.put(`/appointment/${appt.id}`, { appointmentDate: newDate, appointmentTime: newTime }),
    onSuccess: () => { onSuccess(); onClose() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal'),
  })
  const convertMut = useMutation({
    mutationFn: () => api.put(`/appointment/${appt.id}/convert`, {}),
    onSuccess: () => { onSuccess(); onClose() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? e.message ?? 'Gagal mengkonversi ke antrian. Pastikan pasien sudah terdaftar di sistem.'),
  })

  const isPending = confirmMut.isPending || declineMut.isPending || reschedMut.isPending || convertMut.isPending

  const TIME_SLOTS = Array.from({ length: 18 }, (_, i) => {
    const h = 8 + Math.floor(i / 2)
    const m = i % 2 === 0 ? '00' : '30'
    return `${String(h).padStart(2, '0')}:${m}`
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Kelola Booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {/* Info booking */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-800">{appt.petName}</span>
              <StatusBadge status={appt.status} />
            </div>
            <p className="text-gray-500">Pemilik: {appt.ownerName} · {appt.ownerPhone}</p>
            <p className="text-gray-500">📅 {fmtDate(appt.appointmentDate)} · ⏰ {appt.appointmentTime}</p>
            <p className="text-gray-500">👨‍⚕️ {appt.doctor?.fullname ?? '-'}</p>
          </div>

          {msg && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{msg}</p>}

          {/* Main actions */}
          {mode === 'main' && (
            <div className="space-y-2">
              {(appt.status === 'pending' || appt.status === 'rescheduled') && (
                <button onClick={() => confirmMut.mutate()} disabled={isPending}
                  className="w-full py-2.5 rounded-xl bg-green-600 text-white font-medium flex items-center justify-center gap-2 hover:bg-green-700 transition-colors">
                  <CheckCircle className="w-4 h-4" /> Konfirmasi Booking
                </button>
              )}
              {appt.status === 'confirmed' && !appt.patient && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                  Untuk konversi ke antrian, pasien harus terdaftar di sistem terlebih dahulu.
                </div>
              )}
              {(appt.status === 'confirmed') && appt.patient && (
                <button onClick={() => convertMut.mutate()} disabled={isPending}
                  className="w-full py-2.5 rounded-xl bg-primary-600 text-white font-medium flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors">
                  <ArrowRight className="w-4 h-4" /> Konversi ke Antrian Hari Ini
                </button>
              )}
              {(appt.status === 'pending' || appt.status === 'confirmed' || appt.status === 'rescheduled') && (
                <button onClick={() => setMode('reschedule')}
                  className="w-full py-2.5 rounded-xl border-2 border-purple-200 text-purple-600 font-medium flex items-center justify-center gap-2 hover:bg-purple-50 transition-colors">
                  <RefreshCw className="w-4 h-4" /> Jadwal Ulang
                </button>
              )}
              {!['converted', 'cancelled', 'declined'].includes(appt.status) && (
                <button onClick={() => setMode('decline')}
                  className="w-full py-2.5 rounded-xl border-2 border-red-200 text-red-600 font-medium flex items-center justify-center gap-2 hover:bg-red-50 transition-colors">
                  <XCircle className="w-4 h-4" /> Tolak Booking
                </button>
              )}
              <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-colors">
                Tutup
              </button>
            </div>
          )}

          {/* Decline form */}
          {mode === 'decline' && (
            <div className="space-y-3">
              <div>
                <label className="label">Alasan penolakan (opsional)</label>
                <textarea className="input min-h-[80px]" value={declineReason}
                  onChange={e => setDeclineReason(e.target.value)}
                  placeholder="Dokter tidak tersedia, slot penuh, dll..." />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMode('main')} className="btn-secondary flex-1">← Kembali</button>
                <button onClick={() => declineMut.mutate()} disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700">
                  Tolak Booking
                </button>
              </div>
            </div>
          )}

          {/* Reschedule form */}
          {mode === 'reschedule' && (
            <div className="space-y-3">
              <div>
                <label className="label">Tanggal Baru</label>
                <input type="date" className="input" value={newDate} min={todayStr()}
                  onChange={e => setNewDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Jam Baru</label>
                <select className="input" value={newTime} onChange={e => setNewTime(e.target.value)}>
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMode('main')} className="btn-secondary flex-1">← Kembali</button>
                <button onClick={() => reschedMut.mutate()} disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700">
                  Simpan Jadwal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ appt, onClose, onAction }: { appt: Appointment; onClose: () => void; onAction: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Detail Booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-bold text-gray-900">{appt.petName}</p>
              {appt.petCategory && <p className="text-sm text-gray-400">{appt.petCategory}</p>}
            </div>
            <StatusBadge status={appt.status} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Pemilik', value: appt.ownerName },
              { label: 'No. WA', value: appt.ownerPhone },
              { label: 'Tanggal', value: fmtDate(appt.appointmentDate) },
              { label: 'Jam', value: appt.appointmentTime },
              { label: 'Dokter', value: appt.doctor?.fullname ?? '-' },
              { label: 'Cabang', value: appt.branch?.branchName ?? '-' },
            ].map(r => (
              <div key={r.label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1">{r.label}</p>
                <p className="font-medium">{r.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">Keluhan</p>
            <p className="text-sm">{appt.complaint}</p>
          </div>

          {appt.declineReason && (
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-red-400 text-xs mb-1">Alasan Penolakan</p>
              <p className="text-sm text-red-700">{appt.declineReason}</p>
            </div>
          )}

          {appt.registrationId && (
            <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700">
              ✅ Sudah dikonversi ke antrian (ID: {appt.registrationId})
            </div>
          )}

          {appt.notes && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-blue-400 text-xs mb-1">Catatan Internal</p>
              <p className="text-sm text-blue-700">{appt.notes}</p>
            </div>
          )}

          <div className="flex gap-2">
            {!['converted', 'cancelled', 'declined'].includes(appt.status) && (
              <button onClick={onAction} className="btn-primary flex-1">Kelola Booking</button>
            )}
            <button onClick={onClose} className="btn-secondary flex-1">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { label: 'Semua', value: '' },
  { label: 'Menunggu', value: 'pending' },
  { label: 'Terkonfirmasi', value: 'confirmed' },
  { label: 'Dijadwal Ulang', value: 'rescheduled' },
  { label: 'Masuk Antrian', value: 'converted' },
  { label: 'Ditolak', value: 'declined' },
]

export default function AppointmentPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter]     = useState('')
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(1)
  const [selected, setSelected]         = useState<Appointment | null>(null)
  const [showDetail, setShowDetail]     = useState(false)
  const [showAction, setShowAction]     = useState(false)

  const statsQ = useQuery({
    queryKey: ['appt-stats'],
    queryFn: () => api.get('/appointment/stats').then((r: any) => r.data.data),
  })

  const listQ = useQuery<{ data: Appointment[]; meta: any }>({
    queryKey: ['appointments', statusFilter, dateFilter, search, page],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' })
      if (statusFilter) p.set('status', statusFilter)
      if (dateFilter)   p.set('date', dateFilter)
      if (search)       p.set('search', search)
      return api.get(`/appointment?${p}`).then((r: any) => r.data)
    },
  })

  const stats = statsQ.data
  const list  = listQ.data?.data ?? []
  const meta  = listQ.data?.meta

  function refetch() {
    qc.invalidateQueries({ queryKey: ['appointments'] })
    qc.invalidateQueries({ queryKey: ['appt-stats'] })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Booking & Appointment</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kelola booking konsultasi dari pemilik hewan</p>
        </div>
        <a href="/booking" target="_blank" rel="noopener noreferrer"
          className="btn-secondary flex items-center gap-2 text-sm">
          <User className="w-4 h-4" /> Halaman Booking Publik ↗
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Menunggu Konfirmasi', value: stats?.pending,   icon: Clock,        color: 'text-yellow-600 bg-yellow-100' },
          { label: 'Terkonfirmasi',       value: stats?.confirmed, icon: CheckCircle,  color: 'text-blue-600   bg-blue-100'   },
          { label: 'Booking Hari Ini',    value: stats?.today,     icon: Calendar,     color: 'text-green-600  bg-green-100'  },
          { label: 'Total',               value: stats?.total,     icon: RefreshCw,    color: 'text-gray-600   bg-gray-100'   },
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

      {/* Filter + Table */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
          {/* Status tabs */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button key={f.value}
                onClick={() => { setStatusFilter(f.value); setPage(1) }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  statusFilter === f.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Date + Search */}
          <div className="flex gap-2 sm:ml-auto">
            <input type="date" className="input text-sm w-38"
              value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(1) }} />
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input className="input pl-9 w-44" placeholder="Cari nama/WA..."
                value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="text-xs text-gray-400 hover:text-gray-600 px-2">
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Hewan / Pemilik', 'Jadwal', 'Dokter', 'Cabang', 'Keluhan', 'Status', ''].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {listQ.isLoading && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Memuat data...</td></tr>
              )}
              {!listQ.isLoading && list.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Belum ada booking</td></tr>
              )}
              {list.map(appt => (
                <tr key={appt.id} className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => { setSelected(appt); setShowDetail(true) }}>
                  <td className="py-3 px-3">
                    <p className="font-medium text-gray-800">{appt.petName}
                      {appt.petCategory && <span className="text-gray-400 text-xs ml-1">({appt.petCategory})</span>}
                    </p>
                    <p className="text-xs text-gray-500">{appt.ownerName} · {appt.ownerPhone}</p>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <p className="text-sm font-medium">{fmtDate(appt.appointmentDate)}</p>
                    <p className="text-xs text-gray-400">⏰ {appt.appointmentTime}</p>
                  </td>
                  <td className="py-3 px-3 text-gray-600 text-sm">{appt.doctor?.fullname ?? '-'}</td>
                  <td className="py-3 px-3 text-xs text-gray-500">{appt.branch?.branchName ?? '-'}</td>
                  <td className="py-3 px-3 max-w-[160px]">
                    <p className="text-xs text-gray-600 truncate">{appt.complaint}</p>
                  </td>
                  <td className="py-3 px-3"><StatusBadge status={appt.status} /></td>
                  <td className="py-3 px-3">
                    {!['converted', 'cancelled', 'declined'].includes(appt.status) && (
                      <button
                        onClick={e => { e.stopPropagation(); setSelected(appt); setShowAction(true) }}
                        className="text-xs text-primary-600 hover:underline font-medium">
                        Kelola
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
              Halaman {meta.page} dari {meta.totalPages} ({meta.total} booking)
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
      {showDetail && selected && (
        <DetailModal
          appt={selected}
          onClose={() => { setShowDetail(false); setSelected(null) }}
          onAction={() => { setShowDetail(false); setShowAction(true) }}
        />
      )}
      {showAction && selected && (
        <ActionModal
          appt={selected}
          onClose={() => { setShowAction(false); setSelected(null) }}
          onSuccess={refetch}
        />
      )}
    </div>
  )
}
