import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { BarChart3, Users, TrendingDown, Star, Package, Clock, AlertTriangle, RefreshCw } from 'lucide-react'

function fmtRp(n: number) { return `Rp${Math.round(n).toLocaleString('id-ID')}` }

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function LTVTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-ltv'],
    queryFn: () => api.get('/analytics/ltv', { params: { limit: 20 } }).then((r: any) => r.data.data),
  })
  const rows: any[] = data ?? []
  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b"><h3 className="font-semibold text-gray-800">Top 20 Pemilik Berdasarkan Lifetime Value</h3></div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">#</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Pemilik</th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tier</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Total Spend</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Kunjungan</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Avg/Kunjungan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={6}><div className="h-10 animate-pulse bg-gray-50" /></td></tr>)
          ) : rows.map((r, i) => (
            <tr key={r.ownerId} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-400 text-xs">#{i + 1}</td>
              <td className="px-4 py-3">
                <p className="font-medium text-gray-800">{r.ownerName}</p>
                <p className="text-xs text-gray-400">{r.phoneNumber}</p>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.tier === 'gold' ? 'bg-yellow-100 text-yellow-700' : r.tier === 'silver' ? 'bg-gray-200 text-gray-600' : 'bg-blue-50 text-blue-600'}`}>
                  {r.tier}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-bold text-teal-600">{fmtRp(r.totalSpend)}</td>
              <td className="px-4 py-3 text-right text-gray-700">{r.visitCount}×</td>
              <td className="px-4 py-3 text-right text-gray-500 text-xs">{fmtRp(r.avgPerVisit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChurnTab() {
  const [days, setDays] = useState(90)
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-churn', days],
    queryFn: () => api.get('/analytics/churn', { params: { days } }).then((r: any) => r.data),
  })
  const rows: any[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">Tidak kunjungan dalam:</span>
        {[30, 60, 90, 180].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${days === d ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {d} hari
          </button>
        ))}
      </div>
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-800">Risiko Churn ({data?.total ?? 0} pemilik)</h3>
          <TrendingDown className="w-4 h-4 text-red-500" />
        </div>
        <div className="divide-y">
          {isLoading && <div className="p-8 text-center text-gray-400">Memuat...</div>}
          {!isLoading && rows.length === 0 && <p className="text-center py-8 text-gray-400">Tidak ada pemilik berisiko churn</p>}
          {rows.map(r => (
            <div key={r.ownerId} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-gray-800">{r.ownerName}</p>
                <p className="text-xs text-gray-400">{r.phoneNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-red-600 font-bold">{r.daysSince} hari tidak kunjungan</p>
                <p className="text-xs text-gray-400">Terakhir: {r.lastVisit ? new Date(r.lastVisit).toLocaleDateString('id-ID') : '-'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DoctorPerfTab() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const { data } = useQuery({
    queryKey: ['analytics-doctor', month, year],
    queryFn: () => api.get('/analytics/doctor-performance', { params: { month, year } }).then((r: any) => r.data.data),
  })
  const rows: any[] = data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border rounded-lg px-3 py-1.5 text-sm">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{new Date(2024, m - 1).toLocaleDateString('id-ID', { month: 'long' })}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="border rounded-lg px-3 py-1.5 text-sm">
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Dokter</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Pasien</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Omzet</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(r => (
              <tr key={r.doctorId} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{r.fullname}</td>
                <td className="px-4 py-3 text-right text-gray-700">{r.patientCount}</td>
                <td className="px-4 py-3 text-right font-semibold text-teal-600">{fmtRp(r.omzet)}</td>
                <td className="px-4 py-3 text-right">
                  {r.avgRating ? (
                    <span className="flex items-center justify-end gap-1">
                      <Star className="w-3.5 h-3.5 text-yellow-400" />
                      <span className="font-medium">{r.avgRating}</span>
                      <span className="text-xs text-gray-400">({r.reviewCount})</span>
                    </span>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StockForecastTab() {
  const { data } = useQuery({
    queryKey: ['analytics-stock'],
    queryFn: () => api.get('/analytics/stock-forecast').then((r: any) => r.data.data),
  })
  const rows: any[] = (data ?? []).filter((r: any) => r.dailyUsage > 0)

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-gray-800">Prediksi Stok Habis (90 hari ke depan)</h3>
        <p className="text-xs text-gray-400 mt-0.5">Berdasarkan rata-rata penggunaan 90 hari terakhir</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Produk</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Stok Saat Ini</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Pemakaian/Hari</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Sisa Hari</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Prediksi Habis</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-12 text-gray-400"><Package className="w-8 h-8 mx-auto mb-2 opacity-20" />Belum ada data penggunaan stok</td></tr>
          ) : rows.map(r => (
            <tr key={r.itemId} className={`hover:bg-gray-50 ${r.isCritical ? 'bg-red-50' : ''}`}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {r.isCritical && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                  <p className="font-medium text-gray-800">{r.itemName}</p>
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <span className={r.isLow ? 'text-red-600 font-bold' : 'text-gray-700'}>{r.currentStock} {r.unitName}</span>
              </td>
              <td className="px-4 py-3 text-right text-gray-500 text-xs">{r.dailyUsage}/hari</td>
              <td className="px-4 py-3 text-right">
                <span className={`font-bold ${r.isCritical ? 'text-red-600' : r.daysLeft && r.daysLeft <= 30 ? 'text-orange-600' : 'text-gray-700'}`}>
                  {r.daysLeft ?? '∞'} hari
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {r.forecastDate ? new Date(r.forecastDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HeatmapTab() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const { data } = useQuery({
    queryKey: ['analytics-heatmap', month, year],
    queryFn: () => api.get('/analytics/heatmap', { params: { month, year } }).then((r: any) => r.data.data),
  })

  const heatmap: any[] = data?.heatmap ?? []
  const maxVal = Math.max(1, ...heatmap.flatMap(d => d.hours as number[]))
  const peakHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-5">
      <div className="flex items-center gap-3 mb-5">
        <h3 className="font-semibold text-gray-800">Heatmap Jam Kunjungan</h3>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border rounded-lg px-2 py-1 text-xs">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{new Date(2024, m - 1).toLocaleDateString('id-ID', { month: 'long' })}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="border rounded-lg px-2 py-1 text-xs">
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {heatmap.length === 0 ? (
        <p className="text-center py-8 text-gray-400">Tidak ada data</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="flex gap-1 mb-1 ml-10">
              {peakHours.map(h => <div key={h} className="flex-1 text-center text-xs text-gray-400">{h}:00</div>)}
            </div>
            {heatmap.map(day => (
              <div key={day.day} className="flex gap-1 mb-1 items-center">
                <div className="w-10 text-xs text-gray-500 text-right pr-2">{day.day.slice(0, 3)}</div>
                {peakHours.map(h => {
                  const count = day.hours[h] as number
                  const intensity = Math.round((count / maxVal) * 255)
                  return (
                    <div key={h} className="flex-1 h-7 rounded text-xs flex items-center justify-center text-white font-medium cursor-default"
                      style={{ backgroundColor: count === 0 ? '#f3f4f6' : `rgba(13, 148, 136, ${count / maxVal})`, color: count > maxVal * 0.5 ? 'white' : count > 0 ? '#0d9488' : '#d1d5db' }}
                      title={`${day.day} ${h}:00 — ${count} kunjungan`}>
                      {count > 0 ? count : ''}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function BIPage() {
  const [tab, setTab] = useState<'ltv' | 'churn' | 'doctor' | 'stock' | 'heatmap'>('ltv')

  const tabs = [
    { key: 'ltv', label: 'Customer LTV', icon: Users },
    { key: 'churn', label: 'Churn Risk', icon: TrendingDown },
    { key: 'doctor', label: 'Kinerja Dokter', icon: Star },
    { key: 'stock', label: 'Forecast Stok', icon: Package },
    { key: 'heatmap', label: 'Heatmap Jam', icon: Clock },
  ] as const

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><BarChart3 className="w-6 h-6 text-teal-600" /> Business Intelligence</h1>
        <p className="text-sm text-gray-500 mt-0.5">Analitik mendalam untuk tren bisnis dan kinerja klinik</p>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === key ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'ltv' && <LTVTab />}
      {tab === 'churn' && <ChurnTab />}
      {tab === 'doctor' && <DoctorPerfTab />}
      {tab === 'stock' && <StockForecastTab />}
      {tab === 'heatmap' && <HeatmapTab />}
    </div>
  )
}
