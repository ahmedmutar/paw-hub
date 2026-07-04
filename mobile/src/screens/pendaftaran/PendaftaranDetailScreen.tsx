import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge } from '../../components/Badge'
import { useAuthStore } from '../../stores/auth.store'
import { registrationStatusView } from './statusView'
import type { PendaftaranStackParamList } from '../../navigation/RootNavigator'

interface RegistrationDetail {
  id: string
  idNumber: string
  queueNumber: number
  visitType: string
  isPriority: boolean
  complaint: string
  registrant: string
  acceptanceStatus: string
  cancelReason?: string
  createdAt: string
  patient: {
    petName: string
    petCategory: string
    petGender?: string
    owner: { ownerName: string; phoneNumber: string }
    medicalRecord?: { allergies?: string; chronicConditions?: string }
  }
  doctor: { fullname: string }
  checkUpResult?: { statusFinish: boolean; statusPaidOff: boolean; diagnosa?: string }
}

export default function PendaftaranDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<PendaftaranStackParamList>>()
  const route = useRoute<RouteProp<PendaftaranStackParamList, 'PendaftaranDetail'>>()
  const role = useAuthStore((s) => s.user?.role)
  const [item, setItem] = useState<RegistrationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchDetail = () =>
    api.get(`/registrasi/${route.params.id}`).then((res) => setItem(res.data.data))

  useEffect(() => {
    setLoading(true)
    fetchDetail().finally(() => setLoading(false))
  }, [route.params.id])

  const runAction = async (action: () => Promise<any>, confirmMsg?: string) => {
    if (confirmMsg) {
      const ok = await new Promise<boolean>((resolve) => {
        Alert.alert('Konfirmasi', confirmMsg, [
          { text: 'Batal', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Ya', onPress: () => resolve(true) },
        ])
      })
      if (!ok) return
    }
    setActionLoading(true)
    try {
      await action()
      await fetchDetail()
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setActionLoading(false)
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
        <Text style={styles.emptyText}>Data antrian tidak ditemukan</Text>
      </View>
    )
  }

  const view = registrationStatusView(item.acceptanceStatus, item.checkUpResult)
  const isPending = item.acceptanceStatus === 'pending'
  const canTerimaTolak = isPending && (role === 'admin' || role === 'dokter')
  const canBatal = isPending && (role === 'admin' || role === 'resepsionis')
  const canPeriksa =
    item.acceptanceStatus === 'accepted' && !item.checkUpResult?.statusFinish && (role === 'admin' || role === 'dokter')

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Kembali</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.queueBadge}>
            <Text style={styles.queueNumber}>#{item.queueNumber}</Text>
          </View>
          <Badge variant={view.variant}>{view.label}</Badge>
        </View>
        <Text style={styles.petName}>{item.patient.petName}</Text>
        <Text style={styles.metaText}>
          {item.patient.petCategory}
          {item.patient.petGender ? ` · ${item.patient.petGender}` : ''}
        </Text>
        {item.isPriority && <Text style={styles.priorityTag}>⚡ Pasien Prioritas</Text>}
        <Text style={styles.metaText}>No. Registrasi: {item.idNumber}</Text>
        <Text style={styles.metaText}>Jenis Kunjungan: {item.visitType}</Text>
        <Text style={styles.metaText}>
          {format(new Date(item.createdAt), 'd MMM yyyy, HH:mm', { locale: localeId })}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pemilik</Text>
        <Text style={styles.ownerName}>{item.patient.owner.ownerName}</Text>
        <Text style={styles.metaText}>{item.patient.owner.phoneNumber}</Text>
        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Petugas Pendaftar</Text>
        <Text style={styles.metaText}>{item.registrant}</Text>
        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Dokter</Text>
        <Text style={styles.metaText}>{item.doctor.fullname}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Keluhan</Text>
        <Text style={styles.bodyText}>{item.complaint}</Text>
        {item.patient.medicalRecord?.allergies && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Alergi</Text>
            <Text style={styles.bodyText}>{item.patient.medicalRecord.allergies}</Text>
          </>
        )}
        {item.checkUpResult?.diagnosa && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Diagnosa</Text>
            <Text style={styles.bodyText}>{item.checkUpResult.diagnosa}</Text>
          </>
        )}
        {item.cancelReason && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Alasan</Text>
            <Text style={styles.bodyText}>{item.cancelReason}</Text>
          </>
        )}
      </View>

      {canPeriksa && (
        <TouchableOpacity
          style={styles.periksaBtn}
          onPress={() => navigation.navigate('Pemeriksaan', { registrationId: item.id })}
        >
          <Text style={styles.actionBtnText}>
            {item.checkUpResult ? 'Lanjutkan Periksa' : 'Mulai Periksa'}
          </Text>
        </TouchableOpacity>
      )}

      {(canTerimaTolak || canBatal) && (
        <View style={styles.actionRow}>
          {canTerimaTolak && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.blue }]}
              disabled={actionLoading}
              onPress={() => runAction(() => api.post(`/registrasi/${item.id}/terima`))}
            >
              <Text style={styles.actionBtnText}>Terima</Text>
            </TouchableOpacity>
          )}
          {canTerimaTolak && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.red }]}
              disabled={actionLoading}
              onPress={() =>
                runAction(() => api.post(`/registrasi/${item.id}/tolak`, {}), 'Tolak pendaftaran ini?')
              }
            >
              <Text style={styles.actionBtnText}>Tolak</Text>
            </TouchableOpacity>
          )}
          {canBatal && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.textSoft }]}
              disabled={actionLoading}
              onPress={() =>
                runAction(() => api.post(`/registrasi/${item.id}/batalkan`, {}), 'Batalkan antrian ini?')
              }
            >
              <Text style={styles.actionBtnText}>Batalkan</Text>
            </TouchableOpacity>
          )}
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
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 12,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  queueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.orangeLt,
  },
  queueNumber: { fontSize: 14, fontWeight: '800', color: colors.orangeDk },
  petName: { fontSize: 18, fontWeight: '800', color: colors.textDark },
  priorityTag: { fontSize: 12, fontWeight: '700', color: colors.red, marginTop: 6 },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  ownerName: { fontSize: 15, fontWeight: '700', color: colors.textDark },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: colors.textDark, marginBottom: 4 },
  bodyText: { fontSize: 13, fontWeight: '500', color: colors.textMid, lineHeight: 19 },
  periksaBtn: {
    backgroundColor: colors.teal,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', minWidth: 100 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
