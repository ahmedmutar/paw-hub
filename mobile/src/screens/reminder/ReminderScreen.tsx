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
  Modal,
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format, differenceInCalendarDays } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import { SearchBar } from '../../components/SearchBar'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface UpcomingItem {
  type: 'vaccination' | 'deworming'
  recordId: string
  name: string
  dueDate: string
  patient: {
    id: string
    petName: string
    petCategory: string
    branch: { branchName: string }
    owner: { ownerName: string; phoneNumber?: string }
  }
  reminder: { id: string; status: string; sentAt?: string; errorMsg?: string } | null
}

interface LogItem {
  id: string
  type: 'vaccination' | 'deworming'
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  dueDate: string
  sentAt?: string
  errorMsg?: string
  patient: { petName: string; owner: { ownerName: string } }
}

interface Stats {
  due7: number
  due30: number
  sentToday: number
  failed: number
  breakdown7: { vaccination: number; deworming: number }
}

const typeLabel: Record<string, string> = { vaccination: 'Vaksinasi', deworming: 'Obat Cacing' }
const statusView: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Menunggu', variant: 'yellow' },
  sent: { label: 'Terkirim', variant: 'green' },
  failed: { label: 'Gagal', variant: 'red' },
  skipped: { label: 'Dilewati', variant: 'gray' },
}
const DAYS_OPTIONS = [7, 14, 30, 60]

export default function ReminderScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [tab, setTab] = useState<'jatuh-tempo' | 'log'>('jatuh-tempo')
  const [stats, setStats] = useState<Stats | null>(null)
  const [scanVisible, setScanVisible] = useState(false)

  const fetchStats = useCallback(() => api.get('/reminder/stats').then((res) => setStats(res.data.data)), [])
  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Jatuh tempo tab
  const [typeFilter, setTypeFilter] = useState<'semua' | 'vaccination' | 'deworming'>('semua')
  const [daysFilter, setDaysFilter] = useState(30)
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<UpcomingItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sendingKey, setSendingKey] = useState<string | null>(null)

  const fetchUpcoming = useCallback(async () => {
    const res = await api.get('/reminder/upcoming', {
      params: {
        days: daysFilter,
        type: typeFilter === 'semua' ? undefined : typeFilter,
        search: search || undefined,
        limit: 30,
      },
    })
    setItems(res.data.data)
  }, [typeFilter, daysFilter, search])

  useEffect(() => {
    if (tab !== 'jatuh-tempo') return
    setLoadingItems(true)
    fetchUpcoming().finally(() => setLoadingItems(false))
  }, [tab, fetchUpcoming])

  const onRefreshUpcoming = async () => {
    setRefreshing(true)
    await Promise.all([fetchUpcoming(), fetchStats()])
    setRefreshing(false)
  }

  const sendNow = async (item: UpcomingItem) => {
    const key = `${item.type}-${item.recordId}`
    setSendingKey(key)
    try {
      await api.post(`/reminder/send-manual/${item.type}/${item.recordId}`)
      await fetchUpcoming()
      Alert.alert('Berhasil', 'Reminder sudah diproses.')
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setSendingKey(null)
    }
  }

  // Log tab
  const [logStatusFilter, setLogStatusFilter] = useState<'semua' | 'pending' | 'sent' | 'failed' | 'skipped'>('semua')
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  const fetchLogs = useCallback(async () => {
    const res = await api.get('/reminder/log', {
      params: { status: logStatusFilter === 'semua' ? undefined : logStatusFilter, limit: 30 },
    })
    setLogs(res.data.data)
  }, [logStatusFilter])

  useEffect(() => {
    if (tab !== 'log') return
    setLoadingLogs(true)
    fetchLogs().finally(() => setLoadingLogs(false))
  }, [tab, fetchLogs])

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Reminder</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setScanVisible(true)}>
            <Text style={styles.addBtnText}>Jalankan Scan</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tabRow}>
          {(['jatuh-tempo', 'log'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'jatuh-tempo' ? 'Jatuh Tempo' : 'Log Pengiriman'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.due7}</Text>
            <Text style={styles.statLabel}>7 Hari</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.due30}</Text>
            <Text style={styles.statLabel}>30 Hari</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.sentToday}</Text>
            <Text style={styles.statLabel}>Terkirim Hari Ini</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, stats.failed > 0 && { color: colors.red }]}>{stats.failed}</Text>
            <Text style={styles.statLabel}>Gagal</Text>
          </View>
        </View>
      )}

      {tab === 'jatuh-tempo' ? (
        <>
          <View style={styles.searchWrap}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Cari nama hewan/pemilik..." />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
            {(['semua', 'vaccination', 'deworming'] as const).map((t) => (
              <TouchableOpacity key={t} onPress={() => setTypeFilter(t)} style={[styles.filterChip, typeFilter === t && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, typeFilter === t && styles.filterChipTextActive]}>
                  {t === 'semua' ? 'Semua Tipe' : typeLabel[t]}
                </Text>
              </TouchableOpacity>
            ))}
            {DAYS_OPTIONS.map((d) => (
              <TouchableOpacity key={d} onPress={() => setDaysFilter(d)} style={[styles.filterChip, daysFilter === d && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, daysFilter === d && styles.filterChipTextActive]}>{d} hari</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loadingItems ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.orange} size="large" />
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => `${item.type}-${item.recordId}`}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshUpcoming} tintColor={colors.orange} />}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={{ fontSize: 32 }}>🔔</Text>
                  <Text style={styles.emptyText}>Tidak ada jatuh tempo untuk filter ini</Text>
                </View>
              }
              renderItem={({ item }) => {
                const daysLeft = differenceInCalendarDays(new Date(item.dueDate), new Date())
                const urgent = daysLeft <= 3
                const status = item.reminder?.status
                const key = `${item.type}-${item.recordId}`
                const canSend = !!item.patient.owner.phoneNumber && status !== 'sent'
                return (
                  <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.petName}>{item.patient.petName} · {item.patient.petCategory}</Text>
                      <Badge variant={typeFilter === 'deworming' || item.type === 'deworming' ? 'purple' : 'blue'}>{typeLabel[item.type]}</Badge>
                    </View>
                    <Text style={styles.rowMeta}>{item.name}</Text>
                    <Text style={styles.rowMeta}>{item.patient.owner.ownerName}{item.patient.owner.phoneNumber ? ` · ${item.patient.owner.phoneNumber}` : ' · tanpa no. HP'}</Text>
                    <Text style={styles.rowMeta}>{item.patient.branch.branchName}</Text>
                    <Text style={[styles.dueText, urgent && { color: colors.red }]}>
                      {format(new Date(item.dueDate), 'd MMMM yyyy', { locale: localeId })} ({daysLeft <= 0 ? 'lewat jatuh tempo' : `${daysLeft} hari lagi`})
                    </Text>
                    {status && <Badge variant={statusView[status].variant}>{statusView[status].label}</Badge>}

                    {canSend && (
                      <TouchableOpacity
                        style={[styles.sendBtn, sendingKey === key && { opacity: 0.5 }]}
                        onPress={() => sendNow(item)}
                        disabled={sendingKey === key}
                      >
                        {sendingKey === key ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Kirim Sekarang</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                )
              }}
            />
          )}
        </>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
            {(['semua', 'pending', 'sent', 'failed', 'skipped'] as const).map((s) => (
              <TouchableOpacity key={s} onPress={() => setLogStatusFilter(s)} style={[styles.filterChip, logStatusFilter === s && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, logStatusFilter === s && styles.filterChipTextActive]}>
                  {s === 'semua' ? 'Semua' : statusView[s].label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {loadingLogs ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.orange} size="large" />
            </View>
          ) : (
            <FlatList
              data={logs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={{ fontSize: 32 }}>📖</Text>
                  <Text style={styles.emptyText}>Belum ada log untuk filter ini</Text>
                </View>
              }
              renderItem={({ item }) => {
                const view = statusView[item.status]
                return (
                  <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.petName}>{item.patient.petName}</Text>
                      <Badge variant={view.variant}>{view.label}</Badge>
                    </View>
                    <Text style={styles.rowMeta}>{typeLabel[item.type]} · {item.patient.owner.ownerName}</Text>
                    <Text style={styles.rowMeta}>Jatuh tempo: {format(new Date(item.dueDate), 'd MMM yyyy', { locale: localeId })}</Text>
                    {item.sentAt && <Text style={styles.rowMeta}>Terkirim: {format(new Date(item.sentAt), 'd MMM yyyy, HH:mm', { locale: localeId })}</Text>}
                    {item.errorMsg && <Text style={styles.errorText}>⚠️ {item.errorMsg}</Text>}
                  </View>
                )
              }}
            />
          )}
        </>
      )}

      <RunScanModal
        visible={scanVisible}
        onClose={() => setScanVisible(false)}
        onSuccess={() => {
          setScanVisible(false)
          fetchStats()
          if (tab === 'jatuh-tempo') fetchUpcoming()
          if (tab === 'log') fetchLogs()
        }}
      />
    </View>
  )
}

function RunScanModal({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const [days, setDays] = useState(7)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (visible) setDays(7)
  }, [visible])

  const handleRun = async () => {
    setRunning(true)
    try {
      const res = await api.post('/reminder/run', { days })
      const { vaccination, deworming, errors } = res.data.data
      Alert.alert('Scan selesai', `Vaksinasi: ${vaccination} · Obat cacing: ${deworming}${errors?.length ? ` · ${errors.length} error` : ''}`)
      onSuccess()
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Jalankan Scan Reminder</Text>
          <Text style={styles.modalSub}>Cek jatuh tempo vaksinasi & obat cacing dalam rentang hari berikut, lalu kirim WhatsApp ke pemilik yang belum diingatkan.</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            {DAYS_OPTIONS.map((d) => (
              <TouchableOpacity key={d} style={[styles.dayChip, days === d && styles.dayChipActive]} onPress={() => setDays(d)}>
                <Text style={[styles.dayChipText, days === d && styles.dayChipTextActive]}>{d} hari</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.textSoft }]} onPress={onClose} disabled={running}>
              <Text style={styles.modalBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.orange }]} onPress={handleRun} disabled={running}>
              {running ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Jalankan</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  header: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 8 },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.orangeDk },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  addBtn: { backgroundColor: colors.orange, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  tabBtnActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  tabTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 8, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.textDark },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textSoft, marginTop: 2, textAlign: 'center' },
  searchWrap: { paddingHorizontal: 18, marginTop: 12, marginBottom: -4 },
  filterRow: { flexGrow: 0, marginVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  filterChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  filterChipTextActive: { color: '#fff' },
  listContent: { paddingHorizontal: 18, paddingBottom: 24 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  petName: { fontSize: 14, fontWeight: '800', color: colors.textDark, flexShrink: 1 },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  dueText: { fontSize: 12, fontWeight: '700', color: colors.textDark, marginTop: 6 },
  errorText: { fontSize: 11, fontWeight: '700', color: colors.red, marginTop: 4 },
  sendBtn: { backgroundColor: colors.teal, paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: colors.card, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textDark },
  modalSub: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 8, lineHeight: 18 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.warmBg },
  dayChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  dayChipText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  dayChipTextActive: { color: '#fff' },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
})
