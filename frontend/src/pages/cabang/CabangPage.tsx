import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Plus, Pencil, Trash2, MapPin, Phone,
  Mail, Users, PawPrint, Stethoscope, Clock,
  ToggleLeft, ToggleRight, Search,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { api } from '@/lib/api'
import {
  Button, Input, Textarea, Dialog, DialogContent, DialogTrigger,
  Badge, EmptyState, Spinner,
} from '@/components/ui'

interface Branch {
  id: string
  branchCode: string
  branchName: string
  address?: string
  phoneNumber?: string
  email?: string
  operatingHours?: string
  paymentInstruction?: string
  isActive: boolean
  stats?: {
    totalUsers: number
    totalPatients: number
    activeDoctors: number
  }
}

interface BranchForm {
  branchCode: string
  branchName: string
  phoneNumber?: string
  email?: string
  operatingHours?: string
  address?: string
  paymentInstruction?: string
}

// ─── Modal Form ───────────────────────────────────────────────────────────────

function BranchModal({ branch, onSuccess }: { branch?: Branch; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const isEdit = !!branch

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BranchForm>({
    defaultValues: branch
      ? {
          branchCode: branch.branchCode,
          branchName: branch.branchName,
          phoneNumber: branch.phoneNumber ?? '',
          email: branch.email ?? '',
          operatingHours: branch.operatingHours ?? '',
          address: branch.address ?? '',
          paymentInstruction: branch.paymentInstruction ?? '',
        }
      : {},
  })

  const mutation = useMutation({
    mutationFn: (data: BranchForm) =>
      isEdit ? api.put(`/cabang/${branch!.id}`, data) : api.post('/cabang', data),
    onSuccess: () => { setOpen(false); reset(); onSuccess() },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <button className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        ) : (
          <Button><Plus className="w-4 h-4" /> Tambah Cabang</Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={isEdit ? 'Edit Cabang' : 'Tambah Cabang Baru'}
        description={isEdit ? 'Perbarui informasi cabang.' : 'Lengkapi data cabang klinik baru.'}
        className="max-w-xl"
      >
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {/* Kode & Nama */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-2">
              <Input
                label="Kode Cabang"
                placeholder="cth: JKT01"
                required
                disabled={isEdit}
                {...register('branchCode', {
                  required: 'Wajib diisi',
                  maxLength: { value: 10, message: 'Maks 10 karakter' },
                })}
                error={errors.branchCode?.message}
              />
            </div>
            <div className="col-span-3">
              <Input
                label="Nama Cabang"
                placeholder="cth: Jakarta Selatan"
                required
                {...register('branchName', { required: 'Wajib diisi' })}
                error={errors.branchName?.message}
              />
            </div>
          </div>

          {/* Kontak */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nomor Telepon"
              placeholder="021-12345678"
              {...register('phoneNumber')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="klinik@email.com"
              {...register('email')}
            />
          </div>

          {/* Jam operasional */}
          <Input
            label="Jam Operasional"
            placeholder="cth: Senin–Sabtu 08.00–20.00, Minggu 09.00–15.00"
            {...register('operatingHours')}
          />

          {/* Alamat */}
          <Textarea
            label="Alamat Lengkap"
            placeholder="Jl. Contoh No. 1, RT/RW, Kelurahan, Kecamatan, Kota"
            rows={2}
            {...register('address')}
          />

          {/* Instruksi pembayaran */}
          <Textarea
            label="Instruksi Pembayaran"
            placeholder="cth: Transfer ke BCA 1234567890 a/n PawCare Clinic"
            rows={2}
            {...register('paymentInstruction')}
          />

          {mutation.isError && (
            <p className="text-xs text-red-500">
              {(mutation.error as any)?.response?.data?.message ?? 'Gagal menyimpan. Coba lagi.'}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEdit ? 'Simpan Perubahan' : 'Tambah Cabang'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function BranchDetailModal({ branch }: { branch: Branch }) {
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['cabang-detail', branch.id],
    queryFn: async () => {
      const res = await api.get(`/cabang/${branch.id}`)
      return res.data.data
    },
    enabled: open,
  })

  const roleLabel: Record<string, string> = {
    admin: 'Admin', dokter: 'Dokter',
    resepsionis: 'Resepsionis', kasir: 'Kasir', karyawan: 'Karyawan',
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-xs text-primary-600 hover:underline font-medium">
          Lihat detail
        </button>
      </DialogTrigger>
      <DialogContent title={branch.branchName} description={`Kode: ${branch.branchCode}`} className="max-w-lg">
        {!data ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <div className="space-y-4">
            {/* Info */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {data.phoneNumber && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {data.phoneNumber}
                </div>
              )}
              {data.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  {data.email}
                </div>
              )}
              {data.operatingHours && (
                <div className="flex items-center gap-2 text-gray-600 col-span-2">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  {data.operatingHours}
                </div>
              )}
            </div>

            {/* Daftar staf */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Staf ({data.users?.length ?? 0})
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {data.users?.length === 0 && (
                  <p className="text-sm text-gray-400 italic">Belum ada staf di cabang ini.</p>
                )}
                {data.users?.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{u.fullname}</p>
                      <p className="text-xs text-gray-400">@{u.username}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{roleLabel[u.role] ?? u.role}</span>
                      <span className={`w-2 h-2 rounded-full ${u.status ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {data.paymentInstruction && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700 border border-blue-100">
                <p className="text-xs font-semibold text-blue-500 mb-1">Info Pembayaran</p>
                {data.paymentInstruction}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CabangPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'semua' | 'aktif' | 'nonaktif'>('semua')
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['cabang'] })

  const { data, isLoading } = useQuery<Branch[]>({
    queryKey: ['cabang'],
    queryFn: async () => {
      const res = await api.get('/cabang')
      return res.data.data
    },
  })

  const toggleStatus = useMutation({
    mutationFn: (id: string) => api.patch(`/cabang/${id}/toggle-status`),
    onSuccess: refresh,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cabang/${id}`),
    onSuccess: refresh,
  })

  const branches = (data ?? [])
    .filter((b) => {
      const matchSearch = !search ||
        b.branchName.toLowerCase().includes(search.toLowerCase()) ||
        b.branchCode.toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === 'semua' ||
        (filterStatus === 'aktif' ? b.isActive : !b.isActive)
      return matchSearch && matchStatus
    })

  const totalAktif = (data ?? []).filter((b) => b.isActive).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl text-gray-900">Manajemen Cabang</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {(data ?? []).length} cabang · {totalAktif} aktif
          </p>
        </div>
        <BranchModal onSuccess={refresh} />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama atau kode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-56"
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden text-sm">
          {(['semua', 'aktif', 'nonaktif'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 font-medium capitalize transition-colors ${
                filterStatus === s
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : branches.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Building2 className="w-10 h-10" />}
            title="Tidak ada cabang ditemukan"
            description="Coba ubah filter atau tambah cabang baru."
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className={`card p-5 flex flex-col gap-4 transition-all hover:shadow-card-md ${!branch.isActive ? 'opacity-60' : ''}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${branch.isActive ? 'bg-primary-100' : 'bg-gray-100'}`}>
                    <Building2 className={`w-5 h-5 ${branch.isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm leading-tight">{branch.branchName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono text-gray-400">{branch.branchCode}</span>
                      <Badge variant={branch.isActive ? 'green' : 'gray'}>
                        {branch.isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => toggleStatus.mutate(branch.id)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title={branch.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  >
                    {branch.isActive
                      ? <ToggleRight className="w-4 h-4 text-primary-500" />
                      : <ToggleLeft className="w-4 h-4" />
                    }
                  </button>
                  <BranchModal branch={branch} onSuccess={refresh} />
                  <button
                    onClick={() => { if (confirm(`Hapus cabang "${branch.branchName}"?`)) deleteMutation.mutate(branch.id) }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Statistik */}
              {branch.stats && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                      <Users className="w-3 h-3" />
                    </div>
                    <p className="text-lg font-display font-bold text-gray-800">{branch.stats.totalUsers}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">Staf</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                      <Stethoscope className="w-3 h-3" />
                    </div>
                    <p className="text-lg font-display font-bold text-gray-800">{branch.stats.activeDoctors}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">Dokter</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                      <PawPrint className="w-3 h-3" />
                    </div>
                    <p className="text-lg font-display font-bold text-gray-800">{branch.stats.totalPatients}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">Pasien</p>
                  </div>
                </div>
              )}

              {/* Info kontak */}
              <div className="space-y-1 text-sm">
                {branch.phoneNumber && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Phone className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span>{branch.phoneNumber}</span>
                  </div>
                )}
                {branch.email && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Mail className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span className="truncate">{branch.email}</span>
                  </div>
                )}
                {branch.operatingHours && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Clock className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span className="text-xs">{branch.operatingHours}</span>
                  </div>
                )}
                {branch.address && (
                  <div className="flex items-start gap-2 text-gray-500">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400 mt-0.5" />
                    <span className="text-xs line-clamp-2">{branch.address}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-1 border-t border-gray-100">
                <BranchDetailModal branch={branch} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
