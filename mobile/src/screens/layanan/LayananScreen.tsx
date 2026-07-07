import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge } from '../../components/Badge'
import { SearchBar } from '../../components/SearchBar'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface Category {
  id: string
  categoryName: string
  _count: { listOfServices: number }
}

interface Service {
  id: string
  serviceName: string
  description?: string
  durationMinutes?: number
  isActive: boolean
  serviceCategory: { id: string; categoryName: string }
  priceServices: { sellingPrice: string }[]
}

const fmt = (n: string | number) =>
  Number(n).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function LayananScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    api.get('/layanan/kategori').then((res) => setCategories(res.data.data))
  }, [])

  const fetchList = useCallback(async () => {
    const res = await api.get('/layanan', {
      params: { search: search || undefined, categoryId: categoryId || undefined, limit: 100 },
    })
    setItems(res.data.data)
  }, [search, categoryId])

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
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Layanan</Text>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Cari nama layanan..." />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
        <TouchableOpacity onPress={() => setCategoryId(null)} style={[styles.filterChip, !categoryId && styles.filterChipActive]}>
          <Text style={[styles.filterChipText, !categoryId && styles.filterChipTextActive]}>Semua Kategori</Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity key={c.id} onPress={() => setCategoryId(c.id)} style={[styles.filterChip, categoryId === c.id && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, categoryId === c.id && styles.filterChipTextActive]}>
              {c.categoryName} ({c._count.listOfServices})
            </Text>
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
              <Text style={{ fontSize: 32 }}>🩺</Text>
              <Text style={styles.emptyText}>Tidak ada layanan untuk filter ini</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.serviceName}>{item.serviceName}</Text>
                {!item.isActive && <Badge variant="gray">Nonaktif</Badge>}
              </View>
              <Text style={styles.rowMeta}>{item.serviceCategory.categoryName}{item.durationMinutes ? ` · ${item.durationMinutes} menit` : ''}</Text>
              {item.description && <Text style={styles.rowMeta} numberOfLines={2}>{item.description}</Text>}
              <Text style={styles.priceText}>
                {item.priceServices[0] ? fmt(item.priceServices[0].sellingPrice) : 'Belum ada harga'}
              </Text>
            </View>
          )}
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
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  searchWrap: { paddingHorizontal: 18, marginTop: 12, marginBottom: -4 },
  filterRow: { flexGrow: 0, marginVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  filterChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  filterChipTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 18, paddingTop: 4, paddingBottom: 24 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  serviceName: { fontSize: 14, fontWeight: '800', color: colors.textDark, flexShrink: 1 },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  priceText: { fontSize: 15, fontWeight: '800', color: colors.orangeDk, marginTop: 8 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft, textAlign: 'center' },
})
