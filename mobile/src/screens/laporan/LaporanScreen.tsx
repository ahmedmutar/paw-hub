import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format, addDays, addMonths } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface Harian {
  date: string
  revenue: { total: number; count: number; byMethod: { method: string; total: number; count: number }[] }
  expense: { total: number; count: number; byCategory: { category: string; total: number; count: number }[] }
  profit: number
  profitMargin: number
}

interface Bulanan {
  period: { month: number; year: number }
  current: { revenue: number; expense: number; profit: number; transactions: number; profitMargin: number }
  growth: { revenue: number; expense: number; profit: number }
  byMethod: { method: string; total: number }[]
  byCategory: { category: string; total: number }[]
}

const fmt = (n: number) =>
  n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

const GrowthBadge = ({ pct }: { pct: number }) => {
  const up = pct >= 0
  return (
    <Text style={[styles.growthText, { color: up ? colors.green : colors.red }]}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </Text>
  )
}

export default function LaporanScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [tab, setTab] = useState<'harian' | 'bulanan'>('harian')

  // Harian
  const [day, setDay] = useState(new Date())
  const [harian, setHarian] = useState<Harian | null>(null)
  const [loadingHarian, setLoadingHarian] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchHarian = useCallback(() => {
    return api.get('/laporan/harian', { params: { date: format(day, 'yyyy-MM-dd') } }).then((res) => setHarian(res.data.data))
  }, [day])

  useEffect(() => {
    if (tab !== 'harian') return
    setLoadingHarian(true)
    fetchHarian().finally(() => setLoadingHarian(false))
  }, [tab, fetchHarian])

  // Bulanan
  const [month, setMonth] = useState(new Date())
  const [bulanan, setBulanan] = useState<Bulanan | null>(null)
  const [loadingBulanan, setLoadingBulanan] = useState(true)

  const fetchBulanan = useCallback(() => {
    return api
      .get('/laporan/bulanan', { params: { month: month.getMonth() + 1, year: month.getFullYear() } })
      .then((res) => setBulanan(res.data.data))
  }, [month])

  useEffect(() => {
    if (tab !== 'bulanan') return
    setLoadingBulanan(true)
    fetchBulanan().finally(() => setLoadingBulanan(false))
  }, [tab, fetchBulanan])

  const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  const onRefresh = async () => {
    setRefreshing(true)
    await (tab === 'harian' ? fetchHarian() : fetchBulanan())
    setRefreshing(false)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Laporan Keuangan</Text>
        <View style={styles.tabRow}>
          {(['harian', 'bulanan'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t === 'harian' ? 'Harian' : 'Bulanan'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === 'harian' ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
        >
          <View style={styles.navRow}>
            <TouchableOpacity onPress={() => setDay((d) => addDays(d, -1))} style={styles.navBtn}>
              <Text style={styles.navBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.navLabel}>{format(day, 'EEEE, d MMMM yyyy', { locale: localeId })}</Text>
            <TouchableOpacity onPress={() => !isToday && setDay((d) => addDays(d, 1))} style={styles.navBtn} disabled={isToday}>
              <Text style={[styles.navBtnText, isToday && { opacity: 0.3 }]}>›</Text>
            </TouchableOpacity>
          </View>

          {loadingHarian ? (
            <ActivityIndicator color={colors.orange} size="large" style={{ marginTop: 40 }} />
          ) : harian ? (
            <>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Omzet</Text>
                  <Text style={styles.kpiValue}>{fmt(harian.revenue.total)}</Text>
                  <Text style={styles.kpiSub}>{harian.revenue.count} transaksi</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Pengeluaran</Text>
                  <Text style={styles.kpiValue}>{fmt(harian.expense.total)}</Text>
                  <Text style={styles.kpiSub}>{harian.expense.count} item</Text>
                </View>
              </View>
              <View style={[styles.profitCard, { backgroundColor: harian.profit >= 0 ? colors.green : colors.red }]}>
                <Text style={styles.profitLabel}>{harian.profit >= 0 ? 'Laba' : 'Rugi'}</Text>
                <Text style={styles.profitValue}>{fmt(Math.abs(harian.profit))}</Text>
                <Text style={styles.profitSub}>Margin {harian.profitMargin.toFixed(1)}%</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Omzet per Metode Bayar</Text>
                {harian.revenue.byMethod.length === 0 ? (
                  <Text style={styles.emptyText}>Belum ada transaksi</Text>
                ) : (
                  harian.revenue.byMethod.map((m) => (
                    <View key={m.method} style={styles.lineRow}>
                      <Text style={styles.lineName}>{m.method} ({m.count})</Text>
                      <Text style={styles.lineValue}>{fmt(m.total)}</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Pengeluaran per Kategori</Text>
                {harian.expense.byCategory.length === 0 ? (
                  <Text style={styles.emptyText}>Belum ada pengeluaran</Text>
                ) : (
                  harian.expense.byCategory.map((c) => (
                    <View key={c.category} style={styles.lineRow}>
                      <Text style={styles.lineName}>{c.category} ({c.count})</Text>
                      <Text style={styles.lineValue}>{fmt(c.total)}</Text>
                    </View>
                  ))
                )}
              </View>
            </>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
        >
          <View style={styles.navRow}>
            <TouchableOpacity onPress={() => setMonth((m) => addMonths(m, -1))} style={styles.navBtn}>
              <Text style={styles.navBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.navLabel}>{format(month, 'MMMM yyyy', { locale: localeId })}</Text>
            <TouchableOpacity onPress={() => setMonth((m) => addMonths(m, 1))} style={styles.navBtn}>
              <Text style={styles.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>

          {loadingBulanan ? (
            <ActivityIndicator color={colors.orange} size="large" style={{ marginTop: 40 }} />
          ) : bulanan ? (
            <>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Omzet</Text>
                  <Text style={styles.kpiValue}>{fmt(bulanan.current.revenue)}</Text>
                  <GrowthBadge pct={bulanan.growth.revenue} />
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Pengeluaran</Text>
                  <Text style={styles.kpiValue}>{fmt(bulanan.current.expense)}</Text>
                  <GrowthBadge pct={bulanan.growth.expense} />
                </View>
              </View>
              <View style={[styles.profitCard, { backgroundColor: bulanan.current.profit >= 0 ? colors.green : colors.red }]}>
                <Text style={styles.profitLabel}>{bulanan.current.profit >= 0 ? 'Laba' : 'Rugi'}</Text>
                <Text style={styles.profitValue}>{fmt(Math.abs(bulanan.current.profit))}</Text>
                <Text style={styles.profitSub}>Margin {bulanan.current.profitMargin.toFixed(1)}% · {bulanan.current.transactions} transaksi</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Omzet per Metode Bayar</Text>
                {bulanan.byMethod.length === 0 ? (
                  <Text style={styles.emptyText}>Belum ada transaksi</Text>
                ) : (
                  bulanan.byMethod.map((m) => (
                    <View key={m.method} style={styles.distRow}>
                      <Text style={styles.distLabel}>{m.method}</Text>
                      <View style={styles.distBarBg}>
                        <View style={[styles.distBarFill, { width: `${bulanan.current.revenue ? (m.total / bulanan.current.revenue) * 100 : 0}%` }]} />
                      </View>
                      <Text style={styles.distValue}>{fmt(m.total)}</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Pengeluaran per Kategori</Text>
                {bulanan.byCategory.length === 0 ? (
                  <Text style={styles.emptyText}>Belum ada pengeluaran</Text>
                ) : (
                  bulanan.byCategory.map((c) => (
                    <View key={c.category} style={styles.distRow}>
                      <Text style={styles.distLabel}>{c.category}</Text>
                      <View style={styles.distBarBg}>
                        <View style={[styles.distBarFill, { backgroundColor: colors.red, width: `${bulanan.current.expense ? (c.total / bulanan.current.expense) * 100 : 0}%` }]} />
                      </View>
                      <Text style={styles.distValue}>{fmt(c.total)}</Text>
                    </View>
                  ))
                )}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
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
  content: { padding: 18, paddingTop: 4, paddingBottom: 40 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  navBtnText: { fontSize: 18, fontWeight: '800', color: colors.orangeDk },
  navLabel: { fontSize: 13, fontWeight: '700', color: colors.textDark, flex: 1, textAlign: 'center' },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiCard: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: colors.border },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: colors.textSoft },
  kpiValue: { fontSize: 15, fontWeight: '800', color: colors.textDark, marginTop: 4 },
  kpiSub: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 3 },
  growthText: { fontSize: 11, fontWeight: '800', marginTop: 3 },
  profitCard: { borderRadius: 16, padding: 16, marginBottom: 12 },
  profitLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  profitValue: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 4 },
  profitSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: colors.border, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark, marginBottom: 10 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  lineName: { fontSize: 13, fontWeight: '600', color: colors.textDark, flex: 1 },
  lineValue: { fontSize: 13, fontWeight: '700', color: colors.textMid },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  distLabel: { fontSize: 11, fontWeight: '700', color: colors.textMid, width: 80 },
  distBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.warmBg, overflow: 'hidden' },
  distBarFill: { height: 8, borderRadius: 4, backgroundColor: colors.green },
  distValue: { fontSize: 11, fontWeight: '700', color: colors.textDark, width: 80, textAlign: 'right' },
  emptyText: { fontSize: 12, fontWeight: '600', color: colors.textSoft },
})
