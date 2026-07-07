import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface StaffItem {
  id: string
  staffingNumber?: string
  fullname: string
  username: string
  role: string
  status: boolean
  phoneNumber?: string
}

interface BranchDetail {
  id: string
  branchCode: string
  branchName: string
  address?: string
  phoneNumber?: string
  email?: string
  operatingHours?: string
  paymentInstruction?: string
  isActive: boolean
  users: StaffItem[]
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

export default function CabangDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'CabangDetail'>>()
  const { id } = route.params

  const [branch, setBranch] = useState<BranchDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDetail = useCallback(() => api.get(`/cabang/${id}`).then((res) => setBranch(res.data.data)), [id])

  useEffect(() => {
    setLoading(true)
    fetchDetail().finally(() => setLoading(false))
  }, [fetchDetail])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    )
  }

  if (!branch) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Cabang tidak ditemukan</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Kembali</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.branchName}>{branch.branchName}</Text>
          <Badge variant={branch.isActive ? 'green' : 'gray'}>{branch.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
        </View>
        <Text style={styles.metaText}>Kode: {branch.branchCode}</Text>
        {branch.address && <Text style={styles.metaText}>{branch.address}</Text>}
        {branch.phoneNumber && <Text style={styles.metaText}>Telp: {branch.phoneNumber}</Text>}
        {branch.email && <Text style={styles.metaText}>Email: {branch.email}</Text>}
        {branch.operatingHours && <Text style={styles.metaText}>Jam Operasional: {branch.operatingHours}</Text>}
        {branch.paymentInstruction && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Instruksi Pembayaran</Text>
            <Text style={styles.bodyText}>{branch.paymentInstruction}</Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Staf ({branch.users.length})</Text>
        {branch.users.length === 0 ? (
          <Text style={[styles.metaText, { marginTop: 8 }]}>Belum ada staf di cabang ini</Text>
        ) : (
          branch.users.map((u) => (
            <View key={u.id} style={styles.staffRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.staffName}>{u.fullname}{!u.status && ' (nonaktif)'}</Text>
                <Text style={styles.rowMeta}>@{u.username}{u.phoneNumber ? ` · ${u.phoneNumber}` : ''}</Text>
              </View>
              <Badge variant={roleVariant[u.role] ?? 'gray'}>{roleLabel[u.role] ?? u.role}</Badge>
            </View>
          ))
        )}
      </View>

      <Text style={styles.noteText}>
        Buat/edit/hapus cabang hanya bisa lewat web — sengaja dibatasi di mobile karena ini konfigurasi tingkat tenant yang jarang diubah.
      </Text>
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
  branchName: { fontSize: 17, fontWeight: '800', color: colors.textDark, flexShrink: 1 },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark },
  bodyText: { fontSize: 13, fontWeight: '500', color: colors.textMid, marginTop: 4 },
  staffRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 },
  staffName: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  rowMeta: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  noteText: { fontSize: 11, fontWeight: '600', color: colors.textSoft, lineHeight: 16, textAlign: 'center', paddingHorizontal: 10 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
