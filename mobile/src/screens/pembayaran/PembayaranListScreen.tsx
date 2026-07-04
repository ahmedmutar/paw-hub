import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import type { PembayaranStackParamList } from '../../navigation/RootNavigator'

interface AntrianKasir {
  id: string
  registration: {
    queueNumber: number
    isPriority: boolean
    patient: { petName: string; owner: { ownerName: string } }
  }
  doctor: { fullname: string }
  estimatedTotal: number
  itemCount: number
}

const fmt = (n: number) =>
  n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function PembayaranListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<PembayaranStackParamList>>()
  const [items, setItems] = useState<AntrianKasir[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchList = useCallback(async () => {
    const res = await api.get('/pembayaran/antrian-kasir')
    setItems(res.data.data)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchList().finally(() => setLoading(false))
  }, [fetchList])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchList()
    setRefreshing(false)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Kasir</Text>
        <Text style={styles.subtitle}>Pasien yang sudah diperiksa, menunggu pembayaran</Text>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 32 }}>👍</Text>
              <Text style={styles.emptyText}>Tidak ada tagihan yang menunggu</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('PembayaranDetail', { checkUpId: item.id })}
            >
              <View style={styles.queueBadge}>
                <Text style={styles.queueNumber}>{item.registration.queueNumber}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.petName}>{item.registration.patient.petName}</Text>
                  {item.registration.isPriority && <Text style={styles.priorityTag}>⚡</Text>}
                </View>
                <Text style={styles.rowMeta}>{item.registration.patient.owner.ownerName} · {item.doctor.fullname}</Text>
                <Text style={styles.rowMeta}>{item.itemCount} item tagihan</Text>
              </View>
              <Text style={styles.total}>{fmt(item.estimatedTotal)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  header: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  subtitle: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 12,
  },
  queueBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.orangeLt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueNumber: { fontSize: 15, fontWeight: '800', color: colors.orangeDk },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  petName: { fontSize: 14, fontWeight: '700', color: colors.textDark },
  priorityTag: { fontSize: 12 },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  total: { fontSize: 14, fontWeight: '800', color: colors.green },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
