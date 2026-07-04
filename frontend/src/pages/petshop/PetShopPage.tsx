import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShoppingBag, Package, ShoppingCart, History, Plus, Search,
  Edit2, Trash2, X, AlertTriangle, Minus, ChevronDown,
  Tag, BarChart2, Banknote, CreditCard, Check,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  itemName: string
  totalItem: number
  limitItem: number | null
  expiredDate: string | null
  unitItemId: string
  categoryItemId: string
  isLowStock: boolean
  currentPrice: { id: string; sellingPrice: number; capitalPrice: number; petshopFee: number } | null
  branch: { id: string; branchName: string } | null
}

interface Ref {
  categories: { id: string; name: string }[]
  units: { id: string; name: string }[]
  paymentMethods: { id: string; name: string }[]
}

interface CartItem {
  priceItemPetShopId: string
  productId: string
  productName: string
  sellingPrice: number
  qty: number
  type: 'retail'
}

interface Transaction {
  id: string
  discount: number
  subtotal: number
  total: number
  user: { fullname: string; branch: { branchName: string } | null } | null
  items: {
    id: string
    itemType: string
    totalItem: number
    sellingPrice: number
    lineTotal: number
    product: { itemName: string } | null
  }[]
  createdAt: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, bg, label, value, sub }: {
  icon: React.ReactNode; bg: string; label: string; value: string; sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', bg)}>{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-bold text-gray-800 mt-0.5">{value}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Modal Produk ─────────────────────────────────────────────────────────────

function ProdukModal({
  initial, refs, onClose, onSave, saving,
}: {
  initial?: Product | null
  refs: Ref
  onClose: () => void
  onSave: (d: any) => void
  saving: boolean
}) {
  const auth = useAuthStore((s) => s.user)
  const [form, setForm] = useState(() => ({
    itemName: initial?.itemName ?? '',
    unitItemId: initial?.unitItemId ?? '',
    categoryItemId: initial?.categoryItemId ?? '',
    branchId: initial?.branch?.id ?? auth?.branchId ?? '',
    limitItem: initial?.limitItem != null ? String(initial.limitItem) : '',
    expiredDate: initial?.expiredDate ? format(new Date(initial.expiredDate), 'yyyy-MM-dd') : '',
    sellingPrice: initial?.currentPrice ? String(initial.currentPrice.sellingPrice) : '',
    capitalPrice: initial?.currentPrice ? String(initial.currentPrice.capitalPrice) : '',
    petshopFee: initial?.currentPrice ? String(initial.currentPrice.petshopFee) : '0',
  }))

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))
  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">{initial ? 'Edit Produk' : 'Tambah Produk'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form) }} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Nama Produk *</label>
            <input className={inputCls} value={form.itemName} onChange={(e) => set('itemName', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Kategori *</label>
              <select className={inputCls} value={form.categoryItemId} onChange={(e) => set('categoryItemId', e.target.value)} required>
                <option value="">Pilih</option>
                {refs.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Satuan *</label>
              <select className={inputCls} value={form.unitItemId} onChange={(e) => set('unitItemId', e.target.value)} required>
                <option value="">Pilih</option>
                {refs.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Stok Minimum Alert</label>
              <input type="number" className={inputCls} placeholder="Opsional" min={0}
                value={form.limitItem} onChange={(e) => set('limitItem', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Tgl Kadaluarsa</label>
              <input type="date" className={inputCls} value={form.expiredDate} onChange={(e) => set('expiredDate', e.target.value)} />
            </div>
          </div>
          {!initial && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-gray-500 uppercase">Harga Awal</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Harga Jual (Rp) *</label>
                  <input type="number" className={inputCls} placeholder="0" min={0}
                    value={form.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)} required />
                </div>
                <div>
                  <label className={labelCls}>Harga Modal (Rp) *</label>
                  <input type="number" className={inputCls} placeholder="0" min={0}
                    value={form.capitalPrice} onChange={(e) => set('capitalPrice', e.target.value)} required />
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
              {saving ? 'Menyimpan...' : initial ? 'Simpan' : 'Tambah Produk'}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Stok ───────────────────────────────────────────────────────────────

function StokModal({ product, onClose, onSave, saving }: {
  product: Product; onClose: () => void
  onSave: (d: any) => void; saving: boolean
}) {
  const [qty, setQty] = useState('')
  const [type, setType] = useState<'masuk' | 'keluar'>('masuk')

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Mutasi Stok</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="text-sm text-gray-600 mb-4">
          <span className="font-medium">{product.itemName}</span>{' '}
          — Stok saat ini: <span className="font-bold text-indigo-600">{product.totalItem}</span>
        </div>
        <div className="flex gap-2 mb-4">
          {(['masuk', 'keluar'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={cn('flex-1 py-2 rounded-lg text-sm font-medium capitalize',
                type === t ? 'bg-indigo-600 text-white' : 'border border-gray-200 text-gray-600'
              )}>
              {t === 'masuk' ? '+ Stok Masuk' : '- Stok Keluar'}
            </button>
          ))}
        </div>
        <input type="number" placeholder="Jumlah" min={1}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4"
          value={qty} onChange={(e) => setQty(e.target.value)} />
        <div className="flex gap-3">
          <button onClick={() => onSave({ qty, type })} disabled={!qty || saving}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-gray-600 text-sm hover:bg-gray-50">
            Batal
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Produk ──────────────────────────────────────────────────────────────

function TabProduk({ refs }: { refs: Ref }) {
  const qc = useQueryClient()
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [stokTarget, setStokTarget] = useState<Product | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: products = [] } = useQuery({
    queryKey: ['petshop-produk', search],
    queryFn: () => api.get('/petshop/produk', { params: { search: search || undefined } })
      .then((r: any) => r.data.data as Product[]),
  })

  const saveMutation = useMutation({
    mutationFn: (body: any) =>
      editTarget
        ? api.put(`/petshop/produk/${editTarget.id}`, body).then((r: any) => r.data)
        : api.post('/petshop/produk', body).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['petshop-produk'] })
      qc.invalidateQueries({ queryKey: ['petshop-stats'] })
      setShowForm(false); setEditTarget(null)
    },
  })

  const stokMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.post(`/petshop/produk/${id}/stok`, data).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['petshop-produk'] })
      setStokTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/petshop/produk/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['petshop-produk'] }); setDeleteId(null) },
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input className="flex-1 text-sm outline-none placeholder:text-gray-400"
            placeholder="Cari produk..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isAdmin && (
          <button onClick={() => { setEditTarget(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Tambah Produk
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {products.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <div className="font-medium">Belum ada produk</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Produk</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Stok</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Harga Jual</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Harga Modal</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Kadaluarsa</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p) => (
                <tr key={p.id} className={cn('hover:bg-gray-50/50', p.isLowStock && 'bg-amber-50/30')}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800 flex items-center gap-2">
                      {p.itemName}
                      {p.isLowStock && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                    <div className="text-xs text-gray-400">{p.branch?.branchName}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('text-sm font-bold',
                      p.isLowStock ? 'text-amber-600' : 'text-gray-700')}>
                      {p.totalItem}
                    </span>
                    {p.limitItem != null && (
                      <div className="text-xs text-gray-400">min {p.limitItem}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-700">
                    {p.currentPrice ? fmt(p.currentPrice.sellingPrice) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">
                    {p.currentPrice ? fmt(p.currentPrice.capitalPrice) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                    {p.expiredDate ? format(new Date(p.expiredDate), 'd MMM yyyy', { locale: localeId }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {isAdmin && (
                        <>
                          <button onClick={() => setStokTarget(p)}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            title="Mutasi Stok">
                            <BarChart2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => { setEditTarget(p); setShowForm(true) }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteId(p.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(showForm || editTarget) && refs && (
        <ProdukModal
          initial={editTarget} refs={refs}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
          onSave={(d) => saveMutation.mutate(d)}
          saving={saveMutation.isPending}
        />
      )}

      {stokTarget && (
        <StokModal
          product={stokTarget}
          onClose={() => setStokTarget(null)}
          onSave={(d) => stokMutation.mutate({ id: stokTarget.id, data: d })}
          saving={stokMutation.isPending}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-semibold text-gray-800 mb-2">Hapus Produk?</h3>
            <p className="text-sm text-gray-500 mb-5">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3">
              <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium">
                Hapus
              </button>
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Kasir ───────────────────────────────────────────────────────────────

function TabKasir({ refs }: { refs: Ref }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [success, setSuccess] = useState(false)

  const { data: katalog = [] } = useQuery({
    queryKey: ['petshop-katalog', search],
    queryFn: () => api.get('/petshop/katalog', { params: { search: search || undefined } })
      .then((r: any) => r.data.data as Product[]),
  })

  const addToCart = (product: Product) => {
    if (!product.currentPrice) return
    setCart((prev) => {
      const existing = prev.find((c) => c.priceItemPetShopId === product.currentPrice!.id)
      if (existing) {
        return prev.map((c) => c.priceItemPetShopId === product.currentPrice!.id
          ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, {
        priceItemPetShopId: product.currentPrice!.id,
        productId: product.id,
        productName: product.itemName,
        sellingPrice: product.currentPrice!.sellingPrice,
        qty: 1,
        type: 'retail',
      }]
    })
  }

  const updateQty = (priceId: string, delta: number) => {
    setCart((prev) => prev.map((c) => c.priceItemPetShopId === priceId
      ? { ...c, qty: Math.max(1, c.qty + delta) } : c
    ).filter((c) => c.qty > 0))
  }

  const removeFromCart = (priceId: string) => {
    setCart((prev) => prev.filter((c) => c.priceItemPetShopId !== priceId))
  }

  const subtotal = cart.reduce((s, c) => s + c.sellingPrice * c.qty, 0)
  const totalAfterDiscount = subtotal - (Number(discount) || 0)

  const checkoutMutation = useMutation({
    mutationFn: () => api.post('/petshop/transaksi', {
      paymentMethodId: paymentMethodId || undefined,
      discount: Number(discount) || 0,
      items: cart.map((c) => ({ priceItemPetShopId: c.priceItemPetShopId, totalItem: c.qty, type: c.type })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['petshop-transaksi'] })
      qc.invalidateQueries({ queryKey: ['petshop-katalog'] })
      qc.invalidateQueries({ queryKey: ['petshop-produk'] })
      qc.invalidateQueries({ queryKey: ['petshop-stats'] })
      setCart([]); setDiscount(''); setPaymentMethodId(''); setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    },
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* Katalog Produk */}
      <div className="lg:col-span-3 space-y-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input className="flex-1 text-sm outline-none placeholder:text-gray-400"
            placeholder="Cari produk..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {katalog.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <div>Tidak ada produk tersedia</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {katalog.map((p) => {
              const inCart = cart.find((c) => c.priceItemPetShopId === p.currentPrice?.id)
              return (
                <button key={p.id} onClick={() => addToCart(p)}
                  className={cn(
                    'bg-white border rounded-xl p-3 text-left transition-all hover:shadow-md hover:border-indigo-200',
                    inCart ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-100'
                  )}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Package className="w-4 h-4 text-indigo-600" />
                    </div>
                    {inCart && (
                      <span className="text-xs font-bold bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center">
                        {inCart.qty}
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-gray-800 text-sm leading-tight mb-1">{p.itemName}</div>
                  <div className="text-xs text-gray-500 mb-1">Stok: {p.totalItem}</div>
                  <div className="text-sm font-bold text-indigo-600">
                    {p.currentPrice ? fmt(p.currentPrice.sellingPrice) : '—'}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Keranjang */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm sticky top-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-gray-800">Keranjang</span>
            {cart.length > 0 && (
              <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                {cart.length} produk
              </span>
            )}
          </div>

          {success && (
            <div className="mx-4 mt-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4" /> Transaksi berhasil!
            </div>
          )}

          {cart.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <div className="text-sm">Keranjang kosong</div>
            </div>
          ) : (
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.priceItemPetShopId}
                  className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{item.productName}</div>
                    <div className="text-xs text-gray-500">{fmt(item.sellingPrice)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.priceItemPetShopId, -1)}
                      className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold">{item.qty}</span>
                    <button onClick={() => updateQty(item.priceItemPetShopId, 1)}
                      className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-sm font-medium text-indigo-700 w-20 text-right">
                    {fmt(item.sellingPrice * item.qty)}
                  </div>
                  <button onClick={() => removeFromCart(item.priceItemPetShopId)}
                    className="text-gray-300 hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <div className="p-4 border-t border-gray-100 space-y-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium">{fmt(subtotal)}</span>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Diskon (Rp)</label>
                <input type="number" placeholder="0" min={0}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                  value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Metode Bayar</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                  value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
                  <option value="">Pilih metode</option>
                  {refs.paymentMethods.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 flex justify-between items-center">
                <span className="font-semibold text-indigo-700 text-sm">Total</span>
                <span className="font-bold text-indigo-700 text-lg">{fmt(totalAfterDiscount)}</span>
              </div>

              <button
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                {checkoutMutation.isPending ? 'Memproses...' : 'Proses Pembayaran'}
              </button>

              {checkoutMutation.isError && (
                <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  {(checkoutMutation.error as any)?.response?.data?.message ?? 'Terjadi kesalahan'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Riwayat ─────────────────────────────────────────────────────────────

function TabRiwayat() {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ['petshop-transaksi', startDate, endDate],
    queryFn: () => api.get('/petshop/transaksi', { params: { startDate, endDate } })
      .then((r: any) => r.data),
  })

  const transactions: Transaction[] = data?.data ?? []
  const totalRevenue = transactions.reduce((s, t) => s + t.total, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <span className="text-gray-400 text-sm">s/d</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="ml-auto text-sm text-gray-500">
          {transactions.length} transaksi •{' '}
          <span className="font-semibold text-indigo-700">{fmt(totalRevenue)}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {transactions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <div>Tidak ada transaksi</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map((t) => (
              <div key={t.id}>
                <button
                  onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 text-left"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">
                      #{t.id.slice(-6)} — {t.user?.fullname}
                    </div>
                    <div className="text-xs text-gray-400">
                      {format(new Date(t.createdAt), 'd MMM yyyy, HH:mm', { locale: localeId })}
                      {t.user?.branch && ` • ${t.user.branch.branchName}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-indigo-700">{fmt(t.total)}</div>
                    <div className="text-xs text-gray-400">{t.items.length} item</div>
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform',
                    expandedId === t.id && 'rotate-180')} />
                </button>

                {expandedId === t.id && (
                  <div className="px-5 pb-4 bg-gray-50/30">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left py-1.5">Produk</th>
                          <th className="text-center py-1.5">Qty</th>
                          <th className="text-right py-1.5">Harga</th>
                          <th className="text-right py-1.5">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {t.items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-1.5 text-gray-700">{item.product?.itemName ?? '—'}</td>
                            <td className="py-1.5 text-center text-gray-600">{item.totalItem}</td>
                            <td className="py-1.5 text-right text-gray-600">{fmt(item.sellingPrice)}</td>
                            <td className="py-1.5 text-right font-medium text-gray-800">{fmt(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {t.discount > 0 && (
                      <div className="mt-2 text-right text-xs text-gray-500">
                        Diskon: <span className="text-red-500">- {fmt(t.discount)}</span>
                      </div>
                    )}
                    <div className="mt-1.5 text-right text-sm font-bold text-indigo-700">
                      Total: {fmt(t.total)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'kasir', label: 'Kasir', icon: ShoppingCart },
  { id: 'produk', label: 'Produk', icon: Package },
  { id: 'riwayat', label: 'Riwayat', icon: History },
]

export default function PetShopPage() {
  const [activeTab, setActiveTab] = useState('kasir')

  const { data: refs } = useQuery({
    queryKey: ['petshop-ref'],
    queryFn: () => api.get('/petshop/ref').then((r: any) => r.data.data as Ref),
  })

  const { data: stats } = useQuery({
    queryKey: ['petshop-stats'],
    queryFn: () => api.get('/petshop/stats').then((r: any) => r.data.data),
  })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-indigo-600" /> Pet Shop
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Kasir & manajemen produk pet shop</p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon={<Banknote className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50"
          label="Omzet Hari Ini" value={fmt(stats?.today?.revenue ?? 0)}
          sub={`${stats?.today?.count ?? 0} transaksi`} />
        <KpiCard icon={<Banknote className="w-5 h-5 text-indigo-600" />} bg="bg-indigo-50"
          label="Omzet Bulan Ini" value={fmt(stats?.month?.revenue ?? 0)}
          sub={`${stats?.month?.count ?? 0} transaksi`} />
        <KpiCard icon={<Package className="w-5 h-5 text-violet-600" />} bg="bg-violet-50"
          label="Total Produk" value={`${stats?.totalProducts ?? 0} produk`} />
        <KpiCard icon={<AlertTriangle className="w-5 h-5 text-amber-600" />} bg="bg-amber-50"
          label="Stok Menipis" value={`${stats?.lowStock ?? 0} produk`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'kasir' && refs && <TabKasir refs={refs} />}
      {activeTab === 'produk' && refs && <TabProduk refs={refs} />}
      {activeTab === 'riwayat' && <TabRiwayat />}
    </div>
  )
}
