import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
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
import { Badge, BadgeVariant } from '../../components/Badge'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface ReviewItem {
  id: string
  rating?: number
  comment?: string
  isPublished: boolean
  sentAt?: string
  repliedAt?: string
  patient: { petName: string }
  doctor: { fullname: string }
}

interface Stats {
  avgRating: number
  total: number
  alertCount: number
  starDistribution: Record<string, number>
  byDoctor: { doctorName: string; avgRating: number; count: number }[]
}

const RATING_FILTERS = [
  { label: 'Semua', min: undefined, max: undefined },
  { label: '≤2⭐ (Perlu Follow-up)', min: 1, max: 2 },
  { label: '3⭐', min: 3, max: 3 },
  { label: '4-5⭐', min: 4, max: 5 },
]

const stars = (n?: number) => (n ? '⭐'.repeat(n) : '-')

export default function ReviewScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [tab, setTab] = useState<'list' | 'stats'>('list')
  const [ratingFilterIdx, setRatingFilterIdx] = useState(0)
  const [onlyRated, setOnlyRated] = useState(true)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  const filter = RATING_FILTERS[ratingFilterIdx]

  const fetchList = useCallback(async () => {
    const res = await api.get('/review/list', {
      params: { minRating: filter.min, maxRating: filter.max, onlyRated: onlyRated ? 'true' : undefined, limit: 30 },
    })
    setItems(res.data.data)
  }, [filter, onlyRated])

  useEffect(() => {
    if (tab !== 'list') return
    setLoading(true)
    fetchList().finally(() => setLoading(false))
  }, [tab, fetchList])

  const fetchStats = useCallback(() => api.get('/review/stats').then((res) => setStats(res.data.data)), [])
  useEffect(() => {
    if (tab !== 'stats') return
    setLoadingStats(true)
    fetchStats().finally(() => setLoadingStats(false))
  }, [tab, fetchStats])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchList()
    setRefreshing(false)
  }

  const togglePublish = async (item: ReviewItem) => {
    try {
      await api.patch(`/review/${item.id}/publish`, { isPublished: !item.isPublished })
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isPublished: !i.isPublished } : i)))
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Ulasan Pelanggan</Text>
        <View style={styles.tabRow}>
          {(['list', 'stats'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'list' ? 'Daftar Ulasan' : 'Statistik'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === 'list' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
            {RATING_FILTERS.map((f, idx) => (
              <TouchableOpacity key={f.label} onPress={() => setRatingFilterIdx(idx)} style={[styles.filterChip, ratingFilterIdx === idx && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, ratingFilterIdx === idx && styles.filterChipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setOnlyRated((v) => !v)} style={[styles.filterChip, onlyRated && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, onlyRated && styles.filterChipTextActive]}>Hanya yang sudah dinilai</Text>
            </TouchableOpacity>
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
                  <Text style={{ fontSize: 32 }}>⭐</Text>
                  <Text style={styles.emptyText}>Belum ada ulasan untuk filter ini</Text>
                </View>
              }
              renderItem={({ item }) => {
                const needsFollowUp = !!item.rating && item.rating <= 2
                return (
                  <View style={[styles.card, needsFollowUp && styles.cardAlert]}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.starsText}>{stars(item.rating)}</Text>
                      {needsFollowUp && <Badge variant="red">Perlu Follow-up</Badge>}
                      {item.isPublished && <Badge variant="green">Dipublikasikan</Badge>}
                    </View>
                    <Text style={styles.petName}>{item.patient.petName}</Text>
                    <Text style={styles.rowMeta}>Dokter: {item.doctor.fullname}</Text>
                    {item.comment && <Text style={styles.commentText}>"{item.comment}"</Text>}
                    {item.repliedAt && (
                      <Text style={styles.rowMeta}>Dinilai: {format(new Date(item.repliedAt), 'd MMM yyyy', { locale: localeId })}</Text>
                    )}
                    {item.rating != null && (
                      <TouchableOpacity style={styles.publishBtn} onPress={() => togglePublish(item)}>
                        <Text style={styles.publishBtnText}>{item.isPublished ? 'Batalkan Publikasi' : 'Publikasikan'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )
              }}
            />
          )}
        </>
      ) : loadingStats ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.orange} size="large" />
        </View>
      ) : stats ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.avgRating.toFixed(1)}⭐</Text>
              <Text style={styles.statLabel}>Rata-rata</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total Ulasan</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, stats.alertCount > 0 && { color: colors.red }]}>{stats.alertCount}</Text>
              <Text style={styles.statLabel}>Perlu Follow-up</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Distribusi Rating</Text>
            {[5, 4, 3, 2, 1].map((n) => (
              <View key={n} style={styles.distRow}>
                <Text style={styles.distLabel}>{n}⭐</Text>
                <View style={styles.distBarBg}>
                  <View style={[styles.distBarFill, { width: `${stats.total ? ((stats.starDistribution[n] ?? 0) / stats.total) * 100 : 0}%` }]} />
                </View>
                <Text style={styles.distCount}>{stats.starDistribution[n] ?? 0}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Per Dokter</Text>
            {stats.byDoctor.map((d) => (
              <View key={d.doctorName} style={styles.lineRow}>
                <Text style={styles.rowMeta}>{d.doctorName} ({d.count})</Text>
                <Text style={styles.bodyText}>{d.avgRating.toFixed(1)}⭐</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  header: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 8 },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.orangeDk },
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark, marginBottom: 12 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  tabBtnActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  tabTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexGrow: 0, marginVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  filterChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  filterChipTextActive: { color: '#fff' },
  listContent: { padding: 18, paddingTop: 4, paddingBottom: 40 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 },
  cardAlert: { borderColor: colors.red },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  starsText: { fontSize: 14 },
  petName: { fontSize: 14, fontWeight: '800', color: colors.textDark, marginTop: 6 },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  commentText: { fontSize: 13, fontWeight: '500', color: colors.textMid, marginTop: 6, fontStyle: 'italic' },
  publishBtn: { backgroundColor: colors.teal, paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  publishBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.textDark },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textSoft, marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark, marginBottom: 10 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  distLabel: { fontSize: 12, fontWeight: '700', color: colors.textMid, width: 28 },
  distBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.warmBg, overflow: 'hidden' },
  distBarFill: { height: 8, borderRadius: 4, backgroundColor: colors.yellow },
  distCount: { fontSize: 12, fontWeight: '700', color: colors.textDark, width: 24, textAlign: 'right' },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  bodyText: { fontSize: 13, fontWeight: '700', color: colors.textDark },
})
