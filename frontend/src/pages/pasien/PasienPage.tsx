import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, PawPrint, FileText, Pencil, Trash2,
  ChevronRight, CalendarDays, TrendingUp, Users2,
  Cat, Dog, Bird, Rabbit, Fish, FileDown,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { api } from '@/lib/api'
import { formatDate, petAge } from '@/lib/utils'
import {
  Button, Input, Textarea, Select, SelectItem,
  Dialog, DialogContent, DialogTrigger,
  Badge, EmptyState, Spinner, Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const PET_CATEGORIES = ['Anjing', 'Kucing', 'Kelinci', 'Hamster', 'Burung', 'Ikan', 'Reptil', 'Lainnya']

function petIcon(category: string) {
  const c = category.toLowerCase()
  if (c.includes('kucing'))  return <Cat  className="w-4 h-4" />
  if (c.includes('anjing'))  return <Dog  className="w-4 h-4" />
  if (c.includes('burung'))  return <Bird className="w-4 h-4" />
  if (c.includes('kelinci')) return <Rabbit className="w-4 h-4" />
  if (c.includes('ikan'))    return <Fish className="w-4 h-4" />
  return <PawPrint className="w-4 h-4" />
}

function petColor(category: string) {
  const c = category.toLowerCase()
  if (c.includes('kucing'))  return 'bg-orange-100 text-orange-600'
  if (c.includes('anjing'))  return 'bg-amber-100 text-amber-600'
  if (c.includes('burung'))  return 'bg-sky-100 text-sky-600'
  if (c.includes('kelinci')) return 'bg-pink-100 text-pink-600'
  if (c.includes('ikan'))    return 'bg-blue-100 text-blue-600'
  return 'bg-primary-100 text-primary-600'
}

// ─── Owner Search Autocomplete ────────────────────────────────────────────────

interface Owner { id: string; ownerName: string; phoneNumber?: string; address?: string }

function OwnerSearchInput({
  onSelect,
  onCreateNew,
}: {
  onSelect: (owner: Owner) => void
  onCreateNew: (name: string) => void
}) {
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const [selected, setSelected] = useState<Owner | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['pemilik-search', query],
    queryFn: async () => (await api.get('/pemilik', { params: { search: query } })).data.data as Owner[],
    enabled: query.length >= 1,
  })

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (selected) {
    return (
      <div className="flex items-center justify-between px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg">
        <div>
          <p className="text-sm font-medium text-primary-800">{selected.ownerName}</p>
          {selected.phoneNumber && <p className="text-xs text-primary-600">{selected.phoneNumber}</p>}
        </div>
        <button
          type="button"
          onClick={() => { setSelected(null); setQuery('') }}
          className="text-xs text-primary-500 hover:text-primary-700 underline"
        >
          Ganti
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Pemilik <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="Ketik nama atau no. HP pemilik..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query && setOpen(true)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {open && query.length >= 1 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-card-md overflow-hidden">
          {isFetching ? (
            <div className="px-3 py-2 text-sm text-gray-400">Mencari...</div>
          ) : (data ?? []).length === 0 ? (
            <div className="p-2">
              <p className="px-2 py-1 text-xs text-gray-400 mb-1">Tidak ditemukan di database</p>
              <button
                type="button"
                onClick={() => { onCreateNew(query); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Daftarkan pemilik baru: <span className="font-semibold">"{query}"</span>
              </button>
            </div>
          ) : (
            <div className="py-1">
              {(data ?? []).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { setSelected(o); onSelect(o); setOpen(false) }}
                  className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Users2 className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{o.ownerName}</p>
                    <p className="text-xs text-gray-400">{o.phoneNumber ?? 'No. HP tidak ada'}</p>
                  </div>
                </button>
              ))}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => { onCreateNew(query); setOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Daftarkan pemilik baru
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Modal Tambah/Edit Pasien ─────────────────────────────────────────────────

function PasienModal({ patient, onSuccess }: { patient?: any; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const isEdit = !!patient

  // State owner
  const [ownerMode, setOwnerMode]       = useState<'existing' | 'new'>('existing')
  const [selectedOwnerId, setSelectedOwnerId] = useState('')
  const [newOwnerName, setNewOwnerName] = useState('')

  // Pet category
  const [petCategory, setPetCategory]   = useState(patient?.petCategory ?? '')
  const [customCategory, setCustomCategory] = useState('')
  const [gender, setGender]             = useState(patient?.petGender ?? '')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>({
    defaultValues: patient ? {
      petName:    patient.petName,
      petYearAge: patient.petYearAge ?? '',
      petMonthAge: patient.petMonthAge ?? '',
    } : {},
  })

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit
        ? api.put(`/pasien/${patient.id}`, data)
        : api.post('/pasien', data),
    onSuccess: () => { setOpen(false); reset(); onSuccess() },
  })

  const handleOwnerSelect = (owner: Owner) => {
    setOwnerMode('existing')
    setSelectedOwnerId(owner.id)
  }

  const handleCreateNew = (name: string) => {
    setOwnerMode('new')
    setNewOwnerName(name)
  }

  const onSubmit = (formData: any) => {
    const finalCategory = petCategory === 'Lainnya' ? customCategory : petCategory

    const payload: any = {
      petName:     formData.petName,
      petCategory: finalCategory,
      petGender:   gender || undefined,
      petYearAge:  formData.petYearAge  ? Number(formData.petYearAge)  : undefined,
      petMonthAge: formData.petMonthAge ? Number(formData.petMonthAge) : undefined,
    }

    if (!isEdit) {
      if (ownerMode === 'existing' && selectedOwnerId) {
        payload.ownerId = selectedOwnerId
      } else if (ownerMode === 'new' && newOwnerName) {
        payload.ownerName    = newOwnerName
        payload.ownerAddress = formData.ownerAddress
        payload.ownerPhone   = formData.ownerPhone
      } else {
        return // Validasi pemilik
      }
    }

    mutation.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <button className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        ) : (
          <Button><Plus className="w-4 h-4" /> Tambah Pasien</Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={isEdit ? 'Edit Data Pasien' : 'Daftarkan Pasien Baru'}
        description={isEdit ? 'Perbarui data hewan.' : 'Isi data hewan dan pemiliknya.'}
        className="max-w-xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Data hewan */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Data Hewan</p>
            <div className="space-y-3">
              <Input
                label="Nama Hewan"
                placeholder="cth: Mimi, Buddy, Koko..."
                required
                {...register('petName', { required: 'Wajib diisi' })}
                error={errors.petName?.message?.toString()}
              />
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Jenis Hewan <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PET_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setPetCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        petCategory === cat
                          ? 'border-primary-400 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {petCategory === 'Lainnya' && (
                  <input
                    type="text"
                    placeholder="Tulis jenis hewan..."
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="mt-2 w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Select label="Jenis Kelamin" value={gender} onValueChange={setGender}>
                  <SelectItem value="Jantan">Jantan</SelectItem>
                  <SelectItem value="Betina">Betina</SelectItem>
                </Select>
                <Input label="Umur (Tahun)" type="number" min={0} placeholder="0" {...register('petYearAge')} />
                <Input label="Umur (Bulan)" type="number" min={0} max={11} placeholder="0" {...register('petMonthAge')} />
              </div>
            </div>
          </div>

          {/* Data pemilik — hanya saat tambah baru */}
          {!isEdit && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Data Pemilik</p>
              <div className="space-y-3">
                <OwnerSearchInput onSelect={handleOwnerSelect} onCreateNew={handleCreateNew} />

                {/* Form pemilik baru muncul jika pilih "buat baru" */}
                {ownerMode === 'new' && newOwnerName && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-3">
                    <p className="text-xs font-medium text-blue-700">Daftarkan pemilik baru</p>
                    <Input
                      label="Nama Pemilik"
                      defaultValue={newOwnerName}
                      required
                      {...register('ownerName')}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="No. HP / WA" placeholder="08xxxxxxxxx" {...register('ownerPhone')} />
                    </div>
                    <Textarea label="Alamat" placeholder="Alamat pemilik (opsional)" rows={2} {...register('ownerAddress')} />
                  </div>
                )}
              </div>
            </div>
          )}

          {mutation.isError && (
            <p className="text-xs text-red-500">
              {(mutation.error as any)?.response?.data?.message ?? 'Gagal menyimpan. Coba lagi.'}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEdit ? 'Simpan Perubahan' : 'Daftarkan Pasien'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Modal Edit Pemilik ───────────────────────────────────────────────────────

function EditOwnerModal({ owner, onSuccess }: { owner: Owner; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      ownerName:   owner.ownerName,
      phoneNumber: owner.phoneNumber ?? '',
      address:     owner.address     ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: any) => api.put(`/pemilik/${owner.id}`, data),
    onSuccess: () => { setOpen(false); onSuccess() },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-xs text-gray-400 hover:text-primary-600 flex items-center gap-1 hover:underline">
          <Pencil className="w-3 h-3" /> edit pemilik
        </button>
      </DialogTrigger>
      <DialogContent title="Edit Data Pemilik">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input
            label="Nama Pemilik"
            required
            {...register('ownerName', { required: 'Wajib diisi' })}
            error={errors.ownerName?.message?.toString()}
          />
          <Input label="No. HP / WA" placeholder="08xxxxxxxxx" {...register('phoneNumber')} />
          <Textarea label="Alamat" rows={2} {...register('address')} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" loading={mutation.isPending}>Simpan</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

function StatsBar() {
  const { data } = useQuery({
    queryKey: ['pasien-stats'],
    queryFn: async () => (await api.get('/pasien/stats')).data.data,
    staleTime: 1000 * 60,
  })

  const items = [
    { label: 'Total Pasien',       value: data?.total          ?? '—', icon: PawPrint,     color: 'text-primary-600 bg-primary-50' },
    { label: 'Ditambah Hari Ini',  value: data?.addedToday     ?? '—', icon: Plus,          color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Kunjungan Bulan Ini',value: data?.visitThisMonth ?? '—', icon: CalendarDays,  color: 'text-blue-600 bg-blue-50' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((s) => (
        <div key={s.label} className="card px-4 py-3 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
            <s.icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xl font-display font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 leading-tight">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PasienPage() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const [search, setSearch]         = useState('')
  const [category, setCategory]     = useState('')
  const [page, setPage]             = useState(1)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pasien'] })
    queryClient.invalidateQueries({ queryKey: ['pasien-stats'] })
  }

  const { data, isLoading } = useQuery({
    queryKey: ['pasien', search, category, page],
    queryFn: async () => (await api.get('/pasien', {
      params: { search, category: category || undefined, page, limit: 20 },
    })).data,
    placeholderData: (prev) => prev,
  })

  // Ambil kategori unik dari stats
  const { data: statsData } = useQuery({
    queryKey: ['pasien-stats'],
    queryFn: async () => (await api.get('/pasien/stats')).data.data,
    staleTime: 1000 * 60,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/pasien/${id}`),
    onSuccess: refresh,
  })

  const patients: any[] = data?.data ?? []
  const meta = data?.meta
  const topCategories: Array<{ petCategory: string; _count: { id: number } }> = statsData?.categoryStats ?? []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl text-gray-900">Data Pasien</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {meta ? `${meta.total} pasien terdaftar` : 'Memuat...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const res = await api.get('/export/pasien', { responseType: 'blob' })
              const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
              const a = document.createElement('a'); a.href = url; a.download = 'daftar-pasien.xlsx'; a.click()
              URL.revokeObjectURL(url)
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50">
            <FileDown className="w-4 h-4" /> Export
          </button>
          <PasienModal onSuccess={refresh} />
        </div>
      </div>

      {/* Stats */}
      <StatsBar />

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama hewan, pemilik, atau ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Filter jenis hewan */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => { setCategory(''); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              !category ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            Semua
          </button>
          {topCategories.map(({ petCategory, _count }) => (
            <button
              key={petCategory}
              onClick={() => { setCategory(petCategory); setPage(1) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                category === petCategory ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {petCategory}
              <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full text-[10px]">
                {_count.id}
              </span>
            </button>
          ))}
        </div>

        {(search || category) && (
          <button
            onClick={() => { setSearch(''); setCategory(''); setPage(1) }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Tabel */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : patients.length === 0 ? (
          <EmptyState
            icon={<PawPrint className="w-10 h-10" />}
            title="Tidak ada pasien ditemukan"
            description={search || category ? 'Coba ubah filter pencarian.' : 'Mulai daftarkan pasien pertama.'}
          />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Hewan</th>
                <th>Pemilik</th>
                <th>Umur</th>
                <th>Kunjungan Terakhir</th>
                <th className="text-center">Total Kunjungan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p: any) => {
                const lastVisit = p.registrations?.[0]
                return (
                  <tr
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/pasien/${p.id}`)}
                  >
                    {/* Hewan */}
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${petColor(p.petCategory)}`}>
                          {petIcon(p.petCategory)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 text-sm">{p.petName}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400">{p.petCategory}</span>
                            {p.petGender && (
                              <>
                                <span className="text-gray-200">·</span>
                                <span className="text-xs text-gray-400">{p.petGender}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Pemilik */}
                    <td>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{p.owner?.ownerName}</p>
                        <p className="text-xs text-gray-400">{p.owner?.phoneNumber ?? '—'}</p>
                      </div>
                    </td>

                    {/* Umur */}
                    <td className="text-sm text-gray-500">
                      {petAge(p.petYearAge, p.petMonthAge)}
                    </td>

                    {/* Kunjungan terakhir */}
                    <td>
                      {lastVisit ? (
                        <div>
                          <p className="text-sm text-gray-700">{formatDate(lastVisit.createdAt)}</p>
                          {lastVisit.checkUpResult?.diagnosa && (
                            <p className="text-xs text-gray-400 truncate max-w-[160px]">
                              {lastVisit.checkUpResult.diagnosa}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">Belum pernah</span>
                      )}
                    </td>

                    {/* Total kunjungan */}
                    <td className="text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                        {p._count?.registrations ?? 0}
                      </span>
                    </td>

                    {/* Actions */}
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/rekam-medis/${p.id}`)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Rekam Medis"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Rekam Medis
                        </button>
                        <PasienModal patient={p} onSuccess={refresh} />
                        <button
                          onClick={() => {
                            if (confirm(`Hapus pasien "${p.petName}"?`)) deleteMutation.mutate(p.id)
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Menampilkan {patients.length} dari {meta.total} pasien
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= meta.totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
