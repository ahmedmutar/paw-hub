import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import { SearchBar } from '../../components/SearchBar'
import type { AppointmentStackParamList } from '../../navigation/RootNavigator'

interface Appointment {
  id: string
  ownerName: string
  ownerPhone: string
  petName: string
  petCategory?: string
  complaint: string
  status: string
  appointmentDate: string
  appointmentTime: string
  doctor?: { fullname: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  confirmed: 'Dikonfirmasi',
  rescheduled: 'Dijadwal Ulang',
  converted: 'Selesai',
  declined: 'Ditolak',
  cancelled: 'Dibatalkan',
}

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: 'yellow',
  confirmed: 'blue',
  rescheduled: 'purple',
  converted: 'green',
  declined: 'red',
  cancelled: 'gray',
}

const FILTERS = ['semua', 'pending', 'confirmed', 'rescheduled', 'converted', 'declined', 'cancelled']

export default function AppointmentListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppointmentStackParamList>>()
  const [items, setItems] = useState<Appointment[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('semua')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      const res = await api.get('/appointment', {
        params: {
          page: pageNum,
          limit: 20,
          search: search || undefined,
          status: statusFilter === 'semua' ? undefined : statusFilter,
        },
      })
      const { data, meta } = res.data
      setItems((prev) => (append ? [...prev, ...data] : data))
      setTotalPages(meta.totalPages)
      setPage(meta.page)
    },
    [search, statusFilter]
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
        <Text style={styles.title}>Janji Temu</Text>
      </View>
      <View style={styles.content}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Cari nama pemilik, hewan, no. HP..." />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setStatusFilter(f)}
            style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>
              {f === 'semua' ? 'Semua' : STATUS_LABEL[f]}
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
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 32 }}>📅</Text>
              <Text style={styles.emptyText}>Tidak ada janji temu</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 12 }} color={colors.orange} /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('AppointmentDetail', { id: item.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.petName}>
                  {item.petName} · {item.ownerName}
                </Text>
                <Text style={styles.rowMeta}>
                  {format(new Date(item.appointmentDate), 'd MMM yyyy', { locale: localeId })} · {item.appointmentTime}
                </Text>
                {item.doctor && <Text style={styles.rowMeta}>{item.doctor.fullname}</Text>}
              </View>
              <Badge variant={STATUS_VARIANT[item.status] ?? 'gray'}>{STATUS_LABEL[item.status] ?? item.status}</Badge>
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
  filterRow: { flexGrow: 0, marginBottom: 12 },
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
  petName: { fontSize: 14, fontWeight: '700', color: colors.textDark },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 3 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
