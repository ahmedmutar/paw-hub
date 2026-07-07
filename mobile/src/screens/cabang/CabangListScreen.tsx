import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge } from '../../components/Badge'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface Branch {
  id: string
  branchCode: string
  branchName: string
  address?: string
  phoneNumber?: string
  email?: string
  operatingHours?: string
  isActive: boolean
  stats?: { totalUsers: number; totalPatients: number; activeDoctors: number }
}

export default function CabangListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [items, setItems] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchList = useCallback(() => api.get('/cabang').then((res) => setItems(res.data.data)), [])

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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Cabang</Text>
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
              <Text style={{ fontSize: 32 }}>🏢</Text>
              <Text style={styles.emptyText}>Belum ada cabang</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CabangDetail', { id: item.id })}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.branchName}>{item.branchName}</Text>
                <Badge variant={item.isActive ? 'green' : 'gray'}>{item.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
              </View>
              <Text style={styles.rowMeta}>Kode: {item.branchCode}</Text>
              {item.address && <Text style={styles.rowMeta} numberOfLines={1}>{item.address}</Text>}
              {item.stats && (
                <View style={styles.statsRow}>
                  <Text style={styles.statText}>👥 {item.stats.totalUsers} staf</Text>
                  <Text style={styles.statText}>🩺 {item.stats.activeDoctors} dokter</Text>
                  <Text style={styles.statText}>🐾 {item.stats.totalPatients} pasien</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
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
  branchName: { fontSize: 15, fontWeight: '800', color: colors.textDark, flexShrink: 1 },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  statText: { fontSize: 11, fontWeight: '700', color: colors.textMid },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
