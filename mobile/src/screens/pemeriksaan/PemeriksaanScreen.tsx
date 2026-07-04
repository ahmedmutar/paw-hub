import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import type { PendaftaranStackParamList } from '../../navigation/RootNavigator'

interface DetailItem {
  id: string
  priceItem: { listOfItem: { itemName: string; unitItem?: { unitName: string } } }
  quantity: number
  priceOverall: number
}
interface DetailService {
  id: string
  priceService: { listOfService: { serviceName: string } }
  quantity: number
  priceOverall: number
}
interface DetailMedGroup {
  id: string
  medicineGroup: { groupName: string }
  quantity: number
  remark?: string
}

interface CheckUpResult {
  id: string
  anamnesa?: string
  sign?: string
  diagnosa?: string
  prognosis?: string
  homeInstructions?: string
  weightKg?: number
  temperature?: number
  heartRate?: number
  respiratoryRate?: number
  statusFinish: boolean
  detailItems?: DetailItem[]
  detailServices?: DetailService[]
  detailMedicineGroups?: DetailMedGroup[]
}

interface FormState {
  anamnesa: string
  sign: string
  diagnosa: string
  prognosis: string
  homeInstructions: string
  weightKg: string
  temperature: string
  heartRate: string
  respiratoryRate: string
}

const emptyForm: FormState = {
  anamnesa: '',
  sign: '',
  diagnosa: '',
  prognosis: '',
  homeInstructions: '',
  weightKg: '',
  temperature: '',
  heartRate: '',
  respiratoryRate: '',
}

const fmt = (n: number) =>
  n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

function toForm(c: CheckUpResult): FormState {
  return {
    anamnesa: c.anamnesa ?? '',
    sign: c.sign ?? '',
    diagnosa: c.diagnosa ?? '',
    prognosis: c.prognosis ?? '',
    homeInstructions: c.homeInstructions ?? '',
    weightKg: c.weightKg != null ? String(c.weightKg) : '',
    temperature: c.temperature != null ? String(c.temperature) : '',
    heartRate: c.heartRate != null ? String(c.heartRate) : '',
    respiratoryRate: c.respiratoryRate != null ? String(c.respiratoryRate) : '',
  }
}

function toPayload(f: FormState) {
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v))
  return {
    anamnesa: f.anamnesa || undefined,
    sign: f.sign || undefined,
    diagnosa: f.diagnosa || undefined,
    prognosis: f.prognosis || undefined,
    homeInstructions: f.homeInstructions || undefined,
    weightKg: num(f.weightKg),
    temperature: num(f.temperature),
    heartRate: num(f.heartRate),
    respiratoryRate: num(f.respiratoryRate),
  }
}

// ─── Picker jenis: layanan / item gudang / kelompok obat ──────────────────────

type PickerKind = 'items' | 'services' | 'medicineGroups'

const PICKER_LABEL: Record<PickerKind, string> = {
  items: 'Item / Obat Gudang',
  services: 'Layanan',
  medicineGroups: 'Kelompok Obat',
}
const PICKER_ENDPOINT: Record<PickerKind, string> = {
  items: '/master/items',
  services: '/master/services',
  medicineGroups: '/master/medicine-groups',
}

interface MasterResult {
  id: string
  itemName?: string
  serviceName?: string
  groupName?: string
  unit?: string
  category?: string
  totalItem?: number
  priceItemId?: string
  priceServiceId?: string
  sellingPrice?: number
}

function AddPickerModal({
  visible,
  kind,
  onClose,
  onSubmit,
}: {
  visible: boolean
  kind: PickerKind
  onClose: () => void
  onSubmit: (payload: any) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<MasterResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<MasterResult | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) {
      setSearch('')
      setResults([])
      setSelected(null)
      setQuantity('1')
      setRemark('')
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    setSearching(true)
    const t = setTimeout(() => {
      api
        .get(PICKER_ENDPOINT[kind], { params: { search: search || undefined } })
        .then((res) => setResults(res.data.data))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [search, kind, visible])

  const qtyNum = Number(quantity) || 0
  const priceOverall = selected ? (selected.sellingPrice ?? 0) * qtyNum : 0

  const handleConfirm = async () => {
    if (!selected || qtyNum <= 0) return
    setSubmitting(true)
    try {
      if (kind === 'items') {
        await onSubmit({ priceItemId: selected.priceItemId, quantity: qtyNum, priceOverall })
      } else if (kind === 'services') {
        await onSubmit({ priceServiceId: selected.priceServiceId, quantity: qtyNum, priceOverall })
      } else {
        await onSubmit({ medicineGroupId: selected.id, quantity: qtyNum, remark: remark || undefined })
      }
      onClose()
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tambah {PICKER_LABEL[kind]}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>

          {!selected ? (
            <>
              <TextInput
                style={styles.input}
                value={search}
                onChangeText={setSearch}
                placeholder="Cari nama..."
                placeholderTextColor={colors.textSoft}
                autoFocus
              />
              {searching ? (
                <ActivityIndicator color={colors.orange} style={{ marginTop: 16 }} />
              ) : (
                <FlatList
                  data={results}
                  keyExtractor={(item) => item.id}
                  style={{ marginTop: 10, maxHeight: 320 }}
                  ListEmptyComponent={<Text style={styles.emptyPickerText}>Tidak ada hasil</Text>}
                  renderItem={({ item }) => {
                    const name = item.itemName ?? item.serviceName ?? item.groupName ?? ''
                    const outOfStock = kind === 'items' && (item.totalItem ?? 0) <= 0
                    return (
                      <TouchableOpacity
                        style={styles.resultRow}
                        onPress={() => !outOfStock && setSelected(item)}
                        disabled={outOfStock}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.resultName, outOfStock && { color: colors.textSoft }]}>{name}</Text>
                          {item.category && <Text style={styles.resultMeta}>{item.category}</Text>}
                          {kind === 'items' && (
                            <Text style={styles.resultMeta}>
                              Stok: {item.totalItem} {item.unit ?? ''}
                            </Text>
                          )}
                        </View>
                        {item.sellingPrice != null && <Text style={styles.resultPrice}>{fmt(item.sellingPrice)}</Text>}
                      </TouchableOpacity>
                    )
                  }}
                />
              )}
            </>
          ) : (
            <View>
              <Text style={styles.selectedName}>
                {selected.itemName ?? selected.serviceName ?? selected.groupName}
              </Text>
              <Text style={styles.label}>Jumlah</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
              />
              {kind === 'medicineGroups' && (
                <>
                  <Text style={[styles.label, { marginTop: 10 }]}>Catatan (opsional)</Text>
                  <TextInput style={styles.input} value={remark} onChangeText={setRemark} placeholder="Dosis, aturan pakai, dll" placeholderTextColor={colors.textSoft} />
                </>
              )}
              {kind !== 'medicineGroups' && (
                <Text style={styles.totalPreview}>Total: {fmt(priceOverall)}</Text>
              )}
              <View style={styles.modalActionRow}>
                <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.modalSecondaryBtnText}>Ganti</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleConfirm} disabled={submitting || qtyNum <= 0}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Tambahkan</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

export default function PemeriksaanScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<PendaftaranStackParamList>>()
  const route = useRoute<RouteProp<PendaftaranStackParamList, 'Pemeriksaan'>>()
  const { registrationId } = route.params

  const [checkUp, setCheckUp] = useState<CheckUpResult | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [pickerKind, setPickerKind] = useState<PickerKind | null>(null)

  const fetchCheckUp = () =>
    api.get(`/pemeriksaan/registrasi/${registrationId}`).then((res) => {
      const data: CheckUpResult | null = res.data.data
      if (data) {
        setCheckUp(data)
        setForm(toForm(data))
      }
    })

  useEffect(() => {
    setLoading(true)
    fetchCheckUp().finally(() => setLoading(false))
  }, [registrationId])

  const handleMulai = async () => {
    setStarting(true)
    try {
      const res = await api.post('/pemeriksaan/mulai', { patientRegistrationId: registrationId })
      setCheckUp(res.data.data)
      setForm(toForm(res.data.data))
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setStarting(false)
    }
  }

  const handleSave = async () => {
    if (!checkUp) return
    setSaving(true)
    try {
      await api.put(`/pemeriksaan/${checkUp.id}`, toPayload(form))
      Alert.alert('Tersimpan', 'Data pemeriksaan berhasil disimpan.')
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setSaving(false)
    }
  }

  const handleSelesai = async () => {
    if (!checkUp) return
    Alert.alert('Selesaikan Pemeriksaan', 'Tandai pemeriksaan ini selesai?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Ya, Selesai',
        onPress: async () => {
          setFinishing(true)
          try {
            await api.put(`/pemeriksaan/${checkUp.id}`, toPayload(form))
            await api.post(`/pemeriksaan/${checkUp.id}/selesai`)
            Alert.alert('Selesai', 'Pemeriksaan ditandai selesai.', [
              { text: 'OK', onPress: () => navigation.navigate('PendaftaranList') },
            ])
          } catch (err: any) {
            Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
          } finally {
            setFinishing(false)
          }
        },
      },
    ])
  }

  const handleAddPicked = async (payload: any) => {
    if (!checkUp || !pickerKind) return
    const endpoint =
      pickerKind === 'items' ? 'items' : pickerKind === 'services' ? 'services' : 'medicine-groups'
    await api.post(`/pemeriksaan/${checkUp.id}/${endpoint}`, payload)
    await fetchCheckUp()
  }

  const handleRemove = (kind: PickerKind, detailId: string) => {
    if (!checkUp) return
    Alert.alert('Hapus', 'Hapus item ini dari pemeriksaan?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          const endpoint = kind === 'items' ? 'items' : kind === 'services' ? 'services' : 'medicine-groups'
          try {
            await api.delete(`/pemeriksaan/${checkUp.id}/${endpoint}/${detailId}`)
            await fetchCheckUp()
          } catch (err: any) {
            Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
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

  if (!checkUp) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🩺</Text>
        <Text style={styles.emptyText}>Pemeriksaan belum dimulai</Text>
        <TouchableOpacity style={styles.startBtn} onPress={handleMulai} disabled={starting}>
          {starting ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Mulai Periksa</Text>}
        </TouchableOpacity>
      </View>
    )
  }

  const readOnly = checkUp.statusFinish

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>

        {readOnly && (
          <View style={styles.finishedBanner}>
            <Text style={styles.finishedBannerText}>✅ Pemeriksaan ini sudah ditandai selesai (hanya lihat)</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Vital & Anamnesa</Text>
          <Field label="Anamnesa" value={form.anamnesa} onChangeText={(v) => setForm((p) => ({ ...p, anamnesa: v }))} multiline readOnly={readOnly} />
          <Field label="Pemeriksaan Fisik (Sign)" value={form.sign} onChangeText={(v) => setForm((p) => ({ ...p, sign: v }))} multiline readOnly={readOnly} />
          <View style={styles.row2}>
            <Field label="Berat (kg)" value={form.weightKg} onChangeText={(v) => setForm((p) => ({ ...p, weightKg: v }))} keyboardType="decimal-pad" readOnly={readOnly} flex />
            <Field label="Suhu (°C)" value={form.temperature} onChangeText={(v) => setForm((p) => ({ ...p, temperature: v }))} keyboardType="decimal-pad" readOnly={readOnly} flex />
          </View>
          <View style={styles.row2}>
            <Field label="Detak Jantung" value={form.heartRate} onChangeText={(v) => setForm((p) => ({ ...p, heartRate: v }))} keyboardType="number-pad" readOnly={readOnly} flex />
            <Field label="Laju Napas" value={form.respiratoryRate} onChangeText={(v) => setForm((p) => ({ ...p, respiratoryRate: v }))} keyboardType="number-pad" readOnly={readOnly} flex />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Diagnosa</Text>
          <Field label="Diagnosa" value={form.diagnosa} onChangeText={(v) => setForm((p) => ({ ...p, diagnosa: v }))} multiline readOnly={readOnly} />
          <Field label="Prognosis" value={form.prognosis} onChangeText={(v) => setForm((p) => ({ ...p, prognosis: v }))} multiline readOnly={readOnly} />
          <Field label="Instruksi di Rumah" value={form.homeInstructions} onChangeText={(v) => setForm((p) => ({ ...p, homeInstructions: v }))} multiline readOnly={readOnly} />
        </View>

        {/* Layanan */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Layanan</Text>
            {!readOnly && (
              <TouchableOpacity onPress={() => setPickerKind('services')}>
                <Text style={styles.addLink}>+ Tambah</Text>
              </TouchableOpacity>
            )}
          </View>
          {(checkUp.detailServices ?? []).length === 0 ? (
            <Text style={styles.emptyLineText}>Belum ada layanan ditambahkan.</Text>
          ) : (
            checkUp.detailServices!.map((d) => (
              <View key={d.id} style={styles.lineRow}>
                <Text style={styles.lineName} numberOfLines={1}>{d.priceService.listOfService.serviceName} ×{d.quantity}</Text>
                <Text style={styles.lineValue}>{fmt(Number(d.priceOverall))}</Text>
                {!readOnly && (
                  <TouchableOpacity onPress={() => handleRemove('services', d.id)}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {/* Item / Obat Gudang */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Item / Obat Gudang</Text>
            {!readOnly && (
              <TouchableOpacity onPress={() => setPickerKind('items')}>
                <Text style={styles.addLink}>+ Tambah</Text>
              </TouchableOpacity>
            )}
          </View>
          {(checkUp.detailItems ?? []).length === 0 ? (
            <Text style={styles.emptyLineText}>Belum ada item ditambahkan.</Text>
          ) : (
            checkUp.detailItems!.map((d) => (
              <View key={d.id} style={styles.lineRow}>
                <Text style={styles.lineName} numberOfLines={1}>
                  {d.priceItem.listOfItem.itemName} ×{d.quantity} {d.priceItem.listOfItem.unitItem?.unitName ?? ''}
                </Text>
                <Text style={styles.lineValue}>{fmt(Number(d.priceOverall))}</Text>
                {!readOnly && (
                  <TouchableOpacity onPress={() => handleRemove('items', d.id)}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {/* Kelompok Obat */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Kelompok Obat</Text>
            {!readOnly && (
              <TouchableOpacity onPress={() => setPickerKind('medicineGroups')}>
                <Text style={styles.addLink}>+ Tambah</Text>
              </TouchableOpacity>
            )}
          </View>
          {(checkUp.detailMedicineGroups ?? []).length === 0 ? (
            <Text style={styles.emptyLineText}>Belum ada kelompok obat ditambahkan.</Text>
          ) : (
            checkUp.detailMedicineGroups!.map((d) => (
              <View key={d.id} style={styles.lineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName} numberOfLines={1}>{d.medicineGroup.groupName} ×{d.quantity}</Text>
                  {d.remark && <Text style={styles.remarkText}>{d.remark}</Text>}
                </View>
                {!readOnly && (
                  <TouchableOpacity onPress={() => handleRemove('medicineGroups', d.id)}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {!readOnly && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.blue }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Simpan</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.green }]} onPress={handleSelesai} disabled={finishing}>
              {finishing ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Selesai Periksa</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {pickerKind && (
        <AddPickerModal
          visible={!!pickerKind}
          kind={pickerKind}
          onClose={() => setPickerKind(null)}
          onSubmit={handleAddPicked}
        />
      )}
    </KeyboardAvoidingView>
  )
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
  readOnly,
  flex,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  multiline?: boolean
  keyboardType?: 'decimal-pad' | 'number-pad'
  readOnly?: boolean
  flex?: boolean
}) {
  return (
    <View style={[styles.fieldWrap, flex && { flex: 1 }]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        editable={!readOnly}
        placeholder="-"
        placeholderTextColor={colors.textSoft}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  content: { padding: 18, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.warmBg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backBtn: { marginBottom: 14 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.orangeDk },
  emptyText: { fontSize: 14, fontWeight: '700', color: colors.textSoft, marginBottom: 18 },
  startBtn: { backgroundColor: colors.orange, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  finishedBanner: { backgroundColor: colors.greenLt, borderRadius: 12, padding: 12, marginBottom: 12 },
  finishedBannerText: { color: colors.green, fontWeight: '700', fontSize: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 12,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark, marginBottom: 10 },
  addLink: { fontSize: 12, fontWeight: '800', color: colors.orangeDk },
  fieldWrap: { marginBottom: 12 },
  row2: { flexDirection: 'row', gap: 10 },
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
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textDark },
  lineValue: { fontSize: 13, fontWeight: '700', color: colors.textMid },
  remarkText: { fontSize: 11, fontWeight: '500', color: colors.textSoft, marginTop: 2 },
  removeText: { fontSize: 14, fontWeight: '800', color: colors.red, paddingHorizontal: 4 },
  emptyLineText: { fontSize: 12, fontWeight: '600', color: colors.textSoft },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 15, fontWeight: '800', color: colors.textDark },
  modalClose: { fontSize: 16, fontWeight: '700', color: colors.textSoft, padding: 4 },
  emptyPickerText: { fontSize: 12, fontWeight: '600', color: colors.textSoft, textAlign: 'center', paddingVertical: 20 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  resultName: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  resultMeta: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  resultPrice: { fontSize: 12, fontWeight: '800', color: colors.orangeDk },
  selectedName: { fontSize: 15, fontWeight: '800', color: colors.textDark, marginBottom: 14 },
  totalPreview: { fontSize: 14, fontWeight: '800', color: colors.green, marginTop: 12 },
  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalSecondaryBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  modalSecondaryBtnText: { fontSize: 13, fontWeight: '700', color: colors.textMid },
  modalPrimaryBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: colors.orange },
})
