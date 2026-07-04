import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Calendar, Clock, Users, Plus, Check, X, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

interface Schedule {
  id: string; doctorId: string; doctorName: string
  dayOfWeek: number; dayName: string; shiftStart: string; shiftEnd: string
  maxPatients: number; isActive: boolean
}
interface Leave {
  id: string; doctorName: string; leaveDate: string
  reason: string | null; status: string; createdAt: string
}
interface CalDay {
  date: string; dayName: string; dayOfWeek: number
  slots: { doctorId: string; doctorName: string; hasSchedule: boolean; shiftStart: string | null; shiftEnd: string | null; maxPatients: number; leave: any; available: boolean }[]
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const SHIFT_COLORS = ['bg-teal-100 text-teal-700', 'bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700', 'bg-pink-100 text-pink-700', 'bg-green-100 text-green-700']

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
}

function getWeekStart(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() - d.getDay() + offset * 7); d.setHours(0, 0, 0, 0); return d
}

function AddScheduleModal({ doctors, onClose, onSuccess }: { doctors: any[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ doctorId: '', dayOfWeek: '1', shiftStart: '08:00', shiftEnd: '16:00', maxPatients: '20' })
  const mutation = useMutation({
    mutationFn: (body: any) => api.post('/jadwal-dokter', body),
    onSuccess: () => { onSuccess(); onClose() },
  })
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-gray-800">Tambah Jadwal Dokter</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Dokter</label>
            <select value={form.doctorId} onChange={e => setForm(f => ({ ...f, doctorId: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">Pilih Dokter</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.fullname}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Hari</label>
            <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Jam Mulai</label>
              <input type="time" value={form.shiftStart} onChange={e => setForm(f => ({ ...f, shiftStart: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Jam Selesai</label>
              <input type="time" value={form.shiftEnd} onChange={e => setForm(f => ({ ...f, shiftEnd: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Maks. Pasien per Hari</label>
            <input type="number" min={1} max={100} value={form.maxPatients}
              onChange={e => setForm(f => ({ ...f, maxPatients: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <button onClick={() => mutation.mutate({ ...form, dayOfWeek: Number(form.dayOfWeek), maxPatients: Number(form.maxPatients) })}
            disabled={!form.doctorId || mutation.isPending}
            className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-medium text-sm">
            {mutation.isPending ? 'Menyimpan...' : 'Simpan Jadwal'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function JadwalDokterPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'kalender' | 'jadwal' | 'cuti'>('kalender')
  const [weekOffset, setWeekOffset] = useState(0)
  const [showAdd, setShowAdd] = useState(false)

  const weekStart = getWeekStart(weekOffset)
  const dateFrom = weekStart.toISOString().split('T')[0]

  const { data: calData, isLoading: calLoading } = useQuery({
    queryKey: ['kalender-dokter', dateFrom],
    queryFn: () => api.get('/jadwal-dokter/kalender/week', { params: { dateFrom } }).then((r: any) => r.data.data),
    enabled: tab === 'kalender',
  })

  const { data: schedulesData } = useQuery({
    queryKey: ['jadwal-dokter-all'],
    queryFn: () => api.get('/jadwal-dokter').then((r: any) => r.data.data),
    enabled: tab === 'jadwal',
  })

  const { data: leavesData, refetch: refetchLeaves } = useQuery({
    queryKey: ['cuti-dokter'],
    queryFn: () => api.get('/jadwal-dokter/cuti/list').then((r: any) => r.data.data),
    enabled: tab === 'cuti',
  })

  const { data: doctorsData } = useQuery({
    queryKey: ['doctors-list'],
    queryFn: () => api.get('/user', { params: { role: 'dokter' } }).then((r: any) => r.data.data),
  })
  const doctors = doctorsData ?? []

  const leaveStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/jadwal-dokter/cuti/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cuti-dokter'] }); refetchLeaves() },
  })

  const deleteSchedule = useMutation({
    mutationFn: (id: string) => api.delete(`/jadwal-dokter/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jadwal-dokter-all'] }),
  })

  const days: CalDay[] = calData?.days ?? []
  const schedules: Schedule[] = schedulesData ?? []
  const leaves: Leave[] = leavesData ?? []

  // Group schedules by doctor
  const byDoctor = schedules.reduce<Record<string, { name: string; days: Schedule[] }>>((acc, s) => {
    if (!acc[s.doctorId]) acc[s.doctorId] = { name: s.doctorName, days: [] }
    acc[s.doctorId].days.push(s)
    return acc
  }, {})

  const pendingLeaves = leaves.filter(l => l.status === 'pending').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-teal-600" /> Jadwal Dokter & Shift
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Atur jadwal kerja dan kapasitas antrian per dokter</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> Tambah Jadwal
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        {(['kalender', 'jadwal', 'cuti'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium capitalize border-b-2 transition flex items-center gap-1.5 ${tab === t ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'cuti' ? 'Permintaan Cuti' : t === 'kalender' ? 'Kalender Mingguan' : 'Daftar Jadwal'}
            {t === 'cuti' && pendingLeaves > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{pendingLeaves}</span>
            )}
          </button>
        ))}
      </div>

      {/* Kalender Mingguan */}
      {tab === 'kalender' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setWeekOffset(o => o - 1)} className="p-1.5 border rounded-lg hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold text-gray-700">
              {weekOffset === 0 ? 'Minggu Ini' : weekOffset === 1 ? 'Minggu Depan' : `${dateFrom}`}
            </span>
            <button onClick={() => setWeekOffset(o => o + 1)} className="p-1.5 border rounded-lg hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
          </div>

          {calLoading ? (
            <div className="text-center py-12 text-gray-400">Memuat kalender...</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {days.map(d => (
                    <div key={d.date} className={`text-center text-xs font-medium p-2 rounded-lg ${d.date === new Date().toISOString().split('T')[0] ? 'bg-teal-500 text-white' : 'text-gray-500'}`}>
                      <div>{d.dayName}</div>
                      <div className="font-normal text-[10px]">{new Date(d.date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</div>
                    </div>
                  ))}
                </div>
                {/* Slots */}
                <div className="grid grid-cols-7 gap-1">
                  {days.map((d, di) => (
                    <div key={d.date} className="space-y-1 min-h-[120px]">
                      {d.slots.filter(s => s.hasSchedule || s.leave).map((slot, si) => (
                        <div key={slot.doctorId}
                          className={`text-xs p-2 rounded-lg ${slot.leave?.status === 'approved' ? 'bg-red-100 text-red-600 line-through' : slot.available ? SHIFT_COLORS[si % SHIFT_COLORS.length] : 'bg-gray-50 text-gray-400'}`}>
                          <p className="font-medium truncate">{slot.doctorName.split(' ')[0]}</p>
                          {slot.shiftStart && <p className="text-[10px] opacity-80">{slot.shiftStart}–{slot.shiftEnd}</p>}
                          {slot.leave && <p className="text-[10px]">🏖️ {slot.leave.status}</p>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Daftar Jadwal */}
      {tab === 'jadwal' && (
        <div className="space-y-4">
          {Object.entries(byDoctor).map(([docId, { name, days: dSchedules }], idx) => (
            <div key={docId} className="bg-white rounded-2xl border p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-8 rounded-full ${SHIFT_COLORS[idx % SHIFT_COLORS.length].split(' ')[0]}`} />
                <div>
                  <p className="font-semibold text-gray-800">{name}</p>
                  <p className="text-xs text-gray-400">{dSchedules.filter(s => s.isActive).length} hari aktif</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {dSchedules.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-xs font-medium text-gray-700">{s.dayName}</p>
                      <p className="text-xs text-gray-500">{s.shiftStart}–{s.shiftEnd}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Users className="w-3 h-3" />{s.maxPatients}</p>
                    </div>
                    <button onClick={() => { if (confirm(`Hapus jadwal ${s.dayName}?`)) deleteSchedule.mutate(s.id) }}
                      className="p-1 text-gray-300 hover:text-red-400 rounded">×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(byDoctor).length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Belum ada jadwal. Klik "Tambah Jadwal" untuk memulai.
            </div>
          )}
        </div>
      )}

      {/* Permintaan Cuti */}
      {tab === 'cuti' && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Dokter</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tanggal</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Alasan</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!leaves.length ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Tidak ada permintaan cuti</td></tr>
              ) : leaves.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{l.doctorName}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(l.leaveDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{l.reason ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[l.status] ?? 'bg-gray-100'}`}>
                      {l.status === 'pending' ? 'Menunggu' : l.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {l.status === 'pending' && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => leaveStatusMutation.mutate({ id: l.id, status: 'approved' })}
                          className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => leaveStatusMutation.mutate({ id: l.id, status: 'declined' })}
                          className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddScheduleModal doctors={doctors} onClose={() => setShowAdd(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ['jadwal-dokter-all'] })} />}
    </div>
  )
}
