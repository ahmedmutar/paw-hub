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
import { useAuthStore } from '../../stores/auth.store'
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface SessionDetail {
  id: string
  status: 'pending' | 'confirmed' | 'ongoing' | 'done' | 'cancelled'
  channel: 'chat' | 'video'
  scheduledAt: string
  complaint: string
  doctorNotes?: string
  ePrescription?: string
  fee: string
  isPaid: boolean
  patient: { petName: string; petCategory: string }
  owner: { ownerName: string; phoneNumber?: string }
  doctor: { fullname: string }
}

const statusView: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Menunggu', variant: 'yellow' },
  confirmed: { label: 'Dikonfirmasi', variant: 'blue' },
  ongoing: { label: 'Berlangsung', variant: 'teal' },
  done: { label: 'Selesai', variant: 'green' },
  cancelled: { label: 'Dibatalkan', variant: 'red' },
}

const fmtMoney = (n: string | number) =>
  Number(n).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function TelemedDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'TelemedDetail'>>()
  const { id } = route.params
  const { user } = useAuthStore()
  const canManageClinical = user?.role === 'dokter' || user?.role === 'admin' || user?.role === 'superadmin'
  const canBilling = user?.role === 'admin' || user?.role === 'kasir' || user?.role === 'superadmin'

  const [item, setItem] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [doctorNotes, setDoctorNotes] = useState('')
  const [ePrescription, setEPrescription] = useState('')

  const fetchDetail = useCallback(() => api.get(`/telemed/session/${id}`).then((res) => setItem(res.data.data)), [id])

  useEffect(() => {
    setLoading(true)
    fetchDetail().finally(() => setLoading(false))
  }, [fetchDetail])

  useEffect(() => {
    if (item) {
      setDoctorNotes(item.doctorNotes ?? '')
      setEPrescription(item.ePrescription ?? '')
    }
  }, [item])

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      await api.patch(`/telemed/session/${id}/confirm`, {})
      await fetchDetail()
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFinish = async () => {
    setSubmitting(true)
    try {
      await api.patch(`/telemed/session/${id}/notes`, { doctorNotes, ePrescription, status: 'done' })
      await fetchDetail()
      Alert.alert('Berhasil', 'Konsultasi selesai, e-resep terkirim ke pemilik.')
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveNotes = async () => {
    setSubmitting(true)
    try {
      await api.patch(`/telemed/session/${id}/notes`, { doctorNotes, ePrescription, status: item?.status })
      await fetchDetail()
      Alert.alert('Tersimpan', 'Catatan berhasil disimpan.')
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkPaid = async () => {
    setSubmitting(true)
    try {
      await api.post(`/telemed/billing/${id}`, {})
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
        <Text style={styles.emptyText}>Sesi tidak ditemukan</Text>
      </View>
    )
  }

  const view = statusView[item.status]

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Kembali</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.petName}>{item.patient.petName} · {item.patient.petCategory}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {item.isPaid && <Badge variant="green">Lunas</Badge>}
            <Badge variant={view.variant}>{view.label}</Badge>
          </View>
        </View>
        <Text style={styles.metaText}>{item.owner.ownerName}{item.owner.phoneNumber ? ` · ${item.owner.phoneNumber}` : ''}</Text>
        <Text style={styles.metaText}>Dokter: {item.doctor.fullname}</Text>
        <Text style={styles.metaText}>{item.channel === 'video' ? '🎥 Video' : '💬 Chat'} · {format(new Date(item.scheduledAt), 'd MMMM yyyy, HH:mm', { locale: localeId })}</Text>
        <Text style={styles.priceText}>{fmtMoney(item.fee)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Keluhan</Text>
        <Text style={styles.bodyText}>{item.complaint}</Text>
      </View>

      {item.status === 'pending' && canManageClinical && (
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.blue }]} onPress={handleConfirm} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Konfirmasi Konsultasi</Text>}
        </TouchableOpacity>
      )}

      {(item.status === 'confirmed' || item.status === 'ongoing') && canManageClinical && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Catatan Dokter</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top', marginTop: 8 }]}
            value={doctorNotes}
            onChangeText={setDoctorNotes}
            placeholder="Hasil diskusi/pemeriksaan via chat/video..."
            placeholderTextColor={colors.textSoft}
            multiline
          />
          <Text style={[styles.sectionTitle, { marginTop: 14 }]}>E-Resep</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top', marginTop: 8 }]}
            value={ePrescription}
            onChangeText={setEPrescription}
            placeholder="Nama obat, dosis, cara pakai..."
            placeholderTextColor={colors.textSoft}
            multiline
          />
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtnFlex, { backgroundColor: colors.textSoft }]} onPress={handleSaveNotes} disabled={submitting}>
              <Text style={styles.actionBtnText}>Simpan Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnFlex, { backgroundColor: colors.green }]} onPress={handleFinish} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Selesaikan & Kirim Resep</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {(item.doctorNotes || item.ePrescription) && item.status === 'done' && (
        <View style={styles.card}>
          {item.doctorNotes && (
            <>
              <Text style={styles.sectionTitle}>Catatan Dokter</Text>
              <Text style={styles.bodyText}>{item.doctorNotes}</Text>
            </>
          )}
          {item.ePrescription && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>E-Resep</Text>
              <Text style={styles.bodyText}>{item.ePrescription}</Text>
            </>
          )}
        </View>
      )}

      {item.status === 'done' && !item.isPaid && canBilling && (
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.green }]} onPress={handleMarkPaid} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Tandai Lunas</Text>}
        </TouchableOpacity>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  petName: { fontSize: 16, fontWeight: '800', color: colors.textDark, flexShrink: 1 },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  priceText: { fontSize: 16, fontWeight: '800', color: colors.textDark, marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark },
  bodyText: { fontSize: 13, fontWeight: '500', color: colors.textMid, lineHeight: 19, marginTop: 4 },
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
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  actionBtnFlex: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
