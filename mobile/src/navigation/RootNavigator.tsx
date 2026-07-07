import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
import DashboardScreen from '../screens/DashboardScreen'
import PasienListScreen from '../screens/pasien/PasienListScreen'
import PasienDetailScreen from '../screens/pasien/PasienDetailScreen'
import AppointmentListScreen from '../screens/appointment/AppointmentListScreen'
import AppointmentDetailScreen from '../screens/appointment/AppointmentDetailScreen'
import PendaftaranListScreen from '../screens/pendaftaran/PendaftaranListScreen'
import PendaftaranDetailScreen from '../screens/pendaftaran/PendaftaranDetailScreen'
import PemeriksaanScreen from '../screens/pemeriksaan/PemeriksaanScreen'
import PembayaranListScreen from '../screens/pembayaran/PembayaranListScreen'
import PembayaranDetailScreen from '../screens/pembayaran/PembayaranDetailScreen'
import RekamMedisScreen from '../screens/rekam-medis/RekamMedisScreen'
import NotificationsScreen from '../screens/notifications/NotificationsScreen'
import GudangListScreen from '../screens/gudang/GudangListScreen'
import GudangDetailScreen from '../screens/gudang/GudangDetailScreen'
import BarcodeScanScreen from '../screens/gudang/BarcodeScanScreen'
import JadwalDokterScreen from '../screens/jadwal-dokter/JadwalDokterScreen'
import RawatInapListScreen from '../screens/rawat-inap/RawatInapListScreen'
import RawatInapDetailScreen from '../screens/rawat-inap/RawatInapDetailScreen'
import PetHotelScreen from '../screens/pet-hotel/PetHotelScreen'
import PetHotelBookingDetailScreen from '../screens/pet-hotel/PetHotelBookingDetailScreen'
import GroomingScreen from '../screens/grooming/GroomingScreen'
import ReminderScreen from '../screens/reminder/ReminderScreen'
import ReviewScreen from '../screens/review/ReviewScreen'
import TelemedScreen from '../screens/telemed/TelemedScreen'
import TelemedDetailScreen from '../screens/telemed/TelemedDetailScreen'
import LaporanScreen from '../screens/laporan/LaporanScreen'
import LabScreen from '../screens/lab/LabScreen'
import LabResultScreen from '../screens/lab/LabResultScreen'
import LabHistoryScreen from '../screens/lab/LabHistoryScreen'
import UserListScreen, { StaffUser } from '../screens/user/UserListScreen'
import UserDetailScreen from '../screens/user/UserDetailScreen'
import CabangListScreen from '../screens/cabang/CabangListScreen'
import CabangDetailScreen from '../screens/cabang/CabangDetailScreen'
import { colors } from '../theme'

export type RootStackParamList = {
  Tabs: undefined
  Notifications: undefined
  Gudang: undefined
  GudangDetail: { id: string }
  BarcodeScan: undefined
  JadwalDokter: undefined
  RawatInap: undefined
  RawatInapDetail: { id: string }
  PetHotel: undefined
  PetHotelBookingDetail: { id: string }
  Grooming: undefined
  Reminder: undefined
  Review: undefined
  Telemed: undefined
  TelemedDetail: { id: string }
  Laporan: undefined
  Lab: undefined
  LabResult: { id: string }
  User: undefined
  UserDetail: { user: StaffUser }
  Cabang: undefined
  CabangDetail: { id: string }
}

export type PasienStackParamList = {
  PasienList: undefined
  PasienDetail: { id: string }
  RekamMedis: { patientId: string }
  LabHistory: { patientId: string }
}

export type AppointmentStackParamList = {
  AppointmentList: undefined
  AppointmentDetail: { id: string }
}

export type PendaftaranStackParamList = {
  PendaftaranList: undefined
  PendaftaranDetail: { id: string }
  Pemeriksaan: { registrationId: string }
}

export type PembayaranStackParamList = {
  PembayaranList: undefined
  PembayaranDetail: { checkUpId: string }
}

const Tab = createBottomTabNavigator()
const RootStack = createNativeStackNavigator<RootStackParamList>()
const PasienStack = createNativeStackNavigator<PasienStackParamList>()
const AppointmentStack = createNativeStackNavigator<AppointmentStackParamList>()
const PendaftaranStack = createNativeStackNavigator<PendaftaranStackParamList>()
const PembayaranStack = createNativeStackNavigator<PembayaranStackParamList>()

function PasienStackNavigator() {
  return (
    <PasienStack.Navigator screenOptions={{ headerShown: false }}>
      <PasienStack.Screen name="PasienList" component={PasienListScreen} />
      <PasienStack.Screen name="PasienDetail" component={PasienDetailScreen} />
      <PasienStack.Screen name="RekamMedis" component={RekamMedisScreen} />
      <PasienStack.Screen name="LabHistory" component={LabHistoryScreen} />
    </PasienStack.Navigator>
  )
}

function AppointmentStackNavigator() {
  return (
    <AppointmentStack.Navigator screenOptions={{ headerShown: false }}>
      <AppointmentStack.Screen name="AppointmentList" component={AppointmentListScreen} />
      <AppointmentStack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
    </AppointmentStack.Navigator>
  )
}

function PendaftaranStackNavigator() {
  return (
    <PendaftaranStack.Navigator screenOptions={{ headerShown: false }}>
      <PendaftaranStack.Screen name="PendaftaranList" component={PendaftaranListScreen} />
      <PendaftaranStack.Screen name="PendaftaranDetail" component={PendaftaranDetailScreen} />
      <PendaftaranStack.Screen name="Pemeriksaan" component={PemeriksaanScreen} />
    </PendaftaranStack.Navigator>
  )
}

function PembayaranStackNavigator() {
  return (
    <PembayaranStack.Navigator screenOptions={{ headerShown: false }}>
      <PembayaranStack.Screen name="PembayaranList" component={PembayaranListScreen} />
      <PembayaranStack.Screen name="PembayaranDetail" component={PembayaranDetailScreen} />
    </PembayaranStack.Navigator>
  )
}

const icons: Record<string, string> = {
  Dashboard: '🏠',
  Pendaftaran: '📋',
  Pasien: '🐾',
  Appointment: '📅',
  Pembayaran: '💳',
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.textSoft,
        tabBarStyle: { borderTopColor: colors.border, height: 58, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: () => <Text style={{ fontSize: 18 }}>{icons[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Beranda' }} />
      <Tab.Screen
        name="Pendaftaran"
        component={PendaftaranStackNavigator}
        options={{ title: 'Antrian' }}
      />
      <Tab.Screen name="Pasien" component={PasienStackNavigator} options={{ title: 'Pasien' }} />
      <Tab.Screen
        name="Appointment"
        component={AppointmentStackNavigator}
        options={{ title: 'Janji Temu' }}
      />
      <Tab.Screen
        name="Pembayaran"
        component={PembayaranStackNavigator}
        options={{ title: 'Kasir' }}
      />
    </Tab.Navigator>
  )
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Tabs" component={Tabs} />
        <RootStack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'modal' }} />
        <RootStack.Screen name="Gudang" component={GudangListScreen} />
        <RootStack.Screen name="GudangDetail" component={GudangDetailScreen} />
        <RootStack.Screen name="BarcodeScan" component={BarcodeScanScreen} options={{ presentation: 'fullScreenModal' }} />
        <RootStack.Screen name="JadwalDokter" component={JadwalDokterScreen} />
        <RootStack.Screen name="RawatInap" component={RawatInapListScreen} />
        <RootStack.Screen name="RawatInapDetail" component={RawatInapDetailScreen} />
        <RootStack.Screen name="PetHotel" component={PetHotelScreen} />
        <RootStack.Screen name="PetHotelBookingDetail" component={PetHotelBookingDetailScreen} />
        <RootStack.Screen name="Grooming" component={GroomingScreen} />
        <RootStack.Screen name="Reminder" component={ReminderScreen} />
        <RootStack.Screen name="Review" component={ReviewScreen} />
        <RootStack.Screen name="Telemed" component={TelemedScreen} />
        <RootStack.Screen name="TelemedDetail" component={TelemedDetailScreen} />
        <RootStack.Screen name="Laporan" component={LaporanScreen} />
        <RootStack.Screen name="Lab" component={LabScreen} />
        <RootStack.Screen name="LabResult" component={LabResultScreen} />
        <RootStack.Screen name="User" component={UserListScreen} />
        <RootStack.Screen name="UserDetail" component={UserDetailScreen} />
        <RootStack.Screen name="Cabang" component={CabangListScreen} />
        <RootStack.Screen name="CabangDetail" component={CabangDetailScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  )
}
