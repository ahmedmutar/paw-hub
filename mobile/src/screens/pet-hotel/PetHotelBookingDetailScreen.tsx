import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface BookingDetail {
  id: string
  checkIn: string
  checkOut: string
  totalNights: number
  totalPrice: string
  specialNeeds?: string
  notes?: string
  status: 'pending' | 'checkedin' | 'checkedout' | 'cancelled'
  isPaid: boolean
  room: { roomName: string; roomType: string }
  patient: { petName: string; petCategory: string }
  owner: { ownerName: string; phoneNumber?: string }
}

interface CareLog {
  id: string
  logDate: string
  mealNote?: string
  drinkNote?: string
  activityNote?: string
  conditionNote?: string
  staff: { fullname: string }
  createdAt: string
}

const statusView: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Menunggu', variant: 'yellow' },
  checkedin: { label: 'Check-in', variant: 'teal' },
  checkedout: { label: 'Check-out', variant: 'green' },
  cancelled: { label: 'Dibatalkan', variant: 'red' },
}

const fmtMoney = (n: string | number) =>
  Number(n).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function PetHotelBookingDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'PetHotelBookingDetail'>>()
  const { id } = route.params

  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<CareLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  const [mealNote, setMealNote] = useState('')
  const [drinkNote, setDrinkNote] = useState('')
  const [activityNote, setActivityNote] = useState('')
  const [conditionNote, setConditionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Booking detail isn't exposed via a GET-by-id endpoint, so we find it in the paginated list.
  const fetchBooking = useCallback(async () => {
    const res = await api.get('/pet-hotel/booking', { params: { limit: 100 } })
    const found = res.data.data.find((b: BookingDetail) => b.id === id)
    setBooking(found ?? null)
  }, [id])

  const fetchLogs = useCallback(
    () => api.get(`/pet-hotel/care-log/${id}`).then((res) => setLogs(res.data.data)),
    [id]
  )

  useEffect(() => {
    setLoading(true)
    fetchBooking().finally(() => setLoading(false))
    setLoadingLogs(true)
    fetchLogs().finally(() => setLoadingLogs(false))
  }, [fetchBooking, fetchLogs])

  const handleAddLog = async () => {
    if (!mealNote && !drinkNote && !activityNote && !conditionNote) {
      Alert.alert('Isi minimal satu catatan', 'Isi salah satu kolom: makan, minum, aktivitas, atau kondisi.')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/pet-hotel/care-log/${id}`, {
        logDate: new Date().toISOString(),
        mealNote: mealNote || undefined,
        drinkNote: drinkNote || undefined,
        activityNote: activityNote || undefined,
        conditionNote: conditionNote || undefined,
      })
      setMealNote('')
      setDrinkNote('')
      setActivityNote('')
      setConditionNote('')
      await fetchLogs()
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    )
  }

  if (!booking) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Data tidak ditemukan</Text>
      </View>
    )
  }

  const view = statusView[booking.status]

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Kembali</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.petName}>{booking.patient.petName} · {booking.patient.petCategory}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {booking.isPaid && <Badge variant="green">Lunas</Badge>}
            <Badge variant={view.variant}>{view.label}</Badge>
          </View>
        </View>
        <Text style={styles.metaText}>{booking.owner.ownerName}{booking.owner.phoneNumber ? ` · ${booking.owner.phoneNumber}` : ''}</Text>
        <Text style={styles.metaText}>Kamar: {booking.room.roomName}</Text>
        <Text style={styles.metaText}>
          {format(new Date(booking.checkIn), 'd MMMM yyyy', { locale: localeId })} - {format(new Date(booking.checkOut), 'd MMMM yyyy', { locale: localeId })} ({booking.totalNights} malam)
        </Text>
        {booking.specialNeeds && <Text style={styles.specialNeeds}>⚠️ {booking.specialNeeds}</Text>}
        {booking.notes && <Text style={styles.metaText}>Catatan: {booking.notes}</Text>}
        <Text style={styles.priceText}>{fmtMoney(booking.totalPrice)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Catat Perawatan Hari Ini</Text>
        <Text style={styles.label}>Makan</Text>
        <TextInput style={styles.input} value={mealNote} onChangeText={setMealNote} placeholder="Contoh: makan habis 1 mangkuk" placeholderTextColor={colors.textSoft} />
        <Text style={[styles.label, { marginTop: 10 }]}>Minum</Text>
        <TextInput style={styles.input} value={drinkNote} onChangeText={setDrinkNote} placeholder="Contoh: minum normal" placeholderTextColor={colors.textSoft} />
        <Text style={[styles.label, { marginTop: 10 }]}>Aktivitas</Text>
        <TextInput style={styles.input} value={activityNote} onChangeText={setActivityNote} placeholder="Contoh: jalan pagi 15 menit" placeholderTextColor={colors.textSoft} />
        <Text style={[styles.label, { marginTop: 10 }]}>Kondisi</Text>
        <TextInput style={styles.input} value={conditionNote} onChangeText={setConditionNote} placeholder="Contoh: aktif dan sehat" placeholderTextColor={colors.textSoft} />
        <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.5 }]} onPress={handleAddLog} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Simpan Catatan</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Riwayat Perawatan</Text>
        {loadingLogs ? (
          <ActivityIndicator color={colors.orange} style={{ marginTop: 10 }} />
        ) : logs.length === 0 ? (
          <Text style={[styles.metaText, { marginTop: 8 }]}>Belum ada catatan perawatan</Text>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.logDate}>{format(new Date(log.logDate), 'd MMM yyyy, HH:mm', { locale: localeId })} · {log.staff.fullname}</Text>
              {log.mealNote && <Text style={styles.logText}>🍖 Makan: {log.mealNote}</Text>}
              {log.drinkNote && <Text style={styles.logText}>💧 Minum: {log.drinkNote}</Text>}
              {log.activityNote && <Text style={styles.logText}>🐾 Aktivitas: {log.activityNote}</Text>}
              {log.conditionNote && <Text style={styles.logText}>❤️ Kondisi: {log.conditionNote}</Text>}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  content: { padding: 18, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.warmBg, alignItems: 'center', justifyContent: 'center' },
  backBtn: { marginBottom: 14 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.orangeDk },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: colors.border, marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  petName: { fontSize: 16, fontWeight: '800', color: colors.textDark, flexShrink: 1 },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  specialNeeds: { fontSize: 12, fontWeight: '700', color: colors.orangeDk, marginTop: 4 },
  priceText: { fontSize: 16, fontWeight: '800', color: colors.textDark, marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMid, marginBottom: 5 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.warmBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
  },
  submitBtn: { backgroundColor: colors.orange, paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 14 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  logRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 },
  logDate: { fontSize: 11, fontWeight: '700', color: colors.textSoft, marginBottom: 4 },
  logText: { fontSize: 12, fontWeight: '600', color: colors.textDark, marginTop: 2 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
