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
  Switch,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface LabRequestDetail {
  id: string
  testType: string
  notes?: string
  status: 'pending' | 'processing' | 'ready'
  priority: 'normal' | 'urgent'
  createdAt: string
  patient: { petName: string; petCategory: string }
  requestedBy: { fullname: string }
  result?: {
    templateType?: string
    resultData?: Record<string, string>
    interpretation?: string
    isReady: boolean
    readyAt?: string
  } | null
}

interface Template {
  key: string
  label: string
  fields: { key: string; label: string; unit?: string; normalMin?: number; normalMax?: number }[]
}

const statusView: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Menunggu', variant: 'yellow' },
  processing: { label: 'Diproses', variant: 'blue' },
  ready: { label: 'Siap', variant: 'green' },
}

export default function LabResultScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'LabResult'>>()
  const { id } = route.params

  const [item, setItem] = useState<LabRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<Template[]>([])
  const [resultData, setResultData] = useState<Record<string, string>>({})
  const [interpretation, setInterpretation] = useState('')
  const [rawResult, setRawResult] = useState('')
  const [isReady, setIsReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchDetail = useCallback(async () => {
    const [reqRes, tplRes] = await Promise.all([
      api.get('/lab/request', { params: { limit: 100 } }),
      api.get('/lab/templates'),
    ])
    const found = reqRes.data.data.find((r: LabRequestDetail) => r.id === id)
    setItem(found ?? null)
    setTemplates(tplRes.data.data)
  }, [id])

  useEffect(() => {
    setLoading(true)
    fetchDetail().finally(() => setLoading(false))
  }, [fetchDetail])

  useEffect(() => {
    if (item?.result) {
      setResultData(item.result.resultData ?? {})
      setInterpretation(item.result.interpretation ?? '')
      setIsReady(item.result.isReady)
      if (!item.result.templateType && item.result.resultData?.raw) setRawResult(item.result.resultData.raw)
    }
  }, [item])

  const template = templates.find((t) => t.key === item?.testType)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await api.patch(`/lab/request/${id}/result`, {
        templateType: template?.key,
        resultData: template ? resultData : { raw: rawResult },
        interpretation: interpretation || undefined,
        isReady,
      })
      await fetchDetail()
      Alert.alert('Tersimpan', isReady ? 'Hasil disimpan & notifikasi WA dikirim ke pemilik.' : 'Hasil disimpan.')
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
        <Text style={styles.emptyText}>Request lab tidak ditemukan</Text>
      </View>
    )
  }

  const view = statusView[item.status]
  const readOnly = item.status === 'ready'

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Kembali</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.petName}>{item.patient.petName} · {item.patient.petCategory}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {item.priority === 'urgent' && <Badge variant="red">Urgent</Badge>}
            <Badge variant={view.variant}>{view.label}</Badge>
          </View>
        </View>
        <Text style={styles.metaText}>{template?.label ?? item.testType}</Text>
        <Text style={styles.metaText}>Diminta oleh {item.requestedBy.fullname} · {format(new Date(item.createdAt), 'd MMM yyyy, HH:mm', { locale: localeId })}</Text>
        {item.notes && <Text style={styles.metaText}>Catatan: {item.notes}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Hasil {template ? template.label : 'Pemeriksaan'}</Text>

        {template ? (
          template.fields.map((f) => (
            <View key={f.key} style={{ marginTop: 10 }}>
              <Text style={styles.label}>
                {f.label}{f.unit ? ` (${f.unit})` : ''}
                {f.normalMin != null && f.normalMax != null ? ` · normal ${f.normalMin}-${f.normalMax}` : ''}
              </Text>
              <TextInput
                style={styles.input}
                value={resultData[f.key] ?? ''}
                onChangeText={(v) => setResultData((prev) => ({ ...prev, [f.key]: v }))}
                placeholder="Nilai"
                placeholderTextColor={colors.textSoft}
                editable={!readOnly}
                keyboardType="numeric"
              />
            </View>
          ))
        ) : (
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top', marginTop: 8 }]}
            value={rawResult}
            onChangeText={setRawResult}
            placeholder="Tulis hasil pemeriksaan / link file..."
            placeholderTextColor={colors.textSoft}
            multiline
            editable={!readOnly}
          />
        )}

        <Text style={[styles.label, { marginTop: 14 }]}>Interpretasi Dokter</Text>
        <TextInput
          style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
          value={interpretation}
          onChangeText={setInterpretation}
          placeholder="Kesimpulan/rekomendasi..."
          placeholderTextColor={colors.textSoft}
          multiline
          editable={!readOnly}
        />

        {!readOnly && (
          <View style={styles.switchRow}>
            <Text style={styles.label}>Hasil sudah siap (kirim notifikasi WA ke pemilik)</Text>
            <Switch value={isReady} onValueChange={setIsReady} trackColor={{ true: colors.green }} />
          </View>
        )}

        {!readOnly && (
          <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.5 }]} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Simpan Hasil</Text>}
          </TouchableOpacity>
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
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: colors.border, marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  petName: { fontSize: 16, fontWeight: '800', color: colors.textDark, flexShrink: 1 },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark },
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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 },
  submitBtn: { backgroundColor: colors.orange, paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 14 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
