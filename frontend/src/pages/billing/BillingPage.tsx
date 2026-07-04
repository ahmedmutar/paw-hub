import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { loadMidtransSnap } from '@/lib/midtrans'
import { CreditCard, TrendingUp, Users, Building2, PawPrint, Zap, Check, AlertTriangle, X, Loader2 } from 'lucide-react'

interface Plan {
  id: string; code: string; name: string
  priceMonthly: number; priceYearly: number
  maxBranches: number; maxUsers: number; maxPatients: number
  features: Record<string, boolean>
}
interface Subscription {
  id: string; status: string; cycle: string
  startedAt: string; expiresAt?: string
  daysLeft?: number
  plan: Plan
}
interface Usage {
  branches: { used: number; limit: number; pct: number }
  users:    { used: number; limit: number; pct: number }
  patients: { used: number; limit: number; pct: number }
}

const FEATURE_LABELS: Record<string, string> = {
  whatsapp: 'Notifikasi WhatsApp', booking: 'Booking Online', grooming: 'Modul Grooming',
  reminder: 'Reminder Otomatis', portal: 'Owner Portal', priority_support: 'Priority Support',
}
const STATUS_COLOR: Record<string, string> = {
  trial: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-500',
}
const STATUS_LABEL: Record<string, string> = {
  trial: 'Trial', active: 'Aktif', expired: 'Kedaluwarsa', cancelled: 'Dibatalkan',
}

function UsageBar({ label, icon: Icon, color, used, limit, pct }: any) {
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-400' : color
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${color} bg-opacity-10`}><Icon className={`w-4 h-4 ${color.replace('bg-','text-')}`} /></div>
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        <span className="text-sm font-bold text-gray-800">{used}<span className="text-gray-400 font-normal"> / {limit === 999999 || limit === 999 ? '∞' : limit}</span></span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {pct >= 90 && <p className="text-xs text-red-500 mt-1">⚠ Hampir mencapai batas. Pertimbangkan upgrade.</p>}
    </div>
  )
}

function UpgradeModal({ open, onClose, currentPlanCode, plans, qc }: any) {
  const [selected, setSelected] = useState(currentPlanCode)
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [payStatus, setPayStatus] = useState<'idle' | 'waiting' | 'success' | 'error'>('idle')
  const [payMessage, setPayMessage] = useState('')

  function refreshBillingData() {
    qc.invalidateQueries({ queryKey: ['billing-subscription'] })
    qc.invalidateQueries({ queryKey: ['billing-usage'] })
  }

  // Poll status invoice beberapa kali — webhook Midtrans biasanya masuk dalam
  // beberapa detik, jadi kita cek ulang supaya UI tidak menunggu selamanya.
  async function pollInvoice(orderId: string, attemptsLeft = 6) {
    if (attemptsLeft <= 0) {
      setPayStatus('waiting')
      setPayMessage('Pembayaran masih diproses. Status akan terupdate otomatis begitu konfirmasi masuk.')
      return
    }
    try {
      const res = await api.get(`/billing/invoice/${orderId}`)
      const invoice = res.data.data
      if (invoice.status === 'paid') {
        refreshBillingData()
        setPayStatus('success')
        setPayMessage('Pembayaran berhasil! Paket Anda sudah aktif.')
        return
      }
      if (invoice.status === 'failed' || invoice.status === 'expired') {
        setPayStatus('error')
        setPayMessage('Pembayaran tidak berhasil. Silakan coba lagi.')
        return
      }
    } catch {
      // abaikan, coba lagi di attempt berikutnya
    }
    setTimeout(() => pollInvoice(orderId, attemptsLeft - 1), 2500)
  }

  const checkoutMut = useMutation({
    mutationFn: (data: any) => api.post('/billing/checkout', data).then((r: any) => r.data),
    onSuccess: async (res: any) => {
      if (res.data.free) {
        refreshBillingData()
        setPayStatus('success')
        setPayMessage(res.message ?? 'Berhasil pindah paket.')
        return
      }

      const { token, orderId } = res.data
      try {
        await loadMidtransSnap()
      } catch {
        setPayStatus('error')
        setPayMessage('Gagal memuat halaman pembayaran. Cek koneksi internet Anda.')
        return
      }

      setPayStatus('waiting')
      setPayMessage('Menunggu pembayaran...')

      window.snap?.pay(token, {
        onSuccess: () => pollInvoice(orderId),
        onPending: () => pollInvoice(orderId),
        onError: () => {
          setPayStatus('error')
          setPayMessage('Pembayaran gagal. Silakan coba lagi.')
        },
        onClose: () => {
          setPayStatus('idle')
        },
      })
    },
  })

  if (!open) return null
  const planColors: Record<string, string> = { free: 'border-gray-300', starter: 'border-teal-400', pro: 'border-violet-400', enterprise: 'border-amber-400' }

  function handleClose() {
    setPayStatus('idle')
    setPayMessage('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
          <h2 className="font-semibold text-gray-800">Upgrade / Ganti Paket</h2>
          <button onClick={handleClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Cycle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm ${cycle === 'monthly' ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>Bulanan</span>
            <button onClick={() => setCycle(c => c === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative w-12 h-6 rounded-full transition-colors ${cycle === 'yearly' ? 'bg-teal-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${cycle === 'yearly' ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-sm ${cycle === 'yearly' ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>Tahunan <span className="text-green-600">(hemat 17%)</span></span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {plans.map((plan: Plan) => {
              const price = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly
              const isCurrent = plan.code === currentPlanCode
              const isSelected = plan.code === selected
              return (
                <button key={plan.id} onClick={() => setSelected(plan.code)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${isSelected ? `${planColors[plan.code]} bg-white shadow` : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">{plan.name}</span>
                    {isCurrent && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Saat ini</span>}
                    {isSelected && !isCurrent && <Check className="w-4 h-4 text-teal-500" />}
                  </div>
                  <p className="text-lg font-bold mt-1">{price === 0 ? 'Gratis' : `Rp ${price.toLocaleString('id-ID')}`}</p>
                  <p className="text-xs text-gray-400">/{cycle === 'yearly' ? 'tahun' : 'bulan'}</p>
                </button>
              )
            })}
          </div>
        </div>
        {payMessage && (
          <p className={`text-sm text-center px-5 pb-2 ${
            payStatus === 'success' ? 'text-green-600' : payStatus === 'error' ? 'text-red-500' : 'text-amber-600'
          }`}>
            {payMessage}
          </p>
        )}
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={handleClose} className="px-4 py-2 border rounded-lg text-sm">
            {payStatus === 'success' ? 'Tutup' : 'Batal'}
          </button>
          {payStatus !== 'success' && (
            <button onClick={() => { setPayStatus('idle'); setPayMessage(''); checkoutMut.mutate({ planCode: selected, cycle }) }}
              disabled={checkoutMut.isPending || payStatus === 'waiting' || selected === currentPlanCode}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm rounded-lg">
              {checkoutMut.isPending || payStatus === 'waiting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {checkoutMut.isPending ? 'Memproses...' : payStatus === 'waiting' ? 'Menunggu...' : 'Lanjut Bayar'}
            </button>
          )}
        </div>
        {checkoutMut.isError && (
          <p className="text-sm text-red-500 text-center pb-4">{(checkoutMut.error as any)?.response?.data?.message ?? 'Gagal memproses upgrade'}</p>
        )}
      </div>
    </div>
  )
}

export default function BillingPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showUpgrade, setShowUpgrade] = useState(false)

  const { data: sub, isLoading: subLoading } = useQuery<Subscription>({
    queryKey: ['billing-subscription'],
    queryFn: () => api.get('/billing/subscription').then((r: any) => r.data.data),
  })
  const { data: usage, isLoading: usageLoading } = useQuery<Usage>({
    queryKey: ['billing-usage'],
    queryFn: () => api.get('/billing/usage').then((r: any) => r.data.data),
  })
  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['billing-plans'],
    queryFn: () => api.get('/billing/plans').then((r: any) => r.data.data),
  })

  const cancelMut = useMutation({
    mutationFn: () => api.post('/billing/cancel').then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-subscription'] }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Billing & Langganan</h1>
        <p className="text-sm text-gray-500 mt-0.5">Kelola paket dan pemakaian klinik Anda</p>
      </div>

      {/* Subscription card */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        {subLoading ? (
          <div className="flex items-center gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /> Memuat data langganan...</div>
        ) : sub ? (
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-bold text-gray-800">Paket {sub.plan.name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[sub.status]}`}>{STATUS_LABEL[sub.status]}</span>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p>Siklus: <span className="font-medium">{sub.cycle === 'monthly' ? 'Bulanan' : 'Tahunan'}</span></p>
                {sub.expiresAt && <p>Berlaku hingga: <span className="font-medium">{new Date(sub.expiresAt).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</span></p>}
                {sub.daysLeft !== null && sub.daysLeft !== undefined && (
                  <p className={`font-medium ${sub.daysLeft <= 7 ? 'text-red-500' : sub.daysLeft <= 30 ? 'text-amber-500' : 'text-green-600'}`}>
                    {sub.daysLeft <= 0 ? 'Sudah kedaluwarsa' : `${sub.daysLeft} hari tersisa`}
                  </p>
                )}
              </div>
              {sub.status === 'trial' && (
                <div className="mt-3 flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Anda sedang dalam masa trial. Upgrade sebelum trial berakhir agar layanan tidak terganggu.
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => setShowUpgrade(true)}
                className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Zap className="w-4 h-4" /> Upgrade Paket
              </button>
              {sub.status !== 'cancelled' && (
                <button onClick={() => { if (confirm('Batalkan langganan?')) cancelMut.mutate() }}
                  disabled={cancelMut.isPending}
                  className="text-sm text-red-400 hover:text-red-600 text-center">
                  Batalkan Langganan
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-4">
            <p>Belum ada data langganan.</p>
            <button onClick={() => setShowUpgrade(true)} className="mt-2 text-sm text-teal-600 hover:underline">Pilih paket sekarang</button>
          </div>
        )}
      </div>

      {/* Usage */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Pemakaian</h2>
        {usageLoading ? (
          <div className="text-gray-400 text-sm">Memuat data pemakaian...</div>
        ) : usage ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UsageBar label="Cabang"  icon={Building2} color="bg-blue-500"  {...usage.branches} />
            <UsageBar label="Pengguna" icon={Users}    color="bg-violet-500" {...usage.users} />
            <UsageBar label="Pasien"  icon={PawPrint}  color="bg-teal-500"  {...usage.patients} />
          </div>
        ) : null}
      </div>

      {/* Plan comparison */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Semua Paket</h2>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fitur</th>
                {plans.map((p: Plan) => (
                  <th key={p.id} className="px-4 py-3 font-medium text-gray-600">
                    <div>{p.name}</div>
                    <div className="text-xs font-normal text-gray-400">
                      {p.priceMonthly === 0 ? 'Gratis' : `Rp ${p.priceMonthly.toLocaleString('id-ID')}/bln`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['Cabang', 'Pengguna', 'Pasien', ...Object.keys(FEATURE_LABELS)].map((feat, idx) => (
                <tr key={feat} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2.5 text-gray-700">{FEATURE_LABELS[feat] ?? feat}</td>
                  {plans.map((p: Plan) => {
                    let val: React.ReactNode
                    if (feat === 'Cabang')   val = p.maxBranches === 999    ? '∞' : p.maxBranches
                    else if (feat === 'Pengguna') val = p.maxUsers === 999  ? '∞' : p.maxUsers
                    else if (feat === 'Pasien')   val = p.maxPatients === 999999 ? '∞' : p.maxPatients
                    else val = p.features[feat] ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-300 text-xs mx-auto block text-center">—</span>
                    return (
                      <td key={p.id} className={`px-4 py-2.5 text-center font-medium ${sub?.plan?.code === p.code ? 'bg-teal-50' : ''}`}>
                        {val}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)}
        currentPlanCode={sub?.plan?.code ?? 'free'} plans={plans} qc={qc} />
    </div>
  )
}
