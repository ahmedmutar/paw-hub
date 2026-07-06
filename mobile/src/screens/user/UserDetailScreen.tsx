import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import type { RootStackParamList } from '../../navigation/RootNavigator'

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

export default function UserDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'UserDetail'>>()
  const [user, setUser] = useState(route.params.user)

  const [editing, setEditing] = useState(false)
  const [fullname, setFullname] = useState(user.fullname)
  const [email, setEmail] = useState(user.email ?? '')
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber ?? '')
  const [address, setAddress] = useState(user.address ?? '')
  const [saving, setSaving] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [resetVisible, setResetVisible] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/user/${user.id}`, {
        fullname: fullname.trim(),
        email: email || undefined,
        phoneNumber: phoneNumber || undefined,
        address: address || undefined,
      })
      setUser((prev) => ({ ...prev, fullname: fullname.trim(), email, phoneNumber, address }))
      setEditing(false)
      Alert.alert('Tersimpan', 'Data staf berhasil diperbarui.')
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = () => {
    Alert.alert(
      user.status ? 'Nonaktifkan staf ini?' : 'Aktifkan kembali staf ini?',
      user.status
        ? `${user.fullname} tidak akan bisa login lagi sampai diaktifkan kembali.`
        : `${user.fullname} akan bisa login kembali.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, lanjutkan',
          onPress: async () => {
            setTogglingStatus(true)
            try {
              const res = await api.patch(`/user/${user.id}/toggle-status`)
              setUser((prev) => ({ ...prev, status: res.data.data.status }))
            } catch (err: any) {
              Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
            } finally {
              setTogglingStatus(false)
            }
          },
        },
      ]
    )
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Kembali</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.fullname}>{user.fullname}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {!user.status && <Badge variant="gray">Nonaktif</Badge>}
            <Badge variant={roleVariant[user.role] ?? 'gray'}>{roleLabel[user.role] ?? user.role}</Badge>
          </View>
        </View>
        <Text style={styles.metaText}>@{user.username} · {user.staffingNumber ?? '-'}</Text>
        <Text style={styles.metaText}>Cabang: {user.branch.branchName}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Info Kontak</Text>
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {editing ? (
          <>
            <Text style={styles.label}>Nama Lengkap</Text>
            <TextInput style={styles.input} value={fullname} onChangeText={setFullname} placeholderTextColor={colors.textSoft} />
            <Text style={[styles.label, { marginTop: 10 }]}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.textSoft} />
            <Text style={[styles.label, { marginTop: 10 }]}>No. HP</Text>
            <TextInput style={styles.input} value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" placeholderTextColor={colors.textSoft} />
            <Text style={[styles.label, { marginTop: 10 }]}>Alamat</Text>
            <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} value={address} onChangeText={setAddress} multiline placeholderTextColor={colors.textSoft} />
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.textSoft }]} onPress={() => setEditing(false)}>
                <Text style={styles.actionBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.orange }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Simpan</Text>}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.bodyText}>Email: {user.email || '-'}</Text>
            <Text style={styles.bodyText}>No. HP: {user.phoneNumber || '-'}</Text>
            <Text style={styles.bodyText}>Alamat: {user.address || '-'}</Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Data Pribadi</Text>
        <Text style={styles.bodyText}>Jenis Kelamin: {user.gender || '-'}</Text>
        <Text style={styles.bodyText}>Agama: {user.religion || '-'}</Text>
        <Text style={styles.bodyText}>Golongan Darah: {user.bloodGroup || '-'}</Text>
        <Text style={styles.bodyText}>No. KTP: {user.idCardNumber || '-'}</Text>
      </View>

      <TouchableOpacity
        style={[styles.wideBtn, { backgroundColor: user.status ? colors.red : colors.green }]}
        onPress={handleToggleStatus}
        disabled={togglingStatus}
      >
        {togglingStatus ? <ActivityIndicator color="#fff" /> : (
          <Text style={styles.wideBtnText}>{user.status ? 'Nonaktifkan Staf' : 'Aktifkan Staf'}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={[styles.wideBtn, { backgroundColor: colors.purple, marginTop: 10 }]} onPress={() => setResetVisible(true)}>
        <Text style={styles.wideBtnText}>Reset Password</Text>
      </TouchableOpacity>

      <Text style={styles.noteText}>
        Catatan: pembuatan akun staf baru, penghapusan akun, dan perubahan role hanya bisa dilakukan lewat web — sengaja tidak disediakan di mobile karena sensitif (risiko HP hilang/dicuri).
      </Text>

      <ResetPasswordModal
        visible={resetVisible}
        userId={user.id}
        userName={user.fullname}
        onClose={() => setResetVisible(false)}
      />
    </ScrollView>
  )
}

function ResetPasswordModal({
  visible,
  userId,
  userName,
  onClose,
}: {
  visible: boolean
  userId: string
  userName: string
  onClose: () => void
}) {
  const [newPassword, setNewPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleReset = () => {
    if (newPassword.length < 8) {
      Alert.alert('Password terlalu pendek', 'Minimal 8 karakter.')
      return
    }
    Alert.alert(
      'Konfirmasi Reset Password',
      `Semua sesi login aktif ${userName} akan dihapus dan mereka harus login ulang dengan password baru. Lanjutkan?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Reset',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true)
            try {
              await api.post(`/user/${userId}/reset-password`, { newPassword })
              setNewPassword('')
              onClose()
              Alert.alert('Berhasil', 'Password berhasil di-reset.')
            } catch (err: any) {
              Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
            } finally {
              setSubmitting(false)
            }
          },
        },
      ]
    )
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Reset Password {userName}</Text>
          <Text style={styles.modalSub}>Sesi login aktif akan dihapus setelah password diganti.</Text>
          <Text style={[styles.label, { marginTop: 14 }]}>Password Baru (min 8 karakter)</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="Password baru"
            placeholderTextColor={colors.textSoft}
          />
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.textSoft }]} onPress={onClose} disabled={submitting}>
              <Text style={styles.actionBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.purple }, newPassword.length < 8 && { opacity: 0.5 }]}
              onPress={handleReset}
              disabled={submitting || newPassword.length < 8}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Reset</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  content: { padding: 18, paddingTop: 60, paddingBottom: 40 },
  backBtn: { marginBottom: 14 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.orangeDk },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: colors.border, marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  fullname: { fontSize: 17, fontWeight: '800', color: colors.textDark, flexShrink: 1 },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textDark },
  editLink: { fontSize: 12, fontWeight: '700', color: colors.orangeDk },
  bodyText: { fontSize: 13, fontWeight: '600', color: colors.textMid, marginTop: 6 },
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
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  wideBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  wideBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  noteText: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 14, lineHeight: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: colors.card, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 15, fontWeight: '800', color: colors.textDark },
  modalSub: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 6 },
})
