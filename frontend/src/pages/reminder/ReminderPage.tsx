import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Bell, Syringe, Bug, CheckCircle, XCircle, Clock,
  Search, ChevronLeft, ChevronRight, Play, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UpcomingItem {
  type: 'vaccination' | 'deworming'
  recordId: string
  name: string
  dueDate: string
  patient: {
    id: string
    petName: string
    petCategory?: string
    branch?: { branchName: string } | null
    owner?: { ownerName: string; phoneNumber?: string } | null
  } | null
  reminder: {
    id: string
    status: 'pending' | 'sent' | 'failed' | 'skipped'
    sentAt?: string
    errorMsg?: string
  } | null
}

interface ReminderLog {
  id: string
  type: string
  status: string
  dueDate: string
  sentAt?: string
  errorMsg?: string
  createdAt: string
  patient?: {
    id: string
    petName: string
    owner?: { ownerName: string; phoneNumber?: string } | null
  } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const REMINDER_STATUS_COLOR: Record<string, string> = {
  sent:    'bg-green-100 text-green-700',
  failed:  'bg-red-100   text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  skipped: 'bg-gray-100  text-gray-500',
}
const REMINDER_STATUS_LABEL: Record<string, string> = {
  sent: 'Terkirim', failed: 'Gagal', pending: 'Menunggu', skipped: 'Dilewati',
}

function daysBetween(dateStr: string) {
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function urgencyColor(days: number) {
  if (days <= 3)  return 'text-red-600 bg-red-50 border-red-200'
  if (days <= 7)  return 'text-orange-600 bg-orange-50 border-orange-200'
  if (days <= 14) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  return 'text-gray-600 bg-gray-50 border-gray-200'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Run Cron Modal ────────────────────────────────────────────────────────────

function RunScanModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (r: any) => void }) {
  const [days, setDays] = useState(7)
  const [result, setResult] = useState<any>(null)

  const mutation = useMutation({
    mutationFn: () => api.post('/reminder/run', { days }),
    onSuccess: (r: any) => { setResult(r.data); onSuccess(r.data) },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Jalankan Scan Reminder</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {!result ? (
            <>
              <p className="text-sm text-gray-500">
                Scan semua pasien yang memiliki jadwal vaksinasi atau obat cacing yang akan jatuh tempo,
                lalu kirim reminder via WhatsApp.
              </p>
              <div>
                <label className="label">Lookahead (hari ke depan)</label>
                <select className="input" value={days} onChange={e => setDays(Number(e.target.value))}>
                  {[3, 7, 14, 30].map(d => <option key={d} value={d}>{d} hari</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
                <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Play className="w-4 h-4" />
                  {mutation.isPending ? 'Menjalankan...' : 'Jalankan Scan'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <p className="font-semibold text-gray-800">Scan Selesai!</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-blue-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-blue-700">{result.data?.vaccination ?? 0}</p>
                    <p className="text-xs text-blue-500">Vaksinasi</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-purple-700">{result.data?.deworming ?? 0}</p>
                    <p className="text-xs text-purple-500">Cacing</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-red-700">{result.data?.errors ?? 0}</p>
                    <p className="text-xs text-red-500">Error</p>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="btn-primary w-full">Tutup</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const DAYS_OPTIONS = [
  { label: '7 hari', value: 7 },
  { label: '14 hari', value: 14 },
  { label: '30 hari', value: 30 },
  { label: '60 hari', value: 60 },
]

export default function ReminderPage() {
  const qc = useQueryClient()
  const [activeTab,   setActiveTab]   = useState<'upcoming' | 'log'>('upcoming')
  const [typeFilter,  setTypeFilter]  = useState('')
  const [daysFilter,  setDaysFilter]  = useState(30)
  const [search,      setSearch]      = useState('')
  const [page,        setPage]        = useState(1)
  const [logStatus,   setLogStatus]   = useState('')
  const [showRunScan, setShowRunScan] = useState(false)

  const statsQ = useQuery({
    queryKey: ['reminder-stats'],
    queryFn: () => api.get('/reminder/stats').then((r: any) => r.data.data),
  })

  const upcomingQ = useQuery<{ data: UpcomingItem[]; meta: any }>({
    queryKey: ['reminder-upcoming', typeFilter, daysFilter, search, page],
    queryFn: () => {
      const p = new URLSearchParams({ days: String(daysFilter), page: String(page), limit: '25' })
      if (typeFilter) p.set('type', typeFilter)
      if (search)     p.set('search', search)
      return api.get(`/reminder/upcoming?${p}`).then((r: any) => r.data)
    },
    enabled: activeTab === 'upcoming',
  })

  const logQ = useQuery<{ data: ReminderLog[]; meta: any }>({
    queryKey: ['reminder-log', logStatus, page],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: '30' })
      if (logStatus) p.set('status', logStatus)
      return api.get(`/reminder/log?${p}`).then((r: any) => r.data)
    },
    enabled: activeTab === 'log',
  })

  const sendManualMut = useMutation({
    mutationFn: ({ type, recordId }: { type: string; recordId: string }) =>
      api.post(`/reminder/send-manual/${type}/${recordId}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminder-upcoming'] }),
  })

  const stats    = statsQ.data
  const upcoming = upcomingQ.data?.data ?? []
  const upMeta   = upcomingQ.data?.meta
  const logs     = logQ.data?.data ?? []
  const logMeta  = logQ.data?.meta

  function refetch() {
    qc.invalidateQueries({ queryKey: ['reminder-upcoming'] })
    qc.invalidateQueries({ queryKey: ['reminder-stats'] })
    qc.invalidateQueries({ queryKey: ['reminder-log'] })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reminder & Alert</h1>
          <p className="text-sm text-gray-500 mt-0.5">Jadwal vaksinasi dan obat cacing yang akan jatuh tempo</p>
        </div>
        <button onClick={() => setShowRunScan(true)} className="btn-primary flex items-center gap-2">
          <Play className="w-4 h-4" /> Jalankan Scan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Jatuh Tempo 7 Hari', value: stats?.due7,        icon: AlertTriangle, color: 'text-red-600    bg-red-100'    },
          { label: 'Jatuh Tempo 30 Hari', value: stats?.due30,       icon: Bell,          color: 'text-orange-600 bg-orange-100' },
          { label: 'Terkirim Hari Ini',   value: stats?.sentToday,   icon: CheckCircle,   color: 'text-green-600  bg-green-100'  },
          { label: 'Reminder Gagal',      value: stats?.failed,      icon: XCircle,       color: 'text-gray-600   bg-gray-100'   },
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

      {/* Cron info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3 text-sm">
        <Clock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-blue-700">
          <span className="font-medium">Auto Cron:</span> Reminder dikirim otomatis setiap hari pukul 08:00 WIB.
          Gunakan tombol "Jalankan Scan" untuk mengirim secara manual sekarang.
          Konfigurasi jadwal via env: <code className="font-mono text-xs bg-blue-100 px-1 rounded">REMINDER_CRON_SCHEDULE</code> dan
          <code className="font-mono text-xs bg-blue-100 px-1 rounded ml-1">REMINDER_DAYS_AHEAD</code>.
        </div>
      </div>

      {/* Tabs */}
      <div className="card p-0 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { key: 'upcoming', label: 'Jatuh Tempo' },
            { key: 'log',      label: 'Log Pengiriman' },
          ].map(t => (
            <button key={t.key}
              onClick={() => { setActiveTab(t.key as any); setPage(1) }}
              className={cn(
                'px-5 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === t.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── TAB UPCOMING ── */}
          {activeTab === 'upcoming' && (
            <>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4 flex-wrap">
                {/* Type */}
                <div className="flex gap-1">
                  {[
                    { label: 'Semua', value: '', icon: Bell },
                    { label: 'Vaksinasi', value: 'vaccination', icon: Syringe },
                    { label: 'Cacing', value: 'deworming', icon: Bug },
                  ].map(f => (
                    <button key={f.value}
                      onClick={() => { setTypeFilter(f.value); setPage(1) }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors',
                        typeFilter === f.value
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      )}>
                      <f.icon className="w-3.5 h-3.5" />
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Days */}
                <div className="flex gap-1">
                  {DAYS_OPTIONS.map(o => (
                    <button key={o.value}
                      onClick={() => { setDaysFilter(o.value); setPage(1) }}
                      className={cn(
                        'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        daysFilter === o.value
                          ? 'bg-gray-800 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      )}>
                      {o.label}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative sm:ml-auto">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input className="input pl-9 w-48" placeholder="Cari nama hewan/pemilik..."
                    value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
                </div>
              </div>

              {/* List */}
              {upcomingQ.isLoading ? (
                <p className="text-center py-8 text-gray-400">Memuat data...</p>
              ) : upcoming.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400">Tidak ada jadwal yang jatuh tempo dalam {daysFilter} hari ke depan</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcoming.map(item => {
                    const days = daysBetween(item.dueDate)
                    return (
                      <div key={`${item.type}-${item.recordId}`}
                        className={cn('flex items-center gap-4 p-4 rounded-xl border', urgencyColor(days))}>
                        {/* Type icon */}
                        <div className="shrink-0">
                          {item.type === 'vaccination'
                            ? <Syringe className="w-5 h-5" />
                            : <Bug className="w-5 h-5" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-800 truncate">{item.patient?.petName ?? '-'}</p>
                            <span className="text-xs px-2 py-0.5 bg-white/60 rounded-full">
                              {item.type === 'vaccination' ? 'Vaksin' : 'Cacing'}: {item.name}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5 opacity-80">
                            {item.patient?.owner?.ownerName ?? '-'} · {item.patient?.branch?.branchName ?? '-'}
                            {item.patient?.owner?.phoneNumber && ` · ${item.patient.owner.phoneNumber}`}
                          </p>
                        </div>

                        {/* Due date */}
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold">{days === 0 ? 'Hari ini!' : days < 0 ? `${Math.abs(days)} hari lalu` : `${days} hari lagi`}</p>
                          <p className="text-xs opacity-70">{fmtDate(item.dueDate)}</p>
                        </div>

                        {/* Reminder status + action */}
                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                          {item.reminder ? (
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                              REMINDER_STATUS_COLOR[item.reminder.status])}>
                              {REMINDER_STATUS_LABEL[item.reminder.status]}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                              Belum dikirim
                            </span>
                          )}
                          {item.patient?.owner?.phoneNumber && item.reminder?.status !== 'sent' && (
                            <button
                              onClick={() => sendManualMut.mutate({ type: item.type, recordId: item.recordId })}
                              disabled={sendManualMut.isPending}
                              className="text-xs underline opacity-70 hover:opacity-100 transition-opacity">
                              Kirim Sekarang
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Pagination */}
              {upMeta && upMeta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-400">
                    {upMeta.total} total · halaman {upMeta.page}/{upMeta.totalPages}
                  </p>
                  <div className="flex gap-1">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button disabled={page >= upMeta.totalPages} onClick={() => setPage(p => p + 1)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── TAB LOG ── */}
          {activeTab === 'log' && (
            <>
              <div className="flex gap-1 mb-4 flex-wrap">
                {[
                  { label: 'Semua', value: '' },
                  { label: 'Terkirim', value: 'sent' },
                  { label: 'Gagal', value: 'failed' },
                  { label: 'Pending', value: 'pending' },
                ].map(f => (
                  <button key={f.value}
                    onClick={() => { setLogStatus(f.value); setPage(1) }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      logStatus === f.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                    )}>
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Hewan', 'Pemilik', 'Tipe', 'Jatuh Tempo', 'Status', 'Terkirim'].map(h => (
                        <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {logQ.isLoading && (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400">Memuat...</td></tr>
                    )}
                    {!logQ.isLoading && logs.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400">Belum ada log reminder</td></tr>
                    )}
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium text-gray-800">{log.patient?.petName ?? '-'}</td>
                        <td className="py-3 px-3 text-gray-500 text-xs">{log.patient?.owner?.ownerName ?? '-'}</td>
                        <td className="py-3 px-3">
                          <span className="flex items-center gap-1 text-xs">
                            {log.type === 'vaccination' ? <Syringe className="w-3 h-3" /> : <Bug className="w-3 h-3" />}
                            {log.type === 'vaccination' ? 'Vaksinasi' : 'Cacing'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-sm text-gray-600">{fmtDate(log.dueDate)}</td>
                        <td className="py-3 px-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                            REMINDER_STATUS_COLOR[log.status])}>
                            {REMINDER_STATUS_LABEL[log.status] ?? log.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-gray-400">
                          {log.sentAt ? new Date(log.sentAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {logMeta && logMeta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-400">{logMeta.total} total</p>
                  <div className="flex gap-1">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button disabled={page >= logMeta.totalPages} onClick={() => setPage(p => p + 1)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showRunScan && (
        <RunScanModal
          onClose={() => setShowRunScan(false)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  )
}
