import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import type { AppointmentStackParamList } from '../../navigation/RootNavigator'

interface AppointmentDetail {
  id: string
  ownerName: string
  ownerPhone: string
  petName: string
  petCategory?: string
  complaint: string
  notes?: string
  status: string
  declineReason?: string
  appointmentDate: string
  appointmentTime: string
  doctor?: { fullname: string } | null
  branch?: { branchName: string; address: string } | null
  patientId?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  confirmed: 'Dikonfirmasi',
  rescheduled: 'Dijadwal Ulang',
  converted: 'Selesai',
  declined: 'Ditolak',
  cancelled: 'Dibatalkan',
}

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: 'yellow',
  confirmed: 'blue',
  rescheduled: 'purple',
  converted: 'green',
  declined: 'red',
  cancelled: 'gray',
}

export default function AppointmentDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppointmentStackParamList>>()
  const route = useRoute<RouteProp<AppointmentStackParamList, 'AppointmentDetail'>>()
  const [item, setItem] = useState<AppointmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchDetail = () =>
    api.get(`/appointment/${route.params.id}`).then((res) => setItem(res.data.data))

  useEffect(() => {
    setLoading(true)
    fetchDetail().finally(() => setLoading(false))
  }, [route.params.id])

  const runAction = async (action: () => Promise<any>, confirmMsg?: string) => {
    if (confirmMsg) {
      const ok = await new Promise((resolve) => {
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
        <Text style={styles.emptyText}>Janji temu tidak ditemukan</Text>
      </View>
    )
  }

  const canConfirm = item.status === 'pending' || item.status === 'rescheduled'
  const canDecline = !['converted', 'cancelled', 'declined'].includes(item.status)
  const canConvert = (item.status === 'confirmed' || item.status === 'pending') && !!item.patientId

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Kembali</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.petName}>{item.petName}</Text>
          <Badge variant={STATUS_VARIANT[item.status] ?? 'gray'}>{STATUS_LABEL[item.status] ?? item.status}</Badge>
        </View>
        <Text style={styles.ownerName}>{item.ownerName}</Text>
        <Text style={styles.metaText}>{item.ownerPhone}</Text>
        <Text style={styles.metaText}>
          {format(new Date(item.appointmentDate), 'EEEE, d MMM yyyy', { locale: localeId })} · {item.appointmentTime}
        </Text>
        {item.doctor && <Text style={styles.metaText}>Dokter: {item.doctor.fullname}</Text>}
        {item.branch && <Text style={styles.metaText}>Cabang: {item.branch.branchName}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Keluhan</Text>
        <Text style={styles.bodyText}>{item.complaint}</Text>
        {item.notes && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Catatan</Text>
            <Text style={styles.bodyText}>{item.notes}</Text>
          </>
        )}
        {item.declineReason && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Alasan Penolakan</Text>
            <Text style={styles.bodyText}>{item.declineReason}</Text>
          </>
        )}
      </View>

      {(canConfirm || canDecline || canConvert) && (
        <View style={styles.actionRow}>
          {canConfirm && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.blue }]}
              disabled={actionLoading}
              onPress={() => runAction(() => api.put(`/appointment/${item.id}/confirm`, {}))}
            >
              <Text style={styles.actionBtnText}>Konfirmasi</Text>
            </TouchableOpacity>
          )}
          {canConvert && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.green }]}
              disabled={actionLoading}
              onPress={() =>
                runAction(
                  () => api.put(`/appointment/${item.id}/convert`, {}),
                  'Ubah janji temu ini menjadi antrian hari ini?'
                )
              }
            >
              <Text style={styles.actionBtnText}>Jadikan Antrian</Text>
            </TouchableOpacity>
          )}
          {canDecline && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.red }]}
              disabled={actionLoading}
              onPress={() =>
                runAction(
                  () => api.put(`/appointment/${item.id}/decline`, {}),
                  'Tolak janji temu ini?'
                )
              }
            >
              <Text style={styles.actionBtnText}>Tolak</Text>
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
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  petName: { fontSize: 18, fontWeight: '800', color: colors.textDark },
  ownerName: { fontSize: 14, fontWeight: '700', color: colors.textMid, marginTop: 8 },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: colors.textDark, marginBottom: 4 },
  bodyText: { fontSize: 13, fontWeight: '500', color: colors.textMid, lineHeight: 19 },
  actionRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', minWidth: 100 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
