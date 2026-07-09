import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PawPrint, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Branch {
  id: string
  branchName: string
  address?: string
  phoneNumber?: string
  operatingHours?: string
}

interface Doctor {
  id: string
  fullname: string
  branchId: string
}

interface Slot {
  time: string
  available: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STEPS = ['Pilih Klinik & Dokter', 'Pilih Jadwal', 'Data Hewan', 'Konfirmasi']

function formatDate(d: Date) {
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function dateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

// ── Step Components ───────────────────────────────────────────────────────────

function StepClinic({ branches, doctors, form, set, onNext, lockedBranchId }: any) {
  const [branchId, setBranchId] = useState(form.branchId ?? lockedBranchId ?? '')
  const [doctorUserId, setDoctorUserId] = useState(form.doctorUserId)

  // Kalau datang lewat link khusus klinik (branchId di URL), kunci ke cabang itu
  // begitu data cabangnya sudah termuat — mencegah customer salah pilih klinik lain.
  useEffect(() => {
    if (lockedBranchId && !branchId && (branches ?? []).length > 0) {
      setBranchId(lockedBranchId)
    }
  }, [lockedBranchId, branches, branchId])

  const filteredDoctors = (doctors ?? []).filter((d: Doctor) => !branchId || d.branchId === branchId)
  const selectedBranch  = (branches ?? []).find((b: Branch) => b.id === branchId)

  function handleNext() {
    if (!branchId || !doctorUserId) return
    set({ branchId, doctorUserId })
    onNext()
  }

  return (
    <div className="space-y-5">
      {lockedBranchId ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Klinik Tujuan</label>
          {selectedBranch ? (
            <div className="p-4 rounded-xl border-2 border-primary-500 bg-primary-50">
              <p className="font-semibold text-gray-800">{selectedBranch.branchName}</p>
              {selectedBranch.address && <p className="text-sm text-gray-500 mt-0.5">{selectedBranch.address}</p>}
              {selectedBranch.operatingHours && <p className="text-xs text-gray-400 mt-1">⏰ {selectedBranch.operatingHours}</p>}
            </div>
          ) : (branches ?? []).length === 0 ? (
            <p className="text-red-500 text-sm">Klinik tidak ditemukan. Periksa kembali link booking yang Anda gunakan.</p>
          ) : (
            <p className="text-gray-400 text-sm">Memuat data klinik...</p>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Klinik *</label>
          <div className="grid gap-3">
            {(branches ?? []).map((b: Branch) => (
              <button key={b.id} type="button"
                onClick={() => { setBranchId(b.id); setDoctorUserId('') }}
                className={cn(
                  'text-left p-4 rounded-xl border-2 transition-all',
                  branchId === b.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300',
                )}>
                <p className="font-semibold text-gray-800">{b.branchName}</p>
                {b.address && <p className="text-sm text-gray-500 mt-0.5">{b.address}</p>}
                {b.operatingHours && <p className="text-xs text-gray-400 mt-1">⏰ {b.operatingHours}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {branchId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Dokter *</label>
          {filteredDoctors.length === 0 ? (
            <p className="text-gray-400 text-sm">Tidak ada dokter tersedia di klinik ini</p>
          ) : (
            <div className="grid gap-2">
              {filteredDoctors.map((d: Doctor) => (
                <button key={d.id} type="button"
                  onClick={() => setDoctorUserId(d.id)}
                  className={cn(
                    'text-left px-4 py-3 rounded-xl border-2 transition-all',
                    doctorUserId === d.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300',
                  )}>
                  <p className="font-medium text-gray-800">👨‍⚕️ {d.fullname}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!lockedBranchId && selectedBranch && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm">
          <p className="font-medium text-blue-800 mb-1">{selectedBranch.branchName}</p>
          {selectedBranch.phoneNumber && <p className="text-blue-600">📞 {selectedBranch.phoneNumber}</p>}
        </div>
      )}

      <button onClick={handleNext} disabled={!branchId || !doctorUserId}
        className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold disabled:opacity-40 hover:bg-primary-700 transition-colors">
        Lanjut →
      </button>
    </div>
  )
}

function StepSchedule({ form, set, onNext, onBack }: any) {
  const today  = new Date()
  const [date, setDate]     = useState<Date>(form.appointmentDate ? new Date(form.appointmentDate) : addDays(today, 1))
  const [time, setTime]     = useState(form.appointmentTime ?? '')
  const [weekOffset, setWeekOffset] = useState(0)

  const dateStr = dateInput(date)

  const slotsQ = useQuery<Slot[]>({
    queryKey: ['slots', form.doctorUserId, dateStr],
    queryFn: () => api.get(`/appointment/slots?doctorUserId=${form.doctorUserId}&date=${dateStr}`)
      .then((r: any) => r.data.data),
    enabled: !!form.doctorUserId && !!dateStr,
  })

  const weekStart = addDays(today, weekOffset * 7 + 1)
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  function handleNext() {
    if (!dateStr || !time) return
    set({ appointmentDate: dateStr, appointmentTime: time })
    onNext()
  }

  return (
    <div className="space-y-5">
      {/* Week navigator */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
            disabled={weekOffset === 0}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-600">Pilih Tanggal</span>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(d => {
            const isSelected = dateInput(d) === dateInput(date)
            const isPast     = d < today
            return (
              <button key={d.toISOString()} type="button"
                onClick={() => { if (!isPast) { setDate(d); setTime('') } }}
                disabled={isPast}
                className={cn(
                  'flex flex-col items-center py-2 rounded-xl text-xs transition-all',
                  isSelected ? 'bg-primary-600 text-white' : 'hover:bg-gray-100',
                  isPast && 'opacity-30 cursor-not-allowed',
                )}>
                <span className="text-[10px] opacity-70">
                  {d.toLocaleDateString('id-ID', { weekday: 'short' })}
                </span>
                <span className="font-bold text-sm">{d.getDate()}</span>
                <span className={cn('text-[9px]', isSelected ? 'opacity-70' : 'text-gray-400')}>
                  {d.toLocaleDateString('id-ID', { month: 'short' })}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Slot grid */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Pilih Jam — <span className="text-gray-500">{formatDate(date)}</span>
        </p>
        {slotsQ.isLoading ? (
          <p className="text-gray-400 text-sm text-center py-4">Memuat slot...</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {(slotsQ.data ?? []).map(slot => (
              <button key={slot.time} type="button"
                onClick={() => slot.available && setTime(slot.time)}
                disabled={!slot.available}
                className={cn(
                  'py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
                  time === slot.time ? 'border-primary-500 bg-primary-600 text-white' :
                  slot.available ? 'border-gray-200 hover:border-primary-300 hover:bg-primary-50' :
                  'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed line-through',
                )}>
                {slot.time}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">Slot yang dicoret sudah dipesan</p>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors">
          ← Kembali
        </button>
        <button onClick={handleNext} disabled={!time}
          className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-semibold disabled:opacity-40 hover:bg-primary-700 transition-colors">
          Lanjut →
        </button>
      </div>
    </div>
  )
}

function StepPetData({ form, set, onNext, onBack }: any) {
  const [f, setF] = useState({
    ownerName:   form.ownerName   ?? '',
    ownerPhone:  form.ownerPhone  ?? '',
    petName:     form.petName     ?? '',
    petCategory: form.petCategory ?? '',
    complaint:   form.complaint   ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!f.ownerName.trim())  e.ownerName  = 'Nama pemilik wajib diisi'
    if (!f.ownerPhone.trim()) e.ownerPhone = 'Nomor WA wajib diisi'
    if (!f.petName.trim())    e.petName    = 'Nama hewan wajib diisi'
    if (!f.complaint.trim())  e.complaint  = 'Keluhan wajib diisi'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const PET_CATEGORIES = ['Anjing', 'Kucing', 'Kelinci', 'Burung', 'Hamster', 'Reptil', 'Ikan', 'Lainnya']

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pemilik *</label>
          <input className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
            value={f.ownerName} onChange={e => setF(p => ({ ...p, ownerName: e.target.value }))} placeholder="Nama lengkap Anda" />
          {errors.ownerName && <p className="text-red-500 text-xs mt-1">{errors.ownerName}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WhatsApp *</label>
          <input className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
            value={f.ownerPhone} onChange={e => setF(p => ({ ...p, ownerPhone: e.target.value }))}
            placeholder="628xxxxxxxxxx" type="tel" />
          {errors.ownerPhone && <p className="text-red-500 text-xs mt-1">{errors.ownerPhone}</p>}
          <p className="text-xs text-gray-400 mt-1">Konfirmasi akan dikirim ke nomor ini</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nama Hewan *</label>
          <input className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
            value={f.petName} onChange={e => setF(p => ({ ...p, petName: e.target.value }))} placeholder="Nama hewan peliharaan" />
          {errors.petName && <p className="text-red-500 text-xs mt-1">{errors.petName}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Hewan</label>
          <select className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm bg-white"
            value={f.petCategory} onChange={e => setF(p => ({ ...p, petCategory: e.target.value }))}>
            <option value="">Pilih jenis...</option>
            {PET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Keluhan / Tujuan Kunjungan *</label>
        <textarea className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm min-h-[80px]"
          value={f.complaint} onChange={e => setF(p => ({ ...p, complaint: e.target.value }))}
          placeholder="Ceritakan keluhan atau tujuan pemeriksaan..." />
        {errors.complaint && <p className="text-red-500 text-xs mt-1">{errors.complaint}</p>}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors">
          ← Kembali
        </button>
        <button onClick={() => { if (validate()) { set(f); onNext() } }}
          className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors">
          Lanjut →
        </button>
      </div>
    </div>
  )
}

function StepConfirm({ form, branches, doctors, onBack, onSubmit, loading, error }: any) {
  const branch = (branches ?? []).find((b: Branch) => b.id === form.branchId)
  const doctor = (doctors ?? []).find((d: Doctor) => d.id === form.doctorUserId)
  const tanggal = form.appointmentDate ? formatDate(new Date(form.appointmentDate)) : '-'

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold text-gray-800">Ringkasan Booking</h3>
        {[
          { label: '🏥 Klinik',   value: branch?.branchName ?? '-' },
          { label: '👨‍⚕️ Dokter',  value: doctor?.fullname  ?? '-' },
          { label: '📅 Tanggal',  value: tanggal },
          { label: '⏰ Jam',      value: form.appointmentTime },
          { label: '🐾 Hewan',    value: `${form.petName}${form.petCategory ? ` (${form.petCategory})` : ''}` },
          { label: '👤 Pemilik',  value: form.ownerName },
          { label: '📞 WA',       value: form.ownerPhone },
          { label: '📋 Keluhan',  value: form.complaint },
        ].map(r => (
          <div key={r.label} className="flex gap-3 text-sm">
            <span className="w-32 text-gray-500 shrink-0">{r.label}</span>
            <span className="font-medium text-gray-800">{r.value}</span>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        <p className="font-medium mb-1">📌 Catatan:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Booking masih perlu <b>dikonfirmasi</b> oleh klinik</li>
          <li>Konfirmasi akan dikirim via WhatsApp ke <b>{form.ownerPhone}</b></li>
          <li>Hadir 10 menit sebelum jadwal</li>
        </ul>
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-xl">{error}</p>}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors">
          ← Kembali
        </button>
        <button onClick={onSubmit} disabled={loading}
          className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-semibold disabled:opacity-60 hover:bg-primary-700 transition-colors">
          {loading ? 'Mengirim...' : '✓ Kirim Booking'}
        </button>
      </div>
    </div>
  )
}

// ── Main Booking Page ──────────────────────────────────────────────────────────

export default function BookingPage() {
  const [searchParams] = useSearchParams()
  const lockedBranchId = searchParams.get('branchId') || undefined

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<any>({})
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const configQ = useQuery({
    queryKey: ['booking-config', lockedBranchId],
    queryFn: () => api.get('/booking/config', { params: { branchId: lockedBranchId } }).then((r: any) => r.data.data),
  })

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/booking', data),
    onSuccess: () => setDone(true),
    onError: (e: any) => setError(e.response?.data?.message ?? 'Gagal mengirim booking. Coba lagi.'),
  })

  function mergeAndNext(partial: any) {
    setForm((p: any) => ({ ...p, ...partial }))
    setStep(s => s + 1)
  }

  function handleSubmit() {
    setError('')
    mutation.mutate(form)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Booking Berhasil!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Booking untuk <b>{form.petName}</b> telah diterima. Konfirmasi akan dikirim via WhatsApp ke <b>{form.ownerPhone}</b>.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-left space-y-2 mb-6">
            <p><span className="text-gray-400">Tanggal:</span> <b>{form.appointmentDate ? formatDate(new Date(form.appointmentDate)) : '-'}</b></p>
            <p><span className="text-gray-400">Jam:</span> <b>{form.appointmentTime}</b></p>
          </div>
          <button onClick={() => { setStep(0); setForm({}); setDone(false) }}
            className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors">
            Buat Booking Baru
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-3">
            <PawPrint className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Booking Konsultasi</h1>
          <p className="text-gray-500 text-sm mt-1">
            {lockedBranchId && configQ.data?.branches?.[0]
              ? <>Untuk <b>{configQ.data.branches[0].branchName}</b></>
              : 'Daftarkan jadwal kunjungan hewan kesayangan Anda'}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                i < step ? 'bg-green-500 text-white' :
                i === step ? 'bg-primary-600 text-white' :
                'bg-gray-200 text-gray-400',
              )}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('h-0.5 flex-1', i < step ? 'bg-green-400' : 'bg-gray-200')} />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mb-4 text-center font-medium">{STEPS[step]}</p>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-lg p-6">
          {configQ.isLoading ? (
            <p className="text-center text-gray-400 py-8">Memuat data klinik...</p>
          ) : (
            <>
              {step === 0 && (
                <StepClinic
                  branches={configQ.data?.branches}
                  doctors={configQ.data?.doctors}
                  form={form}
                  set={(v: any) => setForm((p: any) => ({ ...p, ...v }))}
                  onNext={() => mergeAndNext({})}
                  lockedBranchId={lockedBranchId}
                />
              )}
              {step === 1 && (
                <StepSchedule form={form} set={(v: any) => setForm((p: any) => ({ ...p, ...v }))}
                  onNext={() => setStep(2)} onBack={() => setStep(0)} />
              )}
              {step === 2 && (
                <StepPetData form={form} set={(v: any) => setForm((p: any) => ({ ...p, ...v }))}
                  onNext={() => setStep(3)} onBack={() => setStep(1)} />
              )}
              {step === 3 && (
                <StepConfirm form={form} branches={configQ.data?.branches} doctors={configQ.data?.doctors}
                  onBack={() => setStep(2)} onSubmit={handleSubmit}
                  loading={mutation.isPending} error={error} />
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Paw Hub — Sistem Manajemen Klinik Hewan
        </p>
      </div>
    </div>
  )
}
