import { useTranslation } from 'react-i18next'

const LANGS = [
  { code: 'id', label: 'ID' },
  { code: 'en', label: 'EN' },
] as const

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation()
  const current = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'id'

  return (
    <div
      className={`inline-flex items-center rounded-full p-0.5 ${className}`}
      style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
      role="group"
      aria-label="Language switcher"
    >
      {LANGS.map((l) => {
        const active = current === l.code
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => i18n.changeLanguage(l.code)}
            className="px-2.5 py-1 rounded-full text-xs font-bold transition-colors"
            style={
              active
                ? { background: 'var(--orange)', color: '#fff' }
                : { color: 'var(--text-soft)' }
            }
            aria-pressed={active}
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}
