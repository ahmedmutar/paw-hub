import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { BedDouble, Plus, Calendar, ClipboardList, DollarSign, Search, ChevronLeft, ChevronRight, CheckCircle, XCircle, LogIn, LogOut, FileText, RefreshCw } from 'lucide-react'

interface Room { id: string; roomName: string; roomType: string; capacity: number; pricePerNight: number; isActive: boolean }
interface Booking {
  id: string; roomId: string; checkIn: string; checkOut: string; totalNights: number; totalPrice: number
  status: string; isPaid: boolean; specialNeeds: string; notes: string
  room: { roomName: string; roomType: string; pricePerNight: number }
  patient: { petName: string; petCategory: string }
  owner: { ownerName: string; phoneNumber: string }
}

function fmtRp(n: number) { return `Rp${n.toLocaleString('id-ID')}` }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700', checkedin: 'bg-blue-100 text-blue-700',
  checkedout: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-600',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu', checkedin: 'Check-in', checkedout: 'Check-out', cancelled: 'Dibatalkan',
}
const TYPE_COLOR: Record<string, string> = {
  vip: 'bg-yellow-100 text-yellow-800', reguler: 'bg-teal-100 text-teal-800', isolasi: 'bg-red-100 text-red-700',
}

function AddRoomModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ roomName: '', roomType: 'reguler', capacity: 1, pricePerNight: '', description: '' })
  const mut = useMutation({
    mutationFn: () => api.post('/pet-hotel/kamar', form),
    onSuccess: () => { onSaved(); onClose() },
  })
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-semibold text-gray-800">Tambah Kamar</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Nama Kamar</label>
            <input value={form.roomName} onChange={e => setForm(p => ({ ...p, roomName: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Kamar VIP 1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Tipe</label>
              <select value={form.roomType} onChange={e => setForm(p => ({ ...p, roomType: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                <option value="vip">VIP</option>
                <option value="reguler">Reguler</option>
                <option value="isolasi">Isolasi</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Kapasitas</label>
              <input type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: Number(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" min={1} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Harga / Malam (Rp)</label>
            <input type="number" value={form.pricePerNight} onChange={e => setForm(p => ({ ...p, pricePerNight: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="150000" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Deskripsi</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 h-20 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.roomName || !form.pricePerNight}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {mut.isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddBookingModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ roomId: '', patientId: '', ownerId: '', checkIn: '', checkOut: '', specialNeeds: '', notes: '' })
  const { data: rooms } = useQuery({ queryKey: ['hotel-rooms'], queryFn: () => api.get('/pet-hotel/kamar').then((r: any) => r.data.data) })
  const { data: patients } = useQuery({ queryKey: ['patients-list'], queryFn: () => api.get('/pasien').then((r: any) => r.data.data) })

  const mut = useMutation({
    mutationFn: () => api.post('/pet-hotel/booking', form),
    onSuccess: () => { onSaved(); onClose() },
  })

  const selectedPatient: any = patients?.find((p: any) => p.id === form.patientId)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <span className="font-semibold text-gray-800">Booking Hotel</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Kamar</label>
            <select value={form.roomId} onChange={e => setForm(p => ({ ...p, roomId: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Pilih kamar...</option>
              {(rooms ?? []).filter((r: any) => r.isActive).map((r: any) => (
                <option key={r.id} value={r.id}>{r.roomName} ({r.roomType}) — {fmtRp(Number(r.pricePerNight))}/malam</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Pasien</label>
            <select value={form.patientId} onChange={e => {
              const p: any = patients?.find((x: any) => x.id === e.target.value)
              setForm(prev => ({ ...prev, patientId: e.target.value, ownerId: p?.ownerId ?? '' }))
            }} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Pilih pasien...</option>
              {(patients ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.petName} ({p.petCategory}) — {p.owner?.ownerName}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Check-in</label>
              <input type="date" value={form.checkIn} onChange={e => setForm(p => ({ ...p, checkIn: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Check-out</label>
              <input type="date" value={form.checkOut} onChange={e => setForm(p => ({ ...p, checkOut: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Kebutuhan Khusus</label>
            <input value={form.specialNeeds} onChange={e => setForm(p => ({ ...p, specialNeeds: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Diet khusus, obat rutin, dll" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Catatan</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 h-16 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.roomId || !form.patientId || !form.checkIn || !form.checkOut}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {mut.isPending ? 'Menyimpan...' : 'Booking'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PetHotelPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'kamar' | 'booking' | 'occupancy'>('booking')
  const [showAddRoom, setShowAddRoom] = useState(false)
  const [showAddBooking, setShowAddBooking] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const { data: rooms, refetch: refetchRooms } = useQuery({
    queryKey: ['hotel-rooms'],
    queryFn: () => api.get('/pet-hotel/kamar').then((r: any) => r.data.data),
  })

  const { data: bookingsRes } = useQuery({
    queryKey: ['hotel-bookings', statusFilter, page],
    queryFn: () => api.get('/pet-hotel/booking', { params: { status: statusFilter === 'all' ? undefined : statusFilter, page, limit: 20 } }).then((r: any) => r.data),
  })

  const { data: occupancy } = useQuery({
    queryKey: ['hotel-occupancy', month, year],
    queryFn: () => api.get('/pet-hotel/occupancy', { params: { month, year } }).then((r: any) => r.data.data),
    enabled: tab === 'occupancy',
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/pet-hotel/booking/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hotel-bookings'] }),
  })

  const kasirMut = useMutation({
    mutationFn: (id: string) => api.post(`/pet-hotel/kasir/${id}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hotel-bookings'] }),
  })

  const bookings: Booking[] = bookingsRes?.data ?? []
  const roomList: Room[] = rooms ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><BedDouble className="w-6 h-6 text-teal-600" /> Pet Hotel</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manajemen penginapan hewan peliharaan</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddRoom(true)} className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Plus className="w-4 h-4" /> Kamar
          </button>
          <button onClick={() => setShowAddBooking(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Booking
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([['booking', 'Booking', ClipboardList], ['kamar', 'Daftar Kamar', BedDouble], ['occupancy', 'Kalender', Calendar]] as const).map(([v, l, Icon]) => (
          <button key={v} onClick={() => setTab(v as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === v ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>

      {/* Kamar Tab */}
      {tab === 'kamar' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roomList.map(room => (
            <div key={room.id} className="bg-white rounded-2xl border p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-800">{room.roomName}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[room.roomType]}`}>{room.roomType.toUpperCase()}</span>
                </div>
                {room.isActive ? <CheckCircle className="w-5 h-5 text-teal-500" /> : <XCircle className="w-5 h-5 text-gray-300" />}
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p>Kapasitas: {room.capacity} hewan</p>
                <p className="font-bold text-teal-600 text-base">{fmtRp(room.pricePerNight)}<span className="text-xs font-normal text-gray-400">/malam</span></p>
              </div>
            </div>
          ))}
          {roomList.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-400">
              <BedDouble className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Belum ada kamar. Tambah kamar terlebih dahulu.
            </div>
          )}
        </div>
      )}

      {/* Booking Tab */}
      {tab === 'booking' && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
            <div className="flex rounded-lg border overflow-hidden">
              {(['all', 'pending', 'checkedin', 'checkedout', 'cancelled'] as const).map(s => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
                  className={`px-3 py-2 text-xs font-medium ${statusFilter === s ? 'bg-teal-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {s === 'all' ? 'Semua' : STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <button onClick={() => qc.invalidateQueries({ queryKey: ['hotel-bookings'] })} className="p-1.5 border rounded-lg hover:bg-gray-50">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="divide-y">
            {bookings.length === 0 && <p className="text-center py-12 text-gray-400">Tidak ada booking</p>}
            {bookings.map(b => (
              <div key={b.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-800">{b.patient.petName} <span className="text-xs text-gray-400">({b.patient.petCategory})</span></p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                      {b.isPaid && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Lunas</span>}
                    </div>
                    <p className="text-sm text-gray-600">{b.owner.ownerName} · {b.owner.phoneNumber}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {b.room.roomName} ({b.room.roomType.toUpperCase()}) · {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} ({b.totalNights} malam)
                    </p>
                    {b.specialNeeds && <p className="text-xs text-amber-600 mt-1">⚠️ {b.specialNeeds}</p>}
                  </div>
                  <div className="text-right ml-3">
                    <p className="font-bold text-teal-600">{fmtRp(Number(b.totalPrice))}</p>
                    <div className="flex items-center gap-1 mt-2 justify-end flex-wrap">
                      {b.status === 'pending' && (
                        <button onClick={() => statusMut.mutate({ id: b.id, status: 'checkedin' })}
                          className="text-xs flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                          <LogIn className="w-3 h-3" /> Check-in
                        </button>
                      )}
                      {b.status === 'checkedin' && !b.isPaid && (
                        <button onClick={() => kasirMut.mutate(b.id)}
                          className="text-xs flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">
                          <DollarSign className="w-3 h-3" /> Bayar & Check-out
                        </button>
                      )}
                      {b.status === 'pending' && (
                        <button onClick={() => statusMut.mutate({ id: b.id, status: 'cancelled' })}
                          className="text-xs px-2 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100">
                          Batalkan
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {bookingsRes?.total > 20 && (
            <div className="flex items-center justify-between p-4 border-t">
              <span className="text-sm text-gray-500">Total: {bookingsRes.total}</span>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 border rounded disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <button disabled={page * 20 >= bookingsRes.total} onClick={() => setPage(p => p + 1)} className="p-1.5 border rounded disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Occupancy Tab */}
      {tab === 'occupancy' && (
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }} className="p-1 border rounded"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-semibold text-gray-800">{new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
            <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }} className="p-1 border rounded"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className="space-y-3">
            {(occupancy ?? []).map((b: Booking) => (
              <div key={b.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                <div className={`w-3 h-3 rounded-full ${b.status === 'checkedin' ? 'bg-blue-500' : b.status === 'pending' ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{b.patient.petName} → {b.room.roomName}</p>
                  <p className="text-xs text-gray-500">{b.owner.ownerName} · {fmtDate(b.checkIn)} – {fmtDate(b.checkOut)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[b.status]}`}>{STATUS_LABEL[b.status]}</span>
              </div>
            ))}
            {(occupancy ?? []).length === 0 && <p className="text-center py-8 text-gray-400">Tidak ada booking bulan ini</p>}
          </div>
        </div>
      )}

      {showAddRoom && <AddRoomModal onClose={() => setShowAddRoom(false)} onSaved={refetchRooms} />}
      {showAddBooking && <AddBookingModal onClose={() => setShowAddBooking(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['hotel-bookings'] })} />}
    </div>
  )
}
