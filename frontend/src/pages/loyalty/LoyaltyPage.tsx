import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Star, Users, TrendingUp, Gift, Settings, Search,
  ChevronRight, Award, Crown, Shield as ShieldIcon, RefreshCw,
} from 'lucide-react'

interface Member {
  id: string; ownerId: string; ownerName: string; phone?: string
  totalPoints: number; tier: string; totalSpend: number; joinedAt: string
}
interface Stats {
  totalMembers: number; byTier: Record<string, number>
  totalPointsEarned: number; totalRedeemed: number
}
interface Config {
  pointsPerRupiah: number; silverThreshold: number; goldThreshold: number
  redeemRate: number; isActive: boolean
}

const TIER_CONFIG = {
  basic:  { label: 'Basic',  color: 'bg-gray-100 text-gray-600',   icon: ShieldIcon, ring: 'ring-gray-300' },
  silver: { label: 'Silver', color: 'bg-slate-100 text-slate-600', icon: Award,       ring: 'ring-slate-400' },
  gold:   { label: 'Gold',   color: 'bg-amber-100 text-amber-700', icon: Crown,       ring: 'ring-amber-400' },
}

function TierBadge({ tier }: { tier: string }) {
  const cfg = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.basic
  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>
}

function fmt(n: number) {
  return n.toLocaleString('id-ID')
}

function MemberDetailModal({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['loyalty-member', ownerId],
    queryFn: () => api.get(`/loyalty/member/${ownerId}`).then((r: any) => r.data.data),
  })

  const [redeemPts, setRedeemPts] = useState('')
  const redeemMutation = useMutation({
    mutationFn: (body: any) => api.post('/loyalty/redeem', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-member', ownerId] })
      qc.invalidateQueries({ queryKey: ['loyalty-members'] })
      qc.invalidateQueries({ queryKey: ['loyalty-stats'] })
      setRedeemPts('')
    },
  })

  if (!data) return null
  const { member, history, config } = data
  if (!member) return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 text-center">
        <p className="text-gray-500">Member belum terdaftar</p>
        <button onClick={onClose} className="mt-4 text-teal-600 text-sm">Tutup</button>
      </div>
    </div>
  )

  const discountValue = Number(redeemPts) * Number(config.redeemRate)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-bold text-gray-800">{member.ownerName}</h3>
            <p className="text-xs text-gray-400">{member.phone}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* Member card */}
          <div className={`rounded-2xl p-5 text-white bg-gradient-to-br ${member.tier === 'gold' ? 'from-amber-500 to-yellow-600' : member.tier === 'silver' ? 'from-slate-500 to-gray-600' : 'from-teal-500 to-teal-700'}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm opacity-80">Paw Hub Loyalty</span>
              <TierBadge tier={member.tier} />
            </div>
            <p className="text-3xl font-bold">{fmt(member.totalPoints)} <span className="text-lg font-normal opacity-80">poin</span></p>
            <p className="text-xs opacity-70 mt-1">Total belanja: Rp{fmt(member.totalSpend)}</p>
            {member.nextTier && (
              <p className="text-xs mt-2 opacity-90">
                +{fmt(member.nextTierPoints)} poin lagi → tier <strong>{member.nextTier}</strong>
              </p>
            )}
          </div>

          {/* Redeem */}
          <div className="bg-teal-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">Tukarkan Poin</p>
            <div className="flex gap-2">
              <input type="number" value={redeemPts} onChange={e => setRedeemPts(e.target.value)}
                placeholder="Jumlah poin" min={1} max={member.totalPoints}
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <button
                disabled={!redeemPts || Number(redeemPts) < 1 || Number(redeemPts) > member.totalPoints || redeemMutation.isPending}
                onClick={() => redeemMutation.mutate({ ownerId, points: Number(redeemPts) })}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                {redeemMutation.isPending ? '...' : 'Tukar'}
              </button>
            </div>
            {redeemPts && Number(redeemPts) > 0 && (
              <p className="text-xs text-teal-700 mt-1.5">{redeemPts} poin = diskon <strong>Rp{fmt(discountValue)}</strong></p>
            )}
            {redeemMutation.isError && <p className="text-xs text-red-500 mt-1">{(redeemMutation.error as any)?.response?.data?.message}</p>}
            {redeemMutation.isSuccess && <p className="text-xs text-green-600 mt-1">Poin berhasil ditukar!</p>}
          </div>

          {/* History */}
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-2">Riwayat Poin</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {history.length === 0 ? <p className="text-xs text-gray-400">Belum ada transaksi poin</p> : history.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between text-xs py-1.5 border-b">
                  <span className="text-gray-600 flex-1">{h.description}</span>
                  <span className={`font-semibold ml-2 ${h.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {h.points > 0 ? '+' : ''}{h.points}
                  </span>
                  <span className="text-gray-400 ml-3">{fmt(h.balance)} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfigModal({ config, onClose }: { config: Config; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ ...config })
  const mutation = useMutation({
    mutationFn: (body: any) => api.put('/loyalty/config', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loyalty-config'] }); onClose() },
  })
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-gray-800">Konfigurasi Program Loyalty</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Poin per Rp1 (misal: 0.001 = Rp1000 → 1 poin)</label>
            <input type="number" step="0.0001" value={form.pointsPerRupiah}
              onChange={e => setForm(f => ({ ...f, pointsPerRupiah: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Threshold Silver (poin)</label>
              <input type="number" value={form.silverThreshold}
                onChange={e => setForm(f => ({ ...f, silverThreshold: Number(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Threshold Gold (poin)</label>
              <input type="number" value={form.goldThreshold}
                onChange={e => setForm(f => ({ ...f, goldThreshold: Number(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Nilai Tukar per Poin (Rp)</label>
            <input type="number" value={form.redeemRate}
              onChange={e => setForm(f => ({ ...f, redeemRate: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <p className="text-xs text-gray-400 mt-1">1 poin = Rp{fmt(form.redeemRate)} diskon</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="loyaltyActive" checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 accent-teal-500" />
            <label htmlFor="loyaltyActive" className="text-sm text-gray-700">Program Loyalty Aktif</label>
          </div>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white py-2.5 rounded-xl font-medium text-sm disabled:opacity-50">
            {mutation.isPending ? 'Menyimpan...' : 'Simpan Konfigurasi'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LoyaltyPage() {
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)

  const { data: stats } = useQuery<Stats>({
    queryKey: ['loyalty-stats'],
    queryFn: () => api.get('/loyalty/stats').then((r: any) => r.data.data),
  })

  const { data: config } = useQuery<Config>({
    queryKey: ['loyalty-config'],
    queryFn: () => api.get('/loyalty/config').then((r: any) => r.data.data),
  })

  const { data: membersData, isLoading } = useQuery({
    queryKey: ['loyalty-members', search, tierFilter],
    queryFn: () => api.get('/loyalty/members', { params: { search: search || undefined, tier: tierFilter || undefined } }).then((r: any) => r.data),
  })

  const members: Member[] = membersData?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-500" /> Loyalty Program
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Kelola poin reward dan keanggotaan pelanggan klinik</p>
        </div>
        <button onClick={() => setShowConfig(true)}
          className="flex items-center gap-2 px-4 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">
          <Settings className="w-4 h-4" /> Konfigurasi
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-teal-600" /><span className="text-xs text-gray-500">Total Member</span></div>
            <p className="text-2xl font-bold text-gray-800">{fmt(stats.totalMembers)}</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
            <div className="flex items-center gap-2 mb-1"><Crown className="w-4 h-4 text-amber-500" /><span className="text-xs text-gray-500">Gold</span></div>
            <p className="text-2xl font-bold text-amber-700">{fmt(stats.byTier.gold ?? 0)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1"><Award className="w-4 h-4 text-slate-500" /><span className="text-xs text-gray-500">Silver</span></div>
            <p className="text-2xl font-bold text-slate-700">{fmt(stats.byTier.silver ?? 0)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-green-500" /><span className="text-xs text-gray-500">Poin Diredeem</span></div>
            <p className="text-2xl font-bold text-gray-800">{fmt(stats.totalRedeemed)}</p>
          </div>
        </div>
      )}

      {config && !config.isActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 flex items-center gap-2">
          <Gift className="w-4 h-4 shrink-0" />
          Program loyalty saat ini <strong>nonaktif</strong>. Aktifkan di Konfigurasi agar pelanggan bisa mendapatkan poin.
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama owner..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div className="flex rounded-lg border overflow-hidden">
          {(['', 'basic', 'silver', 'gold'] as const).map(t => (
            <button key={t} onClick={() => setTierFilter(t)}
              className={`px-3 py-2 text-xs font-medium capitalize ${tierFilter === t ? 'bg-teal-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {t === '' ? 'Semua' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Members table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Owner</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Tier</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase">Poin</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase">Total Belanja</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Bergabung</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
              ))
            ) : !members.length ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                <Star className="w-8 h-8 mx-auto mb-2 opacity-20" />
                Belum ada member loyalty
              </td></tr>
            ) : members.map(m => (
              <tr key={m.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOwner(m.ownerId)}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{m.ownerName}</p>
                  <p className="text-xs text-gray-400">{m.phone ?? '—'}</p>
                </td>
                <td className="px-4 py-3"><TierBadge tier={m.tier} /></td>
                <td className="px-4 py-3 text-right font-semibold text-amber-600">{fmt(m.totalPoints)}</td>
                <td className="px-4 py-3 text-right text-gray-600">Rp{fmt(m.totalSpend)}</td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(m.joinedAt).toLocaleDateString('id-ID')}
                </td>
                <td className="px-4 py-3 text-right">
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedOwner && <MemberDetailModal ownerId={selectedOwner} onClose={() => setSelectedOwner(null)} />}
      {showConfig && config && <ConfigModal config={config} onClose={() => setShowConfig(false)} />}
    </div>
  )
}
