import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Shield, Search, Filter, Activity, TrendingUp } from 'lucide-react'

interface AuditLog {
  id: string; action: string; resource: string; resourceId?: string
  username?: string; userId?: string; details?: any
  ipAddress?: string; createdAt: string; tenantId?: string
}
interface Stats {
  totalToday: number
  byAction: { action: string; count: number }[]
  byResource: { resource: string; count: number }[]
}

const ACTION_COLOR: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-600',
  export: 'bg-violet-100 text-violet-700',
  login:  'bg-teal-100 text-teal-700',
  view:   'bg-gray-100 text-gray-600',
}
const ACTION_LABEL: Record<string, string> = {
  create: 'Buat', update: 'Edit', delete: 'Hapus',
  export: 'Export', login: 'Login', view: 'Lihat',
}
const RESOURCE_LABEL: Record<string, string> = {
  patient: 'Pasien', registration: 'Pendaftaran', payment: 'Pembayaran',
  invoice: 'Invoice', laporan: 'Laporan', pasien: 'Daftar Pasien',
  user: 'User', cabang: 'Cabang', grooming: 'Grooming',
}

function fmtTime(d: string) {
  return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AuditPage() {
  const [filter, setFilter] = useState({ search: '', action: '', resource: '', dateFrom: '', dateTo: '' })
  const [page, setPage] = useState(1)

  const { data: stats } = useQuery<Stats>({
    queryKey: ['audit-stats'],
    queryFn: () => api.get('/audit/stats').then((r: any) => r.data.data),
    refetchInterval: 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filter, page],
    queryFn: () => api.get('/audit', { params: { ...filter, page, limit: 50 } }).then((r: any) => r.data),
  })

  const logs: AuditLog[] = data?.data ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1

  const setF = (key: string, val: string) => { setFilter(f => ({ ...f, [key]: val })); setPage(1) }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Shield className="w-6 h-6 text-teal-600" /> Audit Trail
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Rekam jejak seluruh aktivitas di sistem</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-100 rounded-lg"><Activity className="w-5 h-5 text-teal-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Aktivitas Hari Ini</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalToday}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Per Aksi (Hari Ini)</p>
            <div className="flex flex-wrap gap-1.5">
              {stats.byAction.map(a => (
                <span key={a.action} className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLOR[a.action] ?? 'bg-gray-100 text-gray-600'}`}>
                  {ACTION_LABEL[a.action] ?? a.action} ({a.count})
                </span>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Paling Aktif</p>
            <div className="space-y-1">
              {stats.byResource.slice(0, 4).map(r => (
                <div key={r.resource} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 capitalize">{RESOURCE_LABEL[r.resource] ?? r.resource}</span>
                  <span className="font-semibold text-gray-800">{r.count}×</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input value={filter.search} onChange={e => setF('search', e.target.value)}
            placeholder="Cari user / resource..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <select value={filter.action} onChange={e => setF('action', e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">Semua Aksi</option>
          {Object.entries(ACTION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filter.resource} onChange={e => setF('resource', e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">Semua Resource</option>
          {Object.entries(RESOURCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={filter.dateFrom} onChange={e => setF('dateFrom', e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          <span className="text-gray-400 text-sm">—</span>
          <input type="date" value={filter.dateTo} onChange={e => setF('dateTo', e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        {(filter.search || filter.action || filter.resource || filter.dateFrom) && (
          <button onClick={() => { setFilter({ search: '', action: '', resource: '', dateFrom: '', dateTo: '' }); setPage(1) }}
            className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Waktu</th>
              <th className="text-left px-4 py-3 font-medium">User</th>
              <th className="text-left px-4 py-3 font-medium">Aksi</th>
              <th className="text-left px-4 py-3 font-medium">Resource</th>
              <th className="text-left px-4 py-3 font-medium">ID / Detail</th>
              <th className="text-left px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Memuat log...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Tidak ada log aktivitas
              </td></tr>
            ) : logs.map((log, i) => (
              <tr key={log.id} className={`border-t ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtTime(log.createdAt)}</td>
                <td className="px-4 py-2.5">
                  <span className="font-medium text-gray-800">{log.username ?? '—'}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLOR[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ACTION_LABEL[log.action] ?? log.action}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-700 capitalize">
                  {RESOURCE_LABEL[log.resource] ?? log.resource}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500">
                  {log.resourceId ? <span className="font-mono bg-gray-100 px-1 rounded">#{log.resourceId}</span> : null}
                  {log.details && (
                    <span className="ml-1 text-gray-400">{Object.entries(log.details).map(([k, v]) => `${k}:${v}`).join(', ')}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{log.ipAddress ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{total} log ditemukan</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40">Sebelumnya</button>
            <span className="px-3 py-1.5 bg-teal-50 text-teal-600 rounded-lg font-medium">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40">Selanjutnya</button>
          </div>
        </div>
      )}
    </div>
  )
}
