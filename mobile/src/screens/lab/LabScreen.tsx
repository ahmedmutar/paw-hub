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
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface LabRequest {
  id: string
  testType: string
  notes?: string
  status: 'pending' | 'processing' | 'ready'
  priority: 'normal' | 'urgent'
  createdAt: string
  patient: { petName: string; petCategory: string }
  requestedBy: { fullname: string }
  result?: { isReady: boolean; readyAt?: string } | null
}

interface Template {
  key: string
  label: string
  fields: { key: string; label: string; unit?: string; normalMin?: number; normalMax?: number }[]
}

interface PatientOption {
  id: string
  petName: string
  petCategory: string
  owner: { ownerName: string }
}

const EXTRA_TEST_TYPES = [
  { key: 'rontgen', label: 'Rontgen' },
  { key: 'usg', label: 'USG' },
  { key: 'kultur', label: 'Kultur' },
  { key: 'lainnya', label: 'Lainnya' },
]

const statusView: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Menunggu', variant: 'yellow' },
  processing: { label: 'Diproses', variant: 'blue' },
  ready: { label: 'Siap', variant: 'green' },
}
const STATUS_FILTERS = ['semua', 'pending', 'processing', 'ready']

export default function LabScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [statusFilter, setStatusFilter] = useState('semua')
  const [items, setItems] = useState<LabRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [addVisible, setAddVisible] = useState(false)

  const fetchList = useCallback(async () => {
    const res = await api.get('/lab/request', {
      params: { status: statusFilter === 'semua' ? undefined : statusFilter, limit: 30 },
    })
    setItems(res.data.data)
  }, [statusFilter])

  useEffect(() => {
    setLoading(true)
    fetchList().finally(() => setLoading(false))
  }, [fetchList])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchList()
    setRefreshing(false)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Lab</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddVisible(true)}>
            <Text style={styles.addBtnText}>+ Request</Text>
          </TouchableOpacity>
        </View>
      </View>

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
              <Text style={{ fontSize: 32 }}>🧪</Text>
              <Text style={styles.emptyText}>Belum ada request lab untuk filter ini</Text>
            </View>
          }
          renderItem={({ item }) => {
            const view = statusView[item.status]
            return (
              <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('LabResult', { id: item.id })}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.petName}>{item.patient.petName} · {item.patient.petCategory}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {item.priority === 'urgent' && <Badge variant="red">Urgent</Badge>}
                    <Badge variant={view.variant}>{view.label}</Badge>
                  </View>
                </View>
                <Text style={styles.rowMeta}>{item.testType}</Text>
                <Text style={styles.rowMeta}>Diminta oleh {item.requestedBy.fullname} · {format(new Date(item.createdAt), 'd MMM yyyy', { locale: localeId })}</Text>
              </TouchableOpacity>
            )
          }}
        />
      )}

      <AddRequestModal
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

function AddRequestModal({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const [patientQuery, setPatientQuery] = useState('')
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [testType, setTestType] = useState('')
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) return
    setPatientQuery('')
    setPatientOptions([])
    setSelectedPatient(null)
    setTestType('')
    setPriority('normal')
    setNotes('')
    api.get('/lab/templates').then((res) => setTemplates(res.data.data))
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

  const canSubmit = selectedPatient && testType

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await api.post('/lab/request', {
        patientId: selectedPatient!.id,
        testType,
        notes: notes || undefined,
        priority,
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
          <Text style={styles.modalTitle}>Request Lab</Text>
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

          <Text style={[styles.label, { marginTop: 16 }]}>Jenis Pemeriksaan</Text>
          <View style={styles.typeGrid}>
            {templates.map((t) => (
              <TouchableOpacity key={t.key} style={[styles.typeChip, testType === t.key && styles.typeChipActive]} onPress={() => setTestType(t.key)}>
                <Text style={[styles.typeChipText, testType === t.key && styles.typeChipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
            {EXTRA_TEST_TYPES.map((t) => (
              <TouchableOpacity key={t.key} style={[styles.typeChip, testType === t.key && styles.typeChipActive]} onPress={() => setTestType(t.key)}>
                <Text style={[styles.typeChipText, testType === t.key && styles.typeChipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>Prioritas</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['normal', 'urgent'] as const).map((p) => (
              <TouchableOpacity key={p} style={[styles.typeChip, priority === p && styles.typeChipActive]} onPress={() => setPriority(p)}>
                <Text style={[styles.typeChipText, priority === p && styles.typeChipTextActive]}>{p === 'normal' ? 'Normal' : 'Urgent'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>Catatan (opsional)</Text>
          <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={colors.textSoft} />

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
  optionRow: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, padding: 12, marginTop: 8 },
  optionName: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  optionSub: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  selectedBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.orangeLt, borderRadius: 12, borderWidth: 1.5, borderColor: colors.orange, padding: 12 },
  selectedName: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  selectedSub: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  changeText: { fontSize: 12, fontWeight: '700', color: colors.orangeDk },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  typeChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  typeChipText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  typeChipTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: colors.orange, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
