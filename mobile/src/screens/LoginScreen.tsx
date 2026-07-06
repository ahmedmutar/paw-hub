import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native'
import { api } from '../lib/api'
import { portalApi } from '../lib/portalApi'
import { useAuthStore } from '../stores/auth.store'
import { usePortalAuthStore } from '../stores/portalAuth.store'
import { colors } from '../theme'

export default function LoginScreen() {
  const [mode, setMode] = useState<'staff' | 'customer'>('staff')

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Image source={require('../../assets/logo-icon-white.png')} style={styles.logoImage} resizeMode="contain" />
          </View>
          <Text style={styles.brand}>PawCare</Text>
          <Text style={styles.subtitle}>Sistem Manajemen Klinik Hewan</Text>
        </View>

        <View style={styles.modeRow}>
          <TouchableOpacity style={[styles.modeBtn, mode === 'staff' && styles.modeBtnActive]} onPress={() => setMode('staff')}>
            <Text style={[styles.modeBtnText, mode === 'staff' && styles.modeBtnTextActive]}>Staf Klinik</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeBtn, mode === 'customer' && styles.modeBtnActive]} onPress={() => setMode('customer')}>
            <Text style={[styles.modeBtnText, mode === 'customer' && styles.modeBtnTextActive]}>Pemilik Hewan</Text>
          </TouchableOpacity>
        </View>

        {mode === 'staff' ? <StaffLoginForm /> : <CustomerLoginForm />}

        <Text style={styles.footer}>© 2025 PawCare Clinic System</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function StaffLoginForm() {
  const login = useAuthStore((s) => s.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/masuk', { username, password })
      const { user, accessToken, refreshToken } = res.data.data
      login({ ...user, accessToken, refreshToken })
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Terjadi kesalahan. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Masuk ke akun Anda</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        placeholder="Masukkan username"
        placeholderTextColor={colors.textSoft}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Masukkan password"
        placeholderTextColor={colors.textSoft}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading || !username || !password}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Masuk</Text>}
      </TouchableOpacity>
    </View>
  )
}

function CustomerLoginForm() {
  const login = usePortalAuthStore((s) => s.login)
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRequestOtp = async () => {
    setError('')
    setInfo('')
    setLoading(true)
    try {
      const res = await portalApi.post('/portal/request-otp', { phone: phone.trim() })
      setInfo(res.data.message ?? 'Kode OTP telah dikirim lewat WhatsApp.')
      setStep('otp')
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Terjadi kesalahan. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await portalApi.post('/portal/verify-otp', { phone: phone.trim(), otp: otp.trim() })
      login({ token: res.data.token, owner: res.data.owner })
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Kode OTP salah atau kadaluarsa.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{step === 'phone' ? 'Cek Rekam Medis Hewan Anda' : 'Masukkan Kode OTP'}</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}
      {info && !error ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>✓ {info}</Text>
        </View>
      ) : null}

      {step === 'phone' ? (
        <>
          <Text style={styles.label}>Nomor WhatsApp Terdaftar</Text>
          <TextInput
            style={styles.input}
            placeholder="08xxxxxxxxxx"
            placeholderTextColor={colors.textSoft}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TouchableOpacity style={styles.button} onPress={handleRequestOtp} disabled={loading || phone.trim().length < 8}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Kirim Kode OTP</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.label}>Kode OTP (6 digit)</Text>
          <TextInput
            style={styles.input}
            placeholder="123456"
            placeholderTextColor={colors.textSoft}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading || otp.trim().length !== 6}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verifikasi & Masuk</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => { setStep('phone'); setOtp(''); setError(''); setInfo('') }}>
            <Text style={styles.changePhoneText}>Ganti nomor / kirim ulang OTP</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.warmBg,
  },
  logoWrap: { alignItems: 'center', marginBottom: 20 },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoImage: { width: 36, height: 36 },
  brand: { fontSize: 24, fontWeight: '800', color: colors.textDark },
  subtitle: { fontSize: 13, color: colors.textSoft, marginTop: 4, fontWeight: '500' },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  modeBtnActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  modeBtnText: { fontSize: 13, fontWeight: '700', color: colors.textMid },
  modeBtnTextActive: { color: '#fff' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.textDark, marginBottom: 18 },
  errorBox: {
    backgroundColor: colors.redLt,
    borderWidth: 1.5,
    borderColor: colors.red,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: colors.red, fontSize: 13, fontWeight: '600' },
  infoBox: {
    backgroundColor: colors.greenLt,
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  infoText: { color: colors.green, fontSize: 12, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMid, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.warmBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 10,
  },
  button: {
    backgroundColor: colors.orange,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  changePhoneText: { fontSize: 12, fontWeight: '700', color: colors.orangeDk },
  footer: { textAlign: 'center', color: colors.textSoft, fontSize: 11, marginTop: 20, fontWeight: '500' },
})
