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
import { SearchBar } from '../../components/SearchBar'
import type { RootStackParamList } from '../../navigation/RootNavigator'

export interface StaffUser {
  id: string
  staffingNumber?: string
  username: string
  fullname: string
  role: string
  status: boolean
  email?: string
  gender?: string
  phoneNumber?: string
  bloodGroup?: string
  birthdate?: string
  birthPlace?: string
  religion?: string
  idCardNumber?: string
  address?: string
  homeNumber?: string
  imageProfile?: string
  branch: { branchName: string; branchCode?: string }
}

const roleLabel: Record<string, string> = {
  admin: 'Admin',
  dokter: 'Dokter',
  resepsionis: 'Resepsionis',
  kasir: 'Kasir',
  karyawan: 'Karyawan',
  superadmin: 'Superadmin',
}
const roleVariant: Record<string, BadgeVariant> = {
  admin: 'purple',
  dokter: 'blue',
  resepsionis: 'teal',
  kasir: 'orange',
  karyawan: 'gray',
  superadmin: 'red',
}
const ROLE_FILTERS = ['semua', 'admin', 'dokter', 'resepsionis', 'kasir', 'karyawan']
const STATUS_FILTERS = ['semua', 'aktif', 'nonaktif']

export default function UserListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('semua')
  const [statusFilter, setStatusFilter] = useState('semua')
  const [items, setItems] = useState<StaffUser[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchList = useCallback(
    async (pageNum = 1, append = false) => {
      const res = await api.get('/user', {
        params: {
          page: pageNum,
          limit: 20,
          search: search || undefined,
          role: roleFilter === 'semua' ? undefined : roleFilter,
          status: statusFilter === 'semua' ? undefined : statusFilter === 'aktif' ? 'true' : 'false',
        },
      })
      const { data, meta } = res.data
      setItems((prev) => (append ? [...prev, ...data] : data))
      setTotalPages(meta.totalPages)
      setPage(meta.page)
    },
    [search, roleFilter, statusFilter]
  )

  useEffect(() => {
    setLoading(true)
    fetchList(1).finally(() => setLoading(false))
  }, [fetchList])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchList(1)
    setRefreshing(false)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Kelola Staf</Text>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Cari nama, username, no. HP..." />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
        {ROLE_FILTERS.map((r) => (
          <TouchableOpacity key={r} onPress={() => setRoleFilter(r)} style={[styles.filterChip, roleFilter === r && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, roleFilter === r && styles.filterChipTextActive]}>
              {r === 'semua' ? 'Semua Role' : roleLabel[r]}
            </Text>
          </TouchableOpacity>
        ))}
        {STATUS_FILTERS.map((s) => (
          <TouchableOpacity key={s} onPress={() => setStatusFilter(s)} style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
              {s === 'semua' ? 'Semua Status' : s === 'aktif' ? 'Aktif' : 'Nonaktif'}
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
          onEndReached={() => page < totalPages && fetchList(page + 1, true)}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 32 }}>👥</Text>
              <Text style={styles.emptyText}>Tidak ada staf untuk filter ini</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('UserDetail', { user: item })}>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.fullname}>{item.fullname}</Text>
                  {!item.status && <Badge variant="gray">Nonaktif</Badge>}
                </View>
                <Text style={styles.rowMeta}>{item.staffingNumber ?? '-'} · {item.branch.branchName}</Text>
                {(item.phoneNumber || item.email) && (
                  <Text style={styles.rowMeta}>{item.phoneNumber ?? item.email}</Text>
                )}
              </View>
              <Badge variant={roleVariant[item.role] ?? 'gray'}>{roleLabel[item.role] ?? item.role}</Badge>
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
  searchWrap: { paddingHorizontal: 18, marginTop: 12, marginBottom: -4 },
  filterRow: { flexGrow: 0, marginVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
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
    gap: 10,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  fullname: { fontSize: 14, fontWeight: '700', color: colors.textDark },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 3 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
