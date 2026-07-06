import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import type { PasienStackParamList } from '../../navigation/RootNavigator'

interface LabHistoryItem {
  id: string
  testType: string
  status: 'pending' | 'processing' | 'ready'
  priority: 'normal' | 'urgent'
  createdAt: string
  requestedBy: { fullname: string }
  result?: { interpretation?: string; isReady: boolean } | null
}

const statusView: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Menunggu', variant: 'yellow' },
  processing: { label: 'Diproses', variant: 'blue' },
  ready: { label: 'Siap', variant: 'green' },
}

export default function LabHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<PasienStackParamList>>()
  const route = useRoute<RouteProp<PasienStackParamList, 'LabHistory'>>()
  const { patientId } = route.params

  const [items, setItems] = useState<LabHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(
    () => api.get(`/lab/history/${patientId}`).then((res) => setItems(res.data.data)),
    [patientId]
  )

  useEffect(() => {
    setLoading(true)
    fetchHistory().finally(() => setLoading(false))
  }, [fetchHistory])

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Riwayat Lab</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.orange} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 32 }}>🧪</Text>
              <Text style={styles.emptyText}>Belum ada riwayat lab untuk pasien ini</Text>
            </View>
          }
          renderItem={({ item }) => {
            const view = statusView[item.status]
            return (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.testType}>{item.testType}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {item.priority === 'urgent' && <Badge variant="red">Urgent</Badge>}
                    <Badge variant={view.variant}>{view.label}</Badge>
                  </View>
                </View>
                <Text style={styles.rowMeta}>Diminta oleh {item.requestedBy.fullname} · {format(new Date(item.createdAt), 'd MMM yyyy', { locale: localeId })}</Text>
                {item.result?.interpretation && <Text style={styles.interpretation}>{item.result.interpretation}</Text>}
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  header: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 4 },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.orangeDk },
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 18, paddingTop: 12, paddingBottom: 24 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  testType: { fontSize: 14, fontWeight: '800', color: colors.textDark, textTransform: 'capitalize' },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  interpretation: { fontSize: 12, fontWeight: '500', color: colors.textMid, marginTop: 6, fontStyle: 'italic' },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft, textAlign: 'center' },
})
