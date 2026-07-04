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
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface StaffNotification {
  id: string
  type: 'low_stock' | 'new_booking' | 'queue_new'
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

const ICON: Record<StaffNotification['type'], string> = {
  low_stock: '📦',
  new_booking: '📅',
  queue_new: '📋',
}

export default function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [items, setItems] = useState<StaffNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchList = useCallback(async () => {
    const res = await api.get('/notifications')
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

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    try {
      await api.post(`/notifications/${id}/read`)
    } catch {
      // biarkan, tidak fatal jika gagal — status lokal tetap terlihat terbaca
    }
  }

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
    try {
      await api.post('/notifications/read-all')
    } catch {
      // abaikan
    }
  }

  const hasUnread = items.some((n) => !n.isRead)

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Notifikasi</Text>
          {hasUnread && (
            <TouchableOpacity onPress={markAllRead}>
              <Text style={styles.markAllText}>Tandai semua terbaca</Text>
            </TouchableOpacity>
          )}
        </View>
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
              <Text style={{ fontSize: 32 }}>🔔</Text>
              <Text style={styles.emptyText}>Belum ada notifikasi</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, !item.isRead && styles.rowUnread]}
              onPress={() => !item.isRead && markRead(item.id)}
            >
              <Text style={{ fontSize: 20 }}>{ICON[item.type]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMessage}>{item.message}</Text>
                <Text style={styles.rowTime}>
                  {format(new Date(item.createdAt), 'd MMM yyyy, HH:mm', { locale: localeId })}
                </Text>
              </View>
              {!item.isRead && <View style={styles.unreadDot} />}
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
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.orangeDk },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  markAllText: { fontSize: 12, fontWeight: '700', color: colors.orangeDk },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  rowUnread: { borderColor: colors.orange, backgroundColor: colors.orangeLt },
  rowTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark },
  rowMessage: { fontSize: 12, fontWeight: '600', color: colors.textMid, marginTop: 3 },
  rowTime: { fontSize: 10, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange, marginTop: 4 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
