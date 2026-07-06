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

interface InPatientDetail {
  id: string
  idNumber: string
  complaint: string
  registrant: string
  estimateDay?: number
  realityDay?: number
  acceptanceStatus: 'pending' | 'accepted' | 'declined' | 'cancelled'
  createdAt: string
  patient: { petName: string; petCategory: string; petGender?: string; owner: { ownerName: string; phoneNumber?: string } }
  branch: { branchName: string }
}

const statusView: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Menunggu', variant: 'yellow' },
  accepted: { label: 'Sedang Dirawat', variant: 'teal' },
  declined: { label: 'Ditolak', variant: 'red' },
  cancelled: { label: 'Selesai', variant: 'green' },
}

export default function RawatInapDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'RawatInapDetail'>>()
  const { id } = route.params

  const [item, setItem] = useState<InPatientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [realityDay, setRealityDay] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchDetail = useCallback(
    () => api.get(`/rawat-inap/${id}`).then((res) => setItem(res.data.data)),
    [id]
  )

  useEffect(() => {
    setLoading(true)
    fetchDetail().finally(() => setLoading(false))
  }, [fetchDetail])

  const changeStatus = async (status: 'accepted' | 'declined' | 'cancelled') => {
    if (status === 'cancelled' && !realityDay) {
      Alert.alert('Lengkapi dulu', 'Isi jumlah hari rawat aktual sebelum discharge.')
      return
    }
    setSubmitting(true)
    try {
      await api.put(`/rawat-inap/${id}/status`, {
        status,
        realityDay: status === 'cancelled' ? Number(realityDay) : undefined,
      })
      await fetchDetail()
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

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Data tidak ditemukan</Text>
      </View>
    )
  }

  const view = statusView[item.acceptanceStatus]

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Kembali</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.idNumber}>{item.idNumber}</Text>
          <Badge variant={view.variant}>{view.label}</Badge>
        </View>
        <Text style={styles.petName}>{item.patient.petName} · {item.patient.petCategory}</Text>
        <Text style={styles.metaText}>{item.patient.owner.ownerName}{item.patient.owner.phoneNumber ? ` · ${item.patient.owner.phoneNumber}` : ''}</Text>
        <Text style={styles.metaText}>Cabang: {item.branch.branchName}</Text>
        <Text style={styles.metaText}>Tgl Masuk: {format(new Date(item.createdAt), 'd MMMM yyyy, HH:mm', { locale: localeId })}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Keluhan</Text>
        <Text style={styles.bodyText}>{item.complaint}</Text>

        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Pendaftar</Text>
        <Text style={styles.bodyText}>{item.registrant}</Text>

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Estimasi Hari</Text>
            <Text style={styles.bodyText}>{item.estimateDay ?? '-'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Hari Aktual</Text>
            <Text style={styles.bodyText}>{item.realityDay ?? '-'}</Text>
          </View>
        </View>
      </View>

      {item.acceptanceStatus === 'pending' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ubah Status</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.green }]}
              onPress={() => changeStatus('accepted')}
              disabled={submitting}
            >
              <Text style={styles.actionBtnText}>Terima Pasien</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.red }]}
              onPress={() => changeStatus('declined')}
              disabled={submitting}
            >
              <Text style={styles.actionBtnText}>Tolak</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {item.acceptanceStatus === 'accepted' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Discharge / Selesai Rawat</Text>
          <Text style={[styles.label, { marginTop: 10 }]}>Hari Aktual Perawatan</Text>
          <TextInput
            style={styles.input}
            value={realityDay}
            onChangeText={setRealityDay}
            placeholder="Contoh: 4"
            placeholderTextColor={colors.textSoft}
            keyboardType="number-pad"
          />
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
            onPress={() => changeStatus('cancelled')}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Discharge Pasien</Text>}
          </TouchableOpacity>
        </View>
      )}
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  idNumber: { fontSize: 12, fontWeight: '700', color: colors.textSoft },
  petName: { fontSize: 18, fontWeight: '800', color: colors.textDark, marginTop: 8 },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: colors.textMid },
  bodyText: { fontSize: 14, fontWeight: '600', color: colors.textDark, marginTop: 4 },
  row2: { flexDirection: 'row', gap: 16, marginTop: 14 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
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
  submitBtn: { backgroundColor: colors.red, paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 14 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
