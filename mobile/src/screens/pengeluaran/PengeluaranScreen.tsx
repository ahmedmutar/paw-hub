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
  ScrollView,
  Modal,
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface Expense {
  id: string
  dateSpend: string
  category: string
  itemName: string
  notes?: string
  quantity: string
  amount: string
  amountOverall: string
  spender: { fullname: string }
}

interface Stats {
  today: { total: number; count: number }
  thisMonth: { total: number; count: number }
  growthPct: string | null
}

const fmt = (n: number | string) =>
  Number(n).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function PengeluaranScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [categories, setCategories] = useState<string[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [items, setItems] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [addVisible, setAddVisible] = useState(false)

  useEffect(() => {
    api.get('/pengeluaran/categories').then((res) => setCategories(res.data.data))
  }, [])

  const fetchStats = useCallback(() => api.get('/pengeluaran/stats').then((res) => setStats(res.data.data)), [])

  const fetchList = useCallback(async () => {
    const res = await api.get('/pengeluaran', { params: { category: categoryFilter || undefined, limit: 50 } })
    setItems(res.data.data)
  }, [categoryFilter])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchStats(), fetchList()]).finally(() => setLoading(false))
  }, [fetchStats, fetchList])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchStats(), fetchList()])
    setRefreshing(false)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pengeluaran</Text>
      </View>

      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{fmt(stats.today.total)}</Text>
            <Text style={styles.statLabel}>Hari Ini ({stats.today.count})</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{fmt(stats.thisMonth.total)}</Text>
            <Text style={styles.statLabel}>Bulan Ini ({stats.thisMonth.count})</Text>
          </View>
          {stats.growthPct !== null && (
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: Number(stats.growthPct) >= 0 ? colors.red : colors.green }]}>
                {Number(stats.growthPct) >= 0 ? '▲' : '▼'} {Math.abs(Number(stats.growthPct)).toFixed(1)}%
              </Text>
              <Text style={styles.statLabel}>vs Bulan Lalu</Text>
            </View>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
        <TouchableOpacity onPress={() => setCategoryFilter(null)} style={[styles.filterChip, !categoryFilter && styles.filterChipActive]}>
          <Text style={[styles.filterChipText, !categoryFilter && styles.filterChipTextActive]}>Semua</Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity key={c} onPress={() => setCategoryFilter(c)} style={[styles.filterChip, categoryFilter === c && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, categoryFilter === c && styles.filterChipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 32 }}>💸</Text>
              <Text style={styles.emptyText}>Belum ada pengeluaran untuk filter ini</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.itemName}>{item.itemName}</Text>
                <Text style={styles.amountText}>{fmt(item.amountOverall)}</Text>
              </View>
              <Text style={styles.rowMeta}>{item.category} · {format(new Date(item.dateSpend), 'd MMM yyyy', { locale: localeId })}</Text>
              <Text style={styles.rowMeta}>{item.quantity} × {fmt(item.amount)} · dicatat oleh {item.spender.fullname}</Text>
              {item.notes && <Text style={styles.rowMeta}>{item.notes}</Text>}
            </View>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setAddVisible(true)}>
        <Text style={styles.fabText}>+ Catat Pengeluaran</Text>
      </TouchableOpacity>

      <AddExpenseModal
        categories={categories}
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onSuccess={() => {
          setAddVisible(false)
          fetchStats()
          fetchList()
        }}
      />
    </View>
  )
}

function AddExpenseModal({
  categories,
  visible,
  onClose,
  onSuccess,
}: {
  categories: string[]
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [category, setCategory] = useState('')
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) return
    setCategory(categories[0] ?? '')
    setItemName('')
    setQuantity('1')
    setAmount('')
    setNotes('')
  }, [visible, categories])

  const total = (Number(quantity) || 0) * (Number(amount) || 0)
  const canSubmit = itemName.trim() && Number(quantity) > 0 && Number(amount) > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await api.post('/pengeluaran', {
        category,
        itemName: itemName.trim(),
        quantity,
        amount,
        notes: notes || undefined,
      })
      onSuccess()
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.backText}>✕ Batal</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Catat Pengeluaran</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.label}>Kategori</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {categories.map((c) => (
              <TouchableOpacity key={c} style={[styles.typeChip, category === c && styles.typeChipActive]} onPress={() => setCategory(c)}>
                <Text style={[styles.typeChipText, category === c && styles.typeChipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { marginTop: 16 }]}>Nama Item / Keterangan</Text>
          <TextInput style={styles.input} value={itemName} onChangeText={setItemName} placeholder="Contoh: Isi ulang gas oksigen" placeholderTextColor={colors.textSoft} />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Jumlah</Text>
              <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholderTextColor={colors.textSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Harga Satuan (Rp)</Text>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSoft} />
            </View>
          </View>

          {total > 0 && (
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{fmt(total)}</Text>
            </View>
          )}

          <Text style={[styles.label, { marginTop: 12 }]}>Catatan (opsional)</Text>
          <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={colors.textSoft} />

          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || submitting) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Simpan</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  header: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 4 },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.orangeDk },
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 12, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  statValue: { fontSize: 13, fontWeight: '800', color: colors.textDark },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textSoft, marginTop: 2, textAlign: 'center' },
  filterRow: { flexGrow: 0, marginVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  filterChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  filterChipTextActive: { color: '#fff' },
  listContent: { padding: 18, paddingTop: 4, paddingBottom: 90 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  itemName: { fontSize: 14, fontWeight: '800', color: colors.textDark, flexShrink: 1 },
  amountText: { fontSize: 14, fontWeight: '800', color: colors.red },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 24, right: 18, backgroundColor: colors.orange, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 999, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  modalScreen: { flex: 1, backgroundColor: colors.warmBg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 18, paddingBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textDark },
  modalContent: { padding: 18, paddingTop: 4, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMid, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  row2: { flexDirection: 'row', gap: 12, marginTop: 12 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, marginRight: 8 },
  typeChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  typeChipText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  typeChipTextActive: { color: '#fff' },
  totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.redLt, borderRadius: 12, padding: 14, marginTop: 14 },
  totalLabel: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  totalValue: { fontSize: 16, fontWeight: '800', color: colors.red },
  submitBtn: { backgroundColor: colors.orange, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
