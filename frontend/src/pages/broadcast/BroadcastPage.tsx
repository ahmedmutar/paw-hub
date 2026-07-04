import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  MessageSquare, Send, Users, CheckCircle2, XCircle,
  Clock, BarChart3, ChevronRight, RefreshCw, Eye,
} from 'lucide-react'

interface BroadcastLog {
  id: string; title: string; status: string; totalTarget: number
  totalSent: number; totalFailed: number; createdAt: string
  completedAt?: string; createdBy: string; preview: string; segment: any
}
interface Analytics {
  totalBroadcasts: number; totalSent: number; totalFailed: number
  totalReached: number; activeSending: number; successRate: number
  recent: any[]
}

const PET_CATEGORIES = ['Anjing', 'Kucing', 'Kelinci', 'Hamster', 'Burung', 'Ikan', 'Reptil', 'Lainnya']

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sending: 'bg-yellow-100 text-yellow-700',
  done: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-600',
}
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', sending: 'Mengirim...', done: 'Selesai', failed: 'Gagal' }

function SegmentPreview({ segment }: { segment: any }) {
  const { data } = useQuery({
    queryKey: ['segment-preview', segment],
    queryFn: () => api.get('/broadcast/segment-preview', { params: segment }).then((r: any) => r.data.data),
    enabled: true,
  })
  if (!data) return <span className="text-gray-400 text-sm">Menghitung...</span>
  return (
    <span className="text-sm font-medium text-teal-700">
      {data.withPhone} kontak dapat dikirim <span className="text-gray-400">({data.totalOwners} total owner)</span>
    </span>
  )
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['broadcast-detail', id],
    queryFn: () => api.get(`/broadcast/${id}/detail`).then((r: any) => r.data.data),
  })
  if (!data) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-gray-800">{data.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Pesan</p>
            <p className="text-sm text-gray-800 whitespace-pre-line">{data.message}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-teal-50 rounded-xl p-3"><p className="text-2xl font-bold text-teal-700">{data.totalTarget}</p><p className="text-xs text-teal-600">Target</p></div>
            <div className="bg-green-50 rounded-xl p-3"><p className="text-2xl font-bold text-green-700">{data.totalSent}</p><p className="text-xs text-green-600">Terkirim</p></div>
            <div className="bg-red-50 rounded-xl p-3"><p className="text-2xl font-bold text-red-600">{data.totalFailed}</p><p className="text-xs text-red-500">Gagal</p></div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Penerima (maks 100)</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {data.recipients.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b">
                  <span className="text-gray-700">{r.ownerName}</span>
                  <span className="text-gray-400">{r.phone}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${r.status === 'sent' ? 'bg-green-100 text-green-700' : r.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BroadcastPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'kirim' | 'riwayat' | 'analitik'>('kirim')
  const [form, setForm] = useState({ title: '', message: '', petCategory: '', lastVisitDaysAgo: '' })
  const [detailId, setDetailId] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const { data: analytics } = useQuery<Analytics>({
    queryKey: ['broadcast-analytics'],
    queryFn: () => api.get('/broadcast/analytics').then((r: any) => r.data.data),
    refetchInterval: 15_000,
  })

  const { data: logs, isLoading: logsLoading, refetch } = useQuery({
    queryKey: ['broadcast-logs'],
    queryFn: () => api.get('/broadcast/log').then((r: any) => r.data),
    enabled: tab === 'riwayat',
  })

  const mutation = useMutation({
    mutationFn: (body: any) => api.post('/broadcast/send', body),
    onSuccess: () => {
      setSent(true)
      setForm({ title: '', message: '', petCategory: '', lastVisitDaysAgo: '' })
      qc.invalidateQueries({ queryKey: ['broadcast-analytics'] })
      qc.invalidateQueries({ queryKey: ['broadcast-logs'] })
    },
  })

  const segment: any = {}
  if (form.petCategory) segment.petCategory = form.petCategory
  if (form.lastVisitDaysAgo) segment.lastVisitDaysAgo = Number(form.lastVisitDaysAgo)

  const handleSend = () => {
    if (!form.title.trim() || !form.message.trim()) return
    setSent(false)
    mutation.mutate({ title: form.title, message: form.message, segment })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-teal-600" /> Broadcast & CRM WhatsApp
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Kirim pesan massal ke pemilik hewan berdasarkan segmentasi</p>
      </div>

      {/* Stats bar */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Broadcast', val: analytics.totalBroadcasts, icon: BarChart3, color: 'text-teal-600' },
            { label: 'Total Terkirim', val: analytics.totalSent, icon: Send, color: 'text-green-600' },
            { label: 'Tingkat Sukses', val: `${analytics.successRate}%`, icon: CheckCircle2, color: 'text-blue-600' },
            { label: 'Sedang Kirim', val: analytics.activeSending, icon: Clock, color: 'text-yellow-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border p-4 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color} shrink-0`} />
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-lg font-bold text-gray-800">{s.val}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        {(['kirim', 'riwayat', 'analitik'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium capitalize border-b-2 transition ${tab === t ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'kirim' ? 'Kirim Broadcast' : t === 'riwayat' ? 'Riwayat' : 'Analitik'}
          </button>
        ))}
      </div>

      {/* Tab: Kirim */}
      {tab === 'kirim' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <h3 className="font-semibold text-gray-800">Buat Pesan</h3>

              {sent && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Broadcast berhasil dimulai! Pesan sedang dikirim ke penerima.
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Judul Broadcast</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="cth: Promo Vaksin Bulan Juli" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Pesan <span className="text-gray-400 font-normal">— gunakan {'{nama}'} untuk nama owner</span>
                </label>
                <textarea rows={6} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Halo {nama}, kami dari Klinik Hewan PawCare ingin menginfokan..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
                <p className="text-xs text-gray-400 mt-1">{form.message.length} karakter</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSend} disabled={mutation.isPending || !form.title || !form.message}
                  className="flex-1 flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-medium text-sm">
                  {mutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {mutation.isPending ? 'Memulai...' : 'Kirim Sekarang'}
                </button>
              </div>
            </div>
          </div>

          {/* Segmentation */}
          <div className="bg-white rounded-2xl border p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">Segmentasi Penerima</h3>
            <p className="text-xs text-gray-500">Filter siapa yang akan menerima pesan ini. Kosongkan untuk kirim ke semua.</p>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Jenis Hewan</label>
              <select value={form.petCategory} onChange={e => setForm(f => ({ ...f, petCategory: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Semua Jenis</option>
                {PET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Kunjungan Terakhir</label>
              <select value={form.lastVisitDaysAgo} onChange={e => setForm(f => ({ ...f, lastVisitDaysAgo: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Semua</option>
                <option value="30">Lebih dari 30 hari yang lalu</option>
                <option value="60">Lebih dari 60 hari yang lalu</option>
                <option value="90">Lebih dari 90 hari yang lalu (3 bulan)</option>
                <option value="180">Lebih dari 6 bulan yang lalu</option>
              </select>
            </div>

            <div className="bg-teal-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Estimasi Penerima</p>
              <SegmentPreview segment={segment} />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              <strong>Tips:</strong> Gunakan variabel <code className="bg-amber-100 px-1 rounded">{'{nama}'}</code> agar pesan terasa personal. Pesan panjang mungkin terkirim sebagai beberapa SMS WA.
            </div>
          </div>
        </div>
      )}

      {/* Tab: Riwayat */}
      {tab === 'riwayat' && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <p className="font-semibold text-gray-800">Riwayat Broadcast</p>
            <button onClick={() => refetch()} className="p-1.5 rounded-lg border hover:bg-gray-50"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
          </div>
          <div className="divide-y">
            {logsLoading ? (
              <div className="py-12 text-center text-gray-400">Memuat...</div>
            ) : !(logs?.data?.length) ? (
              <div className="py-12 text-center text-gray-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Belum ada broadcast
              </div>
            ) : logs.data.map((log: BroadcastLog) => (
              <div key={log.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[log.status] ?? 'bg-gray-100'}`}>
                        {STATUS_LABEL[log.status] ?? log.status}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString('id-ID')}</span>
                    </div>
                    <p className="font-medium text-gray-800">{log.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{log.preview}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{log.totalTarget} target</span>
                      <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3 h-3" />{log.totalSent} terkirim</span>
                      {log.totalFailed > 0 && <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3 h-3" />{log.totalFailed} gagal</span>}
                    </div>
                  </div>
                  <button onClick={() => setDetailId(log.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Analitik */}
      {tab === 'analitik' && analytics && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Ringkasan Keseluruhan</h3>
              <div className="space-y-3">
                {[
                  { label: 'Total Broadcast Dilakukan', val: analytics.totalBroadcasts },
                  { label: 'Total Owner Dijangkau', val: analytics.totalReached },
                  { label: 'Total Pesan Terkirim', val: analytics.totalSent },
                  { label: 'Total Pesan Gagal', val: analytics.totalFailed },
                  { label: 'Tingkat Keberhasilan', val: `${analytics.successRate}%` },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold text-gray-800">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">5 Broadcast Terakhir</h3>
              <div className="space-y-2">
                {analytics.recent.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate flex-1">{r.title}</span>
                    <span className="text-xs text-gray-400 ml-2">{r.totalSent}/{r.totalTarget}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}
