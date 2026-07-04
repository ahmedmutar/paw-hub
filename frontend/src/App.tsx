import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import CabangPage from '@/pages/cabang/CabangPage'
import UserPage from '@/pages/user/UserPage'
import PasienPage from '@/pages/pasien/PasienPage'
import PasienDetailPage from '@/pages/pasien/PasienDetailPage'
import RekamMedisPage from '@/pages/rekam-medis/RekamMedisPage'
import PendaftaranPage from '@/pages/pendaftaran/PendaftaranPage'
import PemeriksaanPage from '@/pages/pemeriksaan/PemeriksaanPage'
import LayananPage from '@/pages/layanan/LayananPage'
import GudangPage from '@/pages/gudang/GudangPage'
import PembayaranPage from '@/pages/pembayaran/PembayaranPage'
import PengeluaranPage from '@/pages/pengeluaran/PengeluaranPage'
import LaporanPage from '@/pages/laporan/LaporanPage'
import PenggajianPage from '@/pages/penggajian/PenggajianPage'
import PetShopPage from '@/pages/petshop/PetShopPage'
import RawatInapPage from '@/pages/rawat-inap/RawatInapPage'
import NotifikasiPage from '@/pages/notifikasi/NotifikasiPage'
import AppointmentPage from '@/pages/appointment/AppointmentPage'
import BookingPage from '@/pages/booking/BookingPage'
import ReminderPage from '@/pages/reminder/ReminderPage'
import PortalPage from '@/pages/portal/PortalPage'
import GroomingPage from '@/pages/grooming/GroomingPage'
import OnboardingPage from '@/pages/onboarding/OnboardingPage'
import LandingPage from '@/pages/landing/LandingPage'
import BillingPage from '@/pages/billing/BillingPage'
import TenantsPage from '@/pages/superadmin/TenantsPage'
import AuditPage from '@/pages/audit/AuditPage'
import BroadcastPage from '@/pages/broadcast/BroadcastPage'
import LoyaltyPage from '@/pages/loyalty/LoyaltyPage'
import ReviewPage, { PublicRatingPage } from '@/pages/review/ReviewPage'
import JadwalDokterPage from '@/pages/jadwal-dokter/JadwalDokterPage'
import BarcodePage from '@/pages/gudang/BarcodePage'
import PetHotelPage from '@/pages/pet-hotel/PetHotelPage'
import TelemedPage from '@/pages/telemed/TelemedPage'
import LabPage from '@/pages/lab/LabPage'
import SymptomPage from '@/pages/symptom/SymptomPage'
import DrugPage from '@/pages/clinical/DrugPage'
import PublicClinicPage from '@/pages/public-clinic/PublicClinicPage'
import PajakPage from '@/pages/pajak/PajakPage'
import CalendarSyncPage from '@/pages/calendar/CalendarSyncPage'
import BIPage from '@/pages/analytics/BIPage'
import MarketplacePage from '@/pages/marketplace/MarketplacePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1 },
  },
})

function PublicRatingWrapper() {
  const { token } = useParams<{ token: string }>()
  return <PublicRatingPage token={token!} />
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/beranda" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/portal" element={<PortalPage />} />
          <Route path="/daftar" element={<OnboardingPage />} />
          <Route path="/review/:token" element={<PublicRatingWrapper />} />
          <Route path="/clinic/:branchId" element={<PublicClinicPage />} />

          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="cabang" element={<CabangPage />} />
            <Route path="user" element={<UserPage />} />
            <Route path="pasien" element={<PasienPage />} />
            <Route path="pasien/:id" element={<PasienDetailPage />} />
            <Route path="rekam-medis/:patientId" element={<RekamMedisPage />} />
            <Route path="pendaftaran" element={<PendaftaranPage />} />
            <Route path="pemeriksaan/:registrationId" element={<PemeriksaanPage />} />
            <Route path="layanan" element={<LayananPage />} />
            <Route path="gudang" element={<GudangPage />} />
            <Route path="pembayaran" element={<PembayaranPage />} />
            <Route path="pengeluaran" element={<PengeluaranPage />} />
            <Route path="laporan/harian" element={<LaporanPage />} />
            <Route path="laporan/bulanan" element={<LaporanPage />} />
            <Route path="laporan/mingguan" element={<LaporanPage />} />
            <Route path="laporan/rekap" element={<LaporanPage />} />
            <Route path="penggajian" element={<PenggajianPage />} />
            <Route path="petshop" element={<PetShopPage />} />
            <Route path="rawat-inap" element={<RawatInapPage />} />
            <Route path="notifikasi" element={<NotifikasiPage />} />
            <Route path="appointment" element={<AppointmentPage />} />
            <Route path="reminder" element={<ReminderPage />} />
            <Route path="grooming" element={<GroomingPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="superadmin/tenants" element={<TenantsPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="broadcast" element={<BroadcastPage />} />
            <Route path="loyalty" element={<LoyaltyPage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="jadwal-dokter" element={<JadwalDokterPage />} />
            <Route path="gudang/barcode" element={<BarcodePage />} />
            <Route path="pet-hotel" element={<PetHotelPage />} />
            <Route path="telemed" element={<TelemedPage />} />
            <Route path="lab" element={<LabPage />} />
            <Route path="symptom" element={<SymptomPage />} />
            <Route path="clinical/drug" element={<DrugPage />} />
            <Route path="pajak" element={<PajakPage />} />
            <Route path="calendar-sync" element={<CalendarSyncPage />} />
            <Route path="analytics/bi" element={<BIPage />} />
            <Route path="marketplace" element={<MarketplacePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
