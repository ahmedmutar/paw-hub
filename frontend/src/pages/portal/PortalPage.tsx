import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  PawPrint, LogOut, Syringe, Bug, ChevronRight, ChevronDown,
  FileText, CreditCard, Calendar, Phone, MapPin, Clock,
  CheckCircle, AlertTriangle, Printer,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Owner {
  id: string
  ownerName: string
  phoneNumber?: string
  address?: string
  branch?: { branchName: string; address?: string; phoneNumber?: string } | null
}

interface Pet {
  id: string
  petName: string
  petCategory: string
  petGender?: string
  petYearAge?: number
  petMonthAge?: number
  idMember: string
  visitCount: number
  nextVaccination?: { vaccineName: string; nextDueAt: string } | null
  nextDeworming?:   { medicationName: string; nextDueAt: string } | null
}

interface Visit {
  id: string
  idNumber: string
  visitDate: string
  complaint: string
  visitType: string
  doctor: string
  branch: string
  diagnosa?: string
  notes?: string
  hasPaid: boolean
  paymentId?: string
}

interface Payment {
  paymentId: string
  invoiceNumber: string
  visitDate: string
  registrationNo: string
  branch: string
  paymentMethod: string
  discount: number
  total: number
  items: { name: string; qty: number; price: number }[]
}

// ── Portal Auth Store (localStorage) ─────────────────────────────────────────

function getToken() { return localStorage.getItem('portal_token') }
function setToken(t: string) { localStorage.setItem('portal_token', t) }
function clearToken() { localStorage.removeItem('portal_token') }

function portalApi(path: string) {
  const token = getToken()
  return api.get(path, { headers: { Authorization: `Bearer ${token}` } })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d?: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysDiff(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function petAge(yearAge?: number, monthAge?: number) {
  if (!yearAge && !monthAge) return '-'
  const parts = []
  if (yearAge)  parts.push(`${yearAge} thn`)
  if (monthAge) parts.push(`${monthAge} bln`)
  return parts.join(' ')
}

// ── OTP Login ─────────────────────────────────────────────────────────────────

function OTPLogin({ onSuccess }: { onSuccess: (token: string, owner: Owner) => void }) {
  const [step, setStep]     = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone]   = useState('')
  const [otp, setOtp]       = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]       = useState('')
  const [error, setError]   = useState('')

  async function requestOTP() {
    if (!phone.trim()) return setError('Masukkan nomor WhatsApp Anda')
    setLoading(true); setError('')
    try {
      const r = await api.post('/portal/request-otp', { phone: phone.trim() }) as any
      setMsg(r.data.message)
      setStep('otp')
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Terjadi kesalahan')
    } finally { setLoading(false) }
  }

  async function verifyOTP() {
    if (otp.length !== 6) return setError('OTP harus 6 digit')
    setLoading(true); setError('')
    try {
      const r = await api.post('/portal/verify-otp', { phone: phone.trim(), otp }) as any
      onSuccess(r.data.token, r.data.owner)
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'OTP tidak valid')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-3">
            <PawPrint className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Portal Pemilik</h1>
          <p className="text-gray-500 text-sm mt-1">Akses riwayat medis hewan Anda</p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WhatsApp</label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                type="tel"
                placeholder="628xxxxxxxxxx"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && requestOTP()}
              />
              <p className="text-xs text-gray-400 mt-1">Gunakan nomor yang terdaftar di klinik (format: 628...)</p>
            </div>
            {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button onClick={requestOTP} disabled={loading}
              className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold disabled:opacity-60 hover:bg-primary-700 transition-colors">
              {loading ? 'Mengirim OTP...' : 'Kirim Kode OTP via WhatsApp'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {msg && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
                {msg}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kode OTP</label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-2xl font-bold text-center tracking-widest"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && verifyOTP()}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1 text-center">Berlaku 5 menit. Cek WhatsApp: {phone}</p>
            </div>
            {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button onClick={verifyOTP} disabled={loading}
              className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold disabled:opacity-60 hover:bg-primary-700 transition-colors">
              {loading ? 'Memverifikasi...' : 'Masuk'}
            </button>
            <button onClick={() => { setStep('phone'); setOtp(''); setError('') }}
              className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">
              ← Ganti nomor
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pet Card ──────────────────────────────────────────────────────────────────

function PetCard({ pet, onClick, selected }: { pet: Pet; onClick: () => void; selected: boolean }) {
  const hasUrgentVac = pet.nextVaccination && daysDiff(pet.nextVaccination.nextDueAt) <= 7
  const hasUrgentDew = pet.nextDeworming   && daysDiff(pet.nextDeworming.nextDueAt)   <= 7

  return (
    <button onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-2xl border-2 transition-all',
        selected ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-white hover:border-gray-200',
      )}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-xl shrink-0">
          {{ 'Kucing': '🐱', 'Anjing': '🐶', 'Kelinci': '🐰', 'Burung': '🐦' }[pet.petCategory] ?? '🐾'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 truncate">{pet.petName}</p>
            {(hasUrgentVac || hasUrgentDew) && (
              <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-gray-500">{pet.petCategory} · {pet.petGender ?? '-'} · {petAge(pet.petYearAge, pet.petMonthAge)}</p>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{pet.idMember}</p>
        </div>
        <ChevronRight className={cn('w-4 h-4 text-gray-400 shrink-0 mt-1 transition-transform', selected && 'rotate-90')} />
      </div>

      {/* Jadwal terdekat */}
      {(pet.nextVaccination || pet.nextDeworming) && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          {pet.nextVaccination && (
            <div className={cn('flex items-center gap-2 text-xs rounded-lg px-2 py-1',
              hasUrgentVac ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600')}>
              <Syringe className="w-3 h-3 shrink-0" />
              <span className="truncate">{pet.nextVaccination.vaccineName}</span>
              <span className="ml-auto shrink-0">{fmtDate(pet.nextVaccination.nextDueAt)}</span>
            </div>
          )}
          {pet.nextDeworming && (
            <div className={cn('flex items-center gap-2 text-xs rounded-lg px-2 py-1',
              hasUrgentDew ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600')}>
              <Bug className="w-3 h-3 shrink-0" />
              <span className="truncate">{pet.nextDeworming.medicationName}</span>
              <span className="ml-auto shrink-0">{fmtDate(pet.nextDeworming.nextDueAt)}</span>
            </div>
          )}
        </div>
      )}
    </button>
  )
}

// ── Pet Detail ────────────────────────────────────────────────────────────────

function PetDetail({ pet, token }: { pet: Pet; token: string }) {
  const [activeTab, setActiveTab] = useState<'schedule' | 'history' | 'payments'>('schedule')
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null)
  const [printPayment, setPrintPayment]   = useState<Payment | null>(null)

  const scheduleQ = useQuery({
    queryKey: ['portal-schedule', pet.id],
    queryFn: () => portalApi(`/portal/my-pets/${pet.id}/schedule`).then((r: any) => r.data.data),
  })

  const historyQ = useQuery({
    queryKey: ['portal-history', pet.id],
    queryFn: () => portalApi(`/portal/my-pets/${pet.id}/history`).then((r: any) => r.data.data),
    enabled: activeTab === 'history',
  })

  const paymentsQ = useQuery<Payment[]>({
    queryKey: ['portal-payments', pet.id],
    queryFn: () => portalApi(`/portal/my-pets/${pet.id}/payments`).then((r: any) => r.data.data),
    enabled: activeTab === 'payments',
  })

  const schedule = scheduleQ.data
  const history  = historyQ.data ?? []
  const payments = paymentsQ.data ?? []

  const today = new Date()

  return (
    <div className="space-y-4">
      {/* Pet header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-2xl">
            {{ 'Kucing': '🐱', 'Anjing': '🐶', 'Kelinci': '🐰', 'Burung': '🐦' }[pet.petCategory] ?? '🐾'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{pet.petName}</h2>
            <p className="text-sm text-gray-500">{pet.petCategory} · {pet.petGender ?? '-'} · {petAge(pet.petYearAge, pet.petMonthAge)}</p>
            <p className="text-xs text-gray-400 font-mono">{pet.idMember} · {pet.visitCount} kunjungan</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { key: 'schedule', label: 'Jadwal', icon: Calendar },
            { key: 'history',  label: 'Riwayat', icon: FileText },
            { key: 'payments', label: 'Pembayaran', icon: CreditCard },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-colors',
                activeTab === t.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* ── JADWAL ── */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              {/* Vaksinasi */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Syringe className="w-3.5 h-3.5" /> Vaksinasi
                </h4>
                {scheduleQ.isLoading ? (
                  <p className="text-sm text-gray-400">Memuat...</p>
                ) : schedule?.vaccinations?.length === 0 ? (
                  <p className="text-sm text-gray-400">Belum ada riwayat vaksinasi</p>
                ) : (
                  <div className="space-y-2">
                    {schedule?.vaccinations?.map((v: any) => {
                      const isDue = v.nextDueAt && new Date(v.nextDueAt) >= today
                      const days  = v.nextDueAt ? daysDiff(v.nextDueAt) : null
                      return (
                        <div key={v.id} className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm',
                          days !== null && days <= 7 ? 'bg-red-50 border border-red-200' :
                          isDue ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50',
                        )}>
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">{v.vaccineName}</p>
                            <p className="text-xs text-gray-500">Diberikan: {fmtDate(v.administeredAt)}</p>
                          </div>
                          {v.nextDueAt && (
                            <div className="text-right">
                              <p className={cn('text-xs font-bold', days !== null && days <= 7 ? 'text-red-600' : 'text-blue-600')}>
                                {fmtDate(v.nextDueAt)}
                              </p>
                              {days !== null && (
                                <p className="text-[10px] text-gray-400">
                                  {days < 0 ? `${Math.abs(days)} hari lalu` : days === 0 ? 'Hari ini!' : `${days} hari lagi`}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Obat Cacing */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Bug className="w-3.5 h-3.5" /> Obat Cacing
                </h4>
                {scheduleQ.isLoading ? (
                  <p className="text-sm text-gray-400">Memuat...</p>
                ) : schedule?.dewormings?.length === 0 ? (
                  <p className="text-sm text-gray-400">Belum ada riwayat obat cacing</p>
                ) : (
                  <div className="space-y-2">
                    {schedule?.dewormings?.map((d: any) => {
                      const isDue = d.nextDueAt && new Date(d.nextDueAt) >= today
                      const days  = d.nextDueAt ? daysDiff(d.nextDueAt) : null
                      return (
                        <div key={d.id} className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm',
                          days !== null && days <= 7 ? 'bg-red-50 border border-red-200' :
                          isDue ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50',
                        )}>
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">{d.medicationName}</p>
                            <p className="text-xs text-gray-500">Diberikan: {fmtDate(d.administeredAt)}</p>
                          </div>
                          {d.nextDueAt && (
                            <div className="text-right">
                              <p className={cn('text-xs font-bold', days !== null && days <= 7 ? 'text-red-600' : 'text-purple-600')}>
                                {fmtDate(d.nextDueAt)}
                              </p>
                              {days !== null && (
                                <p className="text-[10px] text-gray-400">
                                  {days < 0 ? `${Math.abs(days)} hari lalu` : days === 0 ? 'Hari ini!' : `${days} hari lagi`}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── RIWAYAT ── */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {historyQ.isLoading ? (
                <p className="text-sm text-gray-400 text-center py-4">Memuat...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Belum ada riwayat kunjungan</p>
              ) : history.map((v: Visit) => (
                <div key={v.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedVisit(expandedVisit === v.id ? null : v.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-gray-800">{fmtDate(v.visitDate)}</p>
                        {v.hasPaid && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{v.complaint}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">{v.doctor}</p>
                      <ChevronDown className={cn('w-4 h-4 text-gray-400 ml-auto transition-transform', expandedVisit === v.id && 'rotate-180')} />
                    </div>
                  </button>
                  {expandedVisit === v.id && (
                    <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-2 bg-gray-50">
                      {[
                        { label: 'No. Registrasi', value: v.idNumber },
                        { label: 'Jenis Kunjungan', value: v.visitType },
                        { label: 'Dokter', value: v.doctor },
                        { label: 'Klinik', value: v.branch },
                        { label: 'Diagnosa', value: v.diagnosa },
                        { label: 'Catatan', value: v.notes },
                      ].filter(r => r.value).map(r => (
                        <div key={r.label} className="flex gap-3 text-sm">
                          <span className="text-gray-400 w-32 shrink-0 text-xs">{r.label}</span>
                          <span className="text-gray-700 text-xs">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── PEMBAYARAN ── */}
          {activeTab === 'payments' && (
            <div className="space-y-2">
              {paymentsQ.isLoading ? (
                <p className="text-sm text-gray-400 text-center py-4">Memuat...</p>
              ) : payments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Belum ada riwayat pembayaran</p>
              ) : payments.map((p: Payment) => (
                <div key={p.paymentId} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-gray-400">{p.invoiceNumber}</p>
                      <p className="font-semibold text-gray-800">{p.registrationNo}</p>
                      <p className="text-xs text-gray-500">{fmtDate(p.visitDate)} · {p.branch}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">Rp {p.total.toLocaleString('id-ID')}</p>
                      <p className="text-xs text-gray-400">{p.paymentMethod}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                    {p.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-gray-500">
                        <span>{item.name} {item.qty > 1 ? `×${item.qty}` : ''}</span>
                        <span>Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                    {p.discount > 0 && (
                      <div className="flex justify-between text-xs text-green-600">
                        <span>Diskon</span>
                        <span>-Rp {p.discount.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setPrintPayment(p)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium py-1.5 rounded-lg hover:bg-primary-50 transition-colors">
                    <Printer className="w-3.5 h-3.5" /> Cetak Struk
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Print Modal */}
      {printPayment && (
        <PrintModal payment={printPayment} petName={pet.petName} onClose={() => setPrintPayment(null)} />
      )}
    </div>
  )
}

// ── Print Modal ───────────────────────────────────────────────────────────────

function PrintModal({ payment: p, petName, onClose }: { payment: Payment; petName: string; onClose: () => void }) {
  function handlePrint() { window.print() }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between print:hidden">
          <h3 className="font-semibold text-gray-800">Struk Pembayaran</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm" id="print-receipt">
          <div className="text-center">
            <p className="font-bold text-lg">VetCore Clinic</p>
            <p className="text-gray-500 text-xs">{p.branch}</p>
          </div>
          <div className="border-t border-dashed border-gray-300 pt-3 space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>No. Invoice</span><span className="font-mono">{p.invoiceNumber}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Pasien</span><span>{petName}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Tanggal</span><span>{fmtDate(p.visitDate)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Metode</span><span>{p.paymentMethod}</span>
            </div>
          </div>
          <div className="border-t border-dashed border-gray-300 pt-3 space-y-1.5">
            {p.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="text-gray-600">{item.name} {item.qty > 1 ? `×${item.qty}` : ''}</span>
                <span>Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
          {p.discount > 0 && (
            <div className="flex justify-between text-xs text-green-600">
              <span>Diskon</span><span>-Rp {p.discount.toLocaleString('id-ID')}</span>
            </div>
          )}
          <div className="border-t-2 border-gray-800 pt-2 flex justify-between font-bold">
            <span>TOTAL</span><span>Rp {p.total.toLocaleString('id-ID')}</span>
          </div>
          <p className="text-center text-xs text-gray-400 pt-2">Terima kasih telah mempercayakan<br/>kesehatan hewan Anda kepada kami 🐾</p>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex gap-2 print:hidden">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200">Tutup</button>
          <button onClick={handlePrint} className="flex-1 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 flex items-center justify-center gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Cetak
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Portal Page ──────────────────────────────────────────────────────────

export default function PortalPage() {
  const [token, setTokenState]   = useState<string | null>(getToken)
  const [owner, setOwner]        = useState<Owner | null>(null)
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null)

  // Load owner info if token exists
  const ownerQ = useQuery({
    queryKey: ['portal-me'],
    queryFn: () => portalApi('/portal/me').then((r: any) => r.data.data),
    enabled: !!token,
    retry: false,
  })

  const petsQ = useQuery<Pet[]>({
    queryKey: ['portal-pets'],
    queryFn: () => portalApi('/portal/my-pets').then((r: any) => r.data.data),
    enabled: !!token,
    retry: false,
  })

  useEffect(() => {
    if (ownerQ.data) setOwner(ownerQ.data)
    if (ownerQ.isError) { clearToken(); setTokenState(null) }
  }, [ownerQ.data, ownerQ.isError])

  function handleLogin(newToken: string, newOwner: Owner) {
    setToken(newToken)
    setTokenState(newToken)
    setOwner(newOwner)
  }

  function handleLogout() {
    clearToken()
    setTokenState(null)
    setOwner(null)
    setSelectedPet(null)
  }

  if (!token) return <OTPLogin onSuccess={handleLogin} />

  const pets = petsQ.data ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center">
              <PawPrint className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm text-gray-900 leading-tight">Portal Pemilik</p>
              {owner && <p className="text-xs text-gray-400 leading-tight">{owner.ownerName}</p>}
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50">
            <LogOut className="w-3.5 h-3.5" /> Keluar
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Owner info */}
        {owner?.branch && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-800">{owner.branch.branchName}</p>
                {owner.branch.address    && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{owner.branch.address}</p>}
                {owner.branch.phoneNumber && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{owner.branch.phoneNumber}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Pets */}
        {petsQ.isLoading ? (
          <div className="text-center py-8 text-gray-400">Memuat data hewan...</div>
        ) : pets.length === 0 ? (
          <div className="text-center py-12">
            <PawPrint className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">Belum ada hewan yang terdaftar</p>
            <p className="text-xs text-gray-400 mt-1">Hubungi klinik untuk mendaftarkan hewan Anda</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {pets.map(pet => (
                <PetCard key={pet.id} pet={pet}
                  selected={selectedPet?.id === pet.id}
                  onClick={() => setSelectedPet(p => p?.id === pet.id ? null : pet)}
                />
              ))}
            </div>

            {selectedPet && (
              <PetDetail key={selectedPet.id} pet={selectedPet} token={token} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
