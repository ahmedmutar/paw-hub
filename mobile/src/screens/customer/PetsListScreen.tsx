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
import { format, differenceInCalendarDays } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { portalApi } from '../../lib/portalApi'
import { usePortalAuthStore } from '../../stores/portalAuth.store'
import { colors } from '../../theme'
import { Badge } from '../../components/Badge'
import type { CustomerStackParamList } from '../../navigation/CustomerNavigator'

interface Pet {
  id: string
  petName: string
  petCategory: string
  petGender?: string
  branch: { branchName: string } | null
  nextVaccination?: { vaccineName: string; nextDueAt: string } | null
  nextDeworming?: { medicationName: string; nextDueAt: string } | null
  visitCount: number
}

const categoryEmoji: Record<string, string> = {
  Anjing: '🐶',
  Kucing: '🐱',
  Kelinci: '🐰',
  Burung: '🐦',
}

export default function PetsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>()
  const { owner, logout } = usePortalAuthStore()
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPets = useCallback(() => portalApi.get('/portal/my-pets').then((res) => setPets(res.data.data)), [])

  useEffect(() => {
    setLoading(true)
    fetchPets().finally(() => setLoading(false))
  }, [fetchPets])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchPets()
    setRefreshing(false)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Halo,</Text>
            <Text style={styles.ownerName}>{owner?.ownerName ?? 'Pemilik Hewan'}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Keluar</Text>
          </TouchableOpacity>
        </View>
        {owner?.branch && <Text style={styles.branchText}>Klinik: {owner.branch.branchName}</Text>}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.orange} size="large" />
        </View>
      ) : (
        <FlatList
          data={pets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 32 }}>🐾</Text>
              <Text style={styles.emptyText}>Belum ada data hewan terdaftar di klinik ini</Text>
            </View>
          }
          renderItem={({ item }) => {
            const vaccDays = item.nextVaccination ? differenceInCalendarDays(new Date(item.nextVaccination.nextDueAt), new Date()) : null
            const dewormDays = item.nextDeworming ? differenceInCalendarDays(new Date(item.nextDeworming.nextDueAt), new Date()) : null
            return (
              <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('PetDetail', { petId: item.id, petName: item.petName })}>
                <View style={styles.cardHeaderRow}>
                  <Text style={{ fontSize: 22 }}>{categoryEmoji[item.petCategory] ?? '🐾'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.petName}>{item.petName}</Text>
                    <Text style={styles.rowMeta}>{item.petCategory}{item.petGender ? ` · ${item.petGender}` : ''}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
                {item.branch && <Text style={styles.rowMeta}>Terdaftar di {item.branch.branchName}</Text>}
                <Text style={styles.rowMeta}>{item.visitCount} kali kunjungan</Text>

                {item.nextVaccination && (
                  <View style={styles.reminderRow}>
                    <Badge variant={vaccDays !== null && vaccDays <= 7 ? 'red' : 'yellow'}>
                      {`💉 Vaksin ${item.nextVaccination.vaccineName} · ${format(new Date(item.nextVaccination.nextDueAt), 'd MMM yyyy', { locale: localeId })}`}
                    </Badge>
                  </View>
                )}
                {item.nextDeworming && (
                  <View style={styles.reminderRow}>
                    <Badge variant={dewormDays !== null && dewormDays <= 7 ? 'red' : 'yellow'}>
                      {`💊 Obat cacing · ${format(new Date(item.nextDeworming.nextDueAt), 'd MMM yyyy', { locale: localeId })}`}
                    </Badge>
                  </View>
                )}
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
  header: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 13, color: colors.textSoft, fontWeight: '600' },
  ownerName: { fontSize: 20, color: colors.textDark, fontWeight: '800', marginTop: 2 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border },
  logoutText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  branchText: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 18, paddingBottom: 24 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  petName: { fontSize: 15, fontWeight: '800', color: colors.textDark },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 3 },
  chevron: { fontSize: 18, fontWeight: '700', color: colors.orangeDk },
  reminderRow: { marginTop: 8, alignSelf: 'flex-start' },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft, textAlign: 'center', paddingHorizontal: 30 },
})
