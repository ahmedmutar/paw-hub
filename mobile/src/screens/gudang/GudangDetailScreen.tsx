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
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface GudangItemDetail {
  id: string
  itemName: string
  description?: string
  totalItem: number
  limitItem?: number
  expiredDate?: string
  unitItem?: { unitName: string }
  categoryItem?: { categoryName: string }
  priceItems?: { sellingPrice: number; capitalPrice: number }[]
}

type MovementType = 'masuk' | 'keluar' | 'adjustment'

const fmt = (n: number) =>
  n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function GudangDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'GudangDetail'>>()
  const { id } = route.params

  const [item, setItem] = useState<GudangItemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [movementType, setMovementType] = useState<MovementType | null>(null)
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchItem = () =>
    api.get(`/gudang/barang/${id}`).then((res) => setItem(res.data.data))

  useEffect(() => {
    setLoading(true)
    fetchItem().finally(() => setLoading(false))
  }, [id])

  const handleSubmitMovement = async () => {
    if (!movementType || !quantity) return
    setSubmitting(true)
    try {
      await api.post('/gudang/mutasi', {
        listOfItemId: id,
        quantity: Number(quantity),
        status: movementType,
        notes: notes || undefined,
      })
      setMovementType(null)
      setQuantity('')
      setNotes('')
      await fetchItem()
      Alert.alert('Berhasil', 'Stok berhasil diperbarui.')
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
        <Text style={styles.emptyText}>Item tidak ditemukan</Text>
      </View>
    )
  }

  const isOut = Number(item.totalItem) <= 0
  const isLow = item.limitItem != null && Number(item.totalItem) <= Number(item.limitItem)
  const price = item.priceItems?.[0]

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Kembali</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.itemName}>{item.itemName}</Text>
        <Text style={styles.metaText}>{item.categoryItem?.categoryName ?? '-'}</Text>
        {item.description && <Text style={styles.metaText}>{item.description}</Text>}

        <View style={styles.stockRow}>
          <Text style={styles.stockValue}>
            {item.totalItem} {item.unitItem?.unitName ?? ''}
          </Text>
          {(isOut || isLow) && (
            <View style={[styles.badge, { backgroundColor: isOut ? colors.redLt : colors.yellowLt }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: isOut ? colors.red : '#C98A00' }}>
                {isOut ? 'Habis' : 'Menipis'}
              </Text>
            </View>
          )}
        </View>
        {item.limitItem != null && <Text style={styles.metaText}>Batas minimum: {item.limitItem}</Text>}
        {item.expiredDate && (
          <Text style={styles.metaText}>Kedaluwarsa: {format(new Date(item.expiredDate), 'd MMM yyyy', { locale: localeId })}</Text>
        )}
        {price && <Text style={styles.metaText}>Harga jual: {fmt(Number(price.sellingPrice))}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Catat Mutasi Stok</Text>
        <View style={styles.typeRow}>
          {(['masuk', 'keluar', 'adjustment'] as MovementType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeChip, movementType === t && styles.typeChipActive]}
              onPress={() => setMovementType(t)}
            >
              <Text style={[styles.typeChipText, movementType === t && styles.typeChipTextActive]}>
                {t === 'masuk' ? 'Stok Masuk' : t === 'keluar' ? 'Stok Keluar' : 'Sesuaikan (Opname)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {movementType && (
          <>
            <Text style={styles.label}>
              {movementType === 'adjustment' ? 'Jumlah stok sebenarnya' : 'Jumlah'}
            </Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textSoft}
            />
            <Text style={[styles.label, { marginTop: 10 }]}>Catatan (opsional)</Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Alasan/keterangan"
              placeholderTextColor={colors.textSoft}
            />
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmitMovement}
              disabled={submitting || !quantity}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Simpan</Text>}
            </TouchableOpacity>
          </>
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
  itemName: { fontSize: 18, fontWeight: '800', color: colors.textDark },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  stockValue: { fontSize: 20, fontWeight: '800', color: colors.textDark },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark, marginBottom: 10 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.warmBg,
  },
  typeChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  typeChipText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  typeChipTextActive: { color: '#fff' },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMid, marginBottom: 5, marginTop: 12 },
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
  submitBtn: { backgroundColor: colors.green, paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 14 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
