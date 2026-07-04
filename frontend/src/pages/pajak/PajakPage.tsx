import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { FileText, Download, Bell, Edit2, Check, X } from 'lucide-react'

interface PajakRow {
  id: string; staffingNumber: string; fullname: string; ptkpStatus: string; npwp: string
  brutoMonthly: number; pph21: number; netSalary: number
}

function fmtRp(n: number) { return `Rp${Math.round(n).toLocaleString('id-ID')}` }

const PTKP_OPTIONS = ['TK0', 'TK1', 'TK2', 'TK3', 'K0', 'K1', 'K2', 'K3']

export default function PajakPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [editRow, setEditRow] = useState<PajakRow | null>(null)
  const [editForm, setEditForm] = useState({ ptkpStatus: '', npwp: '' })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pajak-rekap', month, year],
    queryFn: () => api.get('/pajak/pph21/rekap', { params: { month, year } }).then((r: any) => r.data.data),
  })

  const updateMut = useMutation({
    mutationFn: () => api.patch(`/pajak/user/${editRow!.id}/ptkp`, editForm),
    onSuccess: () => { refetch(); setEditRow(null) },
  })

  const reminderMut = useMutation({
    mutationFn: () => api.post('/pajak/pph21/reminder', {}),
  })

  const downloadExport = async () => {
    const res = await api.get('/pajak/pph21/export', { params: { month, year }, responseType: 'blob' }) as any
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    const a = document.createElement('a'); a.href = url; a.download = `PPh21-${year}-${String(month).padStart(2, '0')}.xlsx`; a.click()
    URL.revokeObjectURL(url)
  }

  const rows: PajakRow[] = data?.rows ?? []
  const monthName = new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FileText className="w-6 h-6 text-teal-600" /> Laporan PPh 21</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kalkulasi otomatis pajak penghasilan karyawan</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => reminderMut.mutate()} disabled={reminderMut.isPending}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Bell className="w-4 h-4" /> {reminderMut.isSuccess ? 'Terkirim!' : 'Kirim Reminder'}
          </button>
          <button onClick={downloadExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
            <Download className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3 bg-white border rounded-2xl p-4 shadow-sm">
        <span className="text-sm text-gray-600">Periode:</span>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="border rounded-lg px-3 py-1.5 text-sm">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{new Date(2024, m - 1).toLocaleDateString('id-ID', { month: 'long' })}</option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border rounded-lg px-3 py-1.5 text-sm">
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-sm font-medium text-gray-700">{monthName}</span>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Bruto', value: data.totalBruto, color: 'text-gray-800' },
            { label: 'Total PPh 21', value: data.totalPph21, color: 'text-red-600' },
            { label: 'Total Neto', value: data.totalNet, color: 'text-teal-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border p-4 shadow-sm">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{fmtRp(s.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-800">Detail PPh 21 Karyawan — {monthName}</h3>
          <p className="text-xs text-gray-400 mt-0.5">Klik ikon edit untuk mengubah status PTKP karyawan</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Karyawan</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">NPWP</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status PTKP</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Gaji Bruto</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">PPh 21</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Gaji Neto</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>)
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Tidak ada data penggajian untuk periode ini</td></tr>
            ) : rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{row.fullname}</p>
                  {row.staffingNumber && <p className="text-xs text-gray-400">NIP: {row.staffingNumber}</p>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 font-mono">{row.npwp || <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-center">
                  {editRow?.id === row.id ? (
                    <div className="flex items-center gap-1 justify-center">
                      <select value={editForm.ptkpStatus} onChange={e => setEditForm(p => ({ ...p, ptkpStatus: e.target.value }))}
                        className="border rounded px-2 py-1 text-xs">
                        {PTKP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <button onClick={() => updateMut.mutate()} className="p-1 text-green-600 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditRow(null)} className="p-1 text-red-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full font-mono">{row.ptkpStatus ?? 'TK0'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{fmtRp(row.brutoMonthly)}</td>
                <td className="px-4 py-3 text-right font-medium text-red-600">{fmtRp(row.pph21)}</td>
                <td className="px-4 py-3 text-right font-semibold text-teal-600">{fmtRp(row.netSalary)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => { setEditRow(row); setEditForm({ ptkpStatus: row.ptkpStatus ?? 'TK0', npwp: row.npwp ?? '' }) }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-teal-600">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-2">Informasi PPh 21</p>
        <ul className="space-y-1 text-xs text-blue-700">
          <li>• Perhitungan menggunakan tarif progresif PPh 21 terbaru (berlaku 2024)</li>
          <li>• PTKP: TK0=54jt, K0=58.5jt, K1=63jt, K2=67.5jt, K3=72jt per tahun</li>
          <li>• Batas pelaporan SPT Masa PPh 21: <strong>tanggal 20 bulan berikutnya</strong></li>
          <li>• Export Excel sesuai format laporan untuk membantu pelaporan manual ke DJP Online</li>
        </ul>
      </div>
    </div>
  )
}
