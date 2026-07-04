import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Building2, Users, Globe, Search, ChevronDown, Eye,
  CheckCircle2, PauseCircle, XCircle, Clock, TrendingUp
} from 'lucide-react'

interface Tenant {
  id: string; name: string; slug: string; email: string; phoneNumber?: string
  status: 'trial' | 'active' | 'suspended' | 'cancelled'
  trialEndsAt?: string; createdAt: string
  branchCount: number; userCount: number
  subscription?: { status: string; cycle: string; expiresAt?: string; plan: { code: string; name: string } }
}
interface Overview { total: number; trial: number; active: number; suspended: number; cancelled: number }

const STATUS_COLOR: Record<string, string> = {
  trial: 'bg-amber-100 text-amber-700', active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-600', cancelled: 'bg-gray-100 text-gray-500',
}
const STATUS_ICON: Record<string, any> = {
  trial: Clock, active: CheckCircle2, suspended: PauseCircle, cancelled: XCircle,
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${color}`}><Icon className="w-5 h-5 text-white" /></div>
      <div><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-bold text-gray-800">{value}</p></div>
    </div>
  )
}

function TenantDetailDrawer({ tenant, onClose, qc }: { tenant: Tenant; onClose: () => void; qc: any }) {
  const { data: detail } = useQuery({
    queryKey: ['tenant-detail', tenant.id],
    queryFn: () => api.get(`/tenant/${tenant.id}`).then((r: any) => r.data.data),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: any) => api.put(`/tenant/${id}/status`, { status }).then((r: any) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); qc.invalidateQueries({ queryKey: ['tenant-detail', tenant.id] }) },
  })

  const t = detail ?? tenant
  const StatusIcon = STATUS_ICON[t.status] ?? Clock

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full md:w-[480px] md:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-start justify-between">
          <div>
            <h2 className="font-bold text-gray-800">{t.name}</h2>
            <p className="text-xs text-gray-400">{t.slug} · {t.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status + change */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[t.status]}`}>
              <StatusIcon className="w-3.5 h-3.5" /> {t.status}
            </span>
            {t.status !== 'active'    && <button onClick={() => statusMut.mutate({ id: t.id, status: 'active' })}    className="text-xs px-2 py-1 bg-green-50 text-green-600 border border-green-200 rounded-full hover:bg-green-100">Aktifkan</button>}
            {t.status !== 'suspended' && t.status !== 'cancelled' && <button onClick={() => statusMut.mutate({ id: t.id, status: 'suspended' })} className="text-xs px-2 py-1 bg-red-50 text-red-500 border border-red-200 rounded-full hover:bg-red-100">Suspend</button>}
            {t.status !== 'cancelled' && <button onClick={() => { if (confirm(`Cancel tenant ${t.name}?`)) statusMut.mutate({ id: t.id, status: 'cancelled' }) }} className="text-xs px-2 py-1 bg-gray-50 text-gray-500 border rounded-full hover:bg-gray-100">Cancel</button>}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Cabang',  value: detail?.branchCount ?? t.branchCount },
              { label: 'User',    value: detail?.userCount   ?? t.userCount },
              { label: 'Pasien',  value: detail?.patientCount ?? '—' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gray-800">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Subscription */}
          {t.subscription && (
            <div className="bg-white border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Langganan</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Paket</span><span className="font-medium">{t.subscription.plan.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLOR[t.subscription.status]}`}>{t.subscription.status}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Siklus</span><span className="font-medium capitalize">{t.subscription.cycle === 'monthly' ? 'Bulanan' : 'Tahunan'}</span></div>
                {t.subscription.expiresAt && <div className="flex justify-between"><span className="text-gray-500">Exp</span><span className="font-medium">{new Date(t.subscription.expiresAt).toLocaleDateString('id-ID')}</span></div>}
              </div>
            </div>
          )}

          {/* Branches */}
          {detail?.branches?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Cabang</h3>
              <div className="space-y-2">
                {detail.branches.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                    <span className="font-medium text-gray-700">{b.branchName}</span>
                    <span className="text-xs text-gray-400">{b.branchCode}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${b.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>{b.isActive ? 'Aktif' : 'Nonaktif'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-400">Terdaftar: {new Date(t.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
      </div>
    </div>
  )
}

export default function TenantsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Tenant | null>(null)

  const { data: overview } = useQuery<Overview>({
    queryKey: ['tenant-overview'],
    queryFn: () => api.get('/tenant/stats/overview').then((r: any) => r.data.data),
  })
  const { data, isLoading } = useQuery({
    queryKey: ['tenants', search, status, page],
    queryFn: () => api.get('/tenant', { params: { search, status, page, limit: 20 } }).then((r: any) => r.data),
  })

  const tenants: Tenant[] = data?.data ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Manajemen Tenant</h1>
        <p className="text-sm text-gray-500 mt-0.5">Kelola semua klinik yang terdaftar di platform</p>
      </div>

      {/* Overview stats */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total"      value={overview.total}     icon={Globe}        color="bg-gray-500" />
          <StatCard label="Trial"      value={overview.trial}     icon={Clock}        color="bg-amber-400" />
          <StatCard label="Aktif"      value={overview.active}    icon={CheckCircle2} color="bg-green-500" />
          <StatCard label="Suspended"  value={overview.suspended} icon={PauseCircle}  color="bg-red-400" />
          <StatCard label="Cancelled"  value={overview.cancelled} icon={XCircle}      color="bg-gray-400" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari nama / email / slug..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">Semua Status</option>
          <option value="trial">Trial</option>
          <option value="active">Aktif</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Klinik</th>
              <th className="text-left px-4 py-3 font-medium">Slug</th>
              <th className="text-left px-4 py-3 font-medium">Paket</th>
              <th className="text-center px-4 py-3 font-medium">Cabang</th>
              <th className="text-center px-4 py-3 font-medium">User</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Terdaftar</th>
              <th className="text-left px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Memuat data...</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Tidak ada tenant ditemukan</td></tr>
            ) : tenants.map(t => {
              const SIcon = STATUS_ICON[t.status] ?? Clock
              return (
                <tr key={t.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{t.slug}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {t.subscription ? (
                      <span className="text-xs font-medium">{t.subscription.plan.name}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-gray-700">{t.branchCount}</td>
                  <td className="px-4 py-3 text-center font-medium text-gray-700">{t.userCount}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[t.status]}`}>
                      <SIcon className="w-3 h-3" /> {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(t.createdAt).toLocaleDateString('id-ID')}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelected(t)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{total} tenant ditemukan</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40">Sebelumnya</button>
            <span className="px-3 py-1.5 bg-teal-50 text-teal-600 rounded-lg">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40">Selanjutnya</button>
          </div>
        </div>
      )}

      {selected && <TenantDetailDrawer tenant={selected} onClose={() => setSelected(null)} qc={qc} />}
    </div>
  )
}
