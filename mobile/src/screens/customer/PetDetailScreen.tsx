import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { portalApi } from '../../lib/portalApi'
import { colors } from '../../theme'
import { Badge } from '../../components/Badge'
import type { CustomerStackParamList } from '../../navigation/CustomerNavigator'

interface VisitHistory {
  id: string
  idNumber: string
  visitDate: string
  complaint: string
  doctor: string
  branch: string
  diagnosa?: string | null
  notes?: string | null
  hasPaid: boolean
}

interface VaccinationRecord {
  id: string
  vaccineName: string
  administeredAt: string
  nextDueAt?: string | null
}

interface DewormingRecord {
  id: string
  medicationName: string
  administeredAt: string
  nextDueAt?: string | null
}

interface PaymentHistory {
  paymentId: string
  invoiceNumber: string
  visitDate: string
  registrationNo: string
  branch: string
  paymentMethod: string
  discount: number
  total: number
  items: { name: string; qty: number; price: number }[]
}

const fmt = (n: number) =>
  n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function PetDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>()
  const route = useRoute<RouteProp<CustomerStackParamList, 'PetDetail'>>()
  const { petId, petName } = route.params

  const [tab, setTab] = useState<'riwayat' | 'jadwal' | 'pembayaran'>('riwayat')

  const [history, setHistory] = useState<VisitHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([])
  const [dewormings, setDewormings] = useState<DewormingRecord[]>([])
  const [loadingSchedule, setLoadingSchedule] = useState(true)

  const [payments, setPayments] = useState<PaymentHistory[]>([])
  const [loadingPayments, setLoadingPayments] = useState(true)

  const fetchHistory = useCallback(
    () => portalApi.get(`/portal/my-pets/${petId}/history`).then((res) => setHistory(res.data.data)),
    [petId]
  )
  const fetchSchedule = useCallback(
    () =>
      portalApi.get(`/portal/my-pets/${petId}/schedule`).then((res) => {
        setVaccinations(res.data.data.vaccinations)
        setDewormings(res.data.data.dewormings)
      }),
    [petId]
  )
  const fetchPayments = useCallback(
    () => portalApi.get(`/portal/my-pets/${petId}/payments`).then((res) => setPayments(res.data.data)),
    [petId]
  )

  useEffect(() => {
    if (tab === 'riwayat') {
      setLoadingHistory(true)
      fetchHistory().finally(() => setLoadingHistory(false))
    } else if (tab === 'jadwal') {
      setLoadingSchedule(true)
      fetchSchedule().finally(() => setLoadingSchedule(false))
    } else {
      setLoadingPayments(true)
      fetchPayments().finally(() => setLoadingPayments(false))
    }
  }, [tab, fetchHistory, fetchSchedule, fetchPayments])

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{petName}</Text>
        <View style={styles.tabRow}>
          {(['riwayat', 'jadwal', 'pembayaran'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'riwayat' ? 'Riwayat' : t === 'jadwal' ? 'Jadwal' : 'Pembayaran'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === 'riwayat' &&
        (loadingHistory ? (
          <ActivityIndicator color={colors.orange} size="large" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>Belum ada riwayat kunjungan</Text>
            ) : (
              history.map((h) => (
                <View key={h.id} style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{format(new Date(h.visitDate), 'd MMMM yyyy', { locale: localeId })}</Text>
                    {h.hasPaid && <Badge variant="green">Lunas</Badge>}
                  </View>
                  <Text style={styles.rowMeta}>{h.branch} · Dokter {h.doctor}</Text>
                  <Text style={styles.bodyText}>Keluhan: {h.complaint}</Text>
                  {h.diagnosa && <Text style={styles.bodyText}>Diagnosa: {h.diagnosa}</Text>}
                  {h.notes && <Text style={styles.bodyText}>Instruksi: {h.notes}</Text>}
                </View>
              ))
            )}
          </ScrollView>
        ))}

      {tab === 'jadwal' &&
        (loadingSchedule ? (
          <ActivityIndicator color={colors.orange} size="large" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.sectionTitle}>Vaksinasi</Text>
            {vaccinations.length === 0 ? (
              <Text style={styles.emptyText}>Belum ada catatan vaksinasi</Text>
            ) : (
              vaccinations.map((v) => (
                <View key={v.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{v.vaccineName}</Text>
                  <Text style={styles.rowMeta}>Diberikan: {format(new Date(v.administeredAt), 'd MMM yyyy', { locale: localeId })}</Text>
                  {v.nextDueAt && <Text style={styles.rowMeta}>Jadwal berikutnya: {format(new Date(v.nextDueAt), 'd MMM yyyy', { locale: localeId })}</Text>}
                </View>
              ))
            )}

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Obat Cacing</Text>
            {dewormings.length === 0 ? (
              <Text style={styles.emptyText}>Belum ada catatan obat cacing</Text>
            ) : (
              dewormings.map((d) => (
                <View key={d.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{d.medicationName}</Text>
                  <Text style={styles.rowMeta}>Diberikan: {format(new Date(d.administeredAt), 'd MMM yyyy', { locale: localeId })}</Text>
                  {d.nextDueAt && <Text style={styles.rowMeta}>Jadwal berikutnya: {format(new Date(d.nextDueAt), 'd MMM yyyy', { locale: localeId })}</Text>}
                </View>
              ))
            )}
          </ScrollView>
        ))}

      {tab === 'pembayaran' &&
        (loadingPayments ? (
          <ActivityIndicator color={colors.orange} size="large" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {payments.length === 0 ? (
              <Text style={styles.emptyText}>Belum ada riwayat pembayaran</Text>
            ) : (
              payments.map((p) => (
                <View key={p.paymentId} style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{p.invoiceNumber}</Text>
                    <Text style={styles.totalText}>{fmt(p.total)}</Text>
                  </View>
                  <Text style={styles.rowMeta}>{format(new Date(p.visitDate), 'd MMM yyyy', { locale: localeId })} · {p.branch}</Text>
                  <Text style={styles.rowMeta}>Metode: {p.paymentMethod}</Text>
                  {p.items.map((it, idx) => (
                    <View key={idx} style={styles.lineRow}>
                      <Text style={styles.lineName} numberOfLines={1}>{it.name} ×{it.qty}</Text>
                      <Text style={styles.lineValue}>{fmt(it.price)}</Text>
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        ))}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  header: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 8 },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.orangeDk },
  title: { fontSize: 20, fontWeight: '800', color: colors.textDark, marginBottom: 12 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  tabTextActive: { color: '#fff' },
  content: { padding: 18, paddingTop: 12, paddingBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark, marginBottom: 8 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textDark, flexShrink: 1 },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  bodyText: { fontSize: 13, fontWeight: '500', color: colors.textMid, marginTop: 6 },
  totalText: { fontSize: 14, fontWeight: '800', color: colors.textDark },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6 },
  lineName: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textDark },
  lineValue: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
