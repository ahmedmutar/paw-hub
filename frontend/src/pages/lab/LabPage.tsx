import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { FlaskConical, Plus, ChevronLeft, ChevronRight, CheckCircle, Clock, RefreshCw, Loader } from 'lucide-react'

interface LabReq {
  id: string; testType: string; status: string; priority: string; notes: string; createdAt: string
  patient: { petName: string; petCategory: string }
  requestedBy: { fullname: string }
  result: { isReady: boolean; readyAt: string } | null
}
interface LabResult { id: string; templateType: string; resultData: any; interpretation: string; isReady: boolean }
interface Template { key: string; label: string; fields: { key: string; label: string; unit: string; normalMin?: number; normalMax?: number }[] }

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Menunggu', color: 'bg-yellow-100 text-yellow-700' },
  processing: { label: 'Diproses', color: 'bg-blue-100 text-blue-700' },
  ready: { label: 'Siap', color: 'bg-green-100 text-green-700' },
}

function RequestModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ patientId: '', testType: '', notes: '', priority: 'normal' })
  const { data: patients } = useQuery({ queryKey: ['patients-list'], queryFn: () => api.get('/pasien').then((r: any) => r.data.data) })
  const { data: templates } = useQuery({ queryKey: ['lab-templates'], queryFn: () => api.get('/lab/templates').then((r: any) => r.data.data) })

  const mut = useMutation({
    mutationFn: () => api.post('/lab/request', form),
    onSuccess: () => { onSaved(); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-semibold text-gray-800">Request Pemeriksaan Lab</span>
          <button onClick={onClose} className="text-gray-400 text-xl">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Pasien</label>
            <select value={form.patientId} onChange={e => setForm(p => ({ ...p, patientId: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Pilih pasien...</option>
              {(patients ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.petName} — {p.owner?.ownerName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Jenis Pemeriksaan</label>
            <select value={form.testType} onChange={e => setForm(p => ({ ...p, testType: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Pilih jenis...</option>
              {(templates ?? []).map((t: Template) => <option key={t.key} value={t.key}>{t.label}</option>)}
              <option value="rontgen">Rontgen</option>
              <option value="usg">USG</option>
              <option value="kultur">Kultur Bakteri</option>
              <option value="lainnya">Lainnya</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Prioritas</label>
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Catatan</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 h-16 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600">Batal</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.patientId || !form.testType}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {mut.isPending ? 'Menyimpan...' : 'Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ResultModal({ request, onClose }: { request: LabReq; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: templates } = useQuery({ queryKey: ['lab-templates'], queryFn: () => api.get('/lab/templates').then((r: any) => r.data.data) })
  const template: Template | undefined = (templates ?? []).find((t: Template) => t.key === request.testType)

  const [resultData, setResultData] = useState<Record<string, string>>({})
  const [interpretation, setInterpretation] = useState('')
  const [isReady, setIsReady] = useState(false)

  const mut = useMutation({
    mutationFn: () => api.patch(`/lab/request/${request.id}/result`, { templateType: request.testType, resultData, interpretation, isReady }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lab-requests'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <div>
            <p className="font-semibold text-gray-800">Input Hasil Lab</p>
            <p className="text-xs text-gray-400">{request.patient.petName} · {request.testType}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          {template ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">{template.label}</p>
              {template.fields.map(f => (
                <div key={f.key} className="flex items-center gap-3">
                  <label className="w-40 text-sm text-gray-600 shrink-0">{f.label}</label>
                  <input value={resultData[f.key] ?? ''} onChange={e => setResultData(p => ({ ...p, [f.key]: e.target.value }))}
                    className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
                  <span className="text-xs text-gray-400 w-16 shrink-0">{f.unit}</span>
                  {f.normalMin !== undefined && <span className="text-xs text-gray-300 whitespace-nowrap">{f.normalMin}–{f.normalMax}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-gray-600">Hasil (teks bebas / link file)</label>
              <textarea rows={4} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 resize-none"
                placeholder="Hasil pemeriksaan..."
                onChange={e => setResultData({ rawResult: e.target.value })} />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-600">Interpretasi Dokter</label>
            <textarea value={interpretation} onChange={e => setInterpretation(e.target.value)} rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 resize-none" placeholder="Kesimpulan dan saran..." />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isReady} onChange={e => setIsReady(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700 font-medium">Hasil sudah siap (kirim notif WA ke owner)</span>
          </label>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600">Batal</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {mut.isPending ? 'Menyimpan...' : 'Simpan Hasil'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LabPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [selectedReq, setSelectedReq] = useState<LabReq | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const { data: res, isLoading } = useQuery({
    queryKey: ['lab-requests', statusFilter, page],
    queryFn: () => api.get('/lab/request', { params: { status: statusFilter === 'all' ? undefined : statusFilter, page, limit: 20 } }).then((r: any) => r.data),
  })

  const requests: LabReq[] = res?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FlaskConical className="w-6 h-6 text-teal-600" /> Manajemen Lab</h1>
          <p className="text-sm text-gray-500 mt-0.5">Permintaan & hasil pemeriksaan laboratorium</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Request Lab
        </button>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
          <div className="flex rounded-lg border overflow-hidden">
            {(['all', 'pending', 'processing', 'ready'] as const).map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`px-3 py-2 text-xs font-medium ${statusFilter === s ? 'bg-teal-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {s === 'all' ? 'Semua' : STATUS_CONFIG[s]?.label}
              </button>
            ))}
          </div>
          <button onClick={() => qc.invalidateQueries({ queryKey: ['lab-requests'] })} className="p-1.5 border rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Pasien</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Pemeriksaan</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Dokter</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Prioritas</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>)
            ) : requests.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400"><FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-20" />Tidak ada request lab</td></tr>
            ) : requests.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{r.patient.petName}</p>
                  <p className="text-xs text-gray-400">{r.patient.petCategory}</p>
                </td>
                <td className="px-4 py-3 text-gray-700 capitalize">{r.testType.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{r.requestedBy.fullname}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.priority === 'urgent' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                    {r.priority === 'urgent' ? 'Urgent' : 'Normal'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[r.status]?.color}`}>
                    {STATUS_CONFIG[r.status]?.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.status !== 'ready' ? (
                    <button onClick={() => setSelectedReq(r)} className="text-xs px-3 py-1 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 font-medium">
                      Input Hasil
                    </button>
                  ) : (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {res?.total > 20 && (
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-sm text-gray-500">Total: {res.total}</span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 border rounded disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={page * 20 >= res.total} onClick={() => setPage(p => p + 1)} className="p-1.5 border rounded disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {showAdd && <RequestModal onClose={() => setShowAdd(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['lab-requests'] })} />}
      {selectedReq && <ResultModal request={selectedReq} onClose={() => setSelectedReq(null)} />}
    </div>
  )
}
