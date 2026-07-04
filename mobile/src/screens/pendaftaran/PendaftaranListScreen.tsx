import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import { registrationStatusView } from './statusView'
import type { PendaftaranStackParamList } from '../../navigation/RootNavigator'

interface Registration {
  id: string
  idNumber: string
  queueNumber: number
  visitType: string
  isPriority: boolean
  complaint: string
  acceptanceStatus: string
  patient: { petName: string; petCategory: string; owner: { ownerName: string } }
  doctor: { fullname: string }
  checkUpResult?: { statusFinish: boolean; statusPaidOff: boolean }
}

const FILTERS = ['semua', 'pending', 'accepted', 'declined', 'cancelled']
const FILTER_LABEL: Record<string, string> = {
  semua: 'Semua',
  pending: 'Menunggu',
  accepted: 'Diterima',
  declined: 'Ditolak',
  cancelled: 'Dibatalkan',
}

export default function PendaftaranListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<PendaftaranStackParamList>>()
  const [items, setItems] = useState<Registration[]>([])
  const [statusFilter, setStatusFilter] = useState('semua')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchList = useCallback(async () => {
    const res = await api.get('/registrasi/antrian-hari-ini', {
      params: { status: statusFilter === 'semua' ? undefined : statusFilter },
    })
    setItems(res.data.data)
  }, [statusFilter])

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
        <Text style={styles.title}>Antrian Hari Ini</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setStatusFilter(f)}
            style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>
              {FILTER_LABEL[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
              <Text style={{ fontSize: 32 }}>📋</Text>
              <Text style={styles.emptyText}>Belum ada antrian untuk filter ini</Text>
            </View>
          }
          renderItem={({ item }) => {
            const view = registrationStatusView(item.acceptanceStatus, item.checkUpResult)
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => navigation.navigate('PendaftaranDetail', { id: item.id })}
              >
                <View style={styles.queueBadge}>
                  <Text style={styles.queueNumber}>{item.queueNumber}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.petName}>{item.patient.petName}</Text>
                    {item.isPriority && <Text style={styles.priorityTag}>⚡ Prioritas</Text>}
                  </View>
                  <Text style={styles.rowMeta}>{item.patient.owner.ownerName} · {item.doctor.fullname}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>{item.complaint}</Text>
                </View>
                <Badge variant={view.variant}>{view.label}</Badge>
              </TouchableOpacity>
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
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  filterRow: { flexGrow: 0, marginVertical: 12 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  filterChipTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 18, paddingBottom: 24 },
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
  priorityTag: { fontSize: 10, fontWeight: '700', color: colors.red },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
