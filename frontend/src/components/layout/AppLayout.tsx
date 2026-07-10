import { useState } from 'react'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardList, CreditCard, Building2, Package,
  BarChart3, DollarSign, MessageSquare, CalendarDays, Activity,
  ChevronDown, LogOut, Menu, X, PawPrint,
} from 'lucide-react'
import PwaInstallBanner from '@/components/PwaInstallBanner'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  icon: React.ElementType
  path?: string
  children?: { label: string; path: string; roles?: string[] }[]
  roles?: string[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard',           icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Data Pasien',         icon: PawPrint,         path: '/pasien' },
  { label: 'Pendaftaran Berobat', icon: ClipboardList,    path: '/pendaftaran' },
  { label: 'Pembayaran',          icon: CreditCard,       path: '/pembayaran', roles: ['admin', 'kasir', 'resepsionis'] },
  {
    label: 'Layanan Klinis', icon: Activity,
    children: [
      { label: 'Rawat Inap',      path: '/rawat-inap',    roles: ['admin', 'dokter', 'resepsionis'] },
      { label: 'Pet Hotel',       path: '/pet-hotel',     roles: ['admin', 'karyawan'] },
      { label: 'Grooming',        path: '/grooming',      roles: ['admin', 'karyawan', 'resepsionis', 'kasir'] },
      { label: 'Telemedicine',    path: '/telemed',       roles: ['admin', 'dokter'] },
      { label: 'Manajemen Lab',   path: '/lab',           roles: ['admin', 'dokter'] },
      { label: 'Symptom Checker', path: '/symptom',       roles: ['admin'] },
      { label: 'Drug & Dosis',    path: '/clinical/drug', roles: ['admin', 'dokter'] },
    ],
  },
  {
    label: 'Booking & Jadwal', icon: CalendarDays,
    children: [
      { label: 'Booking Online',   path: '/appointment',   roles: ['admin', 'resepsionis'] },
      { label: 'Jadwal Dokter',    path: '/jadwal-dokter', roles: ['admin'] },
      { label: 'Reminder & Alert', path: '/reminder',      roles: ['admin'] },
      { label: 'Google Calendar',  path: '/calendar-sync', roles: ['admin', 'dokter'] },
    ],
  },
  {
    label: 'Gudang & Produk', icon: Package,
    children: [
      { label: 'Gudang & Inventori', path: '/gudang',         roles: ['admin'] },
      { label: 'Scanner Barcode',    path: '/gudang/barcode', roles: ['admin'] },
      { label: 'Pet Shop',           path: '/petshop',        roles: ['admin', 'kasir'] },
      { label: 'Marketplace',        path: '/marketplace',    roles: ['admin'] },
    ],
  },
  {
    label: 'Keuangan', icon: DollarSign,
    children: [
      { label: 'Pengeluaran',         path: '/pengeluaran', roles: ['admin'] },
      { label: 'Penggajian',          path: '/penggajian',  roles: ['admin'] },
      { label: 'Billing & Langganan', path: '/billing',     roles: ['admin'] },
      { label: 'Laporan PPh 21',      path: '/pajak',       roles: ['admin'] },
    ],
  },
  {
    label: 'Laporan & Analitik', icon: BarChart3,
    children: [
      { label: 'Harian',   path: '/laporan/harian',  roles: ['admin'] },
      { label: 'Mingguan', path: '/laporan/mingguan', roles: ['admin'] },
      { label: 'Bulanan',  path: '/laporan/bulanan',  roles: ['admin'] },
      { label: 'Rekap',    path: '/laporan/rekap',    roles: ['admin'] },
      { label: 'Business Intelligence', path: '/analytics/bi', roles: ['admin'] },
      { label: 'Audit Trail',           path: '/audit',        roles: ['admin', 'superadmin'] },
    ],
  },
  {
    label: 'Marketing & CRM', icon: MessageSquare,
    children: [
      { label: 'Notifikasi WA',   path: '/notifikasi', roles: ['admin'] },
      { label: 'Broadcast WA',    path: '/broadcast',  roles: ['admin'] },
      { label: 'Loyalty Program', path: '/loyalty',    roles: ['admin'] },
      { label: 'Rating & Ulasan', path: '/review',     roles: ['admin'] },
    ],
  },
  {
    label: 'Administrasi', icon: Building2,
    children: [
      { label: 'Cabang',           path: '/cabang',  roles: ['admin'] },
      { label: 'Manajemen User',   path: '/user',    roles: ['admin'] },
      { label: 'Layanan & Jasa',   path: '/layanan', roles: ['admin'] },
      { label: 'Platform Tenants', path: '/superadmin/tenants', roles: ['superadmin'] },
    ],
  },
]

const roleLabel: Record<string, string> = {
  admin: 'Administrator', dokter: 'Dokter Hewan',
  resepsionis: 'Resepsionis', kasir: 'Kasir',
  karyawan: 'Karyawan', superadmin: 'Super Admin',
}

const roleBadgeStyle: Record<string, React.CSSProperties> = {
  admin:       { background: 'var(--orange-lt)', color: 'var(--orange)' },
  dokter:      { background: 'var(--teal-lt)',   color: 'var(--teal)'   },
  kasir:       { background: 'var(--yellow-lt)', color: '#C98A00'       },
  superadmin:  { background: 'var(--purple-lt)', color: 'var(--purple)' },
  resepsionis: { background: 'var(--blue-lt)',   color: 'var(--blue)'   },
  karyawan:    { background: 'var(--green-lt)',  color: 'var(--green)'  },
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<string[]>([])

  const toggle = (label: string) =>
    setExpanded((p) => p.includes(label) ? p.filter((l) => l !== label) : [...p, label])

  const isActive = (path: string) => location.pathname === path
  const isGroupActive = (children: { path: string }[]) =>
    children.some((c) => location.pathname.startsWith(c.path))
  const hasRole = (roles?: string[]) =>
    !roles || (user?.role && roles.includes(user.role))
  const canView = (item: NavItem) => hasRole(item.roles)

  const handleLogout = async () => {
    try { await api.post('/keluar') } catch {}
    logout()
    navigate('/login')
  }

  return (
    <aside className="flex flex-col h-full w-64" style={{ background: 'var(--card)', borderRight: '1.5px solid var(--border)' }}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: '1.5px solid var(--border)' }}>
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center p-1.5"
            style={{ background: 'var(--orange)', boxShadow: '0 3px 10px rgba(255,122,61,.3)' }}
          >
            <img src="/logo-icon-white.svg" alt="Paw Hub" className="w-full h-full" />
          </div>
          <div className="leading-tight">
            <p className="font-display font-black text-sm" style={{ color: 'var(--orange)' }}>Paw Hub</p>
            <p className="text-[10px] font-bold" style={{ color: 'var(--text-soft)' }}>Clinic System</p>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-warm-100"
            style={{ color: 'var(--text-soft)' }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* User chip */}
      <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--warm-bg)', border: '1.5px solid var(--border)' }}>
        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-dark)' }}>{user?.fullname}</p>
        <p className="text-xs font-medium truncate" style={{ color: 'var(--text-soft)' }}>{user?.branchName}</p>
        <span
          className="mt-1.5 inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold"
          style={roleBadgeStyle[user?.role ?? ''] ?? { background: 'var(--warm-bg)', color: 'var(--text-mid)' }}
        >
          {roleLabel[user?.role ?? ''] ?? user?.role}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          if (!canView(item)) return null

          if (item.children) {
            const visibleChildren = item.children.filter((c) => hasRole(c.roles))
            if (visibleChildren.length === 0) return null

            const open = expanded.includes(item.label) || isGroupActive(visibleChildren)
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggle(item.label)}
                  className={cn('nav-item justify-between', isGroupActive(visibleChildren) && 'active')}
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </span>
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-300 ease-in-out', open && 'rotate-180')} />
                </button>
                <div
                  className="grid"
                  style={{
                    gridTemplateRows: open ? '1fr' : '0fr',
                    opacity: open ? 1 : 0,
                    transition: 'grid-template-rows 280ms ease-in-out, opacity 220ms ease-in-out',
                  }}
                >
                  <div className="overflow-hidden">
                    <div className="ml-4 mt-0.5 pl-3 space-y-0.5" style={{ borderLeft: '2px solid var(--border)' }}>
                      {visibleChildren.map((child) => (
                        <button
                          key={child.path}
                          onClick={() => { navigate(child.path); onClose?.() }}
                          className={cn('nav-item text-xs py-2', isActive(child.path) && 'active')}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          }

          return (
            <button
              key={item.path}
              onClick={() => { navigate(item.path!); onClose?.() }}
              className={cn('nav-item', isActive(item.path!) && 'active')}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-3" style={{ borderTop: '1.5px solid var(--border)' }}>
        <button
          onClick={handleLogout}
          className="nav-item"
          style={{ color: 'var(--red)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--red-lt)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </aside>
  )
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const pathLabel: Record<string, string> = {
    '/dashboard': 'Dashboard', '/pasien': 'Data Pasien',
    '/pendaftaran': 'Pendaftaran Berobat',
    '/pemeriksaan': 'Hasil Pemeriksaan', '/pembayaran': 'Pembayaran',
    '/penggajian': 'Penggajian', '/pengeluaran': 'Pengeluaran', '/rawat-inap': 'Rawat Inap',
    '/notifikasi': 'Notifikasi WhatsApp', '/appointment': 'Booking & Appointment', '/reminder': 'Reminder & Alert',
    '/cabang': 'Manajemen Cabang', '/user': 'Manajemen User',
  }
  const pageTitle = pathLabel[location.pathname] ?? ''

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--warm-bg)' }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(45,27,14,.06)' }}>
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-[rgba(45,27,14,.4)]" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 shadow-card-lg">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="px-4 lg:px-6 py-3 flex items-center gap-3 flex-shrink-0"
          style={{ background: 'var(--card)', borderBottom: '1.5px solid var(--border)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl transition-colors hover:bg-warm-100"
            style={{ color: 'var(--text-soft)' }}
          >
            <Menu className="w-5 h-5" />
          </button>
          {pageTitle && (
            <h1 className="font-display font-extrabold text-base" style={{ color: 'var(--text-dark)' }}>
              {pageTitle}
            </h1>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-screen-xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <PwaInstallBanner />
    </div>
  )
}
