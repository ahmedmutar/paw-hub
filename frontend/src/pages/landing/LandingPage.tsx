import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ClipboardList, BedDouble, CalendarDays, MessageSquare, Scissors,
  Package, BarChart3, Video, Star, Building2, CreditCard, FlaskConical,
  ChevronDown, Menu, X, ArrowRight, LayoutDashboard, Check, XIcon,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

// ─── Data (non-translatable parts: styling accents, icons, mock ids) ────────

const FLAGSHIP_META = [
  { accent: 'orange', mock: 'medis' },
  { accent: 'teal', mock: 'booking' },
  { accent: 'purple', mock: 'laporan' },
] as const

// Order matches en/id `landing.flagship.moreFeatures`
const MORE_FEATURES_ICON_LIST = [
  BedDouble, Scissors, Package, Video, FlaskConical, Star, Building2, CreditCard, ClipboardList, BarChart3,
]

const TESTIMONIAL_META = [
  { emoji: '👩‍⚕️', bg: 'orange' },
  { emoji: '🧑‍💼', bg: 'teal' },
  { emoji: '👨‍⚕️', bg: 'purple' },
] as const

const ACCENT: Record<string, { bg: string; fg: string; border: string }> = {
  orange: { bg: 'var(--orange-lt)', fg: 'var(--orange)', border: 'var(--peach)' },
  teal:   { bg: 'var(--teal-lt)',   fg: 'var(--teal)',   border: 'var(--teal)'  },
  purple: { bg: 'var(--purple-lt)', fg: 'var(--purple)', border: 'var(--purple)' },
}

// ─── Small doodle accents ───────────────────────────────────────────────────

function SquiggleUnderline({ color = 'var(--orange)' }: { color?: string }) {
  return (
    <svg viewBox="0 0 200 14" className="w-full h-3 -mt-1" preserveAspectRatio="none">
      <path d="M2 8 Q 25 2, 50 8 T 100 8 T 150 8 T 198 8" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// ─── Mockup snippets (fake dashboard screenshots) ──────────────────────────

function DashboardMockup() {
  const { t } = useTranslation()
  return (
    <div
      className="relative w-full max-w-sm mx-auto rounded-2xl p-4"
      style={{ background: 'var(--card)', border: '1.5px solid var(--border)', boxShadow: '0 20px 50px rgba(45,27,14,.18)', transform: 'rotate(-2deg)' }}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--red)' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--yellow)' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)' }} />
        <span className="ml-2 text-[10px] font-bold" style={{ color: 'var(--text-soft)' }}>pawhub.app/dashboard</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          ['🐾', '12', 'Pasien Hari Ini', 'var(--orange-lt)', 'var(--orange)'],
          ['💰', '2,4Jt', 'Omzet', 'var(--green-lt)', 'var(--green)'],
          ['⏳', '3', 'Antrian', 'var(--yellow-lt)', '#C98A00'],
        ].map(([icon, val, label, bg, fg]) => (
          <div key={label as string} className="rounded-xl p-2.5" style={{ background: bg as string }}>
            <span className="text-sm">{icon}</span>
            <p className="font-display font-black text-sm mt-1" style={{ color: fg as string }}>{val}</p>
            <p className="text-[8px] font-bold" style={{ color: 'var(--text-soft)' }}>{label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl p-2.5 space-y-2" style={{ background: 'var(--warm-bg)' }}>
        {[
          ['🐕', 'Max — Golden Retriever', 'Vaksin rabies', 'var(--green)'],
          ['🐈', 'Mochi — Persia', 'Kontrol demam', 'var(--yellow)'],
        ].map(([emoji, name, note, dot]) => (
          <div key={name as string} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5">
            <span className="text-base">{emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold truncate" style={{ color: 'var(--text-dark)' }}>{name}</p>
              <p className="text-[9px] font-medium" style={{ color: 'var(--text-soft)' }}>{note}</p>
            </div>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot as string }} />
          </div>
        ))}
      </div>

      {/* Floating sticky note */}
      <div
        className="absolute -right-6 -bottom-5 px-3 py-2 rounded-xl text-[10px] font-bold"
        style={{ background: '#fff', border: '1.5px solid var(--border)', boxShadow: '0 8px 20px rgba(45,27,14,.15)', transform: 'rotate(4deg)', color: 'var(--text-mid)' }}
      >
        ✨ {t('landing.hero.mockupNote', 'ini tampilan asli, bukan mockup doang')}
      </div>
    </div>
  )
}

function MedisMockup() {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1.5px solid var(--border)', boxShadow: '0 12px 30px rgba(45,27,14,.1)' }}>
      <div className="flex items-center gap-2.5 mb-3 pb-3" style={{ borderBottom: '1.5px dashed var(--border)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: 'var(--orange-lt)' }}>🐕</div>
        <div>
          <p className="text-xs font-extrabold" style={{ color: 'var(--text-dark)' }}>Max · Golden Retriever</p>
          <p className="text-[10px] font-medium" style={{ color: 'var(--text-soft)' }}>ID: P-0042 · Jantan · 3 tahun</p>
        </div>
      </div>
      {[
        ['29 Apr 2026', 'Demam ringan, diberi antibiotik 7 hari', 'var(--yellow)'],
        ['26 Feb 2026', 'Vaksin rabies + DHPP booster', 'var(--green)'],
        ['2 Jan 2026', 'Grooming rutin bulanan', 'var(--teal)'],
      ].map(([date, note, dot]) => (
        <div key={date as string} className="flex gap-2.5 pb-2.5 mb-2.5 last:mb-0 last:pb-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: dot as string }} />
          <div>
            <p className="text-[10px] font-bold" style={{ color: 'var(--text-soft)' }}>{date}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-dark)' }}>{note}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function BookingMockup() {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1.5px solid var(--border)', boxShadow: '0 12px 30px rgba(45,27,14,.1)' }}>
      <p className="text-xs font-extrabold mb-3" style={{ color: 'var(--text-dark)' }}>Booking baru masuk 🎉</p>
      <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--teal-lt)' }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold" style={{ color: 'var(--teal)' }}>Rabu, 2 Juli · 10.00</p>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold" style={{ background: '#fff', color: 'var(--teal)' }}>Terkonfirmasi</span>
        </div>
        <p className="text-[11px] font-semibold mt-1.5" style={{ color: 'var(--text-mid)' }}>Cici (Kelinci) — Ny. Dewi · Check-up rutin</p>
      </div>
      <div className="flex items-center gap-2 rounded-xl p-2.5" style={{ background: 'var(--green-lt)' }}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs" style={{ background: '#fff' }}>📲</div>
        <p className="text-[10px] font-bold" style={{ color: 'var(--green)' }}>WA reminder terjadwal otomatis H-1</p>
      </div>
    </div>
  )
}

function LaporanMockup() {
  const bars = [40, 65, 50, 80, 60, 90, 100]
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1.5px solid var(--border)', boxShadow: '0 12px 30px rgba(45,27,14,.1)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-extrabold" style={{ color: 'var(--text-dark)' }}>Kunjungan 7 Hari Terakhir</p>
        <span className="text-[10px] font-bold" style={{ color: 'var(--purple)' }}>+18%</span>
      </div>
      <div className="flex items-end gap-2 h-20 mb-1">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%`, background: i === bars.length - 1 ? 'var(--purple)' : 'var(--purple-lt)' }} />
        ))}
      </div>
      <div className="flex justify-between">
        {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((d, i) => (
          <span key={i} className="text-[9px] font-bold flex-1 text-center" style={{ color: 'var(--text-soft)' }}>{d}</span>
        ))}
      </div>
    </div>
  )
}

const MOCKS: Record<string, () => JSX.Element> = { medis: MedisMockup, booking: BookingMockup, laporan: LaporanMockup }

// ─── Components ─────────────────────────────────────────────────────────────

function Navbar() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const links = [
    { label: t('landing.nav.features'), href: '#fitur' },
    { label: t('landing.nav.story'), href: '#cerita' },
    { label: t('landing.nav.howItWorks'), href: '#cara-kerja' },
    { label: t('landing.nav.faq'), href: '#faq' },
  ]
  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{ background: 'rgba(255,248,240,.85)', borderBottom: '1.5px solid var(--border)' }}
    >
      <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center p-1.5"
            style={{ background: 'var(--orange)', boxShadow: '0 3px 10px rgba(255,122,61,.3)' }}
          >
            <img src="/logo-icon-white.svg" alt="Paw Hub" className="w-full h-full" />
          </div>
          <span className="font-display font-black text-lg" style={{ color: 'var(--text-dark)' }}>
            Paw Hub
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3.5 py-2 rounded-full text-sm font-bold transition-colors hover:bg-white"
              style={{ color: 'var(--text-mid)' }}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2.5">
          <LanguageSwitcher />
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:-translate-y-px"
              style={{ background: 'var(--orange)', boxShadow: '0 4px 14px rgba(255,122,61,.35)' }}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> {t('landing.nav.dashboard')}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 rounded-full text-sm font-bold transition-colors hover:bg-white"
                style={{ color: 'var(--text-mid)' }}
              >
                {t('landing.nav.login')}
              </Link>
              <Link
                to="/daftar"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:-translate-y-px"
                style={{ background: 'var(--orange)', boxShadow: '0 4px 14px rgba(255,122,61,.35)' }}
              >
                {t('landing.nav.tryFree')} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>

        <div className="md:hidden flex items-center gap-2">
          <LanguageSwitcher />
          <button
            onClick={() => setOpen((p) => !p)}
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--text-dark)' }}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden px-4 pb-4 flex flex-col gap-1" style={{ borderTop: '1.5px solid var(--border)' }}>
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-bold" style={{ color: 'var(--text-mid)' }}>
              {l.label}
            </a>
          ))}
          <div className="flex gap-2 mt-2">
            {isAuthenticated ? (
              <Link to="/dashboard" className="flex-1 text-center px-4 py-2.5 rounded-full text-sm font-bold text-white" style={{ background: 'var(--orange)' }}>
                {t('landing.nav.dashboard')}
              </Link>
            ) : (
              <>
                <Link to="/login" className="flex-1 text-center px-4 py-2.5 rounded-full text-sm font-bold border-2" style={{ borderColor: 'var(--border)', color: 'var(--text-mid)' }}>
                  {t('landing.nav.login')}
                </Link>
                <Link to="/daftar" className="flex-1 text-center px-4 py-2.5 rounded-full text-sm font-bold text-white" style={{ background: 'var(--orange)' }}>
                  {t('landing.nav.tryFree')}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function Hero() {
  const { t } = useTranslation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-20" style={{ background: 'var(--orange)' }} />
        <div className="absolute top-56 -left-24 w-72 h-72 rounded-full opacity-10" style={{ background: 'var(--teal)' }} />
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-6 pt-14 pb-20 lg:pt-20 lg:pb-24 relative grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-sm font-extrabold mb-3" style={{ color: 'var(--orange)' }}>
            {t('landing.hero.greeting')}
          </p>
          <h1
            className="font-display font-black leading-[1.1]"
            style={{ color: 'var(--text-dark)', fontSize: 'clamp(2rem, 4.5vw, 3.2rem)' }}
          >
            {t('landing.hero.titlePrefix')}{' '}
            <span className="relative inline-block">
              <span style={{ color: 'var(--orange)' }}>{t('landing.hero.titleHighlight')}</span>
              <span className="absolute left-0 -bottom-1 w-full"><SquiggleUnderline /></span>
            </span>
          </h1>

          <p
            className="mt-5 text-base font-medium max-w-md leading-relaxed"
            style={{ color: 'var(--text-soft)' }}
          >
            {t('landing.hero.desc')}
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link
              to={isAuthenticated ? '/dashboard' : '/daftar'}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-sm font-bold text-white transition-all hover:-translate-y-0.5"
              style={{ background: 'var(--orange)', boxShadow: '0 6px 20px rgba(255,122,61,.4)' }}
            >
              {isAuthenticated ? t('landing.hero.ctaAuthenticated') : t('landing.hero.ctaGuest')} <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#fitur"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-sm font-bold border-2 transition-all hover:bg-white"
              style={{ borderColor: 'var(--border)', color: 'var(--text-mid)' }}
            >
              {t('landing.hero.secondaryCta')}
            </a>
          </div>

          {!isAuthenticated && (
            <p className="mt-4 text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
              {t('landing.hero.noCreditCard')}
            </p>
          )}
        </div>

        <div className="relative">
          <DashboardMockup />
        </div>
      </div>
    </section>
  )
}

function SectionHeader({ title, desc, align = 'center' }: { title: string; desc?: string; align?: 'center' | 'left' }) {
  return (
    <div className={align === 'center' ? 'text-center max-w-xl mx-auto mb-12' : 'max-w-xl mb-12'}>
      <h2 className="font-display font-black text-2xl lg:text-3xl" style={{ color: 'var(--text-dark)' }}>
        {title}
      </h2>
      {desc && (
        <p className="mt-3 text-sm font-medium leading-relaxed" style={{ color: 'var(--text-soft)' }}>
          {desc}
        </p>
      )}
    </div>
  )
}

function PainPoints() {
  const { t } = useTranslation()
  const items = t('landing.painPoints.items', { returnObjects: true }) as { before: string; after: string }[]
  return (
    <section className="max-w-4xl mx-auto px-4 lg:px-6 py-16">
      <SectionHeader title={t('landing.painPoints.title')} desc={t('landing.painPoints.desc')} />
      <div className="space-y-3">
        {items.map((p) => (
          <div key={p.before} className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl" style={{ background: 'var(--red-lt)' }}>
              <XIcon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--red)' }} />
              <p className="text-xs font-semibold leading-relaxed" style={{ color: 'var(--text-mid)' }}>{p.before}</p>
            </div>
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl" style={{ background: 'var(--green-lt)' }}>
              <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--green)' }} />
              <p className="text-xs font-semibold leading-relaxed" style={{ color: 'var(--text-mid)' }}>{p.after}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Flagship() {
  const { t } = useTranslation()
  const items = t('landing.flagship.items', { returnObjects: true }) as { tag: string; title: string; desc: string }[]
  const moreFeatures = t('landing.flagship.moreFeatures', { returnObjects: true }) as string[]
  return (
    <section id="fitur" className="max-w-6xl mx-auto px-4 lg:px-6 py-16">
      <SectionHeader title={t('landing.flagship.title')} desc={t('landing.flagship.desc')} />
      <div className="space-y-16">
        {items.map((f, i) => {
          const meta = FLAGSHIP_META[i]
          const c = ACCENT[meta.accent]
          const Mock = MOCKS[meta.mock]
          const reverse = i % 2 === 1
          return (
            <div key={f.title} className={`grid md:grid-cols-2 gap-10 items-center ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
              <div>
                <span
                  className="inline-block px-3 py-1 rounded-full text-[11px] font-extrabold mb-4"
                  style={{ background: c.bg, color: c.fg }}
                >
                  {f.tag}
                </span>
                <h3 className="font-display font-extrabold text-xl leading-snug" style={{ color: 'var(--text-dark)' }}>
                  {f.title}
                </h3>
                <p className="mt-3 text-sm font-medium leading-relaxed max-w-md" style={{ color: 'var(--text-soft)' }}>
                  {f.desc}
                </p>
              </div>
              <div className="max-w-sm w-full mx-auto">
                <Mock />
              </div>
            </div>
          )
        })}
      </div>

      {/* Compact list of remaining features */}
      <div className="mt-16 pt-10" style={{ borderTop: '1.5px dashed var(--border)' }}>
        <p className="text-center text-sm font-bold mb-5" style={{ color: 'var(--text-mid)' }}>
          {t('landing.flagship.moreLabel')}
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          {moreFeatures.map((label, i) => {
            const Icon = MORE_FEATURES_ICON_LIST[i] ?? Star
            return (
              <span
                key={label}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold"
                style={{ background: 'var(--card)', border: '1.5px solid var(--border)', color: 'var(--text-mid)' }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: 'var(--orange)' }} />
                {label}
              </span>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Story() {
  const { t } = useTranslation()
  return (
    <section id="cerita" className="py-16" style={{ background: 'var(--card)' }}>
      <div className="max-w-2xl mx-auto px-4 lg:px-6">
        <div
          className="rounded-3xl p-7 lg:p-9 relative"
          style={{ background: 'var(--warm-bg)', border: '1.5px solid var(--border)' }}
        >
          <span className="text-5xl leading-none" style={{ color: 'var(--orange-lt)' }}>&ldquo;</span>
          <p className="text-base font-semibold leading-relaxed -mt-3" style={{ color: 'var(--text-dark)' }}>
            {t('landing.story.quote')}
          </p>
          <div className="flex items-center gap-3 mt-6">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ background: 'var(--orange)' }}
            >
              🐾
            </div>
            <div>
              <p className="text-sm font-extrabold" style={{ color: 'var(--text-dark)' }}>{t('landing.story.author')}</p>
              <p className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>{t('landing.story.authorNote')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  const { t } = useTranslation()
  const items = t('landing.testimonials.items', { returnObjects: true }) as { quote: string; name: string; role: string }[]
  return (
    <section className="max-w-6xl mx-auto px-4 lg:px-6 py-16">
      <SectionHeader title={t('landing.testimonials.title')} desc={t('landing.testimonials.desc')} />
      <div className="grid md:grid-cols-3 gap-5">
        {items.map((t_, i) => {
          const meta = TESTIMONIAL_META[i]
          const c = ACCENT[meta.bg]
          return (
            <div
              key={t_.name}
              className="card p-5"
              style={{ transform: i === 1 ? 'translateY(-8px)' : 'none' }}
            >
              <p className="text-sm font-semibold leading-relaxed" style={{ color: 'var(--text-dark)' }}>
                &ldquo;{t_.quote}&rdquo;
              </p>
              <div className="flex items-center gap-2.5 mt-5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-base" style={{ background: c.bg }}>
                  {meta.emoji}
                </div>
                <div>
                  <p className="text-xs font-extrabold" style={{ color: 'var(--text-dark)' }}>{t_.name}</p>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--text-soft)' }}>{t_.role}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function HowItWorks() {
  const { t } = useTranslation()
  const steps = t('landing.howItWorks.steps', { returnObjects: true }) as { title: string; desc: string }[]
  return (
    <section id="cara-kerja" className="py-16" style={{ background: 'var(--card)' }}>
      <div className="max-w-3xl mx-auto px-4 lg:px-6">
        <SectionHeader title={t('landing.howItWorks.title')} desc={t('landing.howItWorks.desc')} />
        <div className="space-y-5">
          {steps.map((s, i) => (
            <div key={s.title} className="flex gap-4 items-start">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-display font-black text-sm flex-shrink-0"
                style={{ background: 'var(--orange)', color: '#fff' }}
              >
                {i + 1}
              </div>
              <div className="flex-1 pb-5" style={{ borderBottom: i < steps.length - 1 ? '1.5px dashed var(--border)' : 'none' }}>
                <h3 className="font-display font-extrabold text-base" style={{ color: 'var(--text-dark)' }}>{s.title}</h3>
                <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-soft)' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQ() {
  const { t } = useTranslation()
  const items = t('landing.faq.items', { returnObjects: true }) as { q: string; a: string }[]
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  return (
    <section id="faq" className="py-16">
      <div className="max-w-2xl mx-auto px-4 lg:px-6">
        <SectionHeader title={t('landing.faq.title')} />
        <div className="space-y-2.5">
          {items.map((f, i) => {
            const open = openIdx === i
            return (
              <div key={f.q} className="card-sm overflow-hidden">
                <button
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
                >
                  <span className="font-bold text-sm" style={{ color: 'var(--text-dark)' }}>{f.q}</span>
                  <ChevronDown
                    className="w-4 h-4 flex-shrink-0 transition-transform"
                    style={{ color: 'var(--text-soft)', transform: open ? 'rotate(180deg)' : 'none' }}
                  />
                </button>
                {open && (
                  <p className="px-4 pb-4 text-xs font-medium leading-relaxed" style={{ color: 'var(--text-soft)' }}>
                    {f.a}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  const { t } = useTranslation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return (
    <section className="max-w-4xl mx-auto px-4 lg:px-6 py-16">
      <div
        className="rounded-4xl px-6 py-12 lg:py-14 text-center relative overflow-hidden"
        style={{ background: 'var(--text-dark)' }}
      >
        <div className="absolute -right-4 -top-4 text-7xl opacity-10 pointer-events-none select-none">🐾</div>
        <div className="absolute -left-6 -bottom-6 text-7xl opacity-10 pointer-events-none select-none">🐾</div>
        <h2 className="font-display font-black text-2xl lg:text-3xl text-white relative">
          {isAuthenticated ? t('landing.finalCta.titleAuthenticated') : t('landing.finalCta.titleGuest')}
        </h2>
        <p className="mt-3 text-sm font-medium max-w-sm mx-auto relative" style={{ color: 'rgba(255,255,255,.7)' }}>
          {isAuthenticated ? t('landing.finalCta.descAuthenticated') : t('landing.finalCta.descGuest')}
        </p>
        <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center relative">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold transition-all hover:-translate-y-0.5"
              style={{ background: 'var(--orange)', color: '#fff' }}
            >
              {t('landing.finalCta.ctaAuthenticated')} <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/daftar"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--orange)', color: '#fff' }}
              >
                {t('landing.finalCta.ctaGuest')} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold text-white border-2"
                style={{ borderColor: 'rgba(255,255,255,.25)' }}
              >
                {t('landing.finalCta.loginLink')}
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const { t } = useTranslation()
  return (
    <footer style={{ borderTop: '1.5px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center p-1.5"
            style={{ background: 'var(--orange)' }}
          >
            <img src="/logo-icon-white.svg" alt="Paw Hub" className="w-full h-full" />
          </div>
          <span className="font-display font-black text-sm" style={{ color: 'var(--text-dark)' }}>
            {t('landing.footer.brand')}
          </span>
        </div>
        <p className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
          {t('landing.footer.copyright')}
        </p>
        <div className="flex items-center gap-3">
          <Link to="/booking" className="text-xs font-bold" style={{ color: 'var(--text-mid)' }}>{t('landing.footer.booking')}</Link>
          <Link to="/daftar" className="text-xs font-bold" style={{ color: 'var(--text-mid)' }}>{t('landing.footer.register')}</Link>
          <Link to="/login" className="text-xs font-bold" style={{ color: 'var(--text-mid)' }}>{t('landing.footer.login')}</Link>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ background: 'var(--warm-bg)', minHeight: '100vh' }}>
      <Navbar />
      <Hero />
      <PainPoints />
      <Flagship />
      <Story />
      <Testimonials />
      <HowItWorks />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
