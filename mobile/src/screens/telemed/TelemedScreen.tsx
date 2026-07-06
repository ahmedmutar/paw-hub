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
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/auth.store'
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface Session {
  id: string
  status: 'pending' | 'confirmed' | 'ongoing' | 'done' | 'cancelled'
  channel: 'chat' | 'video'
  scheduledAt: string
  complaint: string
  fee: string
  isPaid: boolean
  patient: { petName: string; petCategory: string }
  owner: { ownerName: string }
  doctor: { fullname: string }
}

interface Rekap {
  total: number
  done: number
  pending: number
  cancelled: number
  totalRevenue: number
}

interface PatientOption {
  id: string
  petName: string
  petCategory: string
  owner: { id: string; ownerName: string }
}

interface DoctorOption {
  id: string
  fullname: string
}

const statusView: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Menunggu', variant: 'yellow' },
  confirmed: { label: 'Dikonfirmasi', variant: 'blue' },
  ongoing: { label: 'Berlangsung', variant: 'teal' },
  done: { label: 'Selesai', variant: 'green' },
  cancelled: { label: 'Dibatalkan', variant: 'red' },
}
const STATUS_FILTERS = ['semua', 'pending', 'confirmed', 'done', 'cancelled']

const fmtMoney = (n: string | number) =>
  Number(n).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function TelemedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const [statusFilter, setStatusFilter] = useState('semua')
  const [items, setItems] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [rekap, setRekap] = useState<Rekap | null>(null)
  const [addVisible, setAddVisible] = useState(false)

  const fetchList = useCallback(async () => {
    const res = await api.get('/telemed/sessions', {
      params: { status: statusFilter === 'semua' ? undefined : statusFilter, limit: 30 },
    })
    setItems(res.data.data)
  }, [statusFilter])

  const fetchRekap = useCallback(() => {
    if (!isAdmin) return
    api.get('/telemed/rekap').then((res) => setRekap(res.data.data))
  }, [isAdmin])

  useEffect(() => {
    setLoading(true)
    fetchList().finally(() => setLoading(false))
    fetchRekap()
  }, [fetchList, fetchRekap])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchList(), fetchRekap()])
    setRefreshing(false)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Telemedicine</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddVisible(true)}>
            <Text style={styles.addBtnText}>+ Request</Text>
          </TouchableOpacity>
        </View>
      </View>

      {rekap && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{rekap.pending}</Text>
            <Text style={styles.statLabel}>Menunggu</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{rekap.done}</Text>
            <Text style={styles.statLabel}>Selesai</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { fontSize: 12 }]}>{fmtMoney(rekap.totalRevenue)}</Text>
            <Text style={styles.statLabel}>Omzet Bulan Ini</Text>
          </View>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity key={f} onPress={() => setStatusFilter(f)} style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>
              {f === 'semua' ? 'Semua' : statusView[f].label}
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
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 32 }}>💻</Text>
              <Text style={styles.emptyText}>Belum ada sesi konsultasi untuk filter ini</Text>
            </View>
          }
          renderItem={({ item }) => {
            const view = statusView[item.status]
            return (
              <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('TelemedDetail', { id: item.id })}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.petName}>{item.patient.petName} · {item.patient.petCategory}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {item.isPaid && <Badge variant="green">Lunas</Badge>}
                    <Badge variant={view.variant}>{view.label}</Badge>
                  </View>
                </View>
                <Text style={styles.rowMeta}>{item.owner.ownerName} · {item.doctor.fullname}</Text>
                <Text style={styles.rowMeta}>{item.channel === 'video' ? '🎥 Video' : '💬 Chat'} · {format(new Date(item.scheduledAt), 'd MMM yyyy, HH:mm', { locale: localeId })}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>{item.complaint}</Text>
                <Text style={styles.priceText}>{fmtMoney(item.fee)}</Text>
              </TouchableOpacity>
            )
          }}
        />
      )}

      <AddSessionModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onSuccess={() => {
          setAddVisible(false)
          fetchList()
        }}
      />
    </View>
  )
}

function AddSessionModal({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const [patientQuery, setPatientQuery] = useState('')
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorOption | null>(null)
  const [channel, setChannel] = useState<'chat' | 'video'>('chat')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [complaint, setComplaint] = useState('')
  const [fee, setFee] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) return
    setPatientQuery('')
    setPatientOptions([])
    setSelectedPatient(null)
    setSelectedDoctor(null)
    setChannel('chat')
    setScheduledDate('')
    setScheduledTime('')
    setComplaint('')
    setFee('')
    api.get('/registrasi/dokter').then((res) => setDoctors(res.data.data))
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

  const canSubmit = selectedPatient && selectedDoctor && scheduledDate && scheduledTime && complaint.trim()

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await api.post('/telemed/request', {
        patientId: selectedPatient!.id,
        ownerId: selectedPatient!.owner.id,
        doctorId: selectedDoctor!.id,
        complaint: complaint.trim(),
        scheduledAt: `${scheduledDate}T${scheduledTime}:00`,
        fee: fee ? Number(fee) : 0,
        channel,
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
          <Text style={styles.modalTitle}>Request Konsultasi</Text>
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

          <Text style={[styles.label, { marginTop: 16 }]}>Dokter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {doctors.map((d) => {
              const active = selectedDoctor?.id === d.id
              return (
                <TouchableOpacity key={d.id} style={[styles.doctorChip, active && styles.doctorChipActive]} onPress={() => setSelectedDoctor(d)}>
                  <Text style={[styles.doctorChipText, active && styles.doctorChipTextActive]}>{d.fullname}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          <Text style={[styles.label, { marginTop: 12 }]}>Channel</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['chat', 'video'] as const).map((c) => (
              <TouchableOpacity key={c} style={[styles.typeChip, channel === c && styles.typeChipActive]} onPress={() => setChannel(c)}>
                <Text style={[styles.typeChipText, channel === c && styles.typeChipTextActive]}>{c === 'chat' ? '💬 Chat' : '🎥 Video'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Tanggal (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={scheduledDate} onChangeText={setScheduledDate} placeholder="2026-07-10" placeholderTextColor={colors.textSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Jam (HH:mm)</Text>
              <TextInput style={styles.input} value={scheduledTime} onChangeText={setScheduledTime} placeholder="14:00" placeholderTextColor={colors.textSoft} />
            </View>
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Keluhan</Text>
          <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} value={complaint} onChangeText={setComplaint} multiline placeholderTextColor={colors.textSoft} />

          <Text style={[styles.label, { marginTop: 12 }]}>Biaya Konsultasi (opsional)</Text>
          <TextInput style={styles.input} value={fee} onChangeText={setFee} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSoft} />

          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || submitting) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Kirim Request</Text>}
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  addBtn: { backgroundColor: colors.orange, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 8, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.textDark },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textSoft, marginTop: 2, textAlign: 'center' },
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
  priceText: { fontSize: 14, fontWeight: '800', color: colors.textDark, marginTop: 6 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft, textAlign: 'center' },
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
  doctorChipTextActive: { color: '#fff' },
  typeChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  typeChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  typeChipText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  typeChipTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: colors.orange, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
