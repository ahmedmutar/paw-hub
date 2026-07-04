import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Weight, Syringe, Pill, Scissors,
  Plus, Pencil, Trash2, AlertCircle, ChevronRight, FileDown,
} from 'lucide-react'

async function downloadSertifikat(type: 'vaksin' | 'prosedur', id: string, filename: string) {
  const res = await api.get(`/sertifikat/${type}/${id}`, { responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
import { api } from '@/lib/api'
import { formatDate, formatDateTime, petAge } from '@/lib/utils'
import {
  Button, Badge, Dialog, DialogContent, DialogTrigger,
  Input, Textarea, Tabs, TabsList, TabsTrigger, TabsContent,
  EmptyState, Spinner,
} from '@/components/ui'
import { useForm } from 'react-hook-form'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RekamMedisData {
  patient: {
    id: string; idMember: string; petName: string; petCategory: string
    petGender?: string; petYearAge?: number; petMonthAge?: number
    owner: { ownerName: string; phoneNumber?: string; address?: string }
    branch: { branchName: string }
  }
  medicalRecord?: {
    bloodType?: string; allergies?: string
    chronicConditions?: string; specialNotes?: string
  }
  weightHistory: Array<{ id: string; weightKg: string; recordedAt: string }>
  vaccinations: Array<{
    id: string; vaccineName: string; batchNumber?: string
    administeredAt: string; nextDueAt?: string; notes?: string
  }>
  dewormings: Array<{
    id: string; medicationName: string
    administeredAt: string; nextDueAt?: string; notes?: string
  }>
  procedures: Array<{
    id: string; procedureName: string
    performedAt: string; notes?: string
  }>
  visitHistory: Array<{
    id: string; idNumber: string; complaint: string; createdAt: string
    doctor: { fullname: string }
    checkUpResult?: { id: string; diagnosa?: string; statusPaidOff: boolean; statusFinish: boolean }
  }>
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

function useRekamMedis(patientId: string) {
  return useQuery<RekamMedisData>({
    queryKey: ['rekam-medis', patientId],
    queryFn: async () => {
      const res = await api.get(`/rekam-medis/${patientId}`)
      return res.data.data
    },
  })
}

// ─── Modal tambah vaksinasi ───────────────────────────────────────────────────

function ModalVaksinasi({ patientId, onSuccess }: { patientId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    vaccineName: string; batchNumber?: string
    administeredAt: string; nextDueAt?: string; notes?: string
  }>()

  const mutation = useMutation({
    mutationFn: (data: any) => api.post(`/rekam-medis/${patientId}/vaksinasi`, data),
    onSuccess: () => { reset(); setOpen(false); onSuccess() },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-3.5 h-3.5" /> Tambah</Button>
      </DialogTrigger>
      <DialogContent title="Tambah Riwayat Vaksinasi">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input
            label="Nama Vaksin"
            placeholder="cth: Rabies, Distemper, FVRCP..."
            required
            {...register('vaccineName', { required: 'Wajib diisi' })}
            error={errors.vaccineName?.message}
          />
          <Input
            label="Nomor Batch"
            placeholder="Opsional"
            {...register('batchNumber')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tanggal Diberikan"
              type="date"
              required
              {...register('administeredAt', { required: true })}
            />
            <Input
              label="Jadwal Ulang"
              type="date"
              {...register('nextDueAt')}
            />
          </div>
          <Textarea
            label="Catatan"
            placeholder="Catatan tambahan (opsional)"
            {...register('notes')}
          />
          {mutation.isError && (
            <p className="text-xs text-red-500">Gagal menyimpan. Coba lagi.</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" loading={mutation.isPending}>Simpan</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Modal tambah obat cacing ─────────────────────────────────────────────────

function ModalObatCacing({ patientId, onSuccess }: { patientId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    medicationName: string; administeredAt: string; nextDueAt?: string; notes?: string
  }>()

  const mutation = useMutation({
    mutationFn: (data: any) => api.post(`/rekam-medis/${patientId}/obat-cacing`, data),
    onSuccess: () => { reset(); setOpen(false); onSuccess() },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-3.5 h-3.5" /> Tambah</Button>
      </DialogTrigger>
      <DialogContent title="Tambah Riwayat Obat Cacing">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input
            label="Nama Obat"
            placeholder="cth: Drontal, Milbemax, Pyrantel..."
            required
            {...register('medicationName', { required: 'Wajib diisi' })}
            error={errors.medicationName?.message}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Tanggal Diberikan" type="date" required {...register('administeredAt', { required: true })} />
            <Input label="Jadwal Ulang" type="date" {...register('nextDueAt')} />
          </div>
          <Textarea label="Catatan" placeholder="Opsional" {...register('notes')} />
          {mutation.isError && <p className="text-xs text-red-500">Gagal menyimpan. Coba lagi.</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" loading={mutation.isPending}>Simpan</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Modal tambah tindakan ────────────────────────────────────────────────────

function ModalTindakan({ patientId, onSuccess }: { patientId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    procedureName: string; performedAt: string; notes?: string
  }>()

  const mutation = useMutation({
    mutationFn: (data: any) => api.post(`/rekam-medis/${patientId}/tindakan`, data),
    onSuccess: () => { reset(); setOpen(false); onSuccess() },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-3.5 h-3.5" /> Tambah</Button>
      </DialogTrigger>
      <DialogContent title="Tambah Tindakan Besar">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input
            label="Nama Tindakan / Prosedur"
            placeholder="cth: Sterilisasi, Operasi Tumor, Ekstraksi Gigi..."
            required
            {...register('procedureName', { required: 'Wajib diisi' })}
            error={errors.procedureName?.message}
          />
          <Input label="Tanggal Dilakukan" type="date" required {...register('performedAt', { required: true })} />
          <Textarea label="Catatan" placeholder="Opsional" {...register('notes')} />
          {mutation.isError && <p className="text-xs text-red-500">Gagal menyimpan. Coba lagi.</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" loading={mutation.isPending}>Simpan</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Modal edit kartu ─────────────────────────────────────────────────────────

function ModalEditKartu({
  patientId, data, onSuccess,
}: { patientId: string; data?: RekamMedisData['medicalRecord']; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const { register, handleSubmit } = useForm({
    defaultValues: {
      bloodType: data?.bloodType ?? '',
      allergies: data?.allergies ?? '',
      chronicConditions: data?.chronicConditions ?? '',
      specialNotes: data?.specialNotes ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: (d: any) => api.put(`/rekam-medis/${patientId}/kartu`, d),
    onSuccess: () => { setOpen(false); onSuccess() },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil className="w-3.5 h-3.5" /> Edit</Button>
      </DialogTrigger>
      <DialogContent title="Edit Kartu Rekam Medis">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input label="Golongan Darah" placeholder="cth: A, B, AB, O" {...register('bloodType')} />
          <Textarea label="Alergi yang Diketahui" placeholder="cth: Alergi penicillin, alergi makanan laut..." rows={2} {...register('allergies')} />
          <Textarea label="Kondisi Kronis" placeholder="cth: Diabetes, penyakit jantung, epilepsi..." rows={2} {...register('chronicConditions')} />
          <Textarea label="Catatan Khusus Dokter" placeholder="cth: Tidak kooperatif saat injeksi, harus dibius ringan..." rows={2} {...register('specialNotes')} />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" loading={mutation.isPending}>Simpan</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Komponen jadwal ulang ────────────────────────────────────────────────────

function NextDueBadge({ date }: { date?: string | null }) {
  if (!date) return <span className="text-gray-400 text-xs">—</span>
  const due = new Date(date)
  const now = new Date()
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return <Badge variant="red">Terlambat {Math.abs(diffDays)} hari</Badge>
  if (diffDays <= 7) return <Badge variant="yellow">Dalam {diffDays} hari</Badge>
  return <span className="text-xs text-gray-500">{formatDate(date)}</span>
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RekamMedisPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useRekamMedis(patientId!)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rekam-medis', patientId] })

  const deleteVaksin = useMutation({
    mutationFn: (id: string) => api.delete(`/rekam-medis/vaksinasi/${id}`),
    onSuccess: refresh,
  })
  const deleteCacing = useMutation({
    mutationFn: (id: string) => api.delete(`/rekam-medis/obat-cacing/${id}`),
    onSuccess: refresh,
  })
  const deleteTindakan = useMutation({
    mutationFn: (id: string) => api.delete(`/rekam-medis/tindakan/${id}`),
    onSuccess: refresh,
  })

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8" /></div>
  }

  if (isError || !data) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600">Gagal memuat rekam medis. Coba muat ulang halaman.</p>
      </div>
    )
  }

  const { patient, medicalRecord, weightHistory, vaccinations, dewormings, procedures, visitHistory } = data

  // Cek vaksin/obat cacing yang hampir jatuh tempo (≤ 30 hari)
  const upcoming = [
    ...vaccinations.filter((v) => v.nextDueAt && daysUntil(v.nextDueAt) <= 30)
      .map((v) => ({ label: `Vaksin ${v.vaccineName}`, date: v.nextDueAt! })),
    ...dewormings.filter((d) => d.nextDueAt && daysUntil(d.nextDueAt) <= 30)
      .map((d) => ({ label: `Obat cacing (${d.medicationName})`, date: d.nextDueAt! })),
  ]

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Link to="/pasien" className="mt-1 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h2 className="font-display font-bold text-xl text-gray-900">
            Rekam Medis — {patient.petName}
          </h2>
          <p className="text-sm text-gray-500">
            {patient.petCategory} · {petAge(patient.petYearAge, patient.petMonthAge)} · {patient.idMember}
          </p>
        </div>
      </div>

      {/* Reminder upcoming */}
      {upcoming.length > 0 && (
        <div className="card p-4 border-l-4 border-amber-400 bg-amber-50 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Jadwal yang Perlu Diperhatikan</p>
            <ul className="mt-1 space-y-0.5">
              {upcoming.map((u, i) => (
                <li key={i} className="text-xs text-amber-700">
                  {u.label} — <NextDueBadge date={u.date} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* ── Kolom kiri: info dasar ── */}
        <div className="space-y-4">
          {/* Info hewan */}
          <div className="card p-4">
            <p className="section-title mb-3">Informasi Hewan</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Nama</dt>
                <dd className="font-medium">{patient.petName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Jenis</dt>
                <dd className="font-medium">{patient.petCategory}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Kelamin</dt>
                <dd className="font-medium">{patient.petGender ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Umur</dt>
                <dd className="font-medium">{petAge(patient.petYearAge, patient.petMonthAge)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Berat terakhir</dt>
                <dd className="font-semibold text-primary-600">
                  {weightHistory.length > 0
                    ? `${weightHistory[weightHistory.length - 1].weightKg} kg`
                    : '—'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Info pemilik */}
          <div className="card p-4">
            <p className="section-title mb-3">Pemilik</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Nama</dt>
                <dd className="font-medium">{patient.owner.ownerName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Telepon</dt>
                <dd className="font-medium">{patient.owner.phoneNumber ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Cabang</dt>
                <dd className="font-medium">{patient.branch.branchName}</dd>
              </div>
            </dl>
          </div>

          {/* Kartu rekam medis */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="section-title">Kondisi Medis</p>
              <ModalEditKartu patientId={patientId!} data={medicalRecord} onSuccess={refresh} />
            </div>
            {medicalRecord ? (
              <dl className="space-y-3 text-sm">
                {medicalRecord.bloodType && (
                  <div>
                    <dt className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Golongan Darah</dt>
                    <dd className="font-medium">{medicalRecord.bloodType}</dd>
                  </div>
                )}
                {medicalRecord.allergies && (
                  <div>
                    <dt className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Alergi</dt>
                    <dd className="text-gray-700 whitespace-pre-wrap">{medicalRecord.allergies}</dd>
                  </div>
                )}
                {medicalRecord.chronicConditions && (
                  <div>
                    <dt className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Kondisi Kronis</dt>
                    <dd className="text-gray-700 whitespace-pre-wrap">{medicalRecord.chronicConditions}</dd>
                  </div>
                )}
                {medicalRecord.specialNotes && (
                  <div>
                    <dt className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Catatan Khusus</dt>
                    <dd className="text-amber-700 bg-amber-50 px-2 py-1.5 rounded-lg text-xs whitespace-pre-wrap">
                      {medicalRecord.specialNotes}
                    </dd>
                  </div>
                )}
                {!medicalRecord.allergies && !medicalRecord.chronicConditions && !medicalRecord.specialNotes && (
                  <p className="text-sm text-gray-400 italic">Belum ada catatan kondisi medis.</p>
                )}
              </dl>
            ) : (
              <p className="text-sm text-gray-400 italic">Belum ada catatan kondisi medis.</p>
            )}
          </div>
        </div>

        {/* ── Kolom kanan: tabs riwayat ── */}
        <div className="lg:col-span-2 card overflow-hidden">
          <Tabs defaultValue="vaksinasi">
            <div className="px-4 pt-3 border-b border-gray-100">
              <TabsList>
                <TabsTrigger value="vaksinasi">
                  <span className="flex items-center gap-1.5">
                    <Syringe className="w-3.5 h-3.5" />
                    Vaksinasi ({vaccinations.length})
                  </span>
                </TabsTrigger>
                <TabsTrigger value="cacing">
                  <span className="flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5" />
                    Obat Cacing ({dewormings.length})
                  </span>
                </TabsTrigger>
                <TabsTrigger value="tindakan">
                  <span className="flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5" />
                    Tindakan ({procedures.length})
                  </span>
                </TabsTrigger>
                <TabsTrigger value="berat">
                  <span className="flex items-center gap-1.5">
                    <Weight className="w-3.5 h-3.5" />
                    Berat ({weightHistory.length})
                  </span>
                </TabsTrigger>
                <TabsTrigger value="kunjungan">Kunjungan</TabsTrigger>
              </TabsList>
            </div>

            {/* Vaksinasi */}
            <TabsContent value="vaksinasi" className="p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="section-subtitle">Riwayat vaksinasi hewan</p>
                <ModalVaksinasi patientId={patientId!} onSuccess={refresh} />
              </div>
              {vaccinations.length === 0 ? (
                <EmptyState icon={<Syringe className="w-10 h-10" />} title="Belum ada riwayat vaksinasi" />
              ) : (
                <div className="space-y-2">
                  {vaccinations.map((v) => (
                    <div key={v.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{v.vaccineName}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          <span className="text-xs text-gray-500">Diberikan: {formatDate(v.administeredAt)}</span>
                          {v.batchNumber && <span className="text-xs text-gray-400">Batch: {v.batchNumber}</span>}
                        </div>
                        {v.nextDueAt && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                            <span>Ulang:</span>
                            <NextDueBadge date={v.nextDueAt} />
                          </div>
                        )}
                        {v.notes && <p className="text-xs text-gray-400 mt-1 italic">{v.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 ml-3">
                        <button
                          title="Download Sertifikat Vaksinasi"
                          onClick={() => downloadSertifikat('vaksin', v.id, `sertifikat-vaksin-${v.id}.pdf`)}
                          className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm('Hapus riwayat vaksinasi ini?')) deleteVaksin.mutate(v.id) }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Obat cacing */}
            <TabsContent value="cacing" className="p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="section-subtitle">Riwayat pemberian obat cacing</p>
                <ModalObatCacing patientId={patientId!} onSuccess={refresh} />
              </div>
              {dewormings.length === 0 ? (
                <EmptyState icon={<Pill className="w-10 h-10" />} title="Belum ada riwayat obat cacing" />
              ) : (
                <div className="space-y-2">
                  {dewormings.map((d) => (
                    <div key={d.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{d.medicationName}</p>
                        <span className="text-xs text-gray-500">Diberikan: {formatDate(d.administeredAt)}</span>
                        {d.nextDueAt && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                            <span>Ulang:</span>
                            <NextDueBadge date={d.nextDueAt} />
                          </div>
                        )}
                        {d.notes && <p className="text-xs text-gray-400 mt-1 italic">{d.notes}</p>}
                      </div>
                      <button
                        onClick={() => { if (confirm('Hapus data ini?')) deleteCacing.mutate(d.id) }}
                        className="ml-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tindakan */}
            <TabsContent value="tindakan" className="p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="section-subtitle">Riwayat operasi & tindakan besar</p>
                <ModalTindakan patientId={patientId!} onSuccess={refresh} />
              </div>
              {procedures.length === 0 ? (
                <EmptyState icon={<Scissors className="w-10 h-10" />} title="Belum ada riwayat tindakan" />
              ) : (
                <div className="space-y-2">
                  {procedures.map((p) => (
                    <div key={p.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{p.procedureName}</p>
                        <span className="text-xs text-gray-500">{formatDate(p.performedAt)}</span>
                        {p.notes && <p className="text-xs text-gray-400 mt-1 italic">{p.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 ml-3">
                        <button
                          title="Download Sertifikat Tindakan"
                          onClick={() => downloadSertifikat('prosedur', p.id, `sertifikat-tindakan-${p.id}.pdf`)}
                          className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm('Hapus data ini?')) deleteTindakan.mutate(p.id) }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Berat badan */}
            <TabsContent value="berat" className="p-4">
              <p className="section-subtitle mb-4">Riwayat berat badan per kunjungan</p>
              {weightHistory.length === 0 ? (
                <EmptyState icon={<Weight className="w-10 h-10" />} title="Belum ada data berat badan" description="Berat badan dicatat otomatis saat dokter melakukan pemeriksaan." />
              ) : (
                <div className="space-y-2">
                  {[...weightHistory].reverse().map((w) => (
                    <div key={w.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <span className="text-xs text-gray-500">{formatDate(w.recordedAt)}</span>
                      <span className="text-base font-display font-bold text-primary-600">{w.weightKg} kg</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Riwayat kunjungan */}
            <TabsContent value="kunjungan" className="p-4">
              <p className="section-subtitle mb-4">10 kunjungan terakhir</p>
              {visitHistory.length === 0 ? (
                <EmptyState title="Belum ada riwayat kunjungan" />
              ) : (
                <div className="space-y-2">
                  {visitHistory.map((v) => (
                    <div key={v.id} className="p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-mono text-gray-400">{v.idNumber}</p>
                            {v.checkUpResult?.statusPaidOff
                              ? <Badge variant="green">Lunas</Badge>
                              : v.checkUpResult?.statusFinish
                                ? <Badge variant="yellow">Belum Bayar</Badge>
                                : <Badge variant="gray">Proses</Badge>
                            }
                          </div>
                          <p className="text-sm font-medium text-gray-800 mt-1 truncate">{v.complaint}</p>
                          {v.checkUpResult?.diagnosa && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">Dx: {v.checkUpResult.diagnosa}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-400">{formatDate(v.createdAt)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{v.doctor.fullname}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

// Helper
function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}
