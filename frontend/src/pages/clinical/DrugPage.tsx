import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Pill, Plus, AlertTriangle, AlertCircle, Check, Search, Calculator } from 'lucide-react'

interface Drug { id: string; drugName: string; genericName: string; category: string; species: string; dosagePerKgMin: number; dosagePerKgMax: number; unit: string; frequency: string; contraindications: string; sideEffects: string; isActive: boolean }

function AddDrugModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ drugName: '', genericName: '', category: 'umum', species: 'all', dosagePerKgMin: '', dosagePerKgMax: '', unit: 'mg', frequency: '', contraindications: '', sideEffects: '' })
  const mut = useMutation({
    mutationFn: () => api.post('/clinical/drug-database', form),
    onSuccess: () => { onSaved(); onClose() },
  })
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <span className="font-semibold text-gray-800">Tambah Obat ke Database</span>
          <button onClick={onClose} className="text-gray-400 text-xl">×</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600">Nama Obat *</label>
            <input value={form.drugName} onChange={e => setForm(p => ({ ...p, drugName: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Amoxicillin" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600">Nama Generik</label>
            <input value={form.genericName} onChange={e => setForm(p => ({ ...p, genericName: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Kategori</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              {['umum', 'antibiotik', 'antijamur', 'antiparasit', 'vitamin', 'hormon', 'analgesik', 'antiinflamasi', 'jantung', 'lainnya'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Spesies</label>
            <select value={form.species} onChange={e => setForm(p => ({ ...p, species: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="all">Semua</option>
              <option value="anjing">Anjing</option>
              <option value="kucing">Kucing</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Dosis Min (per kg)</label>
            <input type="number" value={form.dosagePerKgMin} onChange={e => setForm(p => ({ ...p, dosagePerKgMin: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="5" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Dosis Maks (per kg)</label>
            <input type="number" value={form.dosagePerKgMax} onChange={e => setForm(p => ({ ...p, dosagePerKgMax: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="20" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Satuan</label>
            <input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="mg" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Frekuensi</label>
            <input value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="3×1 hari, 7 hari" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600">Kontraindikasi</label>
            <textarea value={form.contraindications} onChange={e => setForm(p => ({ ...p, contraindications: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 h-16 resize-none" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600">Efek Samping</label>
            <textarea value={form.sideEffects} onChange={e => setForm(p => ({ ...p, sideEffects: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 h-16 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600">Batal</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.drugName}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {mut.isPending ? 'Menyimpan...' : 'Tambah Obat'}
          </button>
        </div>
      </div>
    </div>
  )
}

function InteractionChecker({ drugs }: { drugs: Drug[] }) {
  const [selected, setSelected] = useState<string[]>([])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const check = async () => {
    if (selected.length < 2) return
    setLoading(true)
    const res = await api.post('/clinical/drug-check', { drugIds: selected }) as any
    setResult(res.data.data)
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-4">
      <h3 className="font-semibold text-gray-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" /> Cek Interaksi Obat</h3>
      <p className="text-xs text-gray-400">Pilih 2 atau lebih obat untuk mengecek interaksi</p>

      <div className="flex flex-wrap gap-2">
        {drugs.filter(d => d.isActive).map(d => (
          <button key={d.id} onClick={() => setSelected(p => p.includes(d.id) ? p.filter(x => x !== d.id) : [...p, d.id])}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${selected.includes(d.id) ? 'bg-teal-500 text-white border-teal-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {d.drugName}
          </button>
        ))}
      </div>

      <button onClick={check} disabled={selected.length < 2 || loading}
        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
        {loading ? 'Mengecek...' : `Cek Interaksi (${selected.length} obat)`}
      </button>

      {result && (
        <div className={`p-4 rounded-xl border-2 ${result.hasDanger ? 'border-red-400 bg-red-50' : result.interactions.length > 0 ? 'border-orange-400 bg-orange-50' : 'border-green-400 bg-green-50'}`}>
          {result.safe ? (
            <div className="flex items-center gap-2 text-green-700">
              <Check className="w-5 h-5" />
              <p className="font-semibold">Tidak ada interaksi berbahaya yang diketahui</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-5 h-5 ${result.hasDanger ? 'text-red-600' : 'text-orange-600'}`} />
                <p className={`font-semibold ${result.hasDanger ? 'text-red-700' : 'text-orange-700'}`}>
                  {result.interactions.length} interaksi terdeteksi{result.hasDanger ? ' (BAHAYA)' : ' (Perhatian)'}
                </p>
              </div>
              {result.interactions.map((i: any) => (
                <div key={i.id} className={`p-3 rounded-lg border ${i.severity === 'danger' ? 'bg-red-100 border-red-300' : 'bg-orange-100 border-orange-300'}`}>
                  <p className="text-sm font-medium text-gray-800">{i.drugA.drugName} + {i.drugB.drugName}</p>
                  <p className="text-xs text-gray-600 mt-1">{i.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DoseCalculator({ drugs }: { drugs: Drug[] }) {
  const [drugId, setDrugId] = useState('')
  const [weight, setWeight] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const calc = async () => {
    if (!drugId || !weight) return
    setLoading(true)
    const res = await api.post('/clinical/dose-calculator', { drugId, weightKg: Number(weight) }) as any
    setResult(res.data.data)
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-4">
      <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Calculator className="w-4 h-4 text-blue-500" /> Kalkulator Dosis</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Obat</label>
          <select value={drugId} onChange={e => { setDrugId(e.target.value); setResult(null) }}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
            <option value="">Pilih obat...</option>
            {drugs.filter(d => d.isActive && (d.dosagePerKgMin || d.dosagePerKgMax)).map(d => (
              <option key={d.id} value={d.id}>{d.drugName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Berat Hewan (kg)</label>
          <input type="number" value={weight} onChange={e => { setWeight(e.target.value); setResult(null) }}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="3.5" step="0.1" />
        </div>
      </div>
      <button onClick={calc} disabled={!drugId || !weight || loading}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
        {loading ? 'Menghitung...' : 'Hitung Dosis'}
      </button>

      {result && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
          <p className="font-semibold text-blue-800">{result.drugName}</p>
          <div className="text-sm space-y-1">
            <p className="text-gray-700">Berat: <strong>{result.weightKg} kg</strong></p>
            <p className="text-gray-700">Rekomendasi dosis: <strong className="text-blue-700">{result.recommendation}</strong></p>
            {result.frequency && <p className="text-gray-700">Frekuensi: {result.frequency}</p>}
          </div>
          {result.contraindications && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700 font-semibold">⚠️ Kontraindikasi:</p>
              <p className="text-xs text-red-600 mt-0.5">{result.contraindications}</p>
            </div>
          )}
          <p className="text-xs text-gray-400 italic">*Selalu konfirmasi dengan dokter hewan sebelum pemberian</p>
        </div>
      )}
    </div>
  )
}

export default function DrugPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'database' | 'interaction' | 'calculator'>('database')

  const { data: drugs } = useQuery<Drug[]>({
    queryKey: ['drug-database', search],
    queryFn: () => api.get('/clinical/drug-database', { params: { search: search || undefined } }).then((r: any) => r.data.data),
  })

  const drugList = drugs ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Pill className="w-6 h-6 text-teal-600" /> Drug Database & Interaksi</h1>
          <p className="text-sm text-gray-500 mt-0.5">Database obat hewan, cek interaksi, dan kalkulator dosis</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Tambah Obat
        </button>
      </div>

      <div className="flex gap-1 border-b">
        {[['database', 'Database Obat'], ['interaction', 'Cek Interaksi'], ['calculator', 'Kalkulator Dosis']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === v ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'database' && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama obat..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Nama Obat</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Kategori</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Spesies</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Dosis/kg</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Frekuensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {drugList.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400"><Pill className="w-8 h-8 mx-auto mb-2 opacity-20" />Belum ada obat di database. Tambah obat untuk memulai.</td></tr>
              ) : drugList.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{d.drugName}</p>
                    {d.genericName && <p className="text-xs text-gray-400">{d.genericName}</p>}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{d.category}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${d.species === 'all' ? 'bg-gray-100 text-gray-600' : d.species === 'anjing' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {d.species === 'all' ? 'Semua' : d.species}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {d.dosagePerKgMin || d.dosagePerKgMax
                      ? `${d.dosagePerKgMin ?? '?'}–${d.dosagePerKgMax ?? '?'} ${d.unit}/kg`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{d.frequency ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'interaction' && <InteractionChecker drugs={drugList} />}
      {tab === 'calculator' && <DoseCalculator drugs={drugList} />}

      {showAdd && <AddDrugModal onClose={() => setShowAdd(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['drug-database'] })} />}
    </div>
  )
}
