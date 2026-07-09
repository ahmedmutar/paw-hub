import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ShoppingCart, Plus, RefreshCw, Link2, Link2Off, ExternalLink, Package, TrendingUp } from 'lucide-react'

interface Integration { id: string; platform: string; shopName: string; shopId: string; syncEnabled: boolean; lastSyncAt: string }
interface Order {
  id: string; orderId: string; platform: string; customerName: string; items: any[]
  totalAmount: number; status: string; orderDate: string
  integration: { platform: string; shopName: string }
}

function fmtRp(n: number) { return `Rp${Math.round(n).toLocaleString('id-ID')}` }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-' }

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Menunggu', color: 'bg-yellow-100 text-yellow-700' },
  processing: { label: 'Diproses', color: 'bg-blue-100 text-blue-700' },
  shipped: { label: 'Dikirim', color: 'bg-purple-100 text-purple-700' },
  done: { label: 'Selesai', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-600' },
}

const PLATFORM_CONFIG: Record<string, { color: string; bg: string }> = {
  tokopedia: { color: 'text-green-700', bg: 'bg-green-50' },
  shopee: { color: 'text-orange-700', bg: 'bg-orange-50' },
}

function ConnectModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ platform: 'tokopedia', shopName: '', shopId: '', accessToken: '' })
  const mut = useMutation({
    mutationFn: () => api.post('/marketplace/connect', form),
    onSuccess: () => { onSaved(); onClose() },
  })
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-semibold text-gray-800">Hubungkan Marketplace</span>
          <button onClick={onClose} className="text-gray-400 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs text-blue-700">Masukkan detail toko dan token API yang didapatkan dari dashboard seller marketplace Anda.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Platform</label>
            <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="tokopedia">Tokopedia</option>
              <option value="shopee">Shopee</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Nama Toko</label>
            <input value={form.shopName} onChange={e => setForm(p => ({ ...p, shopName: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Paw Hub Official Store" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Shop ID</label>
            <input value={form.shopId} onChange={e => setForm(p => ({ ...p, shopId: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="12345678" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Access Token API</label>
            <input value={form.accessToken} onChange={e => setForm(p => ({ ...p, accessToken: e.target.value }))}
              type="password" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="••••••••" />
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600">Batal</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.shopName || !form.shopId}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {mut.isPending ? 'Menghubungkan...' : 'Hubungkan'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  const qc = useQueryClient()
  const [showConnect, setShowConnect] = useState(false)
  const [tab, setTab] = useState<'integrasi' | 'pesanan'>('integrasi')
  const [orderStatus, setOrderStatus] = useState('all')

  const { data: integrations } = useQuery<Integration[]>({
    queryKey: ['marketplace-integrations'],
    queryFn: () => api.get('/marketplace/integrations').then((r: any) => r.data.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['marketplace-stats'],
    queryFn: () => api.get('/marketplace/stats').then((r: any) => r.data.data),
  })

  const { data: ordersRes } = useQuery({
    queryKey: ['marketplace-orders', orderStatus],
    queryFn: () => api.get('/marketplace/orders', { params: { status: orderStatus === 'all' ? undefined : orderStatus } }).then((r: any) => r.data),
    enabled: tab === 'pesanan',
  })

  const syncMut = useMutation({
    mutationFn: (id: string) => api.post(`/marketplace/${id}/sync`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace-orders'] }),
  })

  const disconnectMut = useMutation({
    mutationFn: (id: string) => api.delete(`/marketplace/${id}/disconnect`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace-integrations'] }),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/marketplace/orders/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace-orders'] }),
  })

  const integrationList = integrations ?? []
  const orders: Order[] = ordersRes?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><ShoppingCart className="w-6 h-6 text-teal-600" /> Integrasi Marketplace</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kelola toko online Tokopedia & Shopee dari satu tempat</p>
        </div>
        <button onClick={() => setShowConnect(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Hubungkan Toko
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Toko Terhubung', value: stats.connectedPlatforms, color: 'text-teal-600' },
            { label: 'Total Pesanan', value: stats.totalOrders, color: 'text-gray-800' },
            { label: 'Menunggu', value: stats.pendingOrders, color: 'text-yellow-600' },
            { label: 'Total Pendapatan', value: fmtRp(stats.totalRevenue), color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border p-4 shadow-sm">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[['integrasi', 'Toko Terhubung', Link2], ['pesanan', 'Pesanan', ShoppingCart]].map(([v, l, Icon]: any) => (
          <button key={v} onClick={() => setTab(v as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === v ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>

      {/* Integrasi Tab */}
      {tab === 'integrasi' && (
        <div className="space-y-4">
          {integrationList.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>Belum ada toko yang terhubung.</p>
              <p className="text-sm mt-1">Hubungkan toko Tokopedia atau Shopee Anda untuk mulai sinkronisasi stok.</p>
            </div>
          )}
          {integrationList.map(intg => (
            <div key={intg.id} className="bg-white rounded-2xl border p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${PLATFORM_CONFIG[intg.platform]?.bg} ${PLATFORM_CONFIG[intg.platform]?.color}`}>
                    {intg.platform === 'tokopedia' ? 'TK' : 'SP'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{intg.shopName}</p>
                    <p className="text-xs text-gray-400 capitalize">{intg.platform} · ID: {intg.shopId}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${intg.syncEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-xs text-gray-500">{intg.syncEnabled ? 'Aktif' : 'Tidak Aktif'}</span>
                      {intg.lastSyncAt && <span className="text-xs text-gray-300">· Sync: {fmtDate(intg.lastSyncAt)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => syncMut.mutate(intg.id)} disabled={syncMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                    <RefreshCw className="w-3.5 h-3.5" /> Sync
                  </button>
                  <button onClick={() => disconnectMut.mutate(intg.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-xs text-red-500 hover:bg-red-50">
                    <Link2Off className="w-3.5 h-3.5" /> Putuskan
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pesanan Tab */}
      {tab === 'pesanan' && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
            <div className="flex rounded-lg border overflow-hidden">
              {(['all', 'pending', 'processing', 'shipped', 'done', 'cancelled'] as const).map(s => (
                <button key={s} onClick={() => setOrderStatus(s)}
                  className={`px-3 py-2 text-xs font-medium ${orderStatus === s ? 'bg-teal-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {s === 'all' ? 'Semua' : ORDER_STATUS[s]?.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y">
            {orders.length === 0 && <p className="text-center py-12 text-gray-400">Tidak ada pesanan</p>}
            {orders.map(o => (
              <div key={o.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${PLATFORM_CONFIG[o.platform]?.bg} ${PLATFORM_CONFIG[o.platform]?.color}`}>
                        {o.platform.toUpperCase()}
                      </span>
                      <p className="text-xs font-mono text-gray-400">{o.orderId}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS[o.status]?.color}`}>
                        {ORDER_STATUS[o.status]?.label}
                      </span>
                    </div>
                    <p className="font-medium text-gray-800">{o.customerName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDate(o.orderDate)} · {o.integration.shopName}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-gray-800">{fmtRp(Number(o.totalAmount))}</p>
                    {o.status === 'pending' && (
                      <div className="flex gap-1 mt-2">
                        <button onClick={() => statusMut.mutate({ id: o.id, status: 'processing' })}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">Proses</button>
                        <button onClick={() => statusMut.mutate({ id: o.id, status: 'cancelled' })}
                          className="text-xs px-2 py-1 bg-red-50 text-red-500 rounded hover:bg-red-100">Batalkan</button>
                      </div>
                    )}
                    {o.status === 'processing' && (
                      <button onClick={() => statusMut.mutate({ id: o.id, status: 'shipped' })}
                        className="mt-2 text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded hover:bg-purple-100">Kirim</button>
                    )}
                    {o.status === 'shipped' && (
                      <button onClick={() => statusMut.mutate({ id: o.id, status: 'done' })}
                        className="mt-2 text-xs px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100">Selesai</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showConnect && <ConnectModal onClose={() => setShowConnect(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['marketplace-integrations'] })} />}
    </div>
  )
}
