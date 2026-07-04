import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Video, Plus, CheckCircle, Clock, XCircle, DollarSign, FileText, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

interface Session {
  id: string; status: string; channel: string; complaint: string
  scheduledAt: string; fee: number; isPaid: boolean; rating: number | null
  doctorNotes: string; ePrescription: string
  patient: { petName: string; petCategory: string }
  owner: { ownerName: string; phoneNumber: string }
  doctor: { fullname: string }
}

function fmtRp(n: number) { return `Rp${n.toLocaleString('id-ID')}` }
function fmtDT(d: string) { return d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-' }

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Menunggu', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Dikonfirmasi', color: 'bg-blue-100 text-blue-700' },
  ongoing: { label: 'Berlangsung', color: 'bg-purple-100 text-purple-700' },
  done: { label: 'Selesai', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-600' },
}

function AddSessionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ patientId: '', ownerId: '', doctorId: '', complaint: '', scheduledAt: '', fee: '', channel: 'chat' })
  const { data: patients } = useQuery({ queryKey: ['patients-list'], queryFn: () => api.get('/pasien').then((r: any) => r.data.data) })
  const { data: doctors } = useQuery({ queryKey: ['doctors-list'], queryFn: () => api.get('/user', { params: { role: 'dokter' } }).then((r: any) => r.data.data) })

  const mut = useMutation({
    mutationFn: () => api.post('/telemed/request', form),
    onSuccess: () => { onSaved(); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-semibold text-gray-800">Request Telemedicine</span>
          <button onClick={onClose} className="text-gray-400 text-xl">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Pasien</label>
            <select value={form.patientId} onChange={e => {
              const p: any = patients?.find((x: any) => x.id === e.target.value)
              setForm(prev => ({ ...prev, patientId: e.target.value, ownerId: p?.ownerId ?? '' }))
            }} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Pilih pasien...</option>
              {(patients ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.petName} — {p.owner?.ownerName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Dokter</label>
            <select value={form.doctorId} onChange={e => setForm(p => ({ ...p, doctorId: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Pilih dokter...</option>
              {(doctors ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.fullname}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Keluhan</label>
            <textarea value={form.complaint} onChange={e => setForm(p => ({ ...p, complaint: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 h-20 resize-none" placeholder="Deskripsikan keluhan..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Jadwal</label>
              <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Biaya (Rp)</label>
              <input type="number" value={form.fee} onChange={e => setForm(p => ({ ...p, fee: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="100000" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Channel</label>
            <select value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="chat">Chat</option>
              <option value="video">Video Call</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600">Batal</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.patientId || !form.doctorId}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {mut.isPending ? 'Menyimpan...' : 'Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SessionDetailModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState(session.doctorNotes ?? '')
  const [prescription, setPrescription] = useState(session.ePrescription ?? '')

  const notesMut = useMutation({
    mutationFn: () => api.patch(`/telemed/session/${session.id}/notes`, { doctorNotes: notes, ePrescription: prescription, status: 'done' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['telemed-sessions'] }); onClose() },
  })
  const confirmMut = useMutation({
    mutationFn: () => api.patch(`/telemed/session/${session.id}/confirm`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['telemed-sessions'] }),
  })
  const billingMut = useMutation({
    mutationFn: () => api.post(`/telemed/billing/${session.id}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['telemed-sessions'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <div>
            <p className="font-semibold text-gray-800">{session.patient.petName}</p>
            <p className="text-xs text-gray-400">{session.owner.ownerName} · dr. {session.doctor.fullname}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[session.status]?.color}`}>{STATUS_CONFIG[session.status]?.label}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Channel</span><span className="font-medium">{session.channel === 'video' ? 'Video Call' : 'Chat'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Jadwal</span><span className="font-medium">{fmtDT(session.scheduledAt)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Biaya</span><span className="font-medium text-teal-600">{fmtRp(session.fee)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Pembayaran</span><span className={`font-medium ${session.isPaid ? 'text-green-600' : 'text-red-500'}`}>{session.isPaid ? 'Lunas' : 'Belum Bayar'}</span></div>
          </div>

          {session.complaint && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Keluhan</p>
              <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-xl">{session.complaint}</p>
            </div>
          )}

          {session.status === 'pending' && (
            <button onClick={() => confirmMut.mutate()} disabled={confirmMut.isPending}
              className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium">
              Konfirmasi Konsultasi
            </button>
          )}

          {['confirmed', 'ongoing'].includes(session.status) && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-600">Catatan Dokter</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 resize-none" placeholder="Diagnosa, saran, dll..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">E-Resep</label>
                <textarea value={prescription} onChange={e => setPrescription(e.target.value)} rows={4}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 resize-none font-mono" placeholder="1. Amoxicillin 250mg 3×1 tab&#10;2. Vitamin C 500mg 1×1 tab" />
              </div>
              <button onClick={() => notesMut.mutate()} disabled={notesMut.isPending}
                className="w-full py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-medium">
                {notesMut.isPending ? 'Menyimpan...' : 'Selesaikan & Kirim Resep'}
              </button>
            </>
          )}

          {session.status === 'done' && !session.isPaid && (
            <button onClick={() => billingMut.mutate()} disabled={billingMut.isPending}
              className="w-full flex items-center justify-center gap-2 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium">
              <DollarSign className="w-4 h-4" /> Tandai Lunas
            </button>
          )}

          {session.ePrescription && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">E-Resep Terakhir</p>
              <pre className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl whitespace-pre-wrap font-mono">{session.ePrescription}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TelemedPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<Session | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const { data: res } = useQuery({
    queryKey: ['telemed-sessions', statusFilter, page],
    queryFn: () => api.get('/telemed/sessions', { params: { status: statusFilter === 'all' ? undefined : statusFilter, page, limit: 20 } }).then((r: any) => r.data),
  })

  const { data: rekap } = useQuery({
    queryKey: ['telemed-rekap'],
    queryFn: () => api.get('/telemed/rekap').then((r: any) => r.data.data),
  })

  const sessions: Session[] = res?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Video className="w-6 h-6 text-teal-600" /> Telemedicine</h1>
          <p className="text-sm text-gray-500 mt-0.5">Konsultasi online antara dokter dan pemilik hewan</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Request Konsultasi
        </button>
      </div>

      {/* Stats */}
      {rekap && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Sesi', value: rekap.total, color: 'text-gray-800' },
            { label: 'Menunggu', value: rekap.pending, color: 'text-yellow-600' },
            { label: 'Selesai', value: rekap.done, color: 'text-green-600' },
            { label: 'Pendapatan', value: `Rp${(rekap.totalRevenue ?? 0).toLocaleString('id-ID')}`, color: 'text-teal-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border p-4 shadow-sm">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
          <div className="flex rounded-lg border overflow-hidden">
            {(['all', 'pending', 'confirmed', 'done', 'cancelled'] as const).map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`px-3 py-2 text-xs font-medium ${statusFilter === s ? 'bg-teal-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {s === 'all' ? 'Semua' : STATUS_CONFIG[s]?.label}
              </button>
            ))}
          </div>
          <button onClick={() => qc.invalidateQueries({ queryKey: ['telemed-sessions'] })} className="p-1.5 border rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="divide-y">
          {sessions.length === 0 && <p className="text-center py-12 text-gray-400">Tidak ada sesi konsultasi</p>}
          {sessions.map(s => (
            <div key={s.id} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(s)}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-800">{s.patient.petName} <span className="text-xs text-gray-400">({s.patient.petCategory})</span></p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[s.status]?.color}`}>{STATUS_CONFIG[s.status]?.label}</span>
                    {s.isPaid && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Lunas</span>}
                  </div>
                  <p className="text-sm text-gray-600">{s.owner.ownerName} · dr. {s.doctor.fullname}</p>
                  {s.complaint && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{s.complaint}</p>}
                  <p className="text-xs text-gray-400">{s.channel === 'video' ? '📹 Video Call' : '💬 Chat'} · {fmtDT(s.scheduledAt)}</p>
                </div>
                <p className="font-bold text-teal-600 ml-3">{fmtRp(s.fee)}</p>
              </div>
            </div>
          ))}
        </div>

        {res?.total > 20 && (
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-sm text-gray-500">Total: {res.total}</span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 border rounded disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={page * 20 >= res.total} onClick={() => setPage(p => p + 1)} className="p-1.5 border rounded disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {showAdd && <AddSessionModal onClose={() => setShowAdd(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['telemed-sessions'] })} />}
      {selected && <SessionDetailModal session={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
