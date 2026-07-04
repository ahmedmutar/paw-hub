import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ClipboardList, Plus, Search, RefreshCw,
  AlertTriangle, Stethoscope, CheckCircle2,
  XCircle, Clock, User, Phone, ChevronDown,
  Zap, RotateCcw, X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, formatDateTime, petAge } from '@/lib/utils'
import {
  Button, Input, Textarea, Select, SelectItem,
  Dialog, DialogContent, Badge, EmptyState, Spinner,
} from '@/components/ui'
import { useAuthStore } from '@/stores/auth.store'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats { total: number; pending: number; accepted: number; selesai: number; cancelled: number }
interface Doctor { id: string; fullname: string; todayLoad: number }
interface Patient { id: string; petName: string; petCategory: string; idMember: string; owner: { ownerName: string; phoneNumber: string } }
interface Registration {
  id: string; idNumber: string; queueNumber: number; visitType: string
  isPriority: boolean; complaint: string; registrant: string
  acceptanceStatus: string; cancelReason?: string; createdAt: string
  patient: { id: string; petName: string; petCategory: string; petGender?: string; petYearAge?: number; petMonthAge?: number; idMember: string; owner: { ownerName: string; phoneNumber: string }; medicalRecord?: { allergies?: string; chronicConditions?: string } }
  doctor: { id: string; fullname: string }
  checkUpResult?: { id: string; statusFinish: boolean; statusPaidOff: boolean; diagnosa?: string }
}

// ─── Pet icon helper ──────────────────────────────────────────────────────────
const petIcons: Record<string, { icon: string; color: string }> = {
  'Anjing':  { icon: '🐕', color: 'bg-amber-100 text-amber-700' },
  'Kucing':  { icon: '🐈', color: 'bg-purple-100 text-purple-700' },
  'Kelinci': { icon: '🐇', color: 'bg-pink-100 text-pink-700' },
  'Burung':  { icon: '🦜', color: 'bg-sky-100 text-sky-700' },
  'Ikan':    { icon: '🐟', color: 'bg-blue-100 text-blue-700' },
}
const getPetStyle = (cat: string) => petIcons[cat] ?? { icon: '🐾', color: 'bg-gray-100 text-gray-600' }

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, checkUpResult }: { status: string; checkUpResult?: Registration['checkUpResult'] }) {
  if (status === 'cancelled') return <Badge variant="red">Dibatalkan</Badge>
  if (status === 'declined')  return <Badge variant="red">Ditolak</Badge>
  if (status === 'pending')   return <Badge variant="yellow">Menunggu</Badge>
  if (status === 'accepted') {
    if (!checkUpResult)                    return <Badge variant="blue">Diterima</Badge>
    if (checkUpResult.statusPaidOff)       return <Badge variant="green">Lunas</Badge>
    if (checkUpResult.statusFinish)        return <Badge variant="teal">Menunggu Bayar</Badge>
    return <Badge variant="blue">Dalam Pemeriksaan</Badge>
  }
  return <Badge variant="gray">{status}</Badge>
}

// ─── Patient Autocomplete ─────────────────────────────────────────────────────
function PatientSearchInput({ value, onSelect }: {
  value: Patient | null
  onSelect: (p: Patient | null) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['pasien-search', search],
    queryFn:  async () => (await api.get(`/pasien?search=${search}&limit=10`)).data.data as Patient[],
    enabled:  search.length >= 1,
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (value) {
    const { icon, color } = getPetStyle(value.petCategory)
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border border-primary-300 bg-primary-50">
        <div className="flex items-center gap-2.5">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${color}`}>{icon}</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{value.petName}</p>
            <p className="text-xs text-gray-500">{value.petCategory} · {value.owner.ownerName}</p>
          </div>
        </div>
        <button onClick={() => onSelect(null)} className="p-1 rounded hover:bg-primary-100 text-primary-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <label className="text-sm font-medium text-gray-700 mb-1 block">
        Pasien <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Ketik nama hewan atau pemilik..."
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      {open && data && data.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {data.map((p) => {
            const { icon, color } = getPetStyle(p.petCategory)
            return (
              <button
                key={p.id}
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary-50 text-left transition-colors"
                onMouseDown={() => { onSelect(p); setSearch(''); setOpen(false) }}
              >
                <span className={`w-7 h-7 rounded-md flex items-center justify-center text-base ${color}`}>{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.petName}</p>
                  <p className="text-xs text-gray-400">{p.petCategory} · {p.owner.ownerName}</p>
                </div>
                <span className="text-xs text-gray-300 font-mono shrink-0">{p.idMember}</span>
              </button>
            )
          })}
        </div>
      )}
      {open && search.length >= 2 && (!data || data.length === 0) && (
        <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3 text-sm text-gray-400">
          Pasien tidak ditemukan.
        </div>
      )}
    </div>
  )
}

// ─── Form Modal ───────────────────────────────────────────────────────────────
function RegistrasiModal({
  open, onClose, defaultPatientId,
}: { open: boolean; onClose: () => void; defaultPatientId?: string }) {
  const qc     = useQueryClient()
  const user   = useAuthStore((s) => s.user)

  const [patient,    setPatient]    = useState<Patient | null>(null)
  const [doctorId,   setDoctorId]   = useState('')
  const [complaint,  setComplaint]  = useState('')
  const [visitType,  setVisitType]  = useState<'baru' | 'kontrol'>('baru')
  const [isPriority, setIsPriority] = useState(false)
  const [errors,     setErrors]     = useState<Record<string, string>>({})

  // Pre-fill patient jika dari halaman detail
  const { data: prePatient } = useQuery({
    queryKey: ['pasien-detail-pre', defaultPatientId],
    queryFn:  async () => (await api.get(`/pasien/${defaultPatientId}`)).data.data,
    enabled:  !!defaultPatientId && open,
  })
  useEffect(() => {
    if (prePatient && !patient) setPatient(prePatient)
  }, [prePatient])

  const { data: doctorData } = useQuery({
    queryKey: ['registrasi-dokter'],
    queryFn:  async () => (await api.get('/registrasi/dokter')).data.data as Doctor[],
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (payload: object) => api.post('/registrasi', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrasi-antrian'] })
      qc.invalidateQueries({ queryKey: ['registrasi-stats'] })
      onClose()
      resetForm()
    },
  })

  const resetForm = () => {
    setPatient(null); setDoctorId(''); setComplaint('')
    setVisitType('baru'); setIsPriority(false); setErrors({})
  }

  const handleSubmit = () => {
    const e: Record<string, string> = {}
    if (!patient)   e.patient   = 'Pilih pasien terlebih dahulu'
    if (!doctorId)  e.doctor    = 'Pilih dokter terlebih dahulu'
    if (!complaint.trim()) e.complaint = 'Keluhan wajib diisi'
    if (Object.keys(e).length) { setErrors(e); return }

    mutation.mutate({
      patientId:    patient!.id,
      doctorUserId: doctorId,
      complaint:    complaint.trim(),
      registrant:   user?.fullname ?? 'Resepsionis',
      visitType,
      isPriority,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetForm() } }}>
      <DialogContent title="Daftarkan Pasien Berobat" description="Isi data pendaftaran kunjungan" className="max-w-lg">
        <div className="space-y-4">

          {/* Pasien */}
          <PatientSearchInput value={patient} onSelect={setPatient} />
          {errors.patient && <p className="text-xs text-red-500 -mt-2">{errors.patient}</p>}

          {/* Dokter */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Dokter <span className="text-red-500">*</span>
            </label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">— Pilih dokter —</option>
              {(doctorData ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullname}  ({d.todayLoad} pasien hari ini)
                </option>
              ))}
            </select>
            {errors.doctor && <p className="text-xs text-red-500 mt-1">{errors.doctor}</p>}
          </div>

          {/* Keluhan */}
          <Textarea
            label="Keluhan"
            required
            placeholder="Deskripsikan keluhan utama pasien..."
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            error={errors.complaint}
            rows={3}
          />

          {/* Jenis kunjungan + Prioritas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Jenis Kunjungan</p>
              <div className="flex gap-2">
                {(['baru', 'kontrol'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisitType(v)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      visitType === v
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary-300'
                    }`}
                  >
                    {v === 'baru' ? '🆕 Baru' : '🔄 Kontrol'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Prioritas</p>
              <button
                type="button"
                onClick={() => setIsPriority(!isPriority)}
                className={`w-full py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                  isPriority
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-red-300'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                {isPriority ? 'Darurat 🚨' : 'Normal'}
              </button>
            </div>
          </div>

          {isPriority && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">Pasien darurat akan diprioritaskan di atas antrian normal.</p>
            </div>
          )}

          {/* Tombol */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => { onClose(); resetForm() }}>
              Batal
            </Button>
            <Button className="flex-1" loading={mutation.isPending} onClick={handleSubmit}>
              Daftarkan
            </Button>
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-500 text-center">
              {(mutation.error as any)?.response?.data?.message ?? 'Gagal menyimpan.'}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Batalkan / Tolak modal ───────────────────────────────────────────────────
function CancelModal({
  open, onClose, regId, action,
}: { open: boolean; onClose: () => void; regId: string; action: 'batalkan' | 'tolak' }) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post(`/registrasi/${regId}/${action}`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrasi-antrian'] })
      qc.invalidateQueries({ queryKey: ['registrasi-stats'] })
      onClose(); setReason('')
    },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setReason('') } }}>
      <DialogContent
        title={action === 'batalkan' ? 'Batalkan Pendaftaran' : 'Tolak Pendaftaran'}
        description="Berikan alasan agar tercatat di sistem."
      >
        <div className="space-y-4">
          <Textarea
            label="Alasan (opsional)"
            placeholder="Mis. Pasien tidak jadi datang, dokter penuh, dll..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { onClose(); setReason('') }}>
              Kembali
            </Button>
            <Button variant="danger" className="flex-1" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              {action === 'batalkan' ? 'Batalkan' : 'Tolak'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Terima modal confirm ─────────────────────────────────────────────────────
function TerimaConfirm({ open, onClose, regId }: { open: boolean; onClose: () => void; regId: string }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => api.post(`/registrasi/${regId}/terima`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrasi-antrian'] })
      qc.invalidateQueries({ queryKey: ['registrasi-stats'] })
      onClose()
    },
  })
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent title="Terima Pendaftaran" description="Pasien akan masuk ke dalam antrean pemeriksaan.">
        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Kembali</Button>
          <Button className="flex-1" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            ✓ Terima
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Queue Card ───────────────────────────────────────────────────────────────
function QueueCard({ reg, userRole, onTerima, onBatalkan, onTolak }: {
  reg: Registration
  userRole: string
  onTerima:   (id: string) => void
  onBatalkan: (id: string) => void
  onTolak:    (id: string) => void
}) {
  const navigate = useNavigate()
  const { icon, color } = getPetStyle(reg.patient.petCategory)
  const medRec = reg.patient.medicalRecord

  return (
    <div className={`card p-4 transition-shadow hover:shadow-md ${reg.isPriority ? 'border-l-4 border-red-400' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Nomor antrian */}
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm
          ${reg.isPriority ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
          {reg.isPriority ? '🚨' : `#${reg.queueNumber}`}
        </div>

        {/* Info utama */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`w-6 h-6 rounded-md flex items-center justify-center text-sm ${color}`}>{icon}</span>
            <button
              onClick={() => navigate(`/pasien/${reg.patient.id}`)}
              className="font-semibold text-gray-900 hover:text-primary-600 transition-colors text-sm"
            >
              {reg.patient.petName}
            </button>
            <StatusBadge status={reg.acceptanceStatus} checkUpResult={reg.checkUpResult} />
            {reg.visitType === 'kontrol' && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">Kontrol</span>
            )}
          </div>

          <p className="text-xs text-gray-500 mb-1.5">
            <User className="w-3 h-3 inline mr-1" />
            {reg.patient.owner.ownerName}
            {reg.patient.owner.phoneNumber && (
              <><span className="mx-1.5 text-gray-300">·</span>
              <Phone className="w-3 h-3 inline mr-1" />{reg.patient.owner.phoneNumber}</>
            )}
            <span className="mx-1.5 text-gray-300">·</span>
            <Stethoscope className="w-3 h-3 inline mr-1" />
            {reg.doctor.fullname}
          </p>

          <p className="text-sm text-gray-700 line-clamp-2">
            <span className="text-gray-400 text-xs">Keluhan: </span>{reg.complaint}
          </p>

          {/* Peringatan medis */}
          {medRec && (medRec.allergies || medRec.chronicConditions) && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {[medRec.allergies && `Alergi: ${medRec.allergies}`, medRec.chronicConditions && medRec.chronicConditions]
                .filter(Boolean).join(' · ')}
            </div>
          )}

          {reg.cancelReason && (
            <p className="mt-1.5 text-xs text-red-500 italic">Alasan: {reg.cancelReason}</p>
          )}

          {reg.checkUpResult?.diagnosa && (
            <p className="mt-1 text-xs text-gray-500">Dx: {reg.checkUpResult.diagnosa}</p>
          )}
        </div>

        {/* Actions + waktu */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          <p className="text-xs text-gray-400">{formatDateTime(reg.createdAt)}</p>

          {reg.acceptanceStatus === 'pending' && (
            <div className="flex gap-1.5">
              {(userRole === 'admin' || userRole === 'dokter') && (
                <Button size="sm" onClick={() => onTerima(reg.id)}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Terima
                </Button>
              )}
              {(userRole === 'admin' || userRole === 'resepsionis') && (
                <Button size="sm" variant="outline" onClick={() => onBatalkan(reg.id)}>
                  <XCircle className="w-3.5 h-3.5" /> Batal
                </Button>
              )}
              {(userRole === 'admin' || userRole === 'dokter') && (
                <Button size="sm" variant="danger" onClick={() => onTolak(reg.id)}>
                  Tolak
                </Button>
              )}
            </div>
          )}

          {reg.acceptanceStatus === 'accepted' && !reg.checkUpResult && (
            <Button size="sm" onClick={() => navigate(`/pemeriksaan/${reg.id}`)}>
              Mulai Periksa
            </Button>
          )}

          {reg.acceptanceStatus === 'accepted' && reg.checkUpResult && !reg.checkUpResult.statusFinish && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/pemeriksaan/${reg.id}`)}>
              Lanjutkan
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Halaman Utama ────────────────────────────────────────────────────────────
export default function PendaftaranPage() {
  const location   = useLocation()
  const user       = useAuthStore((s) => s.user)
  const userRole   = user?.role ?? ''

  const [openModal,    setOpenModal]    = useState(false)
  const [cancelModal,  setCancelModal]  = useState<{ id: string; action: 'batalkan' | 'tolak' } | null>(null)
  const [terimaId,     setTerimaId]     = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('semua')
  const [doctorFilter, setDoctorFilter] = useState('')

  // Pre-fill patientId dari navigate state (tombol "Daftarkan Berobat" di detail pasien)
  const prePatientId = (location.state as any)?.patientId as string | undefined
  useEffect(() => {
    if (prePatientId) { setOpenModal(true) }
  }, [prePatientId])

  const { data: statsData } = useQuery({
    queryKey: ['registrasi-stats'],
    queryFn:  async () => (await api.get('/registrasi/stats')).data.data as Stats,
    refetchInterval: 30_000,
  })

  const { data: doctorData } = useQuery({
    queryKey: ['registrasi-dokter'],
    queryFn:  async () => (await api.get('/registrasi/dokter')).data.data as Doctor[],
  })

  const { data: antrian, isLoading, refetch } = useQuery({
    queryKey: ['registrasi-antrian', statusFilter, doctorFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'semua') params.set('status', statusFilter)
      if (doctorFilter)            params.set('doctorId', doctorFilter)
      return (await api.get(`/registrasi/antrian-hari-ini?${params}`)).data.data as Registration[]
    },
    refetchInterval: 30_000,
  })

  const stats = statsData ?? { total: 0, pending: 0, accepted: 0, selesai: 0, cancelled: 0 }

  const filterTabs = [
    { key: 'semua',    label: 'Semua',         count: stats.total },
    { key: 'pending',  label: 'Menunggu',       count: stats.pending },
    { key: 'accepted', label: 'Diterima',       count: stats.accepted },
    { key: 'cancelled',label: 'Dibatalkan',     count: stats.cancelled },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl text-gray-900">Pendaftaran Berobat</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Antrian hari ini · {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          {(userRole === 'admin' || userRole === 'resepsionis') && (
            <Button size="sm" onClick={() => setOpenModal(true)}>
              <Plus className="w-4 h-4" />
              Daftarkan Pasien
            </Button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Hari Ini', value: stats.total,     icon: <ClipboardList className="w-4 h-4" />, color: 'text-gray-600',   bg: 'bg-gray-50' },
          { label: 'Menunggu',       value: stats.pending,   icon: <Clock className="w-4 h-4" />,         color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Diterima',       value: stats.accepted,  icon: <Stethoscope className="w-4 h-4" />,   color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Selesai',        value: stats.selesai,   icon: <CheckCircle2 className="w-4 h-4" />,  color: 'text-emerald-600',bg: 'bg-emerald-50' },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${s.bg} ${s.color} flex items-center justify-center`}>{s.icon}</div>
              <div>
                <p className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Tab status */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {filterTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-1.5 px-1.5 rounded-full text-xs ${statusFilter === t.key ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-500'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filter dokter */}
        {doctorData && doctorData.length > 1 && (
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Semua Dokter</option>
            {doctorData.map((d) => (
              <option key={d.id} value={d.id}>{d.fullname} ({d.todayLoad})</option>
            ))}
          </select>
        )}

        <div className="ml-auto text-xs text-gray-400 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Auto-refresh 30 detik
        </div>
      </div>

      {/* Queue list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner className="w-7 h-7" /></div>
      ) : !antrian || antrian.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ClipboardList className="w-10 h-10" />}
            title="Belum ada pendaftaran hari ini"
            description="Klik tombol Daftarkan Pasien untuk menambah antrian."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {antrian.map((reg) => (
            <QueueCard
              key={reg.id}
              reg={reg}
              userRole={userRole}
              onTerima={(id) => setTerimaId(id)}
              onBatalkan={(id) => setCancelModal({ id, action: 'batalkan' })}
              onTolak={(id) => setCancelModal({ id, action: 'tolak' })}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <RegistrasiModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        defaultPatientId={prePatientId}
      />

      {cancelModal && (
        <CancelModal
          open
          onClose={() => setCancelModal(null)}
          regId={cancelModal.id}
          action={cancelModal.action}
        />
      )}

      {terimaId && (
        <TerimaConfirm
          open
          onClose={() => setTerimaId(null)}
          regId={terimaId}
        />
      )}
    </div>
  )
}
