import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format, addMonths } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/auth.store'
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface Room {
  id: string
  roomName: string
  roomType: 'vip' | 'reguler' | 'isolasi'
  capacity: number
  pricePerNight: string
  description?: string
  isActive: boolean
}

interface Booking {
  id: string
  checkIn: string
  checkOut: string
  totalNights: number
  totalPrice: string
  specialNeeds?: string
  status: 'pending' | 'checkedin' | 'checkedout' | 'cancelled'
  isPaid: boolean
  room: { roomName: string; roomType: string }
  patient: { petName: string; petCategory: string }
  owner: { ownerName: string; phoneNumber?: string }
}

interface PatientOption {
  id: string
  petName: string
  petCategory: string
  owner: { id: string; ownerName: string }
}

const roomTypeVariant: Record<string, BadgeVariant> = { vip: 'purple', reguler: 'blue', isolasi: 'red' }
const roomTypeLabel: Record<string, string> = { vip: 'VIP', reguler: 'Reguler', isolasi: 'Isolasi' }
const statusView: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Menunggu', variant: 'yellow' },
  checkedin: { label: 'Check-in', variant: 'teal' },
  checkedout: { label: 'Check-out', variant: 'green' },
  cancelled: { label: 'Dibatalkan', variant: 'red' },
}
const BOOKING_FILTERS = ['semua', 'pending', 'checkedin', 'checkedout', 'cancelled']

const fmtMoney = (n: string | number) =>
  Number(n).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function PetHotelScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const canCheckout = isAdmin || user?.role === 'kasir'

  const [tab, setTab] = useState<'booking' | 'kamar' | 'kalender'>('booking')

  // Rooms (shared, used by tab kamar & booking form)
  const [rooms, setRooms] = useState<Room[]>([])
  const fetchRooms = useCallback(() => api.get('/pet-hotel/kamar').then((res) => setRooms(res.data.data)), [])
  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  // Booking tab
  const [bookingFilter, setBookingFilter] = useState('semua')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadingBooking, setLoadingBooking] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [addBookingVisible, setAddBookingVisible] = useState(false)

  const fetchBookings = useCallback(async () => {
    const res = await api.get('/pet-hotel/booking', {
      params: { status: bookingFilter === 'semua' ? undefined : bookingFilter, limit: 50 },
    })
    setBookings(res.data.data)
  }, [bookingFilter])

  useEffect(() => {
    if (tab !== 'booking') return
    setLoadingBooking(true)
    fetchBookings().finally(() => setLoadingBooking(false))
  }, [tab, fetchBookings])

  const onRefreshBooking = async () => {
    setRefreshing(true)
    await fetchBookings()
    setRefreshing(false)
  }

  const doCheckin = async (id: string) => {
    try {
      await api.patch(`/pet-hotel/booking/${id}/status`, { status: 'checkedin' })
      fetchBookings()
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    }
  }

  const doCancel = (id: string) => {
    Alert.alert('Batalkan booking?', 'Tindakan ini tidak bisa dibatalkan.', [
      { text: 'Tidak', style: 'cancel' },
      {
        text: 'Ya, batalkan',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.patch(`/pet-hotel/booking/${id}/status`, { status: 'cancelled' })
            fetchBookings()
          } catch (err: any) {
            Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
          }
        },
      },
    ])
  }

  const doCheckout = async (id: string) => {
    try {
      await api.post(`/pet-hotel/kasir/${id}`, {})
      fetchBookings()
      Alert.alert('Berhasil', 'Booking sudah dibayar & check-out.')
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    }
  }

  // Kamar tab
  const [addRoomVisible, setAddRoomVisible] = useState(false)

  // Kalender tab
  const [calMonth, setCalMonth] = useState(new Date())
  const [occupancy, setOccupancy] = useState<Booking[]>([])
  const [loadingCal, setLoadingCal] = useState(false)

  const fetchOccupancy = useCallback(() => {
    setLoadingCal(true)
    api
      .get('/pet-hotel/occupancy', { params: { month: calMonth.getMonth() + 1, year: calMonth.getFullYear() } })
      .then((res) => setOccupancy(res.data.data))
      .finally(() => setLoadingCal(false))
  }, [calMonth])

  useEffect(() => {
    if (tab === 'kalender') fetchOccupancy()
  }, [tab, fetchOccupancy])

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pet Hotel</Text>
        <View style={styles.tabRow}>
          {(['booking', 'kamar', 'kalender'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'booking' ? 'Booking' : t === 'kamar' ? 'Kamar' : 'Kalender'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === 'booking' && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}
          >
            {BOOKING_FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setBookingFilter(f)}
                style={[styles.filterChip, bookingFilter === f && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, bookingFilter === f && styles.filterChipTextActive]}>
                  {f === 'semua' ? 'Semua' : statusView[f].label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loadingBooking ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.orange} size="large" />
            </View>
          ) : (
            <FlatList
              data={bookings}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshBooking} tintColor={colors.orange} />}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={{ fontSize: 32 }}>🏨</Text>
                  <Text style={styles.emptyText}>Belum ada booking untuk filter ini</Text>
                </View>
              }
              renderItem={({ item }) => {
                const view = statusView[item.status]
                return (
                  <TouchableOpacity
                    style={styles.bookingCard}
                    onPress={() => navigation.navigate('PetHotelBookingDetail', { id: item.id })}
                  >
                    <View style={styles.bookingHeaderRow}>
                      <Text style={styles.petName}>{item.patient.petName} · {item.patient.petCategory}</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {item.isPaid && <Badge variant="green">Lunas</Badge>}
                        <Badge variant={view.variant}>{view.label}</Badge>
                      </View>
                    </View>
                    <Text style={styles.rowMeta}>{item.owner.ownerName}</Text>
                    <Text style={styles.rowMeta}>
                      {item.room.roomName} ({roomTypeLabel[item.room.roomType]}) · {format(new Date(item.checkIn), 'd MMM', { locale: localeId })} - {format(new Date(item.checkOut), 'd MMM yyyy', { locale: localeId })} · {item.totalNights} malam
                    </Text>
                    {item.specialNeeds && <Text style={styles.specialNeeds}>⚠️ {item.specialNeeds}</Text>}
                    <Text style={styles.priceText}>{fmtMoney(item.totalPrice)}</Text>

                    {item.status === 'pending' && (
                      <View style={styles.actionRow}>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.teal }]} onPress={() => doCheckin(item.id)}>
                          <Text style={styles.actionBtnText}>Check-in</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.red }]} onPress={() => doCancel(item.id)}>
                          <Text style={styles.actionBtnText}>Batalkan</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {item.status === 'checkedin' && !item.isPaid && canCheckout && (
                      <View style={styles.actionRow}>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.green, flex: 1 }]} onPress={() => doCheckout(item.id)}>
                          <Text style={styles.actionBtnText}>Bayar & Check-out</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                )
              }}
            />
          )}

          <TouchableOpacity style={styles.fab} onPress={() => setAddBookingVisible(true)}>
            <Text style={styles.fabText}>+ Booking</Text>
          </TouchableOpacity>

          <AddBookingModal
            visible={addBookingVisible}
            rooms={rooms.filter((r) => r.isActive)}
            onClose={() => setAddBookingVisible(false)}
            onSuccess={() => {
              setAddBookingVisible(false)
              fetchBookings()
            }}
          />
        </>
      )}

      {tab === 'kamar' && (
        <>
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 32 }}>🛏️</Text>
                <Text style={styles.emptyText}>Belum ada kamar</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.roomCard}>
                <View style={styles.bookingHeaderRow}>
                  <Text style={styles.petName}>{item.roomName}</Text>
                  <Badge variant={roomTypeVariant[item.roomType]}>{roomTypeLabel[item.roomType]}</Badge>
                </View>
                <Text style={styles.rowMeta}>Kapasitas {item.capacity} · {fmtMoney(item.pricePerNight)}/malam</Text>
                {item.description && <Text style={styles.rowMeta}>{item.description}</Text>}
                {!item.isActive && <Badge variant="gray">Nonaktif</Badge>}
              </View>
            )}
          />
          {isAdmin && (
            <TouchableOpacity style={styles.fab} onPress={() => setAddRoomVisible(true)}>
              <Text style={styles.fabText}>+ Kamar</Text>
            </TouchableOpacity>
          )}
          <AddRoomModal
            visible={addRoomVisible}
            onClose={() => setAddRoomVisible(false)}
            onSuccess={() => {
              setAddRoomVisible(false)
              fetchRooms()
            }}
          />
        </>
      )}

      {tab === 'kalender' && (
        <ScrollView contentContainerStyle={styles.listContent}>
          <View style={styles.weekNavRow}>
            <TouchableOpacity onPress={() => setCalMonth((m) => addMonths(m, -1))} style={styles.weekNavBtn}>
              <Text style={styles.weekNavText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.weekRangeText}>{format(calMonth, 'MMMM yyyy', { locale: localeId })}</Text>
            <TouchableOpacity onPress={() => setCalMonth((m) => addMonths(m, 1))} style={styles.weekNavBtn}>
              <Text style={styles.weekNavText}>›</Text>
            </TouchableOpacity>
          </View>
          {loadingCal ? (
            <ActivityIndicator color={colors.orange} />
          ) : occupancy.length === 0 ? (
            <Text style={styles.emptyText}>Tidak ada booking bulan ini</Text>
          ) : (
            occupancy.map((b) => {
              const view = statusView[b.status]
              return (
                <View key={b.id} style={styles.roomCard}>
                  <View style={styles.bookingHeaderRow}>
                    <Text style={styles.petName}>{b.patient.petName} → {b.room.roomName}</Text>
                    <Badge variant={view.variant}>{view.label}</Badge>
                  </View>
                  <Text style={styles.rowMeta}>{b.owner.ownerName}</Text>
                  <Text style={styles.rowMeta}>
                    {format(new Date(b.checkIn), 'd MMM', { locale: localeId })} - {format(new Date(b.checkOut), 'd MMM yyyy', { locale: localeId })}
                  </Text>
                </View>
              )
            })
          )}
        </ScrollView>
      )}
    </View>
  )
}

function AddBookingModal({
  visible,
  rooms,
  onClose,
  onSuccess,
}: {
  visible: boolean
  rooms: Room[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [patientQuery, setPatientQuery] = useState('')
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [specialNeeds, setSpecialNeeds] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) return
    setPatientQuery('')
    setPatientOptions([])
    setSelectedPatient(null)
    setSelectedRoom(null)
    setCheckIn('')
    setCheckOut('')
    setSpecialNeeds('')
    setNotes('')
  }, [visible])

  useEffect(() => {
    if (!visible || selectedPatient) return
    const t = setTimeout(() => {
      if (patientQuery.trim().length < 2) {
        setPatientOptions([])
        return
      }
      api.get('/pasien', { params: { search: patientQuery, limit: 10 } }).then((res) => setPatientOptions(res.data.data))
    }, 300)
    return () => clearTimeout(t)
  }, [patientQuery, visible, selectedPatient])

  const canSubmit = selectedPatient && selectedRoom && checkIn && checkOut

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await api.post('/pet-hotel/booking', {
        roomId: selectedRoom!.id,
        patientId: selectedPatient!.id,
        ownerId: selectedPatient!.owner.id,
        checkIn,
        checkOut,
        specialNeeds: specialNeeds || undefined,
        notes: notes || undefined,
      })
      onSuccess()
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.backText}>✕ Batal</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Booking Pet Hotel</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.label}>Pasien</Text>
          {selectedPatient ? (
            <View style={styles.selectedBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedName}>{selectedPatient.petName} · {selectedPatient.petCategory}</Text>
                <Text style={styles.selectedSub}>{selectedPatient.owner.ownerName}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPatient(null)}>
                <Text style={styles.changeText}>Ganti</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={patientQuery}
                onChangeText={setPatientQuery}
                placeholder="Ketik nama hewan (min 2 huruf)..."
                placeholderTextColor={colors.textSoft}
              />
              {patientOptions.map((p) => (
                <TouchableOpacity key={p.id} style={styles.optionRow} onPress={() => setSelectedPatient(p)}>
                  <Text style={styles.optionName}>{p.petName} · {p.petCategory}</Text>
                  <Text style={styles.optionSub}>{p.owner.ownerName}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <Text style={[styles.label, { marginTop: 16 }]}>Kamar</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {rooms.map((r) => {
              const active = selectedRoom?.id === r.id
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.doctorChip, active && styles.doctorChipActive]}
                  onPress={() => setSelectedRoom(r)}
                >
                  <Text style={[styles.doctorChipText, active && styles.doctorChipTextActive]}>{r.roomName}</Text>
                  <Text style={[styles.doctorChipLoad, active && styles.doctorChipTextActive]}>{fmtMoney(r.pricePerNight)}/malam</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Check-in (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={checkIn} onChangeText={setCheckIn} placeholder="2026-07-10" placeholderTextColor={colors.textSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Check-out (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={checkOut} onChangeText={setCheckOut} placeholder="2026-07-12" placeholderTextColor={colors.textSoft} />
            </View>
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Kebutuhan Khusus (opsional)</Text>
          <TextInput style={styles.input} value={specialNeeds} onChangeText={setSpecialNeeds} placeholder="Contoh: alergi ayam" placeholderTextColor={colors.textSoft} />

          <Text style={[styles.label, { marginTop: 12 }]}>Catatan (opsional)</Text>
          <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={colors.textSoft} />

          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || submitting) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Booking</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

function AddRoomModal({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const [roomName, setRoomName] = useState('')
  const [roomType, setRoomType] = useState<'vip' | 'reguler' | 'isolasi'>('reguler')
  const [capacity, setCapacity] = useState('1')
  const [pricePerNight, setPricePerNight] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) return
    setRoomName('')
    setRoomType('reguler')
    setCapacity('1')
    setPricePerNight('')
    setDescription('')
  }, [visible])

  const canSubmit = roomName.trim() && pricePerNight

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await api.post('/pet-hotel/kamar', {
        roomName: roomName.trim(),
        roomType,
        capacity: Number(capacity) || 1,
        pricePerNight: Number(pricePerNight),
        description: description || undefined,
      })
      onSuccess()
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.backText}>✕ Batal</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Tambah Kamar</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.label}>Nama Kamar</Text>
          <TextInput style={styles.input} value={roomName} onChangeText={setRoomName} placeholder="Contoh: Kamar A1" placeholderTextColor={colors.textSoft} />

          <Text style={[styles.label, { marginTop: 12 }]}>Tipe</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['vip', 'reguler', 'isolasi'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, roomType === t && styles.typeChipActive]}
                onPress={() => setRoomType(t)}
              >
                <Text style={[styles.typeChipText, roomType === t && styles.typeChipTextActive]}>{roomTypeLabel[t]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Kapasitas</Text>
              <TextInput style={styles.input} value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholderTextColor={colors.textSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Harga/Malam</Text>
              <TextInput style={styles.input} value={pricePerNight} onChangeText={setPricePerNight} keyboardType="number-pad" placeholder="150000" placeholderTextColor={colors.textSoft} />
            </View>
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Deskripsi (opsional)</Text>
          <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} multiline placeholderTextColor={colors.textSoft} />

          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || submitting) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Simpan</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
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
  listContent: { padding: 18, paddingTop: 4, paddingBottom: 90 },
  bookingCard: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 },
  bookingHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  petName: { fontSize: 14, fontWeight: '800', color: colors.textDark, flexShrink: 1 },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  specialNeeds: { fontSize: 11, fontWeight: '700', color: colors.orangeDk, marginTop: 4 },
  priceText: { fontSize: 14, fontWeight: '800', color: colors.textDark, marginTop: 6 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  roomCard: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 24, right: 18, backgroundColor: colors.orange, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 999, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  weekNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  weekNavBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  weekNavText: { fontSize: 18, fontWeight: '800', color: colors.orangeDk },
  weekRangeText: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  modalScreen: { flex: 1, backgroundColor: colors.warmBg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 18, paddingBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textDark },
  modalContent: { padding: 18, paddingTop: 4, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMid, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  row2: { flexDirection: 'row', gap: 12, marginTop: 12 },
  optionRow: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, padding: 12, marginTop: 8 },
  optionName: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  optionSub: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  selectedBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.orangeLt, borderRadius: 12, borderWidth: 1.5, borderColor: colors.orange, padding: 12 },
  selectedName: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  selectedSub: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  changeText: { fontSize: 12, fontWeight: '700', color: colors.orangeDk },
  doctorChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, marginRight: 8 },
  doctorChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  doctorChipText: { fontSize: 12, fontWeight: '700', color: colors.textDark },
  doctorChipLoad: { fontSize: 10, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  doctorChipTextActive: { color: '#fff' },
  typeChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  typeChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  typeChipText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  typeChipTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: colors.orange, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
