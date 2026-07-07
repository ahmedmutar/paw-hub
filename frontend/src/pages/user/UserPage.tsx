import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, Plus, Pencil, Trash2, KeyRound, Search,
  UserCog, ToggleLeft, ToggleRight, Phone, Mail,
  ShieldCheck, ChevronDown,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { api } from '@/lib/api'
import {
  Button, Input, Textarea, Select, SelectItem,
  Dialog, DialogContent, DialogTrigger,
  Badge, EmptyState, Spinner, Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui'
import { formatDate } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: string
  staffingNumber?: string
  username: string
  fullname: string
  email?: string
  gender?: string
  religion?: string
  birthPlace?: string
  birthdate?: string
  bloodGroup?: string
  idCardNumber?: string
  phoneNumber?: string
  homeNumber?: string
  address?: string
  role: string
  status: boolean
  branch: { branchName: string; branchCode: string }
  createdAt: string
}

interface Branch { id: string; branchCode: string; branchName: string }

const ROLES = [
  { value: 'admin',       label: 'Administrator', color: 'teal' as const },
  { value: 'dokter',      label: 'Dokter',        color: 'blue' as const },
  { value: 'resepsionis', label: 'Resepsionis',   color: 'green' as const },
  { value: 'kasir',       label: 'Kasir',         color: 'yellow' as const },
  { value: 'karyawan',    label: 'Karyawan',      color: 'gray' as const },
]

const RELIGIONS = ['Islam', 'Kristen Protestan', 'Katolik', 'Hindu', 'Buddha', 'Konghucu']

function getRoleMeta(role: string) {
  return ROLES.find((r) => r.value === role) ?? { label: role, color: 'gray' as const }
}

// ─── Modal Tambah/Edit ────────────────────────────────────────────────────────

function UserModal({ user, branches, onSuccess }: { user?: User; branches: Branch[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const isEdit = !!user

  const [selectedRole,   setSelectedRole]   = useState(user?.role     ?? '')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedGender, setSelectedGender] = useState(user?.gender   ?? '')
  const [selectedReligion, setSelectedReligion] = useState(user?.religion ?? '')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>({
    defaultValues: user ? {
      fullname: user.fullname, email: user.email ?? '',
      birthPlace: user.birthPlace ?? '', birthdate: user.birthdate ? user.birthdate.slice(0, 10) : '',
      bloodGroup: user.bloodGroup ?? '', idCardNumber: user.idCardNumber ?? '',
      phoneNumber: user.phoneNumber ?? '', homeNumber: user.homeNumber ?? '',
      address: user.address ?? '',
    } : {},
  })

  const mutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        ...data,
        role: selectedRole,
        gender: selectedGender || undefined,
        religion: selectedReligion || undefined,
        ...(isEdit ? {} : { branchId: selectedBranch }),
      }
      return isEdit ? api.put(`/user/${user!.id}`, payload) : api.post('/user', payload)
    },
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
          <Button><Plus className="w-4 h-4" /> Tambah User</Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={isEdit ? 'Edit Data User' : 'Tambah User Baru'}
        description={isEdit ? `Edit data untuk ${user.fullname}` : 'Lengkapi data staf baru.'}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
          <Tabs defaultValue="info-kerja">
            <TabsList>
              <TabsTrigger value="info-kerja">Info Pekerjaan</TabsTrigger>
              <TabsTrigger value="info-pribadi">Data Pribadi</TabsTrigger>
            </TabsList>

            {/* Tab 1: Info Kerja */}
            <TabsContent value="info-kerja" className="pt-4 space-y-4">
              {!isEdit && (
                <Input
                  label="Username"
                  placeholder="cth: drg.sari (tidak bisa diubah)"
                  required
                  {...register('username', {
                    required: 'Wajib diisi',
                    minLength: { value: 3, message: 'Min 3 karakter' },
                    pattern: { value: /^[a-zA-Z0-9._-]+$/, message: 'Hanya huruf, angka, titik, strip' },
                  })}
                  error={errors.username?.message?.toString()}
                />
              )}
              <Input
                label="Nama Lengkap"
                placeholder="cth: drg. Sari Dewi, S.KH"
                required
                {...register('fullname', { required: 'Wajib diisi' })}
                error={errors.fullname?.message?.toString()}
              />
              {!isEdit && (
                <Input
                  label="Password"
                  type="password"
                  placeholder="Min 8 karakter"
                  required
                  {...register('password', {
                    required: 'Wajib diisi',
                    minLength: { value: 8, message: 'Min 8 karakter' },
                  })}
                  error={errors.password?.message?.toString()}
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <Select label="Role" value={selectedRole} onValueChange={setSelectedRole} required>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </Select>
                {!isEdit && (
                  <Select label="Cabang" value={selectedBranch} onValueChange={setSelectedBranch} required>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.branchName}</SelectItem>
                    ))}
                  </Select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Email" type="email" placeholder="email@klinik.com" {...register('email')} />
                <Input label="No. HP / WA" placeholder="08xxxxxxxxx" {...register('phoneNumber')} />
              </div>
            </TabsContent>

            {/* Tab 2: Data Pribadi */}
            <TabsContent value="info-pribadi" className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Select label="Jenis Kelamin" value={selectedGender} onValueChange={setSelectedGender}>
                  <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                  <SelectItem value="Perempuan">Perempuan</SelectItem>
                </Select>
                <Select label="Agama" value={selectedReligion} onValueChange={setSelectedReligion}>
                  {RELIGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Tempat Lahir" placeholder="cth: Jakarta" {...register('birthPlace')} />
                <Input label="Tanggal Lahir" type="date" {...register('birthdate')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Golongan Darah" placeholder="A / B / AB / O" {...register('bloodGroup')} />
                <Input label="No. KTP" placeholder="16 digit" {...register('idCardNumber')} />
              </div>
              <Input label="No. Telepon Rumah" placeholder="Opsional" {...register('homeNumber')} />
              <Textarea label="Alamat" placeholder="Alamat domisili lengkap" rows={2} {...register('address')} />
            </TabsContent>
          </Tabs>

          {mutation.isError && (
            <p className="text-xs text-red-500">
              {(mutation.error as any)?.response?.data?.message ?? 'Gagal menyimpan. Coba lagi.'}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEdit ? 'Simpan Perubahan' : 'Buat Akun'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function UserDetailModal({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const rm = getRoleMeta(user.role)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-xs text-primary-600 hover:underline">detail</button>
      </DialogTrigger>
      <DialogContent title={user.fullname} description={user.staffingNumber ?? ''} className="max-w-md">
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
              <UserCog className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{user.fullname}</p>
              <p className="text-gray-400 text-xs">@{user.username}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={rm.color}>{rm.label}</Badge>
                <Badge variant={user.status ? 'green' : 'red'}>
                  {user.status ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Cabang',          value: user.branch.branchName },
              { label: 'Jenis Kelamin',   value: user.gender },
              { label: 'Agama',           value: user.religion },
              { label: 'Gol. Darah',      value: user.bloodGroup },
              { label: 'Tempat Lahir',    value: user.birthPlace },
              { label: 'Tanggal Lahir',   value: user.birthdate ? formatDate(user.birthdate) : undefined },
              { label: 'No. HP',          value: user.phoneNumber },
              { label: 'Email',           value: user.email },
              { label: 'No. KTP',         value: user.idCardNumber },
              { label: 'Terdaftar',       value: formatDate(user.createdAt) },
            ].map(({ label, value }) => value ? (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="font-medium text-gray-800">{value}</p>
              </div>
            ) : null)}
          </div>

          {user.address && (
            <div>
              <p className="text-xs text-gray-400">Alamat</p>
              <p className="text-gray-700">{user.address}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({ user, onSuccess }: { user: User; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ newPassword: string }>()

  const mutation = useMutation({
    mutationFn: (d: { newPassword: string }) => api.post(`/user/${user.id}/reset-password`, d),
    onSuccess: () => { setOpen(false); reset(); onSuccess() },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Reset Password">
          <KeyRound className="w-3.5 h-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent title="Reset Password" description={`Password baru untuk ${user.fullname}`}>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input
            label="Password Baru"
            type="password"
            placeholder="Min 8 karakter"
            required
            {...register('newPassword', { required: true, minLength: { value: 8, message: 'Min 8 karakter' } })}
            error={errors.newPassword?.message?.toString()}
          />
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            Sesi aktif user akan dihapus dan mereka harus login ulang.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" variant="danger" loading={mutation.isPending}>Reset</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UserPage() {
  const queryClient = useQueryClient()
  const [search, setSearch]           = useState('')
  const [filterRole, setFilterRole]   = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage]               = useState(1)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, filterRole, filterStatus, page],
    queryFn: async () => {
      const res = await api.get('/user', {
        params: { search, role: filterRole || undefined, status: filterStatus || undefined, page, limit: 20 },
      })
      return res.data
    },
    placeholderData: (prev) => prev,
  })

  const { data: branchData } = useQuery<Branch[]>({
    queryKey: ['cabang'],
    queryFn: async () => (await api.get('/cabang')).data.data,
  })

  const toggleStatus = useMutation({
    mutationFn: (id: string) => api.patch(`/user/${id}/toggle-status`),
    onSuccess: refresh,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/user/${id}`),
    onSuccess: refresh,
  })

  const users: User[]  = data?.data ?? []
  const meta           = data?.meta
  const roleSummary: Array<{ role: string; _count: { id: number } }> = data?.roleSummary ?? []
  const branches       = branchData ?? []

  // Hitung total dari summary
  const totalAktif = users.filter((u) => u.status).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl text-gray-900">Manajemen User</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {meta ? `${meta.total} total user` : '—'}
          </p>
        </div>
        <UserModal branches={branches} onSuccess={refresh} />
      </div>

      {/* Summary per role */}
      {roleSummary.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {roleSummary.map(({ role, _count }) => {
            const rm = getRoleMeta(role)
            return (
              <button
                key={role}
                onClick={() => setFilterRole(filterRole === role ? '' : role)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filterRole === role
                    ? 'border-primary-400 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <span>{rm.label}</span>
                <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                  {_count.id}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama, username, no. staf..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden text-sm">
          {[
            { value: '',      label: 'Semua' },
            { value: 'true',  label: 'Aktif' },
            { value: 'false', label: 'Nonaktif' },
          ].map((s) => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                filterStatus === s.value
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {(filterRole || filterStatus || search) && (
          <button
            onClick={() => { setFilterRole(''); setFilterStatus(''); setSearch(''); setPage(1) }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Reset filter
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users className="w-10 h-10" />}
            title="Tidak ada user ditemukan"
            description="Coba ubah filter atau tambah user baru."
          />
        ) : (
          <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Nama Staf</th>
                <th>No. Staf</th>
                <th>Role</th>
                <th>Kontak</th>
                <th>Cabang</th>
                <th className="text-center">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const rm = getRoleMeta(u.role)
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <UserCog className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-800 text-sm">{u.fullname}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs text-gray-400">@{u.username}</p>
                            <span className="text-gray-200">·</span>
                            <UserDetailModal user={u} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-gray-400">{u.staffingNumber ?? '—'}</td>
                    <td><Badge variant={rm.color}>{rm.label}</Badge></td>
                    <td>
                      <div className="space-y-0.5">
                        {u.phoneNumber && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Phone className="w-3 h-3 text-gray-400" />{u.phoneNumber}
                          </div>
                        )}
                        {u.email && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Mail className="w-3 h-3 text-gray-400" />
                            <span className="truncate max-w-[140px]">{u.email}</span>
                          </div>
                        )}
                        {!u.phoneNumber && !u.email && <span className="text-xs text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="text-sm text-gray-600">{u.branch.branchName}</td>
                    <td className="text-center">
                      <button
                        onClick={() => toggleStatus.mutate(u.id)}
                        className="inline-flex items-center"
                        title={u.status ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        {u.status
                          ? <ToggleRight className="w-6 h-6 text-primary-500" />
                          : <ToggleLeft className="w-6 h-6 text-gray-300" />
                        }
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <UserModal user={u} branches={branches} onSuccess={refresh} />
                        <ResetPasswordModal user={u} onSuccess={refresh} />
                        <button
                          onClick={() => { if (confirm(`Hapus user "${u.fullname}"?`)) deleteMutation.mutate(u.id) }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Menampilkan {users.length} dari {meta.total} user
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
