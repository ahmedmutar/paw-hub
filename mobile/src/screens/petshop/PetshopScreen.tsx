import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge } from '../../components/Badge'
import { SearchBar } from '../../components/SearchBar'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface Product {
  id: string
  itemName: string
  totalItem: number
  limitItem: number | null
  isLowStock: boolean
  currentPrice: { id: string; sellingPrice: number } | null
}

interface Stats {
  today: { revenue: number; count: number }
  month: { revenue: number; count: number }
  totalProducts: number
  lowStock: number
}

interface PaymentMethod { id: string; name: string }

interface Transaction {
  id: string
  total: number
  discount: number
  items: { itemName?: string; product?: { itemName: string }; totalItem: number }[]
  user: { fullname: string } | null
  createdAt: string
}

interface CartItem {
  priceItemPetShopId: string
  itemName: string
  sellingPrice: number
  qty: number
  stock: number
}

const fmt = (n: number | string) =>
  Number(n).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

const TABS = [
  { id: 'kasir', label: 'Kasir' },
  { id: 'produk', label: 'Produk' },
  { id: 'riwayat', label: 'Riwayat' },
] as const

export default function PetshopScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [tab, setTab] = useState<typeof TABS[number]['id']>('kasir')
  const [stats, setStats] = useState<Stats | null>(null)

  const fetchStats = useCallback(() => api.get('/petshop/stats').then((res) => setStats(res.data.data)), [])
  useEffect(() => { fetchStats() }, [fetchStats])

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pet Shop</Text>
      </View>

      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{fmt(stats.today.revenue)}</Text>
            <Text style={styles.statLabel}>Omzet Hari Ini</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalProducts}</Text>
            <Text style={styles.statLabel}>Total Produk</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, stats.lowStock > 0 && { color: colors.red }]}>{stats.lowStock}</Text>
            <Text style={styles.statLabel}>Stok Menipis</Text>
          </View>
        </View>
      )}

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => setTab(t.id)} style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === t.id && styles.tabBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'kasir' && <KasirTab onCheckoutDone={fetchStats} />}
      {tab === 'produk' && <ProdukTab />}
      {tab === 'riwayat' && <RiwayatTab />}
    </View>
  )
}

function KasirTab({ onCheckoutDone }: { onCheckoutDone: () => void }) {
  const [search, setSearch] = useState('')
  const [katalog, setKatalog] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState('')
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)

  const fetchKatalog = useCallback(async () => {
    const res = await api.get('/petshop/katalog', { params: { search: search || undefined } })
    setKatalog(res.data.data)
  }, [search])

  useEffect(() => {
    setLoading(true)
    fetchKatalog().finally(() => setLoading(false))
  }, [fetchKatalog])

  useEffect(() => {
    api.get('/petshop/ref').then((res) => setPaymentMethods(res.data.data.paymentMethods))
  }, [])

  const addToCart = (p: Product) => {
    if (!p.currentPrice) return
    setCart((prev) => {
      const existing = prev.find((c) => c.priceItemPetShopId === p.currentPrice!.id)
      if (existing) {
        if (existing.qty >= p.totalItem) return prev
        return prev.map((c) => (c.priceItemPetShopId === p.currentPrice!.id ? { ...c, qty: c.qty + 1 } : c))
      }
      return [...prev, { priceItemPetShopId: p.currentPrice!.id, itemName: p.itemName, sellingPrice: p.currentPrice!.sellingPrice, qty: 1, stock: p.totalItem }]
    })
  }

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.priceItemPetShopId === id ? { ...c, qty: Math.min(c.stock, Math.max(0, c.qty + delta)) } : c))
        .filter((c) => c.qty > 0)
    )
  }

  const subtotal = cart.reduce((s, c) => s + c.sellingPrice * c.qty, 0)
  const total = Math.max(0, subtotal - (Number(discount) || 0))

  const handleCheckout = async () => {
    if (!cart.length) return
    setCheckingOut(true)
    try {
      await api.post('/petshop/transaksi', {
        paymentMethodId: paymentMethodId ?? undefined,
        discount: Number(discount) || 0,
        items: cart.map((c) => ({ priceItemPetShopId: c.priceItemPetShopId, totalItem: c.qty, type: 'retail' })),
      })
      setCart([])
      setDiscount('')
      Alert.alert('Berhasil', 'Transaksi berhasil dibuat.')
      fetchKatalog()
      onCheckoutDone()
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 18 }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Cari produk..." />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.orange} size="large" />
        </View>
      ) : (
        <FlatList
          data={katalog}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>Tidak ada produk dengan stok tersedia</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.katalogCard} onPress={() => addToCart(item)} disabled={!item.currentPrice}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.itemName}</Text>
                <Text style={styles.rowMeta}>Stok: {item.totalItem} · {item.currentPrice ? fmt(item.currentPrice.sellingPrice) : 'Belum ada harga'}</Text>
              </View>
              <Text style={styles.addBtn}>+ Tambah</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {cart.length > 0 && (
        <View style={styles.cartBox}>
          <FlatList
            data={cart}
            keyExtractor={(c) => c.priceItemPetShopId}
            style={{ maxHeight: 140 }}
            renderItem={({ item }) => (
              <View style={styles.cartRow}>
                <Text style={styles.cartItemName} numberOfLines={1}>{item.itemName}</Text>
                <View style={styles.qtyControl}>
                  <TouchableOpacity onPress={() => changeQty(item.priceItemPetShopId, -1)} style={styles.qtyBtn}>
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.qty}</Text>
                  <TouchableOpacity onPress={() => changeQty(item.priceItemPetShopId, 1)} style={styles.qtyBtn}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.cartLineTotal}>{fmt(item.sellingPrice * item.qty)}</Text>
              </View>
            )}
          />
          <View style={styles.discountRow}>
            <Text style={styles.label}>Diskon (Rp)</Text>
            <TextInput style={styles.discountInput} value={discount} onChangeText={setDiscount} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSoft} />
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{fmt(total)}</Text>
          </View>
          <TouchableOpacity style={[styles.checkoutBtn, checkingOut && { opacity: 0.6 }]} onPress={handleCheckout} disabled={checkingOut}>
            {checkingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutBtnText}>Bayar Sekarang</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

function ProdukTab() {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchList = useCallback(async () => {
    const res = await api.get('/petshop/produk', { params: { search: search || undefined } })
    setItems(res.data.data)
  }, [search])

  useEffect(() => {
    setLoading(true)
    fetchList().finally(() => setLoading(false))
  }, [fetchList])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchList()
    setRefreshing(false)
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 18 }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Cari produk..." />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.orange} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Tidak ada produk</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.itemName}>{item.itemName}</Text>
                {item.isLowStock && <Badge variant="red">Stok Menipis</Badge>}
              </View>
              <Text style={styles.rowMeta}>Stok: {item.totalItem}{item.limitItem !== null ? ` (min. ${item.limitItem})` : ''}</Text>
              <Text style={styles.priceText}>{item.currentPrice ? fmt(item.currentPrice.sellingPrice) : 'Belum ada harga'}</Text>
            </View>
          )}
        />
      )}
    </View>
  )
}

function RiwayatTab() {
  const [items, setItems] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchList = useCallback(async () => {
    const res = await api.get('/petshop/transaksi', { params: { limit: 30 } })
    setItems(res.data.data)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchList().finally(() => setLoading(false))
  }, [fetchList])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchList()
    setRefreshing(false)
  }

  return loading ? (
    <View style={styles.center}>
      <ActivityIndicator color={colors.orange} size="large" />
    </View>
  ) : (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
      ListEmptyComponent={<Text style={styles.emptyText}>Belum ada transaksi</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.itemName}>{item.items.length} item</Text>
            <Text style={styles.amountText}>{fmt(item.total)}</Text>
          </View>
          <Text style={styles.rowMeta}>{format(new Date(item.createdAt), 'd MMM yyyy HH:mm', { locale: localeId })}{item.user ? ` · ${item.user.fullname}` : ''}</Text>
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  header: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 4 },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.orangeDk },
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 12, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  statValue: { fontSize: 13, fontWeight: '800', color: colors.textDark },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textSoft, marginTop: 2, textAlign: 'center' },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginVertical: 12 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  tabBtnTextActive: { color: '#fff' },
  listContent: { padding: 18, paddingTop: 4, paddingBottom: 24 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  itemName: { fontSize: 14, fontWeight: '800', color: colors.textDark, flexShrink: 1 },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  priceText: { fontSize: 15, fontWeight: '800', color: colors.orangeDk, marginTop: 8 },
  amountText: { fontSize: 14, fontWeight: '800', color: colors.textDark },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft, textAlign: 'center', paddingVertical: 40 },
  katalogCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 8,
  },
  addBtn: { fontSize: 12, fontWeight: '700', color: colors.orangeDk },
  cartBox: {
    backgroundColor: colors.card,
    borderTopWidth: 1.5,
    borderTopColor: colors.border,
    padding: 14,
    paddingBottom: 24,
  },
  cartRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  cartItemName: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.textDark },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.warmBg, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 15, fontWeight: '800', color: colors.orangeDk },
  qtyValue: { fontSize: 12, fontWeight: '700', color: colors.textDark, minWidth: 18, textAlign: 'center' },
  cartLineTotal: { fontSize: 12, fontWeight: '700', color: colors.textDark, minWidth: 80, textAlign: 'right' },
  discountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  discountInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
    width: 110,
    textAlign: 'right',
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  totalLabel: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  totalValue: { fontSize: 17, fontWeight: '800', color: colors.orangeDk },
  checkoutBtn: { backgroundColor: colors.orange, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  checkoutBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
