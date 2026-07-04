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
import { SearchBar } from '../../components/SearchBar'
import type { PasienStackParamList } from '../../navigation/RootNavigator'

interface Patient {
  id: string
  idMember: string
  petCategory: string
  petName: string
  petGender?: string
  owner: { ownerName: string; phoneNumber?: string }
  _count?: { registrations: number }
}

const categoryEmoji: Record<string, string> = {
  Anjing: '🐶',
  Kucing: '🐱',
  Kelinci: '🐰',
  Burung: '🐦',
}

export default function PasienListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<PasienStackParamList>>()
  const [items, setItems] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPage = useCallback(async (pageNum: number, searchTerm: string, append: boolean) => {
    const res = await api.get('/pasien', { params: { page: pageNum, limit: 20, search: searchTerm || undefined } })
    const { data, meta } = res.data
    setItems((prev) => (append ? [...prev, ...data] : data))
    setTotalPages(meta.totalPages)
    setPage(meta.page)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchPage(1, search, false).finally(() => setLoading(false))
  }, [search, fetchPage])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchPage(1, search, false)
    setRefreshing(false)
  }

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return
    setLoadingMore(true)
    await fetchPage(page + 1, search, true)
    setLoadingMore(false)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Pasien</Text>
      </View>
      <View style={styles.content}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Cari nama hewan, pemilik, no. HP..." />
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
              <Text style={{ fontSize: 32 }}>🐾</Text>
              <Text style={styles.emptyText}>
                {search ? 'Tidak ada pasien yang cocok' : 'Belum ada pasien terdaftar'}
              </Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 12 }} color={colors.orange} /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('PasienDetail', { id: item.id })}
            >
              <View style={styles.avatar}>
                <Text style={{ fontSize: 20 }}>{categoryEmoji[item.petCategory] ?? '🐾'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.petName}>{item.petName}</Text>
                <Text style={styles.ownerName}>{item.owner.ownerName}</Text>
              </View>
              <Text style={styles.idMember}>{item.idMember}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  header: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  content: { paddingHorizontal: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 18, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.orangeLt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petName: { fontSize: 14, fontWeight: '700', color: colors.textDark },
  ownerName: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  idMember: { fontSize: 11, fontWeight: '700', color: colors.textSoft },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
