import { useEffect, useState } from 'react'
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
import { api } from '../../lib/api'
import { colors } from '../../theme'
import type { PembayaranStackParamList } from '../../navigation/RootNavigator'

interface DetailItem {
  id: string
  priceItem: { listOfItem: { itemName: string }; sellingPrice: number }
  priceOverall: number
  quantity: number
  statusPaidOff: boolean
}

interface DetailService {
  id: string
  priceService: { listOfService: { serviceName: string } }
  priceOverall: number
  quantity: number
  statusPaidOff: boolean
}

interface DetailMedGroup {
  id: string
  medicineGroupId: string
  medicineGroup: { groupName: string }
  quantity: number
  statusPaidOff: boolean
}

interface Tagihan {
  id: string
  diagnosa?: string
  registration: { patient: { petName: string; owner: { id: string; ownerName: string } } }
  doctor: { fullname: string }
  detailItems: DetailItem[]
  detailServices: DetailService[]
  detailMedicineGroups: DetailMedGroup[]
  subtotal: number
}

interface PaymentMethod {
  id: string
  methodName: string
}

interface LoyaltyMember {
  totalPoints: number
  tier: 'basic' | 'silver' | 'gold'
}

interface LoyaltyData {
  member: LoyaltyMember | null
  config: { isActive: boolean; redeemRate: number }
}

const tierLabel: Record<string, string> = { basic: 'Basic', silver: 'Silver', gold: 'Gold' }

const fmt = (n: number) =>
  n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function PembayaranDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<PembayaranStackParamList>>()
  const route = useRoute<RouteProp<PembayaranStackParamList, 'PembayaranDetail'>>()
  const { checkUpId } = route.params

  const [tagihan, setTagihan] = useState<Tagihan | null>(null)
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [methodId, setMethodId] = useState<string | undefined>(undefined)
  const [discount, setDiscount] = useState('0')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null)
  const [redeemPoints, setRedeemPoints] = useState('')
  const [redeeming, setRedeeming] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/pembayaran/tagihan/${checkUpId}`),
      api.get('/metode-pembayaran'),
    ])
      .then(([tagihanRes, methodsRes]) => {
        setTagihan(tagihanRes.data.data)
        setMethods(methodsRes.data.data)
        const ownerId = tagihanRes.data.data?.registration?.patient?.owner?.id
        if (ownerId) {
          api
            .get(`/loyalty/member/${ownerId}`)
            .then((res) => setLoyalty(res.data.data))
            .catch(() => {})
        }
      })
      .finally(() => setLoading(false))
  }, [checkUpId])

  const handleRedeem = async () => {
    const ownerId = tagihan?.registration.patient.owner.id
    const pts = Number(redeemPoints)
    if (!ownerId || !pts || pts <= 0) return
    setRedeeming(true)
    try {
      const res = await api.post('/loyalty/redeem', { ownerId, points: pts })
      const { discountValue, newBalance, tier } = res.data.data
      setDiscount((prev) => String((Number(prev) || 0) + discountValue))
      setLoyalty((prev) => (prev ? { ...prev, member: { totalPoints: newBalance, tier } } : prev))
      setRedeemPoints('')
      Alert.alert('Berhasil', `${pts} poin ditukar menjadi diskon ${fmt(discountValue)}.`)
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setRedeeming(false)
    }
  }

  const discountNum = Number(discount) || 0
  const total = Math.max((tagihan?.subtotal ?? 0) - discountNum, 0)

  const handleBayar = () => {
    if (!tagihan) return
    Alert.alert('Konfirmasi Pembayaran', `Proses pembayaran sebesar ${fmt(total)}?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Ya, Bayar',
        onPress: async () => {
          setSubmitting(true)
          try {
            await api.post('/pembayaran', {
              checkUpResultId: tagihan.id,
              paymentMethodId: methodId,
              discount: discountNum,
              items: tagihan.detailItems
                .filter((d) => !d.statusPaidOff)
                .map((d) => ({ detailItemPatientId: d.id, quantity: Number(d.quantity), amountDiscount: 0 })),
              services: tagihan.detailServices
                .filter((d) => !d.statusPaidOff)
                .map((d) => ({ detailServicePatientId: d.id, amountDiscount: 0 })),
              medicineGroups: tagihan.detailMedicineGroups
                .filter((d) => !d.statusPaidOff)
                .map((d) => ({
                  medicineGroupId: d.medicineGroupId,
                  detailMedicineGroupResultId: d.id,
                  quantity: d.quantity,
                  amountDiscount: 0,
                })),
            })
            Alert.alert('Berhasil', 'Pembayaran berhasil diproses.', [
              { text: 'OK', onPress: () => navigation.navigate('PembayaranList') },
            ])
          } catch (err: any) {
            Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
          } finally {
            setSubmitting(false)
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    )
  }

  if (!tagihan) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Tagihan tidak ditemukan</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Kembali</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.petName}>{tagihan.registration.patient.petName}</Text>
        <Text style={styles.metaText}>{tagihan.registration.patient.owner.ownerName}</Text>
        <Text style={styles.metaText}>Dokter: {tagihan.doctor.fullname}</Text>
        {tagihan.diagnosa && <Text style={styles.metaText}>Diagnosa: {tagihan.diagnosa}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Rincian Tagihan</Text>

        {tagihan.detailServices.filter((d) => !d.statusPaidOff).map((d) => (
          <View key={d.id} style={styles.lineRow}>
            <Text style={styles.lineName} numberOfLines={1}>{d.priceService.listOfService.serviceName}</Text>
            <Text style={styles.lineValue}>{fmt(Number(d.priceOverall))}</Text>
          </View>
        ))}
        {tagihan.detailItems.filter((d) => !d.statusPaidOff).map((d) => (
          <View key={d.id} style={styles.lineRow}>
            <Text style={styles.lineName} numberOfLines={1}>{d.priceItem.listOfItem.itemName} ×{d.quantity}</Text>
            <Text style={styles.lineValue}>{fmt(Number(d.priceOverall))}</Text>
          </View>
        ))}
        {tagihan.detailMedicineGroups.filter((d) => !d.statusPaidOff).map((d) => (
          <View key={d.id} style={styles.lineRow}>
            <Text style={styles.lineName} numberOfLines={1}>{d.medicineGroup.groupName} ×{d.quantity}</Text>
          </View>
        ))}

        {tagihan.detailServices.length === 0 && tagihan.detailItems.length === 0 && tagihan.detailMedicineGroups.length === 0 && (
          <Text style={styles.metaText}>Belum ada item tagihan.</Text>
        )}

        <View style={styles.divider} />
        <View style={styles.lineRow}>
          <Text style={styles.subtotalLabel}>Subtotal</Text>
          <Text style={styles.subtotalValue}>{fmt(tagihan.subtotal)}</Text>
        </View>
      </View>

      {loyalty?.config.isActive && (
        <View style={styles.card}>
          <View style={styles.lineRow}>
            <Text style={styles.sectionTitle}>Poin Loyalty</Text>
            <Text style={styles.tierBadgeText}>{tierLabel[loyalty.member?.tier ?? 'basic']}</Text>
          </View>
          <Text style={styles.pointsValue}>{loyalty.member?.totalPoints ?? 0} poin</Text>
          <Text style={styles.metaText}>1 poin = {fmt(loyalty.config.redeemRate)} diskon</Text>
          <View style={styles.redeemRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={redeemPoints}
              onChangeText={setRedeemPoints}
              keyboardType="number-pad"
              placeholder="Jumlah poin ditukar"
              placeholderTextColor={colors.textSoft}
            />
            <TouchableOpacity
              style={[styles.redeemBtn, (!redeemPoints || redeeming) && { opacity: 0.5 }]}
              onPress={handleRedeem}
              disabled={!redeemPoints || redeeming}
            >
              {redeeming ? <ActivityIndicator color="#fff" /> : <Text style={styles.redeemBtnText}>Tukar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
        <View style={styles.methodGrid}>
          <TouchableOpacity
            style={[styles.methodChip, !methodId && styles.methodChipActive]}
            onPress={() => setMethodId(undefined)}
          >
            <Text style={[styles.methodChipText, !methodId && styles.methodChipTextActive]}>Tunai</Text>
          </TouchableOpacity>
          {methods.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.methodChip, methodId === m.id && styles.methodChipActive]}
              onPress={() => setMethodId(m.id)}
            >
              <Text style={[styles.methodChipText, methodId === m.id && styles.methodChipTextActive]}>
                {m.methodName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: 14 }]}>Diskon (Rp)</Text>
        <TextInput
          style={styles.input}
          value={discount}
          onChangeText={setDiscount}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.textSoft}
        />
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Bayar</Text>
        <Text style={styles.totalValue}>{fmt(total)}</Text>
      </View>

      <TouchableOpacity style={styles.payBtn} onPress={handleBayar} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Bayar Sekarang</Text>}
      </TouchableOpacity>
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
  petName: { fontSize: 18, fontWeight: '800', color: colors.textDark },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark, marginBottom: 10 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 6 },
  lineName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textDark },
  lineValue: { fontSize: 13, fontWeight: '700', color: colors.textMid },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  subtotalLabel: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  subtotalValue: { fontSize: 14, fontWeight: '800', color: colors.textDark },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.warmBg,
  },
  methodChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  methodChipText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  methodChipTextActive: { color: '#fff' },
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
  totalCard: {
    backgroundColor: colors.orange,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 13, fontWeight: '700', color: '#FFE5D6' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  payBtn: { backgroundColor: colors.green, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
  tierBadgeText: { fontSize: 11, fontWeight: '800', color: colors.orangeDk, backgroundColor: colors.orangeLt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pointsValue: { fontSize: 20, fontWeight: '800', color: colors.textDark, marginTop: 4 },
  redeemRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  redeemBtn: { backgroundColor: colors.teal, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  redeemBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
})
