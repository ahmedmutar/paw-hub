import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  MessageSquare, CheckCircle, XCircle, Clock,
  Send, RefreshCw, Search, ChevronLeft, ChevronRight, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WaLog {
  id: string
  recipientPhone: string
  recipientName?: string
  type: string
  message: string
  status: 'pending' | 'sent' | 'failed'
  errorMessage?: string
  sentAt?: string
  createdAt: string
  patient?: { id: string; petName: string } | null
  branch?: { id: string; branchName: string } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  sent:    'bg-green-100  text-green-700',
  failed:  'bg-red-100    text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
}

const STATUS_ICON: Record<string, React.ElementType> = {
  sent:    CheckCircle,
  failed:  XCircle,
  pending: Clock,
}

const TYPE_LABEL: Record<string, string> = {
  queue_confirmation:   'Konfirmasi Antrian',
  queue_called:         'Antrian Dipanggil',
  vaccination_reminder: 'Reminder Vaksinasi',
  deworming_reminder:   'Reminder Cacing',
  payment_receipt:      'Struk Pembayaran',
  inpatient_update:     'Update Rawat Inap',
  custom:               'Manual',
}

function StatusBadge({ status }: { status: string }) {
  const Icon = STATUS_ICON[status] ?? Clock
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600')}>
      <Icon className="w-3 h-3" />
      {{ sent: 'Terkirim', failed: 'Gagal', pending: 'Pending' }[status] ?? status}
    </span>
  )
}

// ── Send Manual Modal ─────────────────────────────────────────────────────────

function SendModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ phone: '', message: '', type: 'custom' })
  const [msg, setMsg]   = useState('')

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/notif/wa/send', data),
    onSuccess: () => { onSuccess(); onClose() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal mengirim'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Kirim Pesan WhatsApp</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form) }} className="px-6 py-4 space-y-4">
          <div>
            <label className="label">Nomor WA *</label>
            <input className="input" placeholder="628xxxxxxxxxx" value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} required />
            <p className="text-xs text-gray-400 mt-1">Format: 628... (tanpa + atau 0)</p>
          </div>
          <div>
            <label className="label">Tipe Notifikasi</label>
            <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Pesan *</label>
            <textarea className="input min-h-[120px]" value={form.message}
              onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              placeholder="Ketik pesan... (mendukung *bold* dan _italic_)" required />
          </div>
          {msg && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{msg}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Batal</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Send className="w-4 h-4" />
              {mutation.isPending ? 'Mengirim...' : 'Kirim'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ log, onClose, onResend }: { log: WaLog; onClose: () => void; onResend: () => void }) {
  const fmt = (d: string) => new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Detail Log WA</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800">{log.recipientName ?? log.recipientPhone}</p>
              <p className="text-sm text-gray-400">{log.recipientPhone}</p>
            </div>
            <StatusBadge status={log.status} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Tipe</p>
              <p className="font-medium">{TYPE_LABEL[log.type] ?? log.type}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Cabang</p>
              <p className="font-medium">{log.branch?.branchName ?? '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Dibuat</p>
              <p className="font-medium">{fmt(log.createdAt)}</p>
            </div>
            {log.sentAt && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1">Terkirim</p>
                <p className="font-medium">{fmt(log.sentAt)}</p>
              </div>
            )}
          </div>

          {log.patient && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p className="text-blue-400 text-xs mb-1">Pasien</p>
              <p className="font-medium text-blue-700">{log.patient.petName}</p>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-2">Isi Pesan</p>
            <p className="text-sm whitespace-pre-wrap">{log.message}</p>
          </div>

          {log.errorMessage && (
            <div className="bg-red-50 rounded-lg p-3 text-sm">
              <p className="text-red-400 text-xs mb-1">Error</p>
              <p className="text-red-600">{log.errorMessage}</p>
            </div>
          )}

          <div className="flex gap-2">
            {log.status === 'failed' && (
              <button onClick={onResend} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" /> Kirim Ulang
              </button>
            )}
            <button onClick={onClose} className="btn-secondary flex-1">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Config Panel ──────────────────────────────────────────────────────────────

function ConfigPanel() {
  const { data } = useQuery({
    queryKey: ['wa-config'],
    queryFn: () => api.get('/notif/config').then((r: any) => r.data.data),
  })
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
          <Settings className="w-4 h-4 text-green-600" />
        </div>
        <h3 className="font-semibold text-gray-800">Konfigurasi WhatsApp</h3>
      </div>
      <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
        <div className={cn('w-3 h-3 rounded-full', data?.configured ? 'bg-green-500' : 'bg-red-500')} />
        <div>
          <p className="text-sm font-medium text-gray-800">
            Provider: {data?.provider ?? 'Fonnte'}
          </p>
          <p className="text-xs text-gray-400">
            {data?.configured
              ? 'Token terkonfigurasi — pesan siap dikirim'
              : 'FONNTE_TOKEN belum diset di .env — pesan tidak akan terkirim'}
          </p>
        </div>
      </div>
      {!data?.configured && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <p className="font-medium mb-1">Cara setup:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Daftar di <span className="font-mono">fonnte.com</span> dan buat device WA</li>
            <li>Salin API Token dari dashboard Fonnte</li>
            <li>Tambahkan <span className="font-mono">FONNTE_TOKEN=xxx</span> ke file <span className="font-mono">.env</span> backend</li>
            <li>Restart server backend</li>
          </ol>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { label: 'Semua', value: '' },
  { label: 'Terkirim', value: 'sent' },
  { label: 'Gagal', value: 'failed' },
  { label: 'Pending', value: 'pending' },
]

const TYPE_FILTERS = [
  { label: 'Semua Tipe', value: '' },
  ...Object.entries(TYPE_LABEL).map(([k, v]) => ({ label: v, value: k })),
]

export default function NotifikasiPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter,   setTypeFilter]   = useState('')
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(1)
  const [showSend, setShowSend]         = useState(false)
  const [selected, setSelected]         = useState<WaLog | null>(null)

  const statsQ = useQuery({
    queryKey: ['wa-stats'],
    queryFn: () => api.get('/notif/log/stats').then((r: any) => r.data.data),
  })

  const listQ = useQuery<{ data: WaLog[]; meta: any }>({
    queryKey: ['wa-logs', statusFilter, typeFilter, search, page],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: '30' })
      if (statusFilter) p.set('status', statusFilter)
      if (typeFilter)   p.set('type',   typeFilter)
      if (search)       p.set('search', search)
      return api.get(`/notif/log?${p}`).then((r: any) => r.data)
    },
  })

  const resendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notif/wa/resend/${id}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-logs'] })
      qc.invalidateQueries({ queryKey: ['wa-stats'] })
      setSelected(null)
    },
  })

  const stats = statsQ.data
  const list  = listQ.data?.data ?? []
  const meta  = listQ.data?.meta

  function refetch() {
    qc.invalidateQueries({ queryKey: ['wa-logs'] })
    qc.invalidateQueries({ queryKey: ['wa-stats'] })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifikasi WhatsApp</h1>
          <p className="text-sm text-gray-500 mt-0.5">Log pengiriman pesan WhatsApp otomatis & manual</p>
        </div>
        <button onClick={() => setShowSend(true)} className="btn-primary flex items-center gap-2">
          <Send className="w-4 h-4" /> Kirim Pesan
        </button>
      </div>

      {/* Stats + Config */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stats */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total',    value: stats?.total,   color: 'text-gray-600   bg-gray-100',   icon: MessageSquare },
            { label: 'Terkirim', value: stats?.sent,    color: 'text-green-600  bg-green-100',  icon: CheckCircle   },
            { label: 'Gagal',    value: stats?.failed,  color: 'text-red-600    bg-red-100',    icon: XCircle       },
            { label: 'Hari Ini', value: stats?.today,   color: 'text-blue-600   bg-blue-100',   icon: Send          },
          ].map(s => (
            <div key={s.label} className="card flex items-center gap-3 py-3">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', s.color)}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{s.value ?? '-'}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Config */}
        <ConfigPanel />
      </div>

      {/* Filter + Table */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
          {/* Status tabs */}
          <div className="flex gap-1">
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

          {/* Type filter */}
          <select className="input w-auto text-sm" value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1) }}>
            {TYPE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>

          {/* Search */}
          <div className="relative sm:ml-auto">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input className="input pl-9 w-52" placeholder="Cari nomor / nama..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Penerima', 'Tipe', 'Pesan', 'Cabang', 'Waktu', 'Status', ''].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {listQ.isLoading && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Memuat data...</td></tr>
              )}
              {!listQ.isLoading && list.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Belum ada log WhatsApp</td></tr>
              )}
              {list.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelected(log)}>
                  <td className="py-3 px-3">
                    <p className="font-medium text-gray-800">{log.recipientName ?? '-'}</p>
                    <p className="text-xs text-gray-400 font-mono">{log.recipientPhone}</p>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                      {TYPE_LABEL[log.type] ?? log.type}
                    </span>
                  </td>
                  <td className="py-3 px-3 max-w-[200px]">
                    <p className="text-xs text-gray-600 truncate">{log.message.replace(/\*/g, '')}</p>
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-500">{log.branch?.branchName ?? '-'}</td>
                  <td className="py-3 px-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-3 px-3"><StatusBadge status={log.status} /></td>
                  <td className="py-3 px-3">
                    {log.status === 'failed' && (
                      <button
                        onClick={e => { e.stopPropagation(); resendMutation.mutate(log.id) }}
                        disabled={resendMutation.isPending}
                        className="text-xs text-primary-600 hover:underline font-medium flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Kirim Ulang
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
              Halaman {meta.page} dari {meta.totalPages} ({meta.total} log)
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
      {showSend && (
        <SendModal onClose={() => setShowSend(false)} onSuccess={refetch} />
      )}
      {selected && (
        <DetailModal
          log={selected}
          onClose={() => setSelected(null)}
          onResend={() => { resendMutation.mutate(selected.id); setSelected(null) }}
        />
      )}
    </div>
  )
}
