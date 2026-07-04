import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CreditCard, Clock, CheckCircle2, Search, Receipt,
  X, ChevronLeft, ChevronRight, Printer, AlertCircle,
  Banknote, QrCode, ArrowLeftRight, History, Users, FileDown,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentMethod { id: string; methodName: string }
interface DetailItem {
  id: string; priceOverall: string; quantity: string; statusPaidOff: boolean
  priceItem: { listOfItem: { itemName: string; unitItem: { unitName: string } }; sellingPrice: string; doctorFee: string }
}
interface DetailService {
  id: string; priceOverall: string; quantity: number; statusPaidOff: boolean
  priceService: { listOfService: { serviceName: string; description?: string }; sellingPrice: string }
}
interface DetailMedGroup {
  id: string; quantity: number; statusPaidOff: boolean
  medicineGroup: { groupName: string; priceMedicineGroups: { sellingPrice: string }[] }
}
interface AntrianKasir {
  id: string; estimatedTotal: number; itemCount: number; statusPaidOff: boolean
  createdAt: string
  registration: {
    queueNumber?: number; isPriority: boolean
    patient: { petName: string; owner: { ownerName: string; phoneNumber?: string } }
    doctor?: { fullname: string }
  }
  doctor?: { fullname: string }
  detailItems: DetailItem[]
  detailServices: DetailService[]
  detailMedGroups: DetailMedGroup[]
}
interface Tagihan extends AntrianKasir {
  subtotal: number; subtotalItems: number; subtotalServices: number; subtotalMedGroups: number
}
interface Payment {
  id: string; createdAt: string; discount: string
  checkUpResult: {
    registration: {
      patient: { petName: string; owner: { ownerName: string } }
      doctor?: { fullname: string }
    }
  }
  paymentMethod?: { methodName: string }
  createdBy: { fullname: string }
  paymentItems: { detailItemPatient: { priceOverall: string; priceItem: { listOfItem: { itemName: string } } } }[]
  paymentServices: { detailServicePatient: { priceOverall: string; priceService: { listOfService: { serviceName: string } } } }[]
}

const fmt = (n: string | number) =>
  Number(n).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

const calcPaymentTotal = (p: Payment) =>
  p.paymentItems.reduce((s, i) => s + Number(i.detailItemPatient.priceOverall), 0) +
  p.paymentServices.reduce((s, i) => s + Number(i.detailServicePatient.priceOverall), 0) -
  Number(p.discount)

// ─── TagihanModal (Kasir) ─────────────────────────────────────────────────────

function TagihanModal({ checkUpId, onClose, onSuccess }: {
  checkUpId: string; onClose: () => void; onSuccess: () => void
}) {
  const qc = useQueryClient()
  const [discount, setDiscount] = useState(0)
  const [methodId, setMethodId] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [error, setError] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const { data: tagihanData, isLoading } = useQuery<{ data: Tagihan }>({
    queryKey: ['tagihan', checkUpId],
    queryFn: () => api.get(`/pembayaran/tagihan/${checkUpId}`).then(r => r.data),
  })
  const { data: methodsData } = useQuery<{ data: PaymentMethod[] }>({
    queryKey: ['metode-pembayaran'],
    queryFn: () => api.get('/metode-pembayaran').then(r => r.data),
  })

  const tagihan = tagihanData?.data
  const total = (tagihan?.subtotal ?? 0) - discount
  const change = amountPaid ? Math.max(0, Number(amountPaid) - total) : null
  const isCash = !methodId || methodsData?.data.find(m => m.id === methodId)?.methodName.toLowerCase().includes('tunai') || !methodId

  const mutation = useMutation({
    mutationFn: (body: any) => api.post('/pembayaran', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['antrian-kasir'] }); qc.invalidateQueries({ queryKey: ['pembayaran'] }); onSuccess() },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Gagal memproses pembayaran.'),
  })

  const handleBayar = () => {
    if (!tagihan) return
    setError('')
    mutation.mutate({
      checkUpResultId: tagihan.id,
      paymentMethodId: methodId || undefined,
      discount,
      items: tagihan.detailItems.filter(d => !d.statusPaidOff).map(d => ({
        detailItemPatientId: d.id,
        quantity: Number(d.quantity),
        amountDiscount: 0,
      })),
      services: tagihan.detailServices.filter(d => !d.statusPaidOff).map(d => ({
        detailServicePatientId: d.id,
        amountDiscount: 0,
      })),
      medicineGroups: tagihan.detailMedGroups?.filter(d => !d.statusPaidOff).map(d => ({
        medicineGroupId: d.medicineGroup ? Object.keys(d).find(k => k === 'medicineGroupId') : '',
        detailMedicineGroupResultId: d.id,
        quantity: d.quantity,
        amountDiscount: 0,
      })) ?? [],
    })
  }

  const handlePrint = () => {
    const content = printRef.current?.innerHTML
    if (!content) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html><head><title>Struk</title>
      <style>
        body { font-family: monospace; font-size: 12px; padding: 16px; max-width: 300px; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; }
        .bold { font-weight: bold; }
        .center { text-align: center; }
        h3 { text-align: center; margin-bottom: 4px; }
      </style>
      </head><body>${content}</body></html>
    `)
    w.document.close()
    w.print()
  }

  if (isLoading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-8"><p className="text-gray-500">Memuat tagihan...</p></div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-gray-900">Proses Pembayaran</h2>
              {tagihan && (
                <p className="text-sm text-gray-400">
                  {tagihan.registration.patient.petName} • {tagihan.registration.patient.owner.ownerName}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="p-5 space-y-5">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}

          {/* Rincian tagihan */}
          <div className="space-y-2">
            {(tagihan?.detailItems?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">Obat & Barang</p>
                {tagihan!.detailItems.filter(d => !d.statusPaidOff).map(d => (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div>
                      <p className="text-sm text-gray-900">{d.priceItem.listOfItem.itemName}</p>
                      <p className="text-xs text-gray-400">{Number(d.quantity)} {d.priceItem.listOfItem.unitItem.unitName} × {fmt(d.priceItem.sellingPrice)}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{fmt(d.priceOverall)}</p>
                  </div>
                ))}
              </div>
            )}

            {(tagihan?.detailServices?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5 mt-3">Jasa & Layanan</p>
                {tagihan!.detailServices.filter(d => !d.statusPaidOff).map(d => (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div>
                      <p className="text-sm text-gray-900">{d.priceService.listOfService.serviceName}</p>
                      <p className="text-xs text-gray-400">{d.quantity}× × {fmt(d.priceService.sellingPrice)}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{fmt(d.priceOverall)}</p>
                  </div>
                ))}
              </div>
            )}

            {(tagihan?.itemCount ?? 0) === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm">Tidak ada item dalam tagihan.</div>
            )}
          </div>

          {/* Subtotal + Diskon + Total */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span className="font-medium">{fmt(tagihan?.subtotal ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Diskon</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Rp</span>
                <input
                  className="input w-32 text-right text-sm py-1"
                  type="number" min="0"
                  value={discount || ''}
                  onChange={e => setDiscount(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 text-gray-900">
              <span>Total</span><span className="text-emerald-600 text-lg">{fmt(total)}</span>
            </div>
          </div>

          {/* Metode Bayar */}
          <div>
            <p className="label mb-2">Metode Pembayaran</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMethodId('')}
                className={cn('flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all',
                  !methodId ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                <Banknote className="w-4 h-4" /> Tunai
              </button>
              {methodsData?.data.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMethodId(m.id)}
                  className={cn('flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all',
                    methodId === m.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {m.methodName.toLowerCase().includes('qris') || m.methodName.toLowerCase().includes('qr')
                    ? <QrCode className="w-4 h-4" />
                    : <ArrowLeftRight className="w-4 h-4" />
                  }
                  {m.methodName}
                </button>
              ))}
            </div>
          </div>

          {/* Kembalian (hanya untuk tunai) */}
          {isCash && (
            <div className="p-4 bg-blue-50 rounded-xl space-y-3">
              <div>
                <label className="label text-blue-800">Uang Diterima (Rp)</label>
                <input
                  className="input w-full mt-1 text-lg font-bold"
                  type="number" min={total}
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  placeholder={fmt(total)}
                />
              </div>
              {change !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Kembalian</span>
                  <span className={cn('text-xl font-bold', change >= 0 ? 'text-blue-700' : 'text-red-600')}>
                    {fmt(change)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
            <button
              onClick={handleBayar}
              disabled={mutation.isPending || !tagihan}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {mutation.isPending ? 'Memproses...' : `Bayar ${fmt(total)}`}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden print template */}
      <div className="hidden">
        <div ref={printRef}>
          <h3>🐾 PawCare Clinic</h3>
          <p className="center">{format(new Date(), 'd MMM yyyy HH:mm', { locale: localeId })}</p>
          <div className="divider" />
          {tagihan && (
            <>
              <p><b>Pasien:</b> {tagihan.registration.patient.petName}</p>
              <p><b>Pemilik:</b> {tagihan.registration.patient.owner.ownerName}</p>
              <p><b>Dokter:</b> {tagihan.doctor?.fullname ?? '-'}</p>
              <div className="divider" />
              {tagihan.detailItems.map(d => (
                <div key={d.id} className="row">
                  <span>{d.priceItem.listOfItem.itemName} ×{Number(d.quantity)}</span>
                  <span>{fmt(d.priceOverall)}</span>
                </div>
              ))}
              {tagihan.detailServices.map(d => (
                <div key={d.id} className="row">
                  <span>{d.priceService.listOfService.serviceName}</span>
                  <span>{fmt(d.priceOverall)}</span>
                </div>
              ))}
              <div className="divider" />
              {discount > 0 && <div className="row"><span>Diskon</span><span>-{fmt(discount)}</span></div>}
              <div className="row bold"><span>TOTAL</span><span>{fmt(total)}</span></div>
              {amountPaid && <><div className="row"><span>Bayar</span><span>{fmt(amountPaid)}</span></div>
              <div className="row"><span>Kembalian</span><span>{fmt(change ?? 0)}</span></div></>}
              <div className="divider" />
              <p className="center">Terima kasih sudah mempercayakan kesehatan hewan peliharaan Anda kepada kami 🐾</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Detail Payment Modal ─────────────────────────────────────────────────────

function DetailModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const total = calcPaymentTotal(payment)
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-display font-semibold text-gray-900">Detail Transaksi</h2>
            <p className="text-xs text-gray-400">#{payment.id} · {format(new Date(payment.createdAt), 'd MMM yyyy HH:mm', { locale: localeId })}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-0.5">Pasien</p>
              <p className="font-medium text-gray-900">{payment.checkUpResult.registration.patient.petName}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-0.5">Pemilik</p>
              <p className="font-medium text-gray-900">{payment.checkUpResult.registration.patient.owner.ownerName}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-0.5">Dokter</p>
              <p className="font-medium text-gray-900">{payment.checkUpResult.registration?.doctor?.fullname ?? '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-0.5">Metode</p>
              <p className="font-medium text-gray-900">{payment.paymentMethod?.methodName ?? 'Tunai'}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            {payment.paymentItems.map((pi, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-sm">
                <span className="text-gray-700">{pi.detailItemPatient.priceItem.listOfItem.itemName}</span>
                <span className="font-medium text-gray-900">{fmt(pi.detailItemPatient.priceOverall)}</span>
              </div>
            ))}
            {payment.paymentServices.map((ps, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-sm">
                <span className="text-gray-700">{ps.detailServicePatient.priceService.listOfService.serviceName}</span>
                <span className="font-medium text-gray-900">{fmt(ps.detailServicePatient.priceOverall)}</span>
              </div>
            ))}
          </div>

          {Number(payment.discount) > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>Diskon</span><span>-{fmt(payment.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg text-emerald-600 border-t border-gray-100 pt-3">
            <span>Total</span><span>{fmt(total)}</span>
          </div>

          <p className="text-xs text-gray-400 text-right">Kasir: {payment.createdBy.fullname}</p>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: Antrian Kasir ───────────────────────────────────────────────────────

function AntrianKasirTab() {
  const [paying, setPaying] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery<{ data: AntrianKasir[] }>({
    queryKey: ['antrian-kasir'],
    queryFn: () => api.get('/pembayaran/antrian-kasir').then(r => r.data),
    refetchInterval: 30_000,
  })

  const list = data?.data ?? []

  return (
    <div>
      {success && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">Pembayaran berhasil diproses! 🎉</p>
          <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-500 hover:text-emerald-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
              <div className="h-8 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : !list.length ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-gray-300" />
          </div>
          <p className="font-semibold text-gray-700">Semua sudah terbayar!</p>
          <p className="text-sm text-gray-400 mt-1">Tidak ada antrian pembayaran saat ini.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(item => (
            <div key={item.id} className={cn('card p-5 flex flex-col gap-3', item.registration.isPriority && 'border-l-4 border-red-400')}>
              <div className="flex items-start justify-between">
                <div>
                  {item.registration.queueNumber && (
                    <span className="text-xs font-bold text-gray-400 uppercase">#{item.registration.queueNumber}</span>
                  )}
                  <p className="font-semibold text-gray-900 mt-0.5">{item.registration.patient.petName}</p>
                  <p className="text-sm text-gray-500">{item.registration.patient.owner.ownerName}</p>
                </div>
                {item.registration.isPriority && (
                  <span className="badge badge-danger text-xs">🚨 Prioritas</span>
                )}
              </div>

              <div className="text-xs text-gray-400 space-y-0.5">
                <p>👨‍⚕️ {item.doctor?.fullname ?? item.registration.doctor?.fullname ?? 'Belum ditentukan'}</p>
                <p>📋 {item.itemCount} item</p>
                <p>⏱️ {format(new Date(item.createdAt), 'HH:mm', { locale: localeId })}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-400">Estimasi total</p>
                  <p className="font-bold text-emerald-600 text-lg">{fmt(item.estimatedTotal)}</p>
                </div>
                <button
                  onClick={() => setPaying(item.id)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  Bayar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {paying && (
        <TagihanModal
          checkUpId={paying}
          onClose={() => setPaying(null)}
          onSuccess={() => {
            setPaying(null)
            setSuccess('done')
            qc.invalidateQueries({ queryKey: ['antrian-kasir'] })
            qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
          }}
        />
      )}
    </div>
  )
}

// ─── TAB: Riwayat Pembayaran ──────────────────────────────────────────────────

function RiwayatTab() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState<Payment | null>(null)

  const { data, isLoading } = useQuery<{ data: Payment[]; meta: { total: number; totalPages: number } }>({
    queryKey: ['pembayaran', date, page],
    queryFn: () => api.get('/pembayaran', { params: { date, page, limit: 15 } }).then(r => r.data),
    placeholderData: (prev: any) => prev,
  })

  const todayRevenue = (data?.data ?? []).reduce((s, p) => s + calcPaymentTotal(p), 0)

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input className="input w-40" type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1) }} />
        {data?.data.length ? (
          <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl">
            <span className="text-sm text-emerald-700">Total {format(new Date(date), 'd MMM', { locale: localeId })}:</span>
            <span className="font-bold text-emerald-700">{fmt(todayRevenue)}</span>
            <span className="text-xs text-emerald-500">({data.data.length} transaksi)</span>
          </div>
        ) : null}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Waktu</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pasien</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pemilik</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Metode</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kasir</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : !data?.data.length ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Belum ada transaksi pada tanggal ini.</td></tr>
              ) : data.data.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewing(p)}>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {format(new Date(p.createdAt), 'HH:mm', { locale: localeId })}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.checkUpResult.registration.patient.petName}</td>
                  <td className="px-4 py-3 text-gray-600">{p.checkUpResult.registration.patient.owner.ownerName}</td>
                  <td className="px-4 py-3">
                    <span className="badge badge-secondary text-xs">{p.paymentMethod?.methodName ?? 'Tunai'}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(calcPaymentTotal(p))}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.createdBy.fullname}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={e => { e.stopPropagation(); setViewing(p) }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Lihat detail">
                        <Receipt className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Download Invoice PDF"
                        onClick={async e => {
                          e.stopPropagation()
                          const res = await api.get(`/export/invoice/${p.id}`, { responseType: 'blob' })
                          const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'application/pdf' }))
                          const a = document.createElement('a'); a.href = url; a.download = `invoice-${p.id}.pdf`; a.click()
                          URL.revokeObjectURL(url)
                        }}
                        className="p-1.5 rounded-lg hover:bg-teal-50 text-gray-400 hover:text-teal-600">
                        <FileDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(data?.meta?.totalPages ?? 0) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              Total {data?.meta.total} transaksi — Hal {page}/{data?.meta.totalPages}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(data!.meta.totalPages, p + 1))} disabled={page === data?.meta.totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {viewing && <DetailModal payment={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function PembayaranPage() {
  const [tab, setTab] = useState<'kasir' | 'riwayat'>('kasir')

  const { data: statsData } = useQuery<{ data: { todayRevenue: number; todayTransactions: number; pendingKasir: number } }>({
    queryKey: ['pembayaran-stats'],
    queryFn: () => api.get('/pembayaran/stats').then(r => r.data),
    refetchInterval: 30_000,
  })
  const stats = statsData?.data

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-display font-bold text-gray-900">Pembayaran</h1>
        <p className="text-sm text-gray-400 mt-0.5">Proses transaksi kasir & lihat riwayat pembayaran</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Menunggu Bayar',      value: stats?.pendingKasir ?? '—',     icon: Clock,         color: 'text-amber-600',    bg: 'bg-amber-50' },
          { label: 'Transaksi Hari Ini',  value: stats?.todayTransactions ?? '—', icon: CheckCircle2,  color: 'text-emerald-600',  bg: 'bg-emerald-50' },
          { label: 'Omzet Hari Ini',      value: stats ? fmt(stats.todayRevenue) : '—', icon: CreditCard, color: 'text-primary-600', bg: 'bg-primary-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4 flex items-center gap-4">
            <div className={cn('p-2.5 rounded-xl shrink-0', bg)}>
              <Icon className={cn('w-5 h-5', color)} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
        {[
          { key: 'kasir' as const,   label: 'Antrian Kasir',     icon: Users },
          { key: 'riwayat' as const, label: 'Riwayat',           icon: History },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === key ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
            {key === 'kasir' && (stats?.pendingKasir ?? 0) > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-full">
                {stats!.pendingKasir}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'kasir'   && <AntrianKasirTab />}
      {tab === 'riwayat' && <RiwayatTab />}
    </div>
  )
}
