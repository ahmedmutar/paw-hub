import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge } from '../../components/Badge'
import { SearchBar } from '../../components/SearchBar'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface GudangItem {
  id: string
  itemName: string
  totalItem: number
  limitItem?: number
  unitItem?: { unitName: string }
  categoryItem?: { categoryName: string }
}

const FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'low', label: 'Menipis' },
  { key: 'out', label: 'Habis' },
]

export default function GudangListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [items, setItems] = useState<GudangItem[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      const res = await api.get('/gudang/barang', {
        params: { page: pageNum, limit: 20, q: search || undefined, status: status === 'all' ? undefined : status },
      })
      const { data, total, limit } = res.data
      setItems((prev) => (append ? [...prev, ...data] : data))
      setTotalPages(Math.max(Math.ceil(total / limit), 1))
      setPage(pageNum)
    },
    [search, status]
  )

  useEffect(() => {
    setLoading(true)
    fetchPage(1, false).finally(() => setLoading(false))
  }, [fetchPage])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchPage(1, false)
    setRefreshing(false)
  }

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return
    setLoadingMore(true)
    await fetchPage(page + 1, true)
    setLoadingMore(false)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Gudang</Text>
          <TouchableOpacity style={styles.scanBtn} onPress={() => navigation.navigate('BarcodeScan')}>
            <Text style={styles.scanBtnText}>📷 Scan</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Cari nama item..." />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setStatus(f.key)}
            style={[styles.filterChip, status === f.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, status === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
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
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 32 }}>📦</Text>
              <Text style={styles.emptyText}>Tidak ada item ditemukan</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 12 }} color={colors.orange} /> : null}
          renderItem={({ item }) => {
            const isOut = Number(item.totalItem) <= 0
            const isLow = item.limitItem != null && Number(item.totalItem) <= Number(item.limitItem)
            return (
              <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('GudangDetail', { id: item.id })}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.itemName}</Text>
                  <Text style={styles.itemMeta}>{item.categoryItem?.categoryName ?? '-'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.stockValue}>
                    {item.totalItem} {item.unitItem?.unitName ?? ''}
                  </Text>
                  {(isOut || isLow) && <Badge variant={isOut ? 'red' : 'yellow'}>{isOut ? 'Habis' : 'Menipis'}</Badge>}
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  header: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 4 },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.orangeDk },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  scanBtn: { backgroundColor: colors.orange, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  content: { paddingHorizontal: 18 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  filterChipTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 18, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 10,
  },
  itemName: { fontSize: 14, fontWeight: '700', color: colors.textDark },
  itemMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  stockValue: { fontSize: 13, fontWeight: '800', color: colors.textDark, marginBottom: 4 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
