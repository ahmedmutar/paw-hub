import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, Wallet, TrendingUp, Calendar, Plus, Search,
  Edit2, Trash2, X, ChevronLeft, ChevronRight, Printer,
  Banknote, Briefcase, Building2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string
  fullname: string
  username: string
  role: string
}

interface Payroll {
  id: string
  userEmployeeId: string
  branchId: string
  datePayed: string
  periodMonth: number
  periodYear: number
  basicSallary: number
  accomodation: number
  percentageTurnover: number
  amountTurnover: number
  totalTurnover: number
  minusTurnover: number
  amountInpatient: number
  countInpatient: number
  totalInpatient: number
  percentageSurgery: number
  amountSurgery: number
  totalSurgery: number
  amountGrooming: number
  countGrooming: number
  totalGrooming: number
  totalOverall: number
  employee: Employee
  branch: { id: string; branchName: string }
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const ROLE_LABEL: Record<string, string> = {
  dokter: 'Dokter', resepsionis: 'Resepsionis',
  kasir: 'Kasir', karyawan: 'Karyawan',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const defaultForm = {
  userEmployeeId: '',
  branchId: '',
  datePayed: format(new Date(), 'yyyy-MM-dd'),
  periodMonth: new Date().getMonth() + 1,
  periodYear: new Date().getFullYear(),
  basicSallary: '',
  accomodation: '',
  percentageTurnover: '',
  amountTurnover: '',
  totalTurnover: '',
  minusTurnover: '',
  amountInpatient: '',
  countInpatient: '',
  totalInpatient: '',
  percentageSurgery: '',
  amountSurgery: '',
  totalSurgery: '',
  amountGrooming: '',
  countGrooming: '',
  totalGrooming: '',
}

// ─── Slip Print Component ──────────────────────────────────────────────────────

function SlipGaji({ payroll, onClose }: { payroll: Payroll; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header slip */}
        <div className="bg-indigo-700 text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">SLIP GAJI</div>
            <div className="text-indigo-200 text-sm">
              {payroll.branch?.branchName} • {MONTHS[payroll.periodMonth - 1]} {payroll.periodYear}
            </div>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4" id="slip-print-area">
          {/* Karyawan */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-indigo-700 font-bold text-sm">
                {payroll.employee?.fullname?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="font-semibold text-gray-800">{payroll.employee?.fullname}</div>
              <div className="text-xs text-gray-500">
                {ROLE_LABEL[payroll.employee?.role] ?? payroll.employee?.role} •{' '}
                Dibayar: {format(new Date(payroll.datePayed), 'd MMM yyyy', { locale: localeId })}
              </div>
            </div>
          </div>

          {/* Komponen Gaji */}
          <div className="space-y-2 text-sm">
            <SlipRow label="Gaji Pokok" value={payroll.basicSallary} />
            {payroll.accomodation > 0 && <SlipRow label="Tunjangan Akomodasi" value={payroll.accomodation} />}
            {payroll.totalTurnover > 0 && (
              <SlipRow
                label={`Bonus Omzet (${payroll.percentageTurnover}% × ${fmt(payroll.amountTurnover)})`}
                value={payroll.totalTurnover}
              />
            )}
            {payroll.totalInpatient > 0 && (
              <SlipRow
                label={`Bonus Rawat Inap (${payroll.countInpatient} pasien × ${fmt(payroll.amountInpatient)})`}
                value={payroll.totalInpatient}
              />
            )}
            {payroll.totalSurgery > 0 && (
              <SlipRow
                label={`Bonus Operasi (${payroll.percentageSurgery}% × ${fmt(payroll.amountSurgery)})`}
                value={payroll.totalSurgery}
              />
            )}
            {payroll.totalGrooming > 0 && (
              <SlipRow
                label={`Bonus Grooming (${payroll.countGrooming} sesi × ${fmt(payroll.amountGrooming)})`}
                value={payroll.totalGrooming}
              />
            )}
            {payroll.minusTurnover > 0 && (
              <SlipRow label="Pengurang" value={-payroll.minusTurnover} isDeduction />
            )}
          </div>

          {/* Total */}
          <div className="border-t-2 border-indigo-200 pt-3 flex items-center justify-between">
            <span className="font-bold text-gray-700">Total Gaji Bersih</span>
            <span className="font-bold text-indigo-700 text-lg">{fmt(payroll.totalOverall)}</span>
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <Printer className="w-4 h-4" /> Cetak Slip
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

function SlipRow({ label, value, isDeduction }: { label: string; value: number; isDeduction?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={cn('font-medium', isDeduction ? 'text-red-600' : 'text-gray-800')}>
        {isDeduction ? `- ${fmt(Math.abs(value))}` : fmt(value)}
      </span>
    </div>
  )
}

// ─── Form Modal ───────────────────────────────────────────────────────────────

function PayrollForm({
  initial,
  employees,
  onClose,
  onSave,
  saving,
}: {
  initial?: Payroll | null
  employees: Employee[]
  onClose: () => void
  onSave: (data: any) => void
  saving: boolean
}) {
  const auth = useAuthStore((s) => s.user)
  const [form, setForm] = useState(() =>
    initial
      ? {
          userEmployeeId: initial.userEmployeeId,
          branchId: initial.branchId,
          datePayed: format(new Date(initial.datePayed), 'yyyy-MM-dd'),
          periodMonth: initial.periodMonth,
          periodYear: initial.periodYear,
          basicSallary: String(initial.basicSallary),
          accomodation: String(initial.accomodation),
          percentageTurnover: String(initial.percentageTurnover),
          amountTurnover: String(initial.amountTurnover),
          totalTurnover: String(initial.totalTurnover),
          minusTurnover: String(initial.minusTurnover),
          amountInpatient: String(initial.amountInpatient),
          countInpatient: String(initial.countInpatient),
          totalInpatient: String(initial.totalInpatient),
          percentageSurgery: String(initial.percentageSurgery),
          amountSurgery: String(initial.amountSurgery),
          totalSurgery: String(initial.totalSurgery),
          amountGrooming: String(initial.amountGrooming),
          countGrooming: String(initial.countGrooming),
          totalGrooming: String(initial.totalGrooming),
        }
      : { ...defaultForm, branchId: auth?.branchId ?? '' }
  )

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))

  const totalOverall =
    (Number(form.basicSallary) || 0) +
    (Number(form.accomodation) || 0) +
    (Number(form.totalTurnover) || 0) +
    (Number(form.totalInpatient) || 0) +
    (Number(form.totalSurgery) || 0) +
    (Number(form.totalGrooming) || 0) -
    (Number(form.minusTurnover) || 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">
            {initial ? 'Edit Slip Gaji' : 'Buat Slip Gaji'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Karyawan + Periode */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Karyawan *</label>
              <select
                className={inputCls}
                value={form.userEmployeeId}
                onChange={(e) => set('userEmployeeId', e.target.value)}
                required
                disabled={!!initial}
              >
                <option value="">Pilih Karyawan</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullname} ({ROLE_LABEL[e.role] ?? e.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Bulan Periode *</label>
              <select
                className={inputCls}
                value={form.periodMonth}
                onChange={(e) => set('periodMonth', Number(e.target.value))}
                required
                disabled={!!initial}
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tahun Periode *</label>
              <input
                type="number"
                className={inputCls}
                value={form.periodYear}
                onChange={(e) => set('periodYear', Number(e.target.value))}
                min={2020}
                max={2099}
                required
                disabled={!!initial}
              />
            </div>
            <div>
              <label className={labelCls}>Tanggal Pembayaran *</label>
              <input
                type="date"
                className={inputCls}
                value={form.datePayed}
                onChange={(e) => set('datePayed', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Komponen Gaji */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Komponen Gaji</div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Gaji Pokok (Rp) *</label>
                <input type="number" className={inputCls} placeholder="0" min={0}
                  value={form.basicSallary} onChange={(e) => set('basicSallary', e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Tunjangan Akomodasi (Rp)</label>
                <input type="number" className={inputCls} placeholder="0" min={0}
                  value={form.accomodation} onChange={(e) => set('accomodation', e.target.value)} />
              </div>
            </div>

            {/* Bonus Omzet */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-indigo-600">Bonus Omzet Klinik</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>% Bonus</label>
                  <input type="number" className={inputCls} placeholder="0" min={0} max={100} step="0.01"
                    value={form.percentageTurnover} onChange={(e) => set('percentageTurnover', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Total Omzet (Rp)</label>
                  <input type="number" className={inputCls} placeholder="0" min={0}
                    value={form.amountTurnover} onChange={(e) => set('amountTurnover', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Total Bonus (Rp)</label>
                  <input type="number" className={inputCls} placeholder="0" min={0}
                    value={form.totalTurnover} onChange={(e) => set('totalTurnover', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Bonus Rawat Inap */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-indigo-600">Bonus Rawat Inap</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Tarif/Pasien (Rp)</label>
                  <input type="number" className={inputCls} placeholder="0" min={0}
                    value={form.amountInpatient} onChange={(e) => set('amountInpatient', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Jumlah Pasien</label>
                  <input type="number" className={inputCls} placeholder="0" min={0}
                    value={form.countInpatient} onChange={(e) => set('countInpatient', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Total Bonus (Rp)</label>
                  <input type="number" className={inputCls} placeholder="0" min={0}
                    value={form.totalInpatient} onChange={(e) => set('totalInpatient', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Bonus Operasi */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-indigo-600">Bonus Operasi / Bedah</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>% Bonus</label>
                  <input type="number" className={inputCls} placeholder="0" min={0} max={100} step="0.01"
                    value={form.percentageSurgery} onChange={(e) => set('percentageSurgery', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Total Nilai Operasi (Rp)</label>
                  <input type="number" className={inputCls} placeholder="0" min={0}
                    value={form.amountSurgery} onChange={(e) => set('amountSurgery', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Total Bonus (Rp)</label>
                  <input type="number" className={inputCls} placeholder="0" min={0}
                    value={form.totalSurgery} onChange={(e) => set('totalSurgery', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Bonus Grooming */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-indigo-600">Bonus Grooming</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Tarif/Sesi (Rp)</label>
                  <input type="number" className={inputCls} placeholder="0" min={0}
                    value={form.amountGrooming} onChange={(e) => set('amountGrooming', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Jumlah Sesi</label>
                  <input type="number" className={inputCls} placeholder="0" min={0}
                    value={form.countGrooming} onChange={(e) => set('countGrooming', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Total Bonus (Rp)</label>
                  <input type="number" className={inputCls} placeholder="0" min={0}
                    value={form.totalGrooming} onChange={(e) => set('totalGrooming', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Pengurang */}
            <div>
              <label className={labelCls}>Pengurang / Potongan (Rp)</label>
              <input type="number" className={inputCls} placeholder="0" min={0}
                value={form.minusTurnover} onChange={(e) => set('minusTurnover', e.target.value)} />
            </div>
          </div>

          {/* Preview Total */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-indigo-700">Total Gaji Bersih</span>
            <span className="text-xl font-bold text-indigo-700">{fmt(totalOverall)}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? 'Menyimpan...' : initial ? 'Simpan Perubahan' : 'Buat Slip Gaji'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PenggajianPage() {
  const qc = useQueryClient()
  const auth = useAuthStore((s) => s.user)
  const isAdmin = auth?.role === 'admin'

  const now = new Date()
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1)
  const [filterYear, setFilterYear] = useState(now.getFullYear())
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Payroll | null>(null)
  const [slipTarget, setSlipTarget] = useState<Payroll | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // ─── Queries ─────────────────────────────────────────────────────────────────

  const { data: payrollsData } = useQuery({
    queryKey: ['penggajian', filterMonth, filterYear],
    queryFn: () =>
      api.get('/penggajian', { params: { month: filterMonth, year: filterYear } })
        .then((r: any) => r.data.data as Payroll[]),
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['penggajian-karyawan'],
    queryFn: () => api.get('/penggajian/karyawan').then((r: any) => r.data.data as Employee[]),
    enabled: showForm || !!editTarget,
  })

  const { data: rekap = [] } = useQuery({
    queryKey: ['penggajian-rekap', filterYear],
    queryFn: () =>
      api.get('/penggajian/rekap', { params: { year: filterYear } })
        .then((r: any) => r.data.data as { month: number; year: number; totalGaji: number; jumlahKaryawan: number }[]),
  })

  const payrolls = (payrollsData ?? []).filter((p) =>
    p.employee?.fullname?.toLowerCase().includes(search.toLowerCase())
  )

  // ─── Mutations ────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (body: any) =>
      editTarget
        ? api.put(`/penggajian/${editTarget.id}`, body).then((r: any) => r.data)
        : api.post('/penggajian', body).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['penggajian'] })
      qc.invalidateQueries({ queryKey: ['penggajian-rekap'] })
      setShowForm(false)
      setEditTarget(null)
      setError('')
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message ?? 'Gagal menyimpan slip gaji')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/penggajian/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['penggajian'] })
      qc.invalidateQueries({ queryKey: ['penggajian-rekap'] })
      setDeleteId(null)
    },
  })

  // ─── KPI ─────────────────────────────────────────────────────────────────────

  const totalBulanIni = payrolls.reduce((s, p) => s + p.totalOverall, 0)
  const avgGaji = payrolls.length ? totalBulanIni / payrolls.length : 0
  const rekapBulanIni = rekap.find((r) => r.month === filterMonth)

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Banknote className="w-6 h-6 text-indigo-600" /> Penggajian
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manajemen slip gaji karyawan</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditTarget(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Buat Slip Gaji
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={<Users className="w-5 h-5 text-indigo-600" />}
          bg="bg-indigo-50"
          label={`Karyawan — ${MONTHS[filterMonth - 1]} ${filterYear}`}
          value={`${payrolls.length} orang`}
        />
        <KpiCard
          icon={<Wallet className="w-5 h-5 text-emerald-600" />}
          bg="bg-emerald-50"
          label="Total Gaji Bulan Ini"
          value={fmt(totalBulanIni)}
        />
        <KpiCard
          icon={<TrendingUp className="w-5 h-5 text-violet-600" />}
          bg="bg-violet-50"
          label="Rata-rata Gaji"
          value={payrolls.length ? fmt(avgGaji) : '—'}
        />
      </div>

      {/* Rekap Tahunan */}
      {rekap.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            Rekap Tahunan {filterYear}
          </div>
          <div className="grid grid-cols-6 md:grid-cols-12 gap-1">
            {MONTHS.map((m, i) => {
              const item = rekap.find((r) => r.month === i + 1)
              const active = i + 1 === filterMonth
              return (
                <button
                  key={i}
                  onClick={() => setFilterMonth(i + 1)}
                  className={cn(
                    'rounded-lg p-2 text-center transition-all',
                    active ? 'bg-indigo-600 text-white' : item ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-gray-50 text-gray-400'
                  )}
                >
                  <div className="text-xs font-medium">{m.slice(0, 3)}</div>
                  {item && (
                    <div className="text-xs mt-0.5">{item.jumlahKaryawan} org</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
          <button onClick={() => {
            if (filterMonth === 1) { setFilterMonth(12); setFilterYear(y => y - 1) }
            else setFilterMonth(m => m - 1)
          }} className="text-gray-400 hover:text-gray-600">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 w-36 text-center">
            {MONTHS[filterMonth - 1]} {filterYear}
          </span>
          <button onClick={() => {
            if (filterMonth === 12) { setFilterMonth(1); setFilterYear(y => y + 1) }
            else setFilterMonth(m => m + 1)
          }} className="text-gray-400 hover:text-gray-600">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
            placeholder="Cari nama karyawan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabel Slip Gaji */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {payrolls.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Banknote className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <div className="font-medium">Belum ada slip gaji</div>
            <div className="text-sm mt-1">untuk {MONTHS[filterMonth - 1]} {filterYear}</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Karyawan</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Cabang</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Gaji Pokok</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Total Bonus</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Total Gaji</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Tgl Bayar</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payrolls.map((p) => {
                const totalBonus = p.totalTurnover + p.totalInpatient + p.totalSurgery + p.totalGrooming - p.minusTurnover
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{p.employee?.fullname}</div>
                      <div className="text-xs text-gray-500">
                        {ROLE_LABEL[p.employee?.role] ?? p.employee?.role}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {p.branch?.branchName}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">
                      {fmt(p.basicSallary)}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <span className={cn('text-xs font-medium px-2 py-1 rounded-full',
                        totalBonus > 0 ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400'
                      )}>
                        {totalBonus > 0 ? `+ ${fmt(totalBonus)}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700">
                      {fmt(p.totalOverall)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                      {format(new Date(p.datePayed), 'd MMM yyyy', { locale: localeId })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setSlipTarget(p)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Lihat Slip"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => { setEditTarget(p); setShowForm(true) }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteId(p.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-indigo-50/50 border-t border-indigo-100">
              <tr>
                <td colSpan={2} className="px-4 py-3 font-semibold text-gray-700 text-sm">
                  Total {payrolls.length} karyawan
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-700">
                  {fmt(payrolls.reduce((s, p) => s + p.basicSallary, 0))}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell" />
                <td className="px-4 py-3 text-right font-bold text-indigo-700 text-base">
                  {fmt(totalBulanIni)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Modals */}
      {(showForm || editTarget) && (
        <PayrollForm
          initial={editTarget}
          employees={employees}
          onClose={() => { setShowForm(false); setEditTarget(null); setError('') }}
          onSave={(data) => saveMutation.mutate(data)}
          saving={saveMutation.isPending}
        />
      )}

      {slipTarget && (
        <SlipGaji payroll={slipTarget} onClose={() => setSlipTarget(null)} />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-semibold text-gray-800 mb-2">Hapus Slip Gaji?</h3>
            <p className="text-sm text-gray-500 mb-5">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
              >
                {deleteMutation.isPending ? 'Menghapus...' : 'Hapus'}
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg hover:bg-gray-50 text-sm"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon, bg, label, value }: {
  icon: React.ReactNode; bg: string; label: string; value: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', bg)}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-bold text-gray-800 mt-0.5">{value}</div>
      </div>
    </div>
  )
}
