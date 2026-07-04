import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, AlertTriangle, Weight, Thermometer, Heart,
  Wind, Search, Plus, Trash2, CheckCircle2, Save,
  PawPrint, Phone, ChevronRight, History, Syringe, X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, formatRupiah, petAge } from '@/lib/utils'
import { Badge, Button, Spinner, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'
import { useAuthStore } from '@/stores/auth.store'

// ─── Types ────────────────────────────────────────────────────────────────────
interface MasterItem     { id: string; itemName: string; unit: string; category: string; totalItem: string; priceItemId: string; sellingPrice: string }
interface MasterService  { id: string; serviceName: string; category: string; priceServiceId: string; sellingPrice: string }
interface MasterMedGroup { id: string; groupName: string; description?: string }

interface CheckUp {
  id: string
  anamnesa?: string; sign?: string; diagnosa?: string
  prognosis?: string; homeInstructions?: string
  weightKg?: string; temperature?: string; heartRate?: number; respiratoryRate?: number
  statusFinish: boolean; statusPaidOff: boolean
  statusOutpatientInpatient: number
  registration: {
    id: string; idNumber: string; complaint: string; visitType: string; isPriority: boolean
    patient: {
      id: string; petName: string; petCategory: string; petGender?: string
      petYearAge?: number; petMonthAge?: number; idMember: string
      owner: { ownerName: string; phoneNumber?: string; address?: string }
      medicalRecord?: { allergies?: string; chronicConditions?: string; specialNotes?: string }
      registrations: Array<{ id: string; createdAt: string; checkUpResult?: { diagnosa?: string; createdAt: string } }>
      weightRecords: Array<{ weightKg: string; recordedAt: string }>
      vaccinations:  Array<{ vaccineName: string; administeredAt: string; nextDueAt?: string }>
    }
    doctor: { fullname: string }
  }
  detailItems: Array<{
    id: string; quantity: string; priceOverall: string
    priceItem: { listOfItem: { itemName: string; unitItem: { unitName: string } } }
  }>
  detailServices: Array<{
    id: string; quantity: number; priceOverall: string
    priceService: { listOfService: { serviceName: string } }
  }>
  detailMedicineGroups: Array<{
    id: string; quantity: number; remark?: string
    medicineGroup: { groupName: string }
  }>
  weightRecord?: { weightKg: string; recordedAt: string }
}

// ─── Autocomplete search dropdown ─────────────────────────────────────────────
function SearchDropdown<T extends { id: string }>({
  placeholder, fetchFn, renderOption, onSelect, disabled,
}: {
  placeholder: string
  fetchFn: (search: string) => Promise<T[]>
  renderOption: (item: T) => React.ReactNode
  onSelect: (item: T) => void
  disabled?: boolean
}) {
  const [search, setSearch]   = useState('')
  const [results, setResults] = useState<T[]>([])
  const [open, setOpen]       = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (search.length >= 1) { const r = await fetchFn(search); setResults(r) }
      else setResults([])
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full px-4 py-2.5 hover:bg-primary-50 text-left text-sm transition-colors"
              onMouseDown={() => { onSelect(item); setSearch(''); setOpen(false) }}
            >
              {renderOption(item)}
            </button>
          ))}
        </div>
      )}
      {open && search.length >= 2 && results.length === 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-md px-4 py-3 text-sm text-gray-400">
          Tidak ditemukan.
        </div>
      )}
    </div>
  )
}

// ─── Vital sign input ──────────────────────────────────────────────────────────
function VitalInput({ icon, label, unit, value, onChange, placeholder, disabled }: {
  icon: React.ReactNode; label: string; unit: string
  value: string; onChange: (v: string) => void
  placeholder?: string; disabled?: boolean
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gray-500">{icon}</span>
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </div>
      <div className="flex items-end gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '—'}
          disabled={disabled}
          className="w-full text-xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-0 p-0 placeholder:text-gray-300 disabled:text-gray-400"
        />
        <span className="text-xs text-gray-400 mb-1 shrink-0">{unit}</span>
      </div>
    </div>
  )
}

// ─── Textarea field ────────────────────────────────────────────────────────────
function Field({ label, value, onChange, rows = 3, placeholder, disabled, hint }: {
  label: string; value: string; onChange: (v: string) => void
  rows?: number; placeholder?: string; disabled?: boolean; hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
      />
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PemeriksaanPage() {
  const { registrationId } = useParams<{ registrationId: string }>()
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const user     = useAuthStore((s) => s.user)
  const isDoctor = user?.role === 'dokter' || user?.role === 'admin'

  // ── State form ──
  const [anamnesa,       setAnamnesa]       = useState('')
  const [sign,           setSign]           = useState('')
  const [diagnosa,       setDiagnosa]       = useState('')
  const [prognosis,      setPrognosis]      = useState('')
  const [homeInst,       setHomeInst]       = useState('')
  const [weightKg,       setWeightKg]       = useState('')
  const [temperature,    setTemperature]    = useState('')
  const [heartRate,      setHeartRate]      = useState('')
  const [respiratoryRate,setRespiratoryRate]= useState('')
  const [saved,          setSaved]          = useState(false)

  // ── Load checkup by registrationId ──
  const { data: checkUp, isLoading, refetch } = useQuery({
    queryKey: ['pemeriksaan', registrationId],
    queryFn:  async () => {
      const r = await api.get(`/pemeriksaan/registrasi/${registrationId}`)
      return r.data.data as CheckUp | null
    },
    enabled: !!registrationId,
  })

  // ── Sync form state dari data ──
  useEffect(() => {
    if (!checkUp) return
    setAnamnesa(checkUp.anamnesa ?? '')
    setSign(checkUp.sign ?? '')
    setDiagnosa(checkUp.diagnosa ?? '')
    setPrognosis(checkUp.prognosis ?? '')
    setHomeInst(checkUp.homeInstructions ?? '')
    setWeightKg(checkUp.weightKg ? String(Number(checkUp.weightKg)) : '')
    setTemperature(checkUp.temperature ? String(Number(checkUp.temperature)) : '')
    setHeartRate(checkUp.heartRate ? String(checkUp.heartRate) : '')
    setRespiratoryRate(checkUp.respiratoryRate ? String(checkUp.respiratoryRate) : '')
  }, [checkUp?.id])

  // ── Mulai pemeriksaan ──
  const startMutation = useMutation({
    mutationFn: () => api.post('/pemeriksaan/mulai', { patientRegistrationId: registrationId }),
    onSuccess:  () => refetch(),
  })

  // ── Simpan (draft) ──
  const saveMutation = useMutation({
    mutationFn: () => api.put(`/pemeriksaan/${checkUp!.id}`, {
      anamnesa:         anamnesa || undefined,
      sign:             sign || undefined,
      diagnosa:         diagnosa || undefined,
      prognosis:        prognosis || undefined,
      homeInstructions: homeInst || undefined,
      weightKg:         weightKg ? Number(weightKg) : undefined,
      temperature:      temperature ? Number(temperature) : undefined,
      heartRate:        heartRate ? Number(heartRate) : undefined,
      respiratoryRate:  respiratoryRate ? Number(respiratoryRate) : undefined,
    }),
    onSuccess: () => {
      refetch(); setSaved(true); setTimeout(() => setSaved(false), 2000)
    },
  })

  // ── Selesai ──
  const selesaiMutation = useMutation({
    mutationFn: async () => {
      // Simpan dulu, lalu selesai
      await api.put(`/pemeriksaan/${checkUp!.id}`, {
        anamnesa: anamnesa || undefined, sign: sign || undefined,
        diagnosa: diagnosa || undefined, prognosis: prognosis || undefined,
        homeInstructions: homeInst || undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        temperature: temperature ? Number(temperature) : undefined,
        heartRate: heartRate ? Number(heartRate) : undefined,
        respiratoryRate: respiratoryRate ? Number(respiratoryRate) : undefined,
      })
      return api.post(`/pemeriksaan/${checkUp!.id}/selesai`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrasi-antrian'] })
      qc.invalidateQueries({ queryKey: ['registrasi-stats'] })
      navigate('/pendaftaran')
    },
  })

  // ── Tambah item ──
  const addItem = useMutation({
    mutationFn: (payload: object) => api.post(`/pemeriksaan/${checkUp!.id}/items`, payload),
    onSuccess:  () => refetch(),
  })
  const removeItem = useMutation({
    mutationFn: (itemId: string) => api.delete(`/pemeriksaan/${checkUp!.id}/items/${itemId}`),
    onSuccess:  () => refetch(),
  })

  // ── Tambah layanan ──
  const addService = useMutation({
    mutationFn: (payload: object) => api.post(`/pemeriksaan/${checkUp!.id}/services`, payload),
    onSuccess:  () => refetch(),
  })
  const removeService = useMutation({
    mutationFn: (svcId: string) => api.delete(`/pemeriksaan/${checkUp!.id}/services/${svcId}`),
    onSuccess:  () => refetch(),
  })

  // ── Tambah kelompok obat ──
  const addMedGroup = useMutation({
    mutationFn: (payload: object) => api.post(`/pemeriksaan/${checkUp!.id}/medicine-groups`, payload),
    onSuccess:  () => refetch(),
  })
  const removeMedGroup = useMutation({
    mutationFn: (mgId: string) => api.delete(`/pemeriksaan/${checkUp!.id}/medicine-groups/${mgId}`),
    onSuccess:  () => refetch(),
  })

  const isFinished = checkUp?.statusFinish ?? false
  const canEdit    = isDoctor && !isFinished

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8" /></div>
  }

  // Jika checkup belum ada, tampilkan halaman "Mulai"
  if (!checkUp) {
    return <StartScreen registrationId={registrationId!} onStart={() => startMutation.mutate()} loading={startMutation.isPending} />
  }

  const p      = checkUp.registration.patient
  const medRec = p.medicalRecord

  // Hitung total biaya
  const totalItems    = checkUp.detailItems.reduce((s, i) => s + Number(i.priceOverall), 0)
  const totalServices = checkUp.detailServices.reduce((s, i) => s + Number(i.priceOverall), 0)
  const totalAll      = totalItems + totalServices

  return (
    <div className="flex flex-col min-h-screen -mx-6 -mt-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/pendaftaran')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{p.petName}</span>
            <span className="text-gray-400">·</span>
            <span className="text-sm text-gray-500">{checkUp.registration.idNumber}</span>
            {checkUp.registration.isPriority && <Badge variant="red">🚨 Darurat</Badge>}
            {isFinished
              ? <Badge variant="green">✓ Selesai — Menunggu Pembayaran</Badge>
              : <Badge variant="blue">Sedang Diperiksa</Badge>
            }
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Dokter: {checkUp.registration.doctor.fullname}
            {' · '}Pemilik: {p.owner.ownerName}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {canEdit && (
            <Button variant="outline" size="sm" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              <Save className="w-3.5 h-3.5" />
              {saved ? 'Tersimpan ✓' : 'Simpan'}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" loading={selesaiMutation.isPending} onClick={() => selesaiMutation.mutate()}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Selesai Periksa
            </Button>
          )}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar kiri: info pasien ─── */}
        <div className="w-72 shrink-0 border-r border-gray-100 overflow-y-auto bg-gray-50/50 p-4 space-y-4">

          {/* Identitas hewan */}
          <div className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                <PawPrint className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{p.petName}</p>
                <p className="text-xs text-gray-400">{p.petCategory} · {p.idMember}</p>
              </div>
            </div>
            <dl className="space-y-1.5 text-xs">
              {[
                ['Kelamin', p.petGender],
                ['Umur', petAge(p.petYearAge, p.petMonthAge)],
                ['Pemilik', p.owner.ownerName],
                ['No HP', p.owner.phoneNumber],
              ].map(([k, v]) => v ? (
                <div key={k} className="flex justify-between">
                  <dt className="text-gray-400">{k}</dt>
                  <dd className="font-medium text-gray-700 text-right max-w-[55%] truncate">{v}</dd>
                </div>
              ) : null)}
            </dl>
          </div>

          {/* Keluhan */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Keluhan Masuk</p>
            <p className="text-sm text-gray-700">{checkUp.registration.complaint}</p>
            {checkUp.registration.visitType === 'kontrol' && (
              <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">Kunjungan Kontrol</span>
            )}
          </div>

          {/* Peringatan medis */}
          {medRec && (medRec.allergies || medRec.chronicConditions || medRec.specialNotes) && (
            <div className="card p-4 border-l-4 border-red-400">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Perhatian Medis</p>
              </div>
              {medRec.allergies && (
                <div className="mb-1.5">
                  <p className="text-xs text-gray-400">Alergi</p>
                  <p className="text-xs text-red-700 font-medium">{medRec.allergies}</p>
                </div>
              )}
              {medRec.chronicConditions && (
                <div className="mb-1.5">
                  <p className="text-xs text-gray-400">Kondisi Kronis</p>
                  <p className="text-xs text-gray-700">{medRec.chronicConditions}</p>
                </div>
              )}
              {medRec.specialNotes && (
                <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">{medRec.specialNotes}</p>
              )}
            </div>
          )}

          {/* Berat badan terakhir */}
          {p.weightRecords.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Weight className="w-3.5 h-3.5 text-blue-500" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Riwayat Berat</p>
              </div>
              <div className="space-y-1">
                {p.weightRecords.slice(0, 4).map((w, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">{formatDate(w.recordedAt, 'd MMM yy')}</span>
                    <span className={`text-sm font-bold ${i === 0 ? 'text-primary-600' : 'text-gray-500'}`}>
                      {Number(w.weightKg).toFixed(1)} kg
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vaksinasi terakhir */}
          {p.vaccinations.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Syringe className="w-3.5 h-3.5 text-emerald-500" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vaksinasi</p>
              </div>
              <div className="space-y-1.5">
                {p.vaccinations.map((v, i) => (
                  <div key={i}>
                    <p className="text-xs font-medium text-gray-700">{v.vaccineName}</p>
                    <p className="text-xs text-gray-400">{formatDate(v.administeredAt)}</p>
                    {v.nextDueAt && (
                      <p className="text-xs text-amber-600">Berikutnya: {formatDate(v.nextDueAt)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Riwayat diagnosa */}
          {p.registrations.filter(r => r.checkUpResult?.diagnosa).length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <History className="w-3.5 h-3.5 text-gray-500" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Riwayat Diagnosa</p>
              </div>
              <div className="space-y-1.5">
                {p.registrations
                  .filter(r => r.checkUpResult?.diagnosa && r.id !== checkUp.registration.id)
                  .slice(0, 3)
                  .map((r, i) => (
                    <div key={i}>
                      <p className="text-xs text-gray-700 line-clamp-2">{r.checkUpResult!.diagnosa}</p>
                      <p className="text-xs text-gray-400">{formatDate(r.createdAt)}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Konten utama ─── */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="vital">
            <TabsList className="mb-5">
              <TabsTrigger value="vital">Vital & Anamnesa</TabsTrigger>
              <TabsTrigger value="diagnosa">Diagnosa</TabsTrigger>
              <TabsTrigger value="terapi">
                Terapi & Obat
                {(checkUp.detailItems.length + checkUp.detailServices.length + checkUp.detailMedicineGroups.length) > 0 && (
                  <span className="ml-1.5 px-1.5 rounded-full bg-primary-100 text-primary-600 text-xs font-medium">
                    {checkUp.detailItems.length + checkUp.detailServices.length + checkUp.detailMedicineGroups.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Vital & Anamnesa ────────────────── */}
            <TabsContent value="vital" className="space-y-5">

              {/* Tanda vital */}
              <div className="card p-5">
                <h3 className="font-semibold text-gray-800 text-sm mb-4">Tanda Vital</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <VitalInput
                    icon={<Weight className="w-4 h-4" />} label="Berat Badan" unit="kg"
                    value={weightKg} onChange={setWeightKg} placeholder="0.0" disabled={!canEdit}
                  />
                  <VitalInput
                    icon={<Thermometer className="w-4 h-4" />} label="Suhu Tubuh" unit="°C"
                    value={temperature} onChange={setTemperature} placeholder="38.5" disabled={!canEdit}
                  />
                  <VitalInput
                    icon={<Heart className="w-4 h-4" />} label="Detak Jantung" unit="bpm"
                    value={heartRate} onChange={setHeartRate} placeholder="70" disabled={!canEdit}
                  />
                  <VitalInput
                    icon={<Wind className="w-4 h-4" />} label="Frekuensi Napas" unit="bpm"
                    value={respiratoryRate} onChange={setRespiratoryRate} placeholder="20" disabled={!canEdit}
                  />
                </div>
                {canEdit && weightKg && (
                  <p className="mt-3 text-xs text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg">
                    ✓ Berat badan akan otomatis tersimpan ke rekam medis hewan
                  </p>
                )}
              </div>

              {/* Anamnesa */}
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-gray-800 text-sm">Anamnesa & Pemeriksaan Fisik</h3>
                <Field
                  label="Anamnesa (Riwayat dari pemilik)"
                  value={anamnesa} onChange={setAnamnesa} rows={4}
                  placeholder="Keluhan utama, riwayat penyakit, obat yang sedang dikonsumsi..."
                  disabled={!canEdit}
                />
                <Field
                  label="Hasil Pemeriksaan Fisik (Tanda Klinis)"
                  value={sign} onChange={setSign} rows={4}
                  placeholder="Kondisi umum, turgor kulit, warna mukosa, auskultasi, palpasi..."
                  disabled={!canEdit}
                />
              </div>
            </TabsContent>

            {/* ── Tab 2: Diagnosa ────────────────────────── */}
            <TabsContent value="diagnosa" className="space-y-5">
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-gray-800 text-sm">Diagnosa & Rencana Terapi</h3>
                <Field
                  label="Diagnosa"
                  value={diagnosa} onChange={setDiagnosa} rows={3}
                  placeholder="Diagnosa utama dan diagnosis banding..."
                  disabled={!canEdit}
                />
                <Field
                  label="Prognosis"
                  value={prognosis} onChange={setPrognosis} rows={2}
                  placeholder="Prognosis: baik / sedang / buruk. Keterangan..."
                  disabled={!canEdit}
                />
                <Field
                  label="Instruksi Pulang untuk Pemilik"
                  value={homeInst} onChange={setHomeInst} rows={3}
                  placeholder="Cara pemberian obat, pantangan, kapan harus kontrol, tanda bahaya yang harus diwaspadai..."
                  disabled={!canEdit}
                  hint="Akan ditampilkan di struk/invoice untuk pemilik"
                />
              </div>
            </TabsContent>

            {/* ── Tab 3: Terapi & Obat ───────────────────── */}
            <TabsContent value="terapi" className="space-y-5">

              {/* Total biaya summary */}
              {totalAll > 0 && (
                <div className="card p-4 bg-primary-50 border border-primary-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary-700">Estimasi Total Biaya</span>
                    <span className="text-lg font-bold text-primary-700">{formatRupiah(totalAll)}</span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-primary-600">
                    <span>Item/Obat: {formatRupiah(totalItems)}</span>
                    <span>Layanan: {formatRupiah(totalServices)}</span>
                  </div>
                </div>
              )}

              {/* ── Item / Obat ── */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800 text-sm">Item & Obat</h3>
                  <span className="text-xs text-gray-400">{checkUp.detailItems.length} item</span>
                </div>

                {canEdit && (
                  <div className="mb-4">
                    <SearchDropdown<MasterItem>
                      placeholder="Cari nama obat / item..."
                      fetchFn={async (s) => (await api.get(`/master/items?search=${s}`)).data.data}
                      renderOption={(i) => (
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <p className="font-medium text-gray-800">{i.itemName}</p>
                            <p className="text-xs text-gray-400">{i.category} · Stok: {Number(i.totalItem).toFixed(0)} {i.unit}</p>
                          </div>
                          <span className="text-primary-600 font-semibold">{formatRupiah(Number(i.sellingPrice))}</span>
                        </div>
                      )}
                      onSelect={(item) => addItem.mutate({
                        priceItemId:  item.priceItemId,
                        quantity:     1,
                        priceOverall: Number(item.sellingPrice),
                      })}
                    />
                  </div>
                )}

                {checkUp.detailItems.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Belum ada item ditambahkan</p>
                ) : (
                  <div className="space-y-2">
                    {checkUp.detailItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            {item.priceItem.listOfItem.itemName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {Number(item.quantity)} {item.priceItem.listOfItem.unitItem.unitName}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-gray-700">{formatRupiah(Number(item.priceOverall))}</span>
                        {canEdit && (
                          <button
                            onClick={() => removeItem.mutate(item.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Kelompok Obat ── */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800 text-sm">Kelompok Obat / Resep</h3>
                  <span className="text-xs text-gray-400">{checkUp.detailMedicineGroups.length} resep</span>
                </div>

                {canEdit && (
                  <div className="mb-4">
                    <SearchDropdown<MasterMedGroup>
                      placeholder="Cari kelompok obat / resep..."
                      fetchFn={async (s) => (await api.get(`/master/medicine-groups?search=${s}`)).data.data}
                      renderOption={(g) => (
                        <div>
                          <p className="font-medium text-gray-800">{g.groupName}</p>
                          {g.description && <p className="text-xs text-gray-400">{g.description}</p>}
                        </div>
                      )}
                      onSelect={(g) => addMedGroup.mutate({ medicineGroupId: g.id, quantity: 1 })}
                    />
                  </div>
                )}

                {checkUp.detailMedicineGroups.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Belum ada resep ditambahkan</p>
                ) : (
                  <div className="space-y-2">
                    {checkUp.detailMedicineGroups.map((mg) => (
                      <div key={mg.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{mg.medicineGroup.groupName}</p>
                          <p className="text-xs text-gray-400">
                            x{mg.quantity}{mg.remark ? ` · ${mg.remark}` : ''}
                          </p>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => removeMedGroup.mutate(mg.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Layanan / Jasa ── */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800 text-sm">Layanan & Jasa Tindakan</h3>
                  <span className="text-xs text-gray-400">{checkUp.detailServices.length} layanan</span>
                </div>

                {canEdit && (
                  <div className="mb-4">
                    <SearchDropdown<MasterService>
                      placeholder="Cari layanan / jasa tindakan..."
                      fetchFn={async (s) => (await api.get(`/master/services?search=${s}`)).data.data}
                      renderOption={(s) => (
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <p className="font-medium text-gray-800">{s.serviceName}</p>
                            <p className="text-xs text-gray-400">{s.category}</p>
                          </div>
                          <span className="text-primary-600 font-semibold">{formatRupiah(Number(s.sellingPrice))}</span>
                        </div>
                      )}
                      onSelect={(s) => addService.mutate({
                        priceServiceId: s.priceServiceId,
                        quantity:       1,
                        priceOverall:   Number(s.sellingPrice),
                      })}
                    />
                  </div>
                )}

                {checkUp.detailServices.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Belum ada layanan ditambahkan</p>
                ) : (
                  <div className="space-y-2">
                    {checkUp.detailServices.map((svc) => (
                      <div key={svc.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            {svc.priceService.listOfService.serviceName}
                          </p>
                          <p className="text-xs text-gray-400">x{svc.quantity}</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-700">{formatRupiah(Number(svc.priceOverall))}</span>
                        {canEdit && (
                          <button
                            onClick={() => removeService.mutate(svc.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

// ─── Start Screen ─────────────────────────────────────────────────────────────
function StartScreen({ registrationId, onStart, loading }: {
  registrationId: string; onStart: () => void; loading: boolean
}) {
  const navigate = useNavigate()

  const { data: reg } = useQuery({
    queryKey: ['registrasi-detail', registrationId],
    queryFn:  async () => (await api.get(`/registrasi/${registrationId}`)).data.data,
  })

  if (!reg) return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8" /></div>

  const p = reg.patient

  return (
    <div className="max-w-md mx-auto mt-16 text-center space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto">
        <PawPrint className="w-8 h-8 text-primary-600" />
      </div>
      <div>
        <h2 className="font-display font-bold text-xl text-gray-900">{p.petName}</h2>
        <p className="text-gray-500 mt-1">{p.petCategory} · Pemilik: {p.owner.ownerName}</p>
      </div>
      <div className="card p-4 text-left">
        <p className="text-xs text-gray-400 mb-1">Keluhan</p>
        <p className="text-sm text-gray-700">{reg.complaint}</p>
      </div>
      {reg.acceptanceStatus !== 'accepted' ? (
        <div className="card p-4 border-l-4 border-amber-400">
          <p className="text-sm text-amber-700">Pendaftaran belum diterima. Terima dulu dari halaman antrian.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/pendaftaran')}>
            Kembali ke Antrian
          </Button>
        </div>
      ) : (
        <Button size="lg" className="w-full" loading={loading} onClick={onStart}>
          <CheckCircle2 className="w-5 h-5" />
          Mulai Pemeriksaan
        </Button>
      )}
    </div>
  )
}
