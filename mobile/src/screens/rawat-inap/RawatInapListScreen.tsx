import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import { SearchBar } from '../../components/SearchBar'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface InPatient {
  id: string
  idNumber: string
  complaint: string
  registrant: string
  estimateDay?: number
  realityDay?: number
  acceptanceStatus: 'pending' | 'accepted' | 'declined' | 'cancelled'
  createdAt: string
  patient: { petName: string; petCategory: string; owner: { ownerName: string } }
}

interface Stats {
  pending: number
  accepted: number
  thisMonth: number
  total: number
}

interface PatientOption {
  id: string
  petName: string
  petCategory: string
  owner: { ownerName: string }
}

interface DoctorOption {
  id: string
  fullname: string
  todayLoad: number
}

const FILTERS = ['semua', 'pending', 'accepted', 'declined', 'cancelled']
const FILTER_LABEL: Record<string, string> = {
  semua: 'Semua',
  pending: 'Menunggu',
  accepted: 'Dirawat',
  declined: 'Ditolak',
  cancelled: 'Selesai',
}
const statusView: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Menunggu', variant: 'yellow' },
  accepted: { label: 'Sedang Dirawat', variant: 'teal' },
  declined: { label: 'Ditolak', variant: 'red' },
  cancelled: { label: 'Selesai', variant: 'green' },
}

export default function RawatInapListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [stats, setStats] = useState<Stats | null>(null)
  const [items, setItems] = useState<InPatient[]>([])
  const [statusFilter, setStatusFilter] = useState('semua')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [admitVisible, setAdmitVisible] = useState(false)

  const fetchStats = useCallback(() => {
    api.get('/rawat-inap/stats').then((res) => setStats(res.data.data))
  }, [])

  const fetchList = useCallback(
    async (pageNum = 1, append = false) => {
      const res = await api.get('/rawat-inap', {
        params: {
          page: pageNum,
          limit: 20,
          status: statusFilter === 'semua' ? undefined : statusFilter,
          search: search || undefined,
        },
      })
      const { data, meta } = res.data
      setItems((prev) => (append ? [...prev, ...data] : data))
      setTotalPages(meta.totalPages)
      setPage(meta.page)
    },
    [statusFilter, search]
  )

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchStats(), fetchList(1)]).finally(() => setLoading(false))
  }, [fetchList, fetchStats])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchStats(), fetchList(1)])
    setRefreshing(false)
  }

  const loadMore = () => {
    if (page < totalPages) fetchList(page + 1, true)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Rawat Inap</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAdmitVisible(true)}>
            <Text style={styles.addBtnText}>+ Daftarkan</Text>
          </TouchableOpacity>
        </View>
      </View>

      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Menunggu</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.accepted}</Text>
            <Text style={styles.statLabel}>Dirawat</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.thisMonth}</Text>
            <Text style={styles.statLabel}>Bulan Ini</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      )}

      <View style={styles.searchWrap}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Cari nama hewan..." />
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
              {FILTER_LABEL[f]}
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
              <Text style={{ fontSize: 32 }}>🏥</Text>
              <Text style={styles.emptyText}>Belum ada data untuk filter ini</Text>
            </View>
          }
          renderItem={({ item }) => {
            const view = statusView[item.acceptanceStatus]
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => navigation.navigate('RawatInapDetail', { id: item.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.idNumber}>{item.idNumber}</Text>
                  <Text style={styles.petName}>
                    {item.patient.petName} · {item.patient.petCategory}
                  </Text>
                  <Text style={styles.rowMeta}>{item.patient.owner.ownerName}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>{item.complaint}</Text>
                </View>
                <Badge variant={view.variant}>{view.label}</Badge>
              </TouchableOpacity>
            )
          }}
        />
      )}

      <AdmitModal
        visible={admitVisible}
        onClose={() => setAdmitVisible(false)}
        onSuccess={() => {
          setAdmitVisible(false)
          fetchStats()
          fetchList(1)
        }}
      />
    </View>
  )
}

function AdmitModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [patientQuery, setPatientQuery] = useState('')
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorOption | null>(null)
  const [complaint, setComplaint] = useState('')
  const [registrant, setRegistrant] = useState('')
  const [estimateDay, setEstimateDay] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) return
    setPatientQuery('')
    setPatientOptions([])
    setSelectedPatient(null)
    setSelectedDoctor(null)
    setComplaint('')
    setRegistrant('')
    setEstimateDay('')
    api.get('/registrasi/dokter').then((res) => setDoctors(res.data.data))
  }, [visible])

  useEffect(() => {
    if (!visible || selectedPatient) return
    const t = setTimeout(() => {
      if (patientQuery.trim().length < 2) {
        setPatientOptions([])
        return
      }
      api
        .get('/pasien', { params: { search: patientQuery, limit: 10 } })
        .then((res) => setPatientOptions(res.data.data))
    }, 300)
    return () => clearTimeout(t)
  }, [patientQuery, visible, selectedPatient])

  const canSubmit = selectedPatient && selectedDoctor && complaint.trim() && registrant.trim()

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await api.post('/rawat-inap', {
        patientId: selectedPatient!.id,
        doctorUserId: selectedDoctor!.id,
        complaint: complaint.trim(),
        registrant: registrant.trim(),
        estimateDay: estimateDay ? Number(estimateDay) : undefined,
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
          <Text style={styles.modalTitle}>Daftarkan Rawat Inap</Text>
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

          <Text style={[styles.label, { marginTop: 16 }]}>Dokter Penanggung Jawab</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {doctors.map((d) => {
              const active = selectedDoctor?.id === d.id
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.doctorChip, active && styles.doctorChipActive]}
                  onPress={() => setSelectedDoctor(d)}
                >
                  <Text style={[styles.doctorChipText, active && styles.doctorChipTextActive]}>{d.fullname}</Text>
                  <Text style={[styles.doctorChipLoad, active && styles.doctorChipTextActive]}>{d.todayLoad} pasien hari ini</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          <Text style={[styles.label, { marginTop: 16 }]}>Keluhan</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={complaint}
            onChangeText={setComplaint}
            placeholder="Keluhan / alasan rawat inap"
            placeholderTextColor={colors.textSoft}
            multiline
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Nama Pendaftar</Text>
          <TextInput
            style={styles.input}
            value={registrant}
            onChangeText={setRegistrant}
            placeholder="Nama yang mendaftarkan"
            placeholderTextColor={colors.textSoft}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Estimasi Hari Rawat (opsional)</Text>
          <TextInput
            style={styles.input}
            value={estimateDay}
            onChangeText={setEstimateDay}
            placeholder="Contoh: 3"
            placeholderTextColor={colors.textSoft}
            keyboardType="number-pad"
          />

          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || submitting) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Daftarkan</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  header: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 4 },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.orangeDk },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  addBtn: { backgroundColor: colors.orange, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 12 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.textDark },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textSoft, marginTop: 2, textAlign: 'center' },
  searchWrap: { paddingHorizontal: 18, marginTop: 12, marginBottom: -4 },
  filterRow: { flexGrow: 0, marginVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
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
    gap: 12,
  },
  idNumber: { fontSize: 11, fontWeight: '700', color: colors.textSoft },
  petName: { fontSize: 14, fontWeight: '700', color: colors.textDark, marginTop: 2 },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
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
  submitBtn: { backgroundColor: colors.orange, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
