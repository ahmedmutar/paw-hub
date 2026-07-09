import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { api } from '../../lib/api'
import { colors } from '../../theme'
import type { RootStackParamList } from '../../navigation/RootNavigator'

export default function BarcodeScanScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [looking, setLooking] = useState(false)

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned || looking) return
    setScanned(true)
    setLooking(true)
    try {
      const res = await api.get('/gudang/barcode/scan', { params: { code: data } })
      navigation.replace('GudangDetail', { id: res.data.data.id })
    } catch (err: any) {
      Alert.alert(
        'Tidak ditemukan',
        err.response?.data?.message ?? `Barcode "${data}" tidak cocok dengan item manapun.`,
        [{ text: 'Coba Lagi', onPress: () => setScanned(false) }]
      )
    } finally {
      setLooking(false)
    }
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>📷</Text>
        <Text style={styles.permText}>Paw Hub butuh akses kamera untuk memindai barcode.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Izinkan Kamera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 14 }}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39'] }}
        onBarcodeScanned={scanned ? undefined : handleScan}
      />
      <View style={styles.overlay}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.frame} />
        <Text style={styles.hintText}>Arahkan kamera ke barcode item</Text>
        {looking && <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: colors.warmBg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permText: { fontSize: 14, fontWeight: '600', color: colors.textMid, textAlign: 'center', marginBottom: 18 },
  permBtn: { backgroundColor: colors.orange, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.orangeDk },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 50 },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  frame: { width: 240, height: 240, borderWidth: 3, borderColor: '#fff', borderRadius: 20, backgroundColor: 'transparent' },
  hintText: { color: '#fff', fontWeight: '700', fontSize: 13, marginTop: 20 },
})
