import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { CalendarDays, Link2, Link2Off, RefreshCw, Bell, CheckCircle, AlertCircle } from 'lucide-react'

interface SyncStatus {
  syncEnabled: boolean
  googleEmail: string | null
  lastSyncAt: string | null
}

interface SyncResult {
  syncedAt: string
  eventCount: number
  events: { title: string; date: string; time: string }[]
}

function ConnectModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ googleEmail: '', googleAccessToken: '', googleRefreshToken: '' })
  const [note, setNote] = useState(false)

  const mut = useMutation({
    mutationFn: () => api.post('/calendar/connect', form),
    onSuccess: () => { onSaved(); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-semibold text-gray-800">Hubungkan Google Calendar</span>
          <button onClick={onClose} className="text-gray-400 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 space-y-1">
            <p className="font-semibold">Cara mendapatkan token Google:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Buka Google Cloud Console → OAuth 2.0</li>
              <li>Buat kredensial untuk aplikasi Anda</li>
              <li>Otorisasi scope calendar.events</li>
              <li>Salin Access Token & Refresh Token di bawah ini</li>
            </ol>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Email Google</label>
            <input value={form.googleEmail} onChange={e => setForm(p => ({ ...p, googleEmail: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="dokter@gmail.com" type="email" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Access Token</label>
            <input value={form.googleAccessToken} onChange={e => setForm(p => ({ ...p, googleAccessToken: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" placeholder="ya29.xxx..." />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Refresh Token</label>
            <input value={form.googleRefreshToken} onChange={e => setForm(p => ({ ...p, googleRefreshToken: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" placeholder="1//xxx..." />
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600">Batal</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.googleEmail}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {mut.isPending ? 'Menghubungkan...' : 'Hubungkan'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CalendarSyncPage() {
  const qc = useQueryClient()
  const [showConnect, setShowConnect] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [reminderSent, setReminderSent] = useState(false)

  const { data: status, isLoading } = useQuery<SyncStatus>({
    queryKey: ['calendar-status'],
    queryFn: () => api.get('/calendar/status').then((r: any) => r.data.data),
  })

  const disconnectMut = useMutation({
    mutationFn: () => api.delete('/calendar/disconnect'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-status'] }),
  })

  const syncMut = useMutation({
    mutationFn: () => api.post('/calendar/sync', {}),
    onSuccess: (res: any) => {
      setSyncResult(res.data.data)
      qc.invalidateQueries({ queryKey: ['calendar-status'] })
    },
  })

  const reminderMut = useMutation({
    mutationFn: () => api.post('/calendar/wa-reminder', {}),
    onSuccess: () => setReminderSent(true),
  })

  function fmtDate(d: string) {
    return d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-teal-600" /> Sinkronisasi Google Calendar
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Sinkronkan jadwal dokter ke Google Calendar dan kirim reminder WA mingguan</p>
      </div>

      {/* Connection status card */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${status?.syncEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
              {status?.syncEnabled
                ? <CheckCircle className="w-6 h-6 text-green-600" />
                : <AlertCircle className="w-6 h-6 text-gray-400" />}
            </div>
            <div>
              <p className="font-semibold text-gray-800">
                {isLoading ? 'Memuat...' : status?.syncEnabled ? 'Google Calendar Terhubung' : 'Belum Terhubung'}
              </p>
              {status?.syncEnabled && status.googleEmail && (
                <p className="text-sm text-gray-500 mt-0.5">{status.googleEmail}</p>
              )}
              {status?.lastSyncAt && (
                <p className="text-xs text-gray-400 mt-1">Sync terakhir: {fmtDate(status.lastSyncAt)}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status?.syncEnabled ? (
              <>
                <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${syncMut.isPending ? 'animate-spin' : ''}`} />
                  {syncMut.isPending ? 'Sinkronisasi...' : 'Sync Sekarang'}
                </button>
                <button onClick={() => disconnectMut.mutate()} disabled={disconnectMut.isPending}
                  className="flex items-center gap-2 px-4 py-2 border border-red-200 rounded-lg text-sm text-red-500 hover:bg-red-50">
                  <Link2Off className="w-4 h-4" /> Putuskan
                </button>
              </>
            ) : (
              <button onClick={() => setShowConnect(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium">
                <Link2 className="w-4 h-4" /> Hubungkan Google Calendar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="font-semibold text-green-800">Sinkronisasi berhasil — {syncResult.eventCount} event disinkronkan</p>
          </div>
          {syncResult.events.length > 0 && (
            <div className="space-y-2">
              {syncResult.events.map((e, i) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-green-100">
                  <p className="text-sm font-medium text-gray-800">{e.title}</p>
                  <p className="text-xs text-gray-400">{fmtDate(e.date)} · {e.time}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* WA Reminder */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800">Reminder Jadwal via WhatsApp</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Kirim notifikasi jadwal minggu depan ke semua dokter melalui WhatsApp setiap Minggu malam.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => reminderMut.mutate()} disabled={reminderMut.isPending || reminderSent}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
            <Bell className="w-4 h-4" />
            {reminderMut.isPending ? 'Mengirim...' : reminderSent ? 'Terkirim!' : 'Kirim Reminder Sekarang'}
          </button>
          {reminderSent && <p className="text-sm text-green-600">Reminder berhasil dikirim ke semua dokter aktif.</p>}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-3">
        <p className="font-semibold text-blue-800 text-sm">Cara Kerja Sinkronisasi</p>
        <ul className="space-y-2 text-sm text-blue-700">
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">1.</span>
            <span>Hubungkan Google Calendar dengan token OAuth dari akun Google dokter</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">2.</span>
            <span>Setiap appointment baru yang dibuat akan otomatis muncul sebagai event di Google Calendar</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">3.</span>
            <span>Klik "Sync Sekarang" untuk sinkronisasi manual jadwal 7 hari ke depan</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">4.</span>
            <span>Reminder WA dikirim setiap Minggu malam berisi jadwal minggu depan untuk semua dokter</span>
          </li>
        </ul>
      </div>

      {showConnect && (
        <ConnectModal
          onClose={() => setShowConnect(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['calendar-status'] })}
        />
      )}
    </div>
  )
}
