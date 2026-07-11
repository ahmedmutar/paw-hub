import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Receipt } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Badge } from '@/components/ui'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  today: {
    registrations: number
    activeQueue: number
    checkups: number
    pendingKasir: number
    revenue: number
    transactions: number
  }
  month: { revenue: number; transactions: number }
  lowStock: { id: string; itemName: string; totalItem: string; limitItem: string }[]
  recentTransactions: {
    id: string; createdAt: string; patientName: string; methodName: string; total: number
  }[]
  trend: { date: string; count: number }[]
  topServices: {
    priceServiceId: string; serviceName: string; count: number; total: number
  }[]
}

const fmt = (n: number) =>
  n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

// ─── Banner Trial ─────────────────────────────────────────────────────────────

function TrialBanner() {
  const navigate = useNavigate()
  const tenant = useAuthStore((s) => s.user?.tenant)

  if (!tenant || tenant.status !== 'trial' || !tenant.trialEndsAt) return null

  const daysLeft = Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86_400_000)
  if (daysLeft < 0) return null

  const urgent = daysLeft <= 3
  const label =
    daysLeft <= 0
      ? 'Masa trial berakhir hari ini'
      : `Masa trial tersisa ${daysLeft} hari lagi`

  return (
    <div
      className="flex items-center justify-between gap-3 p-4 rounded-2xl"
      style={{
        background: urgent ? 'var(--red-lt)' : 'var(--yellow-lt)',
        border: `1.5px solid ${urgent ? 'var(--red)' : 'var(--yellow)'}`,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xl">{urgent ? '⏰' : '🎁'}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: urgent ? 'var(--red)' : '#C98A00' }}>
            {label}
          </p>
          <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-soft)' }}>
            Upgrade sekarang biar akun tetap aktif tanpa jeda.
          </p>
        </div>
      </div>
      <button
        onClick={() => navigate('/billing')}
        className="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap"
        style={{ background: urgent ? 'var(--red)' : 'var(--orange)', color: '#fff' }}
      >
        Upgrade Paket
      </button>
    </div>
  )
}

// ─── Banner Batas Paket ───────────────────────────────────────────────────────

interface BillingUsage {
  branches: { used: number; limit: number; pct: number }
  users:    { used: number; limit: number; pct: number }
  patients: { used: number; limit: number; pct: number }
}

function UsageLimitBanner() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data } = useQuery<{ data: BillingUsage }>({
    queryKey: ['billing-usage'],
    queryFn: () => api.get('/billing/usage').then(r => r.data),
    enabled: user?.role === 'admin',
    staleTime: 5 * 60_000,
  })

  const usage = data?.data
  if (!usage) return null

  const nearing = (
    [
      { key: 'branches', label: 'cabang', ...usage.branches },
      { key: 'users',    label: 'user',   ...usage.users },
      { key: 'patients', label: 'pasien', ...usage.patients },
    ] as const
  )
    .filter((r) => r.pct >= 80)
    .sort((a, b) => b.pct - a.pct)[0]

  if (!nearing) return null

  const atLimit = nearing.pct >= 100

  return (
    <div
      className="flex items-center justify-between gap-3 p-4 rounded-2xl"
      style={{
        background: atLimit ? 'var(--red-lt)' : 'var(--yellow-lt)',
        border: `1.5px solid ${atLimit ? 'var(--red)' : 'var(--yellow)'}`,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xl">{atLimit ? '🚫' : '⚠️'}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: atLimit ? 'var(--red)' : '#C98A00' }}>
            {atLimit
              ? `Batas ${nearing.label} paket Anda sudah penuh (${nearing.used}/${nearing.limit})`
              : `Pemakaian ${nearing.label} sudah ${nearing.pct}% dari batas paket (${nearing.used}/${nearing.limit})`}
          </p>
          <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-soft)' }}>
            Upgrade paket supaya tidak terganggu saat klinik terus berkembang.
          </p>
        </div>
      </div>
      <button
        onClick={() => navigate('/billing')}
        className="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap"
        style={{ background: atLimit ? 'var(--red)' : 'var(--orange)', color: '#fff' }}
      >
        Upgrade Paket
      </button>
    </div>
  )
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────

function TrendChart({ data }: { data: DashboardStats['trend'] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d, i) => {
        const pct = Math.max(Math.round((d.count / max) * 100), d.count > 0 ? 8 : 4)
        const isToday = i === data.length - 1
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            {d.count > 0 && (
              <span className="text-[10px] font-bold" style={{ color: 'var(--text-soft)' }}>{d.count}</span>
            )}
            <div
              className="w-full rounded-t-lg transition-all"
              style={{ height: `${pct}%`, background: isToday ? 'var(--orange)' : 'var(--orange-lt)' }}
            />
            <span className="text-[9px] font-bold" style={{ color: 'var(--text-soft)' }}>
              {format(new Date(d.date + 'T12:00:00'), 'EEE', { locale: localeId })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StatSkeleton({ className }: { className?: string }) {
  return (
    <div className={`stat-card p-4 animate-pulse ${className ?? ''}`}>
      <div className="w-11 h-11 rounded-2xl mb-3" style={{ background: 'var(--warm-bg)' }} />
      <div className="h-6 rounded-lg w-16 mb-1.5" style={{ background: 'var(--warm-bg)' }} />
      <div className="h-2.5 rounded w-24" style={{ background: 'var(--warm-bg)' }} />
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery<{ data: DashboardStats }>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 60_000,
  })

  const s = data?.data
  const hour = new Date().getHours()
  const greeting =
    hour < 11 ? 'Pagi' : hour < 15 ? 'Siang' : hour < 18 ? 'Sore' : 'Malam'

  // Satu kalimat ringkasan hari ini yang berubah sesuai kondisi — bukan cuma sapaan generik
  const todayNote = (() => {
    if (isLoading || !s) return null
    if (s.today.pendingKasir > 0) return { text: `Ada ${s.today.pendingKasir} pasien yang belum bayar, cek dulu yuk.`, tone: 'warn' as const }
    if (s.lowStock.length > 0) return { text: `${s.lowStock.length} item stok mulai menipis. Sempatkan cek gudang.`, tone: 'warn' as const }
    if (s.today.registrations === 0) return { text: 'Belum ada pasien terdaftar hari ini. Tenang, masih pagi.', tone: 'calm' as const }
    if (s.today.activeQueue > 0) return { text: `${s.today.activeQueue} pasien lagi nunggu diperiksa sekarang.`, tone: 'info' as const }
    return { text: 'Semua antrian hari ini sudah kelar. Kerja bagus! 🎉', tone: 'good' as const }
  })()

  const smallStats = [
    { label: 'Pemeriksaan',        value: s?.today.checkups,      icon: '🔬', bg: 'var(--purple-lt)', fg: 'var(--purple)', path: '/pendaftaran' },
    { label: 'Menunggu Bayar',     value: s?.today.pendingKasir,  icon: '⏳', bg: 'var(--yellow-lt)', fg: '#C98A00',       path: '/pembayaran'  },
    { label: 'Transaksi',          value: s?.today.transactions,  icon: '🧾', bg: 'var(--pink-lt)',   fg: 'var(--pink)',   path: '/pembayaran'  },
  ]

  return (
    <div className="space-y-6">
      <TrialBanner />
      <UsageLimitBanner />

      {/* Greeting */}
      <div>
        <h2 className="font-display font-black text-xl" style={{ color: 'var(--text-dark)' }}>
          Selamat {greeting.toLowerCase()}, {user?.fullname?.split(' ')[0]} 👋
        </h2>
        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-soft)' }}>
          {format(new Date(), 'EEEE, d MMMM yyyy', { locale: localeId })} · {user?.branchName}
        </p>
        {todayNote && (
          <button
            onClick={() => todayNote.tone === 'warn' && navigate(s!.today.pendingKasir > 0 ? '/pembayaran' : '/gudang')}
            className="inline-flex items-center gap-2 mt-3 px-3.5 py-2 rounded-xl text-xs font-bold"
            style={{
              background: todayNote.tone === 'warn' ? 'var(--yellow-lt)' : todayNote.tone === 'good' ? 'var(--green-lt)' : 'var(--warm-bg)',
              color: todayNote.tone === 'warn' ? '#C98A00' : todayNote.tone === 'good' ? 'var(--green)' : 'var(--text-mid)',
              cursor: todayNote.tone === 'warn' ? 'pointer' : 'default',
            }}
          >
            {todayNote.text}
          </button>
        )}
      </div>

      {/* Bento stats: 1 kartu utama (omzet) + 2 kartu sedang + strip kecil */}
      <div className="grid sm:grid-cols-3 gap-3">
        {isLoading ? (
          <>
            <StatSkeleton className="sm:col-span-1 sm:row-span-2" />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            {/* Hero: Omzet hari ini */}
            <button
              onClick={() => navigate('/pembayaran')}
              className="sm:row-span-2 rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, var(--orange) 0%, #FF9A6C 100%)', boxShadow: '0 8px 24px rgba(255,122,61,.35)' }}
            >
              <span className="text-2xl">💰</span>
              <p className="font-display font-black text-3xl mt-3 text-white">{fmt(s?.today.revenue ?? 0)}</p>
              <p className="text-xs font-bold mt-1" style={{ color: 'rgba(255,255,255,.85)' }}>Omzet Hari Ini</p>
              <p className="text-[11px] font-semibold mt-3" style={{ color: 'rgba(255,255,255,.75)' }}>
                dari {s?.today.transactions ?? 0} transaksi
              </p>
            </button>

            <button onClick={() => navigate('/pendaftaran')} className="stat-card p-4 text-left">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl mb-3" style={{ background: 'var(--orange-lt)' }}>🐾</div>
              <p className="font-display font-black text-2xl" style={{ color: 'var(--orange)' }}>{s?.today.registrations ?? '—'}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-soft)' }}>Pasien Hari Ini</p>
            </button>

            <button onClick={() => navigate('/pendaftaran')} className="stat-card p-4 text-left">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl mb-3" style={{ background: 'var(--blue-lt)' }}>👥</div>
              <p className="font-display font-black text-2xl" style={{ color: 'var(--blue)' }}>{s?.today.activeQueue ?? '—'}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-soft)' }}>Antrian Aktif</p>
            </button>
          </>
        )}
      </div>

      {/* Strip kecil: 3 metrik sekunder */}
      <div className="grid grid-cols-3 gap-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card-sm p-3.5 animate-pulse flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex-shrink-0" style={{ background: 'var(--warm-bg)' }} />
                <div className="flex-1"><div className="h-4 rounded w-10 mb-1" style={{ background: 'var(--warm-bg)' }} /><div className="h-2 rounded w-16" style={{ background: 'var(--warm-bg)' }} /></div>
              </div>
            ))
          : smallStats.map(({ label, value, icon, bg, fg, path }) => (
              <button key={label} onClick={() => navigate(path)} className="card-sm p-3.5 flex items-center gap-3 text-left transition-transform hover:-translate-y-0.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ background: bg }}>{icon}</div>
                <div className="min-w-0">
                  <p className="font-display font-black text-base leading-none" style={{ color: fg }}>{value ?? '—'}</p>
                  <p className="text-[10px] font-semibold mt-1 truncate" style={{ color: 'var(--text-soft)' }}>{label}</p>
                </div>
              </button>
            ))}
      </div>

      {/* Middle row */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Omzet Bulan Ini */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">📅</span>
              <h3 className="font-display font-extrabold text-sm" style={{ color: 'var(--text-dark)' }}>Sebulan Terakhir</h3>
            </div>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>{format(new Date(), 'MMMM yyyy', { locale: localeId })}</span>
          </div>
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-8 rounded-xl w-2/3" style={{ background: 'var(--warm-bg)' }} />
              <div className="h-3 rounded w-1/2" style={{ background: 'var(--warm-bg)' }} />
            </div>
          ) : (
            <>
              <p className="font-display font-black text-3xl" style={{ color: 'var(--green)' }}>{fmt(s?.month.revenue ?? 0)}</p>
              <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-soft)' }}>
                {s?.month.transactions
                  ? `dari ${s.month.transactions} transaksi bulan ini`
                  : 'belum ada transaksi bulan ini'}
              </p>
              <div className="mt-4 p-3 rounded-xl" style={{ background: 'var(--warm-bg)' }}>
                <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-soft)' }}>Rata-rata per hari</p>
                <p className="font-bold" style={{ color: 'var(--text-dark)' }}>
                  {fmt(Math.round((s?.month.revenue ?? 0) / Math.max(new Date().getDate(), 1)))}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Tren 7 Hari */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">📈</span>
            <h3 className="font-display font-extrabold text-sm" style={{ color: 'var(--text-dark)' }}>Kunjungan 7 Hari Terakhir</h3>
          </div>
          {isLoading ? (
            <div className="h-24 rounded animate-pulse" style={{ background: 'var(--warm-bg)' }} />
          ) : s?.trend ? (
            <TrendChart data={s.trend} />
          ) : null}
          {s?.trend && (
            <div className="flex justify-between mt-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
                Total: <b style={{ color: 'var(--text-dark)' }}>{s.trend.reduce((a, b) => a + b.count, 0)}</b> pasien
              </span>
              <span className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--orange)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--orange)' }} /> Hari ini
              </span>
            </div>
          )}
        </div>

        {/* Top Layanan */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">⭐</span>
            <h3 className="font-display font-extrabold text-sm" style={{ color: 'var(--text-dark)' }}>Layanan Favorit Bulan Ini</h3>
          </div>
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 rounded" style={{ background: 'var(--warm-bg)' }} />)}
            </div>
          ) : !s?.topServices.length ? (
            <div className="flex flex-col items-center py-6 gap-1.5 text-center">
              <span className="text-2xl">🗓️</span>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>Belum ada layanan yang tercatat bulan ini.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {s.topServices.map((svc, i) => (
                <div key={svc.priceServiceId} className="flex items-center gap-3">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      background: i === 0 ? 'var(--yellow-lt)' : i === 1 ? 'var(--warm-bg)' : i === 2 ? 'var(--orange-lt)' : 'var(--warm-bg)',
                      color: i === 0 ? '#C98A00' : i === 1 ? 'var(--text-soft)' : i === 2 ? 'var(--orange)' : 'var(--text-soft)',
                    }}
                  >{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-dark)' }}>{svc.serviceName}</p>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>{svc.count}× · {fmt(svc.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Recent Transactions */}
        <div className="card">
          <div className="flex items-center justify-between p-5" style={{ borderBottom: '1.5px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4" style={{ color: 'var(--text-soft)' }} />
              <h3 className="font-display font-extrabold text-sm" style={{ color: 'var(--text-dark)' }}>Transaksi Terakhir</h3>
            </div>
            <button onClick={() => navigate('/pembayaran')}
              className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--orange)' }}>
              Lihat semua <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5 animate-pulse flex justify-between gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 rounded w-1/3" style={{ background: 'var(--warm-bg)' }} />
                    <div className="h-2.5 rounded w-1/4" style={{ background: 'var(--warm-bg)' }} />
                  </div>
                  <div className="h-3 rounded w-20" style={{ background: 'var(--warm-bg)' }} />
                </div>
              ))
            ) : !s?.recentTransactions.length ? (
              <div className="flex flex-col items-center py-10 gap-1.5 text-center">
                <span className="text-3xl">🧾</span>
                <p className="text-sm font-bold" style={{ color: 'var(--text-dark)' }}>Belum ada transaksi</p>
                <p className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>Transaksi hari ini bakal muncul di sini.</p>
              </div>
            ) : s.recentTransactions.map((tx, i) => (
              <div
                key={tx.id}
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: i < s.recentTransactions.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-dark)' }}>{tx.patientName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                      {format(new Date(tx.createdAt), 'HH:mm', { locale: localeId })}
                    </span>
                    <Badge variant="teal">{tx.methodName}</Badge>
                  </div>
                </div>
                <span className="font-display font-extrabold text-sm flex-shrink-0" style={{ color: 'var(--green)' }}>{fmt(tx.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stok Minim */}
        <div className="card">
          <div className="flex items-center justify-between p-5" style={{ borderBottom: '1.5px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <span className="text-base">📦</span>
              <h3 className="font-display font-extrabold text-sm" style={{ color: 'var(--text-dark)' }}>Stok Minim / Habis</h3>
            </div>
            <button onClick={() => navigate('/gudang')}
              className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--orange)' }}>
              Lihat gudang <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3 animate-pulse flex justify-between gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 rounded w-1/2" style={{ background: 'var(--warm-bg)' }} />
                    <div className="h-2.5 rounded w-1/4" style={{ background: 'var(--warm-bg)' }} />
                  </div>
                  <div className="h-5 rounded w-12" style={{ background: 'var(--warm-bg)' }} />
                </div>
              ))
            ) : !s?.lowStock.length ? (
              <div className="flex flex-col items-center py-10 gap-1.5 text-center">
                <span className="text-3xl">👍</span>
                <p className="text-sm font-bold" style={{ color: 'var(--text-dark)' }}>Semua stok aman</p>
                <p className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>Nggak ada yang perlu buru-buru dibeli sekarang.</p>
              </div>
            ) : s.lowStock.map((item, i) => {
              const isOut = Number(item.totalItem) <= 0
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderBottom: i < s.lowStock.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-dark)' }}>{item.itemName}</p>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                      Min stok: {Number(item.limitItem).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="font-display font-extrabold text-sm" style={{ color: isOut ? 'var(--red)' : '#C98A00' }}>
                      {Number(item.totalItem).toLocaleString('id-ID')}
                    </span>
                    <div className="mt-1">
                      <Badge variant={isOut ? 'red' : 'yellow'}>{isOut ? 'Habis' : 'Minim'}</Badge>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
