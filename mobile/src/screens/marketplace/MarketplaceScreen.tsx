import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, ScrollView, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface Order {
  id: string
  orderId: string
  platform: string
  customerName: string
  totalAmount: string
  status: string
  orderDate: string
  integration: { platform: string; shopName: string }
}

interface Stats {
  connectedPlatforms: number
  totalOrders: number
  pendingOrders: number
  totalRevenue: number
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Menunggu', bg: colors.yellowLt, color: colors.orangeDk },
  processing: { label: 'Diproses', bg: colors.blueLt, color: colors.blue },
  shipped: { label: 'Dikirim', bg: colors.purpleLt, color: colors.purple },
  done: { label: 'Selesai', bg: colors.greenLt, color: colors.green },
  cancelled: { label: 'Dibatalkan', bg: colors.redLt, color: colors.red },
}

const STATUS_FILTERS = ['all', 'pending', 'processing', 'shipped', 'done', 'cancelled'] as const

const PLATFORM_LABEL: Record<string, string> = { tokopedia: 'TOKOPEDIA', shopee: 'SHOPEE' }

const fmt = (n: number | string) =>
  Number(n).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function MarketplaceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [stats, setStats] = useState<Stats | null>(null)
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('all')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)

  const fetchStats = useCallback(() => api.get('/marketplace/stats').then((res) => setStats(res.data.data)), [])

  const fetchOrders = useCallback(async () => {
    const res = await api.get('/marketplace/orders', { params: { status: statusFilter === 'all' ? undefined : statusFilter, limit: 50 } })
    setOrders(res.data.data)
  }, [statusFilter])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchStats(), fetchOrders()]).finally(() => setLoading(false))
  }, [fetchStats, fetchOrders])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchStats(), fetchOrders()])
    setRefreshing(false)
  }

  const updateStatus = async (id: string, status: string) => {
    setActingId(id)
    try {
      await api.patch(`/marketplace/orders/${id}`, { status })
      await Promise.all([fetchStats(), fetchOrders()])
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setActingId(null)
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Marketplace</Text>
      </View>

      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.connectedPlatforms}</Text>
            <Text style={styles.statLabel}>Toko Terhubung</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.pendingOrders}</Text>
            <Text style={styles.statLabel}>Menunggu</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{fmt(stats.totalRevenue)}</Text>
            <Text style={styles.statLabel}>Pendapatan</Text>
          </View>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
        {STATUS_FILTERS.map((s) => (
          <TouchableOpacity key={s} onPress={() => setStatusFilter(s)} style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
              {s === 'all' ? 'Semua' : STATUS_LABEL[s]?.label}
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
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 32 }}>🛒</Text>
              <Text style={styles.emptyText}>Tidak ada pesanan untuk filter ini</Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.pending
            const busy = actingId === item.id
            return (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.platformBadge}>
                    <Text style={styles.platformBadgeText}>{PLATFORM_LABEL[item.platform] ?? item.platform.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.orderId}>{item.orderId}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                <Text style={styles.customerName}>{item.customerName}</Text>
                <Text style={styles.rowMeta}>{format(new Date(item.orderDate), 'd MMM yyyy', { locale: localeId })} · {item.integration.shopName}</Text>
                <View style={styles.cardFooterRow}>
                  <Text style={styles.amountText}>{fmt(item.totalAmount)}</Text>
                  {busy ? (
                    <ActivityIndicator color={colors.orange} size="small" />
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {item.status === 'pending' && (
                        <>
                          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.blueLt }]} onPress={() => updateStatus(item.id, 'processing')}>
                            <Text style={[styles.actionBtnText, { color: colors.blue }]}>Proses</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.redLt }]} onPress={() => updateStatus(item.id, 'cancelled')}>
                            <Text style={[styles.actionBtnText, { color: colors.red }]}>Batalkan</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {item.status === 'processing' && (
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.purpleLt }]} onPress={() => updateStatus(item.id, 'shipped')}>
                          <Text style={[styles.actionBtnText, { color: colors.purple }]}>Kirim</Text>
                        </TouchableOpacity>
                      )}
                      {item.status === 'shipped' && (
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.greenLt }]} onPress={() => updateStatus(item.id, 'done')}>
                          <Text style={[styles.actionBtnText, { color: colors.green }]}>Selesai</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
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
  listContent: { padding: 18, paddingTop: 4, paddingBottom: 24 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  platformBadge: { backgroundColor: colors.tealLt, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  platformBadgeText: { fontSize: 9, fontWeight: '800', color: colors.teal },
  orderId: { fontSize: 11, fontWeight: '600', color: colors.textSoft, flex: 1 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  customerName: { fontSize: 14, fontWeight: '800', color: colors.textDark, marginTop: 8 },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  amountText: { fontSize: 14, fontWeight: '800', color: colors.textDark },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionBtnText: { fontSize: 11, fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft, textAlign: 'center' },
})
