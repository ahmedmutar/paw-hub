import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge } from '../../components/Badge'
import type { PasienStackParamList } from '../../navigation/RootNavigator'

interface Registration {
  id: string
  idNumber: string
  complaint: string
  createdAt: string
  doctor?: { fullname: string }
  checkUpResult?: { diagnosa?: string; statusPaidOff: boolean; statusFinish: boolean }
}

interface PatientDetail {
  id: string
  idMember: string
  petCategory: string
  petName: string
  petGender?: string
  petYearAge?: number
  petMonthAge?: number
  owner: { ownerName: string; phoneNumber?: string; address?: string }
  medicalRecord?: { allergies?: string; chronicConditions?: string; specialNotes?: string }
  registrations: Registration[]
  _count?: { registrations: number }
}

function statusBadge(reg: Registration) {
  if (!reg.checkUpResult) return <Badge variant="gray">Belum Diperiksa</Badge>
  if (!reg.checkUpResult.statusFinish) return <Badge variant="blue">Dalam Proses</Badge>
  if (!reg.checkUpResult.statusPaidOff) return <Badge variant="yellow">Menunggu Bayar</Badge>
  return <Badge variant="green">Lunas</Badge>
}

export default function PasienDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<PasienStackParamList>>()
  const route = useRoute<RouteProp<PasienStackParamList, 'PasienDetail'>>()
  const [patient, setPatient] = useState<PatientDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .get(`/pasien/${route.params.id}`)
      .then((res) => setPatient(res.data.data))
      .finally(() => setLoading(false))
  }, [route.params.id])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    )
  }

  if (!patient) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Pasien tidak ditemukan</Text>
      </View>
    )
  }

  const age =
    patient.petYearAge || patient.petMonthAge
      ? `${patient.petYearAge ?? 0} th ${patient.petMonthAge ?? 0} bln`
      : null

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Kembali</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.petName}>{patient.petName}</Text>
        <Text style={styles.idMember}>{patient.idMember}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{patient.petCategory}</Text>
          {patient.petGender && <Text style={styles.metaText}> · {patient.petGender}</Text>}
          {age && <Text style={styles.metaText}> · {age}</Text>}
        </View>
        <TouchableOpacity
          style={styles.rekamMedisBtn}
          onPress={() => navigation.navigate('RekamMedis', { patientId: patient.id })}
        >
          <Text style={styles.rekamMedisBtnText}>📖 Lihat Rekam Medis Lengkap</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rekamMedisBtn, { marginTop: 8 }]}
          onPress={() => navigation.navigate('LabHistory', { patientId: patient.id })}
        >
          <Text style={styles.rekamMedisBtnText}>🧪 Riwayat Lab</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pemilik</Text>
        <Text style={styles.ownerName}>{patient.owner.ownerName}</Text>
        {patient.owner.phoneNumber && <Text style={styles.ownerMeta}>{patient.owner.phoneNumber}</Text>}
        {patient.owner.address && <Text style={styles.ownerMeta}>{patient.owner.address}</Text>}
      </View>

      {patient.medicalRecord &&
        (patient.medicalRecord.allergies || patient.medicalRecord.chronicConditions || patient.medicalRecord.specialNotes) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Catatan Medis</Text>
            {patient.medicalRecord.allergies && (
              <Text style={styles.ownerMeta}>Alergi: {patient.medicalRecord.allergies}</Text>
            )}
            {patient.medicalRecord.chronicConditions && (
              <Text style={styles.ownerMeta}>Kondisi kronis: {patient.medicalRecord.chronicConditions}</Text>
            )}
            {patient.medicalRecord.specialNotes && (
              <Text style={styles.ownerMeta}>Catatan: {patient.medicalRecord.specialNotes}</Text>
            )}
          </View>
        )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Riwayat Kunjungan ({patient._count?.registrations ?? patient.registrations.length})</Text>
        {patient.registrations.length === 0 ? (
          <Text style={styles.ownerMeta}>Belum ada riwayat kunjungan</Text>
        ) : (
          patient.registrations.map((reg) => (
            <View key={reg.id} style={styles.regRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.regComplaint}>{reg.complaint}</Text>
                <Text style={styles.regMeta}>
                  {format(new Date(reg.createdAt), 'd MMM yyyy', { locale: localeId })}
                  {reg.doctor ? ` · ${reg.doctor.fullname}` : ''}
                </Text>
              </View>
              {statusBadge(reg)}
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
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 12,
  },
  petName: { fontSize: 20, fontWeight: '800', color: colors.textDark },
  idMember: { fontSize: 12, fontWeight: '700', color: colors.textSoft, marginTop: 2 },
  metaRow: { flexDirection: 'row', marginTop: 8 },
  metaText: { fontSize: 13, fontWeight: '600', color: colors.textMid },
  rekamMedisBtn: {
    marginTop: 14,
    backgroundColor: colors.warmBg,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  rekamMedisBtnText: { fontSize: 12, fontWeight: '700', color: colors.orangeDk },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark, marginBottom: 8 },
  ownerName: { fontSize: 15, fontWeight: '700', color: colors.textDark },
  ownerMeta: { fontSize: 13, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  regRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  regComplaint: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  regMeta: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
