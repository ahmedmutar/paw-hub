import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Activity, AlertTriangle, Clock, ThumbsUp, Shield, RefreshCw } from 'lucide-react'

// Public symptom checker (embedded view, also used standalone)
export function PublicSymptomChecker({ branchId }: { branchId?: string }) {
  const [form, setForm] = useState({ petName: '', species: '', age: '', symptoms: '' })
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCheck = async () => {
    if (form.symptoms.trim().length < 10) { setError('Deskripsikan gejala lebih detail (min. 10 karakter)'); return }
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/public/symptom-checker', { ...form, branchId }) as any
      setResult(res.data.data)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Gagal menganalisis gejala')
    } finally { setLoading(false) }
  }

  const URGENCY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    segera: { label: 'DARURAT — Segera ke Klinik', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: AlertTriangle },
    dalam_24_jam: { label: 'Perlu Periksa dalam 24 Jam', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: Clock },
    bisa_tunggu: { label: 'Bisa Ditunggu (3–7 Hari)', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: Clock },
    tidak_perlu: { label: 'Tidak Perlu ke Klinik Sekarang', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: ThumbsUp },
  }

  const urg = result ? URGENCY_CONFIG[result.urgencyLevel] : null

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Nama Hewan (opsional)</label>
          <input value={form.petName} onChange={e => setForm(p => ({ ...p, petName: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Mochi" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Jenis Hewan</label>
          <select value={form.species} onChange={e => setForm(p => ({ ...p, species: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
            <option value="">Pilih...</option>
            <option value="anjing">Anjing</option>
            <option value="kucing">Kucing</option>
            <option value="kelinci">Kelinci</option>
            <option value="hamster">Hamster</option>
            <option value="burung">Burung</option>
            <option value="lainnya">Lainnya</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Usia (bulan, opsional)</label>
          <input type="number" value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="12" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Gejala yang Dialami *</label>
        <textarea value={form.symptoms} onChange={e => setForm(p => ({ ...p, symptoms: e.target.value }))} rows={4}
          className="w-full border rounded-lg px-3 py-2 text-sm mt-1 resize-none"
          placeholder="Contoh: Tidak mau makan sejak 2 hari, muntah 3x, lemas, tidak mau bergerak, perut terlihat membesar..." />
        <p className="text-xs text-gray-400 mt-1">Deskripsikan gejala sebanyak mungkin untuk hasil analisis yang lebih akurat</p>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">{error}</div>}

      <button onClick={handleCheck} disabled={loading || form.symptoms.trim().length < 10}
        className="w-full py-3 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-xl font-semibold text-sm">
        {loading ? 'Menganalisis...' : '🔍 Analisis Gejala'}
      </button>

      {result && urg && (
        <div className={`border-2 rounded-2xl p-5 ${urg.bg} space-y-4`}>
          <div className="flex items-center gap-3">
            <urg.icon className={`w-6 h-6 ${urg.color} shrink-0`} />
            <p className={`font-bold text-base ${urg.color}`}>{urg.label}</p>
          </div>
          <p className="text-sm text-gray-700">{result.assessment}</p>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Rekomendasi:</p>
            <ul className="space-y-1.5">
              {result.recommendations.map((r: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-teal-500 font-bold mt-0.5">•</span> {r}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-gray-400 italic border-t pt-3">{result.disclaimer}</p>
          <button onClick={() => setResult(null)} className="text-sm text-teal-600 hover:text-teal-700 font-medium">
            ← Analisis Ulang
          </button>
        </div>
      )}
    </div>
  )
}

// Admin — log viewer page
export default function SymptomPage() {
  const [page, setPage] = useState(1)
  const [urgency, setUrgency] = useState('all')
  const [activeTab, setActiveTab] = useState<'checker' | 'log'>('checker')

  const { data: res } = useQuery({
    queryKey: ['symptom-logs', urgency, page],
    queryFn: () => api.get('/ai/symptom-log', { params: { urgency: urgency === 'all' ? undefined : urgency, page, limit: 20 } }).then((r: any) => r.data),
    enabled: activeTab === 'log',
  })

  const logs: any[] = res?.data ?? []
  const stats: any = res?.stats

  const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
    segera: { label: 'Darurat', color: 'bg-red-100 text-red-700' },
    dalam_24_jam: { label: '< 24 Jam', color: 'bg-orange-100 text-orange-700' },
    bisa_tunggu: { label: 'Bisa Tunggu', color: 'bg-yellow-100 text-yellow-700' },
    tidak_perlu: { label: 'Tidak Perlu', color: 'bg-green-100 text-green-700' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Activity className="w-6 h-6 text-teal-600" /> AI Symptom Checker</h1>
        <p className="text-sm text-gray-500 mt-0.5">Panduan awal kondisi hewan sebelum ke klinik</p>
      </div>

      <div className="flex gap-1 border-b">
        {[['checker', 'Cek Gejala'], ['log', 'Riwayat Log']].map(([v, l]) => (
          <button key={v} onClick={() => setActiveTab(v as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === v ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {activeTab === 'checker' && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <Activity className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">Cek Kondisi Hewan</p>
              <p className="text-xs text-gray-400">Masukkan gejala yang dialami hewan Anda</p>
            </div>
          </div>
          <PublicSymptomChecker />
          <div className="mt-4 flex items-start gap-2 p-3 bg-blue-50 rounded-xl">
            <Shield className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-600">Fitur ini menggunakan analisis berbasis gejala sebagai panduan awal, bukan diagnosa medis resmi. Selalu konsultasikan dengan dokter hewan.</p>
          </div>
        </div>
      )}

      {activeTab === 'log' && (
        <>
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Darurat', value: stats.segera, color: 'text-red-600' },
                { label: '< 24 Jam', value: stats.dalam_24_jam, color: 'text-orange-600' },
                { label: 'Bisa Tunggu', value: stats.bisa_tunggu, color: 'text-yellow-600' },
                { label: 'Tidak Perlu', value: stats.tidak_perlu, color: 'text-green-600' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl border p-4 shadow-sm">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
              <div className="flex rounded-lg border overflow-hidden">
                {(['all', 'segera', 'dalam_24_jam', 'bisa_tunggu', 'tidak_perlu'] as const).map(v => (
                  <button key={v} onClick={() => setUrgency(v)}
                    className={`px-3 py-2 text-xs font-medium ${urgency === v ? 'bg-teal-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {v === 'all' ? 'Semua' : URGENCY_CONFIG[v]?.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y">
              {logs.length === 0 && <p className="text-center py-12 text-gray-400">Belum ada log</p>}
              {logs.map(log => (
                <div key={log.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {log.petName && <p className="font-medium text-gray-800">{log.petName} ({log.species})</p>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${URGENCY_CONFIG[log.urgencyLevel]?.color}`}>
                          {URGENCY_CONFIG[log.urgencyLevel]?.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{log.inputSymptoms}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(log.createdAt).toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {res?.total > 20 && (
              <div className="flex items-center justify-between p-4 border-t">
                <span className="text-sm text-gray-500">Total: {res.total}</span>
                <div className="flex gap-1">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 border rounded disabled:opacity-40 text-xs">‹</button>
                  <button disabled={page * 20 >= res.total} onClick={() => setPage(p => p + 1)} className="p-1.5 border rounded disabled:opacity-40 text-xs">›</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
