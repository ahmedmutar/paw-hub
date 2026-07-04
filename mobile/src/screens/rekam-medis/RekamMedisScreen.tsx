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

interface RekamMedis {
  patient: {
    idMember: string
    petName: string
    petCategory: string
    petGender?: string
    owner: { ownerName: string; phoneNumber?: string }
    branch: { branchName: string }
  }
  medicalRecord?: {
    bloodType?: string
    allergies?: string
    chronicConditions?: string
    specialNotes?: string
  }
  weightHistory: { id: string; weightKg: number; recordedAt: string }[]
  vaccinations: { id: string; vaccineName: string; batchNumber?: string; administeredAt: string; nextDueAt?: string; notes?: string }[]
  dewormings: { id: string; medicationName: string; administeredAt: string; nextDueAt?: string; notes?: string }[]
  procedures: { id: string; procedureName: string; performedAt: string; notes?: string }[]
  visitHistory: {
    id: string; idNumber: string; complaint: string; createdAt: string
    doctor: { fullname: string }
    checkUpResult?: { diagnosa?: string; statusPaidOff: boolean; statusFinish: boolean }
  }[]
}

const fmtDate = (d: string) => format(new Date(d), 'd MMM yyyy', { locale: localeId })

function isDueSoon(nextDueAt?: string) {
  if (!nextDueAt) return false
  const days = Math.ceil((new Date(nextDueAt).getTime() - Date.now()) / 86_400_000)
  return days <= 30 && days >= 0
}

function visitStatusView(cu?: RekamMedis['visitHistory'][number]['checkUpResult']) {
  if (!cu) return { label: 'Belum Diperiksa', variant: 'gray' as const }
  if (!cu.statusFinish) return { label: 'Dalam Proses', variant: 'blue' as const }
  if (!cu.statusPaidOff) return { label: 'Menunggu Bayar', variant: 'yellow' as const }
  return { label: 'Lunas', variant: 'green' as const }
}

export default function RekamMedisScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<PasienStackParamList>>()
  const route = useRoute<RouteProp<PasienStackParamList, 'RekamMedis'>>()
  const [data, setData] = useState<RekamMedis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .get(`/rekam-medis/${route.params.patientId}`)
      .then((res) => setData(res.data.data))
      .finally(() => setLoading(false))
  }, [route.params.patientId])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    )
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Rekam medis tidak ditemukan</Text>
      </View>
    )
  }

  const mr = data.medicalRecord
  const hasKartu = mr && (mr.bloodType || mr.allergies || mr.chronicConditions || mr.specialNotes)

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Kembali</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.petName}>{data.patient.petName}</Text>
        <Text style={styles.metaText}>{data.patient.idMember} · {data.patient.petCategory}{data.patient.petGender ? ` · ${data.patient.petGender}` : ''}</Text>
        <Text style={styles.metaText}>{data.patient.owner.ownerName}{data.patient.owner.phoneNumber ? ` · ${data.patient.owner.phoneNumber}` : ''}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Kartu Rekam Medis</Text>
        {!hasKartu ? (
          <Text style={styles.emptyLineText}>Belum ada catatan khusus.</Text>
        ) : (
          <>
            {mr?.bloodType && <InfoRow label="Golongan Darah" value={mr.bloodType} />}
            {mr?.allergies && <InfoRow label="Alergi" value={mr.allergies} />}
            {mr?.chronicConditions && <InfoRow label="Kondisi Kronis" value={mr.chronicConditions} />}
            {mr?.specialNotes && <InfoRow label="Catatan Khusus" value={mr.specialNotes} />}
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Vaksinasi ({data.vaccinations.length})</Text>
        {data.vaccinations.length === 0 ? (
          <Text style={styles.emptyLineText}>Belum ada riwayat vaksinasi.</Text>
        ) : (
          data.vaccinations.map((v) => (
            <View key={v.id} style={styles.lineRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>{v.vaccineName}</Text>
                <Text style={styles.lineMeta}>Diberikan: {fmtDate(v.administeredAt)}</Text>
                {v.nextDueAt && <Text style={styles.lineMeta}>Ulang: {fmtDate(v.nextDueAt)}</Text>}
              </View>
              {isDueSoon(v.nextDueAt) && <Badge variant="yellow">Segera</Badge>}
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Obat Cacing ({data.dewormings.length})</Text>
        {data.dewormings.length === 0 ? (
          <Text style={styles.emptyLineText}>Belum ada riwayat obat cacing.</Text>
        ) : (
          data.dewormings.map((d) => (
            <View key={d.id} style={styles.lineRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>{d.medicationName}</Text>
                <Text style={styles.lineMeta}>Diberikan: {fmtDate(d.administeredAt)}</Text>
                {d.nextDueAt && <Text style={styles.lineMeta}>Ulang: {fmtDate(d.nextDueAt)}</Text>}
              </View>
              {isDueSoon(d.nextDueAt) && <Badge variant="yellow">Segera</Badge>}
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tindakan / Prosedur ({data.procedures.length})</Text>
        {data.procedures.length === 0 ? (
          <Text style={styles.emptyLineText}>Belum ada riwayat tindakan.</Text>
        ) : (
          data.procedures.map((p) => (
            <View key={p.id} style={styles.lineRowNoBadge}>
              <Text style={styles.lineName}>{p.procedureName}</Text>
              <Text style={styles.lineMeta}>{fmtDate(p.performedAt)}</Text>
              {p.notes && <Text style={styles.remarkText}>{p.notes}</Text>}
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Riwayat Berat Badan ({data.weightHistory.length})</Text>
        {data.weightHistory.length === 0 ? (
          <Text style={styles.emptyLineText}>Belum ada catatan berat.</Text>
        ) : (
          data.weightHistory.map((w) => (
            <View key={w.id} style={styles.lineRow}>
              <Text style={styles.lineMeta}>{fmtDate(w.recordedAt)}</Text>
              <Text style={styles.lineValue}>{w.weightKg} kg</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Riwayat Kunjungan Terakhir</Text>
        {data.visitHistory.length === 0 ? (
          <Text style={styles.emptyLineText}>Belum ada riwayat kunjungan.</Text>
        ) : (
          data.visitHistory.map((v) => {
            const view = visitStatusView(v.checkUpResult)
            return (
              <View key={v.id} style={styles.lineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName}>{v.complaint}</Text>
                  <Text style={styles.lineMeta}>{fmtDate(v.createdAt)} · {v.doctor.fullname}</Text>
                  {v.checkUpResult?.diagnosa && <Text style={styles.remarkText}>Diagnosa: {v.checkUpResult.diagnosa}</Text>}
                </View>
                <Badge variant={view.variant}>{view.label}</Badge>
              </View>
            )
          })
        )}
      </View>
    </ScrollView>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
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
  petName: { fontSize: 18, fontWeight: '800', color: colors.textDark },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark, marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMid, marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineRowNoBadge: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  lineName: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  lineMeta: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  lineValue: { fontSize: 13, fontWeight: '800', color: colors.textDark },
  remarkText: { fontSize: 11, fontWeight: '500', color: colors.textSoft, marginTop: 2 },
  emptyLineText: { fontSize: 12, fontWeight: '600', color: colors.textSoft },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
