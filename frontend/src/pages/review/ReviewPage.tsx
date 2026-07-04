import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Star, ThumbsUp, ThumbsDown, AlertCircle, BarChart3, Send, Eye, EyeOff } from 'lucide-react'

interface Review {
  id: string; rating: number | null; comment: string | null
  petName: string; doctorName: string; isPublished: boolean
  sentAt: string | null; repliedAt: string | null; visitDate: string
}
interface Stats {
  avgRating: string | null; totalReviews: number; alertCount: number
  byDoctor: { doctorId: string; doctorName: string; avgRating: string; count: number }[]
  starDistribution: { rating: number; count: number }[]
}

function StarDisplay({ rating, size = 'sm' }: { rating: number | null; size?: 'sm' | 'lg' }) {
  if (!rating) return <span className="text-xs text-gray-400">Belum dirating</span>
  const sz = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`${sz} ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating}/5</span>
    </div>
  )
}

// Public rating form — accessible at /review/:token (no auth)
export function PublicRatingPage({ token }: { token: string }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [done, setDone] = useState(false)

  const { data } = useQuery({
    queryKey: ['review-public', token],
    queryFn: () => api.get(`/review/public/${token}`).then((r: any) => r.data.data),
  })

  const mutation = useMutation({
    mutationFn: (body: any) => api.post(`/review/rate/${token}`, body),
    onSuccess: () => setDone(true),
  })

  if (!data) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>

  if (data.alreadyRated || done) return (
    <div className="min-h-screen bg-teal-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-lg">
        <div className="text-5xl mb-4">🐾</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Terima Kasih!</h2>
        <p className="text-gray-500 text-sm">Penilaian Anda sangat berarti bagi kami untuk terus meningkatkan pelayanan.</p>
        {data.rating && <div className="mt-4 flex justify-center"><StarDisplay rating={data.rating} size="lg" /></div>}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-teal-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-lg space-y-5">
        <div className="text-center">
          <div className="text-4xl mb-3">🐾</div>
          <h2 className="text-xl font-bold text-gray-800">Bagaimana pengalaman {data.petName}?</h2>
          <p className="text-sm text-gray-500 mt-1">Ditangani oleh {data.doctorName} · {data.branchName}</p>
        </div>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <button key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => setRating(i)}>
              <Star className={`w-10 h-10 transition-colors ${i <= (hover || rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-center text-sm font-medium text-teal-600">
            {rating === 5 ? 'Luar biasa! 🌟' : rating === 4 ? 'Bagus! 😊' : rating === 3 ? 'Cukup baik 👍' : rating === 2 ? 'Perlu ditingkatkan 😐' : 'Mengecewakan 😞'}
          </p>
        )}
        <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Ceritakan pengalaman Anda (opsional)..."
          className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
        <button
          disabled={rating === 0 || mutation.isPending}
          onClick={() => mutation.mutate({ rating, comment: comment || undefined })}
          className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm">
          {mutation.isPending ? 'Mengirim...' : 'Kirim Penilaian'}
        </button>
      </div>
    </div>
  )
}

// Admin ReviewPage
export default function ReviewPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'daftar' | 'statistik'>('daftar')
  const [filter, setFilter] = useState({ minRating: '', maxRating: '', onlyRated: 'true' })

  const { data: stats } = useQuery<Stats>({
    queryKey: ['review-stats'],
    queryFn: () => api.get('/review/stats').then((r: any) => r.data.data),
  })

  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['reviews', filter],
    queryFn: () => api.get('/review/list', { params: filter }).then((r: any) => r.data),
    enabled: tab === 'daftar',
  })
  const reviews: Review[] = reviewsData?.data ?? []

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      api.patch(`/review/${id}/publish`, { isPublished }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews'] }),
  })

  const maxStar = Math.max(...(stats?.starDistribution.map(s => s.count) ?? [1]), 1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Star className="w-6 h-6 text-amber-500" /> Rating & Ulasan
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Pantau kepuasan pelanggan pasca-kunjungan</p>
      </div>

      {/* Quick stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-amber-500">{stats.avgRating ?? '—'}</p>
            <div className="flex justify-center mt-1">
              {stats.avgRating ? <StarDisplay rating={Math.round(Number(stats.avgRating))} /> : null}
            </div>
            <p className="text-xs text-gray-500 mt-1">Rating Rata-rata</p>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-gray-800">{stats.totalReviews}</p>
            <p className="text-xs text-gray-500 mt-1">Total Ulasan</p>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{stats.starDistribution.find(s => s.rating === 5)?.count ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Rating Bintang 5</p>
          </div>
          <div className={`rounded-xl border p-4 text-center ${stats.alertCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
            <p className={`text-3xl font-bold ${stats.alertCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>{stats.alertCount}</p>
            <p className="text-xs text-gray-500 mt-1">Perlu Follow-up (≤2⭐)</p>
          </div>
        </div>
      )}

      {stats && stats.alertCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Ada <strong>{stats.alertCount}</strong> ulasan dengan rating rendah (≤2 bintang) yang perlu ditindaklanjuti.
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        {(['daftar', 'statistik'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium capitalize border-b-2 transition ${tab === t ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'daftar' ? 'Daftar Ulasan' : 'Statistik per Dokter'}
          </button>
        ))}
      </div>

      {/* Daftar */}
      {tab === 'daftar' && (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <select value={filter.minRating} onChange={e => setFilter(f => ({ ...f, minRating: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">Min. Rating</option>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}⭐+</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={filter.onlyRated === 'true'} className="accent-teal-500"
                onChange={e => setFilter(f => ({ ...f, onlyRated: e.target.checked ? 'true' : 'false' }))} />
              Hanya yang sudah diisi
            </label>
          </div>

          <div className="space-y-3">
            {isLoading ? <div className="text-center py-8 text-gray-400">Memuat...</div> :
             !reviews.length ? <div className="text-center py-12 text-gray-400"><Star className="w-8 h-8 mx-auto mb-2 opacity-20" />Belum ada ulasan</div> :
             reviews.map(r => (
              <div key={r.id} className={`bg-white rounded-xl border p-4 ${r.rating !== null && r.rating <= 2 ? 'border-red-200 bg-red-50/30' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <StarDisplay rating={r.rating} />
                      <span className="text-xs text-gray-400">{new Date(r.visitDate).toLocaleDateString('id-ID')}</span>
                      {r.rating !== null && r.rating <= 2 && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Perlu Follow-up
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{r.petName}</span> · {r.doctorName}
                    </p>
                    {r.comment && <p className="text-sm text-gray-600 mt-1.5 italic">"{r.comment}"</p>}
                    {!r.repliedAt && <p className="text-xs text-gray-400 mt-1">Survey dikirim · belum diisi owner</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      title={r.isPublished ? 'Sembunyikan dari publik' : 'Tampilkan di halaman publik'}
                      onClick={() => publishMutation.mutate({ id: r.id, isPublished: !r.isPublished })}
                      className={`p-1.5 rounded-lg ${r.isPublished ? 'text-teal-600 bg-teal-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                      {r.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Statistik */}
      {tab === 'statistik' && stats && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-600" /> Distribusi Bintang
            </h3>
            <div className="space-y-3">
              {[5,4,3,2,1].map(star => {
                const count = stats.starDistribution.find(s => s.rating === star)?.count ?? 0
                return (
                  <div key={star} className="flex items-center gap-3">
                    <div className="flex items-center gap-0.5 w-20 shrink-0">
                      {Array.from({ length: star }).map((_, i) => <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}
                    </div>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${(count / maxStar) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Rating per Dokter</h3>
            <div className="space-y-3">
              {stats.byDoctor.map(d => (
                <div key={d.doctorId} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{d.doctorName}</p>
                    <p className="text-xs text-gray-400">{d.count} ulasan</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarDisplay rating={Math.round(Number(d.avgRating))} />
                    <span className="font-bold text-amber-600">{d.avgRating}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
