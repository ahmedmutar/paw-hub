import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format, startOfWeek, addWeeks, addDays } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/auth.store'
import { colors } from '../../theme'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface DaySlot {
  doctorId: string
  doctorName: string
  hasSchedule: boolean
  shiftStart?: string
  shiftEnd?: string
  maxPatients?: number
  leave: { status: string; reason?: string } | null
  available: boolean
}

interface WeekDay {
  date: string
  dayOfWeek: number
  dayName: string
  slots: DaySlot[]
}

interface CutiItem {
  id: string
  doctorName: string
  leaveDate: string
  reason?: string
  status: 'pending' | 'approved' | 'declined'
  approverName?: string
  createdAt: string
}

interface UpcomingLeave {
  id: string
  leaveDate: string
  reason?: string
  status: string
}

const statusLabel: Record<string, string> = { pending: 'Menunggu', approved: 'Disetujui', declined: 'Ditolak' }
const statusColor: Record<string, string> = { pending: colors.yellow, approved: colors.green, declined: colors.red }

export default function JadwalDokterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const isDoctor = user?.role === 'dokter'

  const [tab, setTab] = useState<'kalender' | 'cuti'>('kalender')

  // --- kalender ---
  const [weekOffset, setWeekOffset] = useState(0)
  const [days, setDays] = useState<WeekDay[]>([])
  const [loadingWeek, setLoadingWeek] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 0 }), weekOffset)

  const fetchWeek = useCallback(async () => {
    const res = await api.get('/jadwal-dokter/kalender/week', {
      params: { dateFrom: format(weekStart, 'yyyy-MM-dd') },
    })
    setDays(res.data.data.days)
  }, [weekOffset])

  useEffect(() => {
    setLoadingWeek(true)
    fetchWeek().finally(() => setLoadingWeek(false))
  }, [fetchWeek])

  const onRefreshWeek = async () => {
    setRefreshing(true)
    await fetchWeek()
    setRefreshing(false)
  }

  // --- cuti: admin (approval list) ---
  const [cutiList, setCutiList] = useState<CutiItem[]>([])
  const [loadingCuti, setLoadingCuti] = useState(false)

  const fetchCutiList = useCallback(async () => {
    const res = await api.get('/jadwal-dokter/cuti/list')
    setCutiList(res.data.data)
  }, [])

  useEffect(() => {
    if (tab === 'cuti' && isAdmin) {
      setLoadingCuti(true)
      fetchCutiList().finally(() => setLoadingCuti(false))
    }
  }, [tab, isAdmin, fetchCutiList])

  const handleApprove = async (id: string, status: 'approved' | 'declined') => {
    try {
      await api.patch(`/jadwal-dokter/cuti/${id}`, { status })
      fetchCutiList()
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    }
  }

  // --- cuti: dokter (self-service request) ---
  const [ownLeaves, setOwnLeaves] = useState<UpcomingLeave[]>([])
  const [loadingOwn, setLoadingOwn] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchOwnLeaves = useCallback(async () => {
    if (!user) return
    const res = await api.get(`/jadwal-dokter/${user.userId}`)
    setOwnLeaves(res.data.data.upcomingLeaves)
  }, [user])

  useEffect(() => {
    if (tab === 'cuti' && isDoctor) {
      setLoadingOwn(true)
      fetchOwnLeaves().finally(() => setLoadingOwn(false))
    }
  }, [tab, isDoctor, fetchOwnLeaves])

  const dateOptions = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i))

  const handleSubmitCuti = async () => {
    if (!selectedDate) return
    setSubmitting(true)
    try {
      await api.post('/jadwal-dokter/cuti', {
        leaveDate: format(selectedDate, 'yyyy-MM-dd'),
        reason: reason || undefined,
      })
      setSelectedDate(null)
      setReason('')
      await fetchOwnLeaves()
      Alert.alert('Berhasil', 'Permintaan cuti sudah diajukan, menunggu persetujuan admin.')
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Jadwal Dokter</Text>
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, tab === 'kalender' && styles.tabBtnActive]} onPress={() => setTab('kalender')}>
            <Text style={[styles.tabText, tab === 'kalender' && styles.tabTextActive]}>Kalender</Text>
          </TouchableOpacity>
          {(isAdmin || isDoctor) && (
            <TouchableOpacity style={[styles.tabBtn, tab === 'cuti' && styles.tabBtnActive]} onPress={() => setTab('cuti')}>
              <Text style={[styles.tabText, tab === 'cuti' && styles.tabTextActive]}>Cuti</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {tab === 'kalender' ? (
        loadingWeek ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.orange} size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshWeek} tintColor={colors.orange} />}
          >
            <View style={styles.weekNavRow}>
              <TouchableOpacity onPress={() => setWeekOffset((w) => w - 1)} style={styles.weekNavBtn}>
                <Text style={styles.weekNavText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.weekRangeText}>
                {format(weekStart, 'd MMM', { locale: localeId })} - {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: localeId })}
              </Text>
              <TouchableOpacity onPress={() => setWeekOffset((w) => w + 1)} style={styles.weekNavBtn}>
                <Text style={styles.weekNavText}>›</Text>
              </TouchableOpacity>
            </View>

            {days.map((day) => {
              const scheduled = day.slots.filter((s) => s.hasSchedule)
              const isToday = day.date === format(new Date(), 'yyyy-MM-dd')
              return (
                <View key={day.date} style={[styles.dayCard, isToday && styles.dayCardToday]}>
                  <Text style={styles.dayTitle}>
                    {day.dayName}, {format(new Date(day.date), 'd MMM', { locale: localeId })}
                  </Text>
                  {scheduled.length === 0 ? (
                    <Text style={styles.emptyDayText}>Tidak ada jadwal</Text>
                  ) : (
                    scheduled.map((slot) => {
                      const onLeave = slot.leave?.status === 'approved'
                      const pendingLeave = slot.leave?.status === 'pending'
                      return (
                        <View key={slot.doctorId} style={styles.slotRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.slotName, onLeave && styles.slotNameOff]}>{slot.doctorName}</Text>
                            <Text style={styles.slotTime}>
                              {slot.shiftStart} - {slot.shiftEnd}
                            </Text>
                          </View>
                          {onLeave && (
                            <View style={[styles.badge, { backgroundColor: colors.redLt }]}>
                              <Text style={[styles.badgeText, { color: colors.red }]}>Cuti</Text>
                            </View>
                          )}
                          {pendingLeave && !onLeave && (
                            <View style={[styles.badge, { backgroundColor: colors.yellowLt }]}>
                              <Text style={[styles.badgeText, { color: '#C98A00' }]}>Cuti (menunggu)</Text>
                            </View>
                          )}
                        </View>
                      )
                    })
                  )}
                </View>
              )
            })}
          </ScrollView>
        )
      ) : isAdmin ? (
        loadingCuti ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.orange} size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={loadingCuti} onRefresh={fetchCutiList} tintColor={colors.orange} />}
          >
            {cutiList.length === 0 && <Text style={styles.emptyDayText}>Belum ada permintaan cuti</Text>}
            {cutiList.map((item) => (
              <View key={item.id} style={styles.cutiCard}>
                <View style={styles.cutiHeaderRow}>
                  <Text style={styles.cutiName}>{item.doctorName}</Text>
                  <View style={[styles.badge, { backgroundColor: statusColor[item.status] + '33' }]}>
                    <Text style={[styles.badgeText, { color: statusColor[item.status] }]}>{statusLabel[item.status]}</Text>
                  </View>
                </View>
                <Text style={styles.cutiDate}>{format(new Date(item.leaveDate), 'd MMMM yyyy', { locale: localeId })}</Text>
                {item.reason && <Text style={styles.cutiReason}>{item.reason}</Text>}
                {item.status === 'pending' && (
                  <View style={styles.cutiActionRow}>
                    <TouchableOpacity style={[styles.cutiActionBtn, { backgroundColor: colors.green }]} onPress={() => handleApprove(item.id, 'approved')}>
                      <Text style={styles.cutiActionText}>Setujui</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.cutiActionBtn, { backgroundColor: colors.red }]} onPress={() => handleApprove(item.id, 'declined')}>
                      <Text style={styles.cutiActionText}>Tolak</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.cutiCard}>
            <Text style={styles.sectionTitle}>Ajukan Cuti</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {dateOptions.map((d) => {
                const key = format(d, 'yyyy-MM-dd')
                const active = selectedDate && format(selectedDate, 'yyyy-MM-dd') === key
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.dateChip, active && styles.dateChipActive]}
                    onPress={() => setSelectedDate(d)}
                  >
                    <Text style={[styles.dateChipDay, active && styles.dateChipTextActive]}>{format(d, 'EEE', { locale: localeId })}</Text>
                    <Text style={[styles.dateChipDate, active && styles.dateChipTextActive]}>{format(d, 'd MMM')}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
            <Text style={styles.label}>Alasan (opsional)</Text>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder="Contoh: acara keluarga"
              placeholderTextColor={colors.textSoft}
            />
            <TouchableOpacity
              style={[styles.submitBtn, (!selectedDate || submitting) && { opacity: 0.5 }]}
              onPress={handleSubmitCuti}
              disabled={!selectedDate || submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Ajukan</Text>}
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 8, marginBottom: 10 }]}>Cuti Saya</Text>
          {loadingOwn ? (
            <ActivityIndicator color={colors.orange} />
          ) : ownLeaves.length === 0 ? (
            <Text style={styles.emptyDayText}>Belum ada pengajuan cuti mendatang</Text>
          ) : (
            ownLeaves.map((lv) => (
              <View key={lv.id} style={styles.cutiCard}>
                <View style={styles.cutiHeaderRow}>
                  <Text style={styles.cutiDate}>{format(new Date(lv.leaveDate), 'd MMMM yyyy', { locale: localeId })}</Text>
                  <View style={[styles.badge, { backgroundColor: statusColor[lv.status] + '33' }]}>
                    <Text style={[styles.badgeText, { color: statusColor[lv.status] }]}>{statusLabel[lv.status]}</Text>
                  </View>
                </View>
                {lv.reason && <Text style={styles.cutiReason}>{lv.reason}</Text>}
              </View>
            ))
          )}
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
  tabBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  tabBtnActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  tabTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 40 },
  weekNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  weekNavBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  weekNavText: { fontSize: 18, fontWeight: '800', color: colors.orangeDk },
  weekRangeText: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  dayCard: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 },
  dayCardToday: { borderColor: colors.teal, backgroundColor: colors.tealLt },
  dayTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark, marginBottom: 8 },
  emptyDayText: { fontSize: 12, fontWeight: '600', color: colors.textSoft },
  slotRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  slotName: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  slotNameOff: { color: colors.textSoft, textDecorationLine: 'line-through' },
  slotTime: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cutiCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: colors.border, marginBottom: 12 },
  cutiHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cutiName: { fontSize: 14, fontWeight: '800', color: colors.textDark },
  cutiDate: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginTop: 4 },
  cutiReason: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  cutiActionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  cutiActionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  cutiActionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.textDark },
  dateChip: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.warmBg, marginRight: 8 },
  dateChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  dateChipDay: { fontSize: 10, fontWeight: '700', color: colors.textSoft },
  dateChipDate: { fontSize: 12, fontWeight: '800', color: colors.textDark, marginTop: 2 },
  dateChipTextActive: { color: '#fff' },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMid, marginBottom: 5 },
  input: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.warmBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: '600', color: colors.textDark, marginBottom: 12 },
  submitBtn: { backgroundColor: colors.orange, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
})
