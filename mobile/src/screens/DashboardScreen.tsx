import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth.store'
import { colors } from '../theme'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface DashboardStats {
  today: {
    registrations: number
    activeQueue: number
    checkups: number
    pendingKasir: number
    revenue: number
    transactions: number
  }
  month: { revenue: number; transactions: number }
  lowStock: { id: string; itemName: string; totalItem: string; limitItem: string }[]
}

const fmt = (n: number) =>
  n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { user, logout } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useFocusEffect(
    useCallback(() => {
      api
        .get('/notifications/unread-count')
        .then((res) => setUnreadCount(res.data.data.count))
        .catch(() => {})
    }, [])
  )

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/stats')
      setStats(res.data.data)
    } catch {
      // biarkan tampilan lama, hindari flash error saat refresh gagal sementara
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchStats().finally(() => setLoading(false))
  }, [fetchStats])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchStats()
    setRefreshing(false)
  }

  const hour = new Date().getHours()
  const greeting = hour < 11 ? 'Pagi' : hour < 15 ? 'Siang' : hour < 18 ? 'Sore' : 'Malam'

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>Selamat {greeting},</Text>
          <Text style={styles.name}>{user?.fullname ?? 'Pengguna'}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.bellBtn}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Keluar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Omzet Hari Ini</Text>
        <Text style={styles.heroValue}>{fmt(stats?.today.revenue ?? 0)}</Text>
        <Text style={styles.heroSub}>{stats?.today.transactions ?? 0} transaksi</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.today.registrations ?? 0}</Text>
          <Text style={styles.statLabel}>Pasien Hari Ini</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.today.activeQueue ?? 0}</Text>
          <Text style={styles.statLabel}>Antrian Aktif</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.statCardSm}>
          <Text style={styles.statValueSm}>{stats?.today.checkups ?? 0}</Text>
          <Text style={styles.statLabelSm}>Pemeriksaan</Text>
        </View>
        <View style={styles.statCardSm}>
          <Text style={styles.statValueSm}>{stats?.today.pendingKasir ?? 0}</Text>
          <Text style={styles.statLabelSm}>Menunggu Bayar</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Stok Minim</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Gudang')}>
            <Text style={styles.gudangLink}>Kelola Gudang ›</Text>
          </TouchableOpacity>
        </View>
        {stats?.lowStock && stats.lowStock.length > 0 ? (
          stats.lowStock.map((item) => (
            <View key={item.id} style={styles.stockRow}>
              <Text style={styles.stockName}>{item.itemName}</Text>
              <View style={styles.badgeYellow}>
                <Text style={styles.badgeYellowText}>{item.totalItem} tersisa</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.stockSafeText}>👍 Semua stok aman</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sebulan Terakhir</Text>
        <Text style={styles.monthValue}>{fmt(stats?.month.revenue ?? 0)}</Text>
        <Text style={styles.monthSub}>{stats?.month.transactions ?? 0} transaksi bulan ini</Text>
      </View>

      <TouchableOpacity style={styles.linkCard} onPress={() => navigation.navigate('JadwalDokter')}>
        <Text style={{ fontSize: 18 }}>🗓️</Text>
        <Text style={styles.linkCardText}>Jadwal Dokter</Text>
        <Text style={styles.linkCardChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.linkCard, { marginTop: 10 }]} onPress={() => navigation.navigate('RawatInap')}>
        <Text style={{ fontSize: 18 }}>🏥</Text>
        <Text style={styles.linkCardText}>Rawat Inap</Text>
        <Text style={styles.linkCardChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.linkCard, { marginTop: 10 }]} onPress={() => navigation.navigate('PetHotel')}>
        <Text style={{ fontSize: 18 }}>🏨</Text>
        <Text style={styles.linkCardText}>Pet Hotel</Text>
        <Text style={styles.linkCardChevron}>›</Text>
      </TouchableOpacity>

      {user?.role !== 'dokter' && (
        <TouchableOpacity style={[styles.linkCard, { marginTop: 10 }]} onPress={() => navigation.navigate('Grooming')}>
          <Text style={{ fontSize: 18 }}>✂️</Text>
          <Text style={styles.linkCardText}>Grooming</Text>
          <Text style={styles.linkCardChevron}>›</Text>
        </TouchableOpacity>
      )}

      {(user?.role === 'admin' || user?.role === 'superadmin') && (
        <TouchableOpacity style={[styles.linkCard, { marginTop: 10 }]} onPress={() => navigation.navigate('Reminder')}>
          <Text style={{ fontSize: 18 }}>🔔</Text>
          <Text style={styles.linkCardText}>Reminder Vaksin & Obat Cacing</Text>
          <Text style={styles.linkCardChevron}>›</Text>
        </TouchableOpacity>
      )}

      {(user?.role === 'admin' || user?.role === 'superadmin') && (
        <TouchableOpacity style={[styles.linkCard, { marginTop: 10 }]} onPress={() => navigation.navigate('Review')}>
          <Text style={{ fontSize: 18 }}>⭐</Text>
          <Text style={styles.linkCardText}>Ulasan Pelanggan</Text>
          <Text style={styles.linkCardChevron}>›</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.linkCard, { marginTop: 10 }]} onPress={() => navigation.navigate('Telemed')}>
        <Text style={{ fontSize: 18 }}>💻</Text>
        <Text style={styles.linkCardText}>Telemedicine</Text>
        <Text style={styles.linkCardChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.linkCard, { marginTop: 10 }]} onPress={() => navigation.navigate('Laporan')}>
        <Text style={{ fontSize: 18 }}>📊</Text>
        <Text style={styles.linkCardText}>Laporan Keuangan</Text>
        <Text style={styles.linkCardChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.linkCard, { marginTop: 10 }]} onPress={() => navigation.navigate('Lab')}>
        <Text style={{ fontSize: 18 }}>🧪</Text>
        <Text style={styles.linkCardText}>Lab</Text>
        <Text style={styles.linkCardChevron}>›</Text>
      </TouchableOpacity>

      {(user?.role === 'admin' || user?.role === 'superadmin') && (
        <TouchableOpacity style={[styles.linkCard, { marginTop: 10 }]} onPress={() => navigation.navigate('User')}>
          <Text style={{ fontSize: 18 }}>👥</Text>
          <Text style={styles.linkCardText}>Kelola Staf</Text>
          <Text style={styles.linkCardChevron}>›</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.linkCard, { marginTop: 10 }]} onPress={() => navigation.navigate('Cabang')}>
        <Text style={{ fontSize: 18 }}>🏢</Text>
        <Text style={styles.linkCardText}>Cabang</Text>
        <Text style={styles.linkCardChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.linkCard, { marginTop: 10 }]} onPress={() => navigation.navigate('Layanan')}>
        <Text style={{ fontSize: 18 }}>🩺</Text>
        <Text style={styles.linkCardText}>Layanan</Text>
        <Text style={styles.linkCardChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.linkCard, { marginTop: 10 }]} onPress={() => navigation.navigate('Pengeluaran')}>
        <Text style={{ fontSize: 18 }}>💸</Text>
        <Text style={styles.linkCardText}>Pengeluaran</Text>
        <Text style={styles.linkCardChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.linkCard, { marginTop: 10 }]} onPress={() => navigation.navigate('Marketplace')}>
        <Text style={{ fontSize: 18 }}>🛒</Text>
        <Text style={styles.linkCardText}>Marketplace</Text>
        <Text style={styles.linkCardChevron}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  center: { flex: 1, backgroundColor: colors.warmBg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingTop: 60, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  greeting: { fontSize: 13, color: colors.textSoft, fontWeight: '600' },
  name: { fontSize: 20, color: colors.textDark, fontWeight: '800', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border },
  logoutText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  heroCard: {
    backgroundColor: colors.orange,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  heroLabel: { color: '#FFE5D6', fontSize: 13, fontWeight: '700' },
  heroValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 6 },
  heroSub: { color: '#FFE5D6', fontSize: 12, fontWeight: '600', marginTop: 4 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  statCardSm: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  statValueSm: { fontSize: 16, fontWeight: '800', color: colors.textDark },
  statLabelSm: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  section: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.textDark, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  gudangLink: { fontSize: 12, fontWeight: '700', color: colors.orangeDk },
  stockSafeText: { fontSize: 12, fontWeight: '600', color: colors.textSoft, paddingVertical: 6 },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stockName: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  badgeYellow: { backgroundColor: colors.yellowLt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeYellowText: { fontSize: 11, fontWeight: '700', color: colors.orangeDk },
  monthValue: { fontSize: 20, fontWeight: '800', color: colors.textDark },
  monthSub: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  linkCardText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textDark },
  linkCardChevron: { fontSize: 16, fontWeight: '700', color: colors.orangeDk },
})
