import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/lib/api'
import { Button, Input } from '@/components/ui'

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/masuk', form)
      const { user, accessToken, refreshToken } = res.data.data
      login({ ...user, accessToken, refreshToken })
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Terjadi kesalahan. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, var(--warm-bg) 0%, var(--cream) 50%, var(--orange-lt) 100%)' }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-20"
          style={{ background: 'var(--orange)' }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'var(--teal)' }}
        />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center p-3 mb-4"
            style={{ background: 'var(--orange)', boxShadow: '0 6px 20px rgba(255,122,61,.4)' }}
          >
            <img src="/logo-icon-white.svg" alt="PawCare" className="w-full h-full" />
          </div>
          <h1 className="font-display font-black text-2xl" style={{ color: 'var(--text-dark)' }}>
            PawCare
          </h1>
          <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-soft)' }}>
            Sistem Manajemen Klinik Hewan
          </p>
        </div>

        {/* Card */}
        <div className="card p-6 shadow-card-md">
          <h2 className="font-display font-extrabold text-base mb-5" style={{ color: 'var(--text-dark)' }}>
            Masuk ke akun Anda
          </h2>

          {error && (
            <div
              className="mb-4 px-3.5 py-3 rounded-xl text-sm font-semibold flex items-center gap-2"
              style={{ background: 'var(--red-lt)', color: 'var(--red)', border: '1.5px solid var(--red)' }}
            >
              <span>⚠️</span>
              <span className="text-red-600">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              placeholder="Masukkan username"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              required
              autoComplete="username"
              autoFocus
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold" style={{ color: 'var(--text-mid)' }}>
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Masukkan password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-xl border-[1.5px] border-warm-200 bg-warm-100 font-semibold text-[--text-dark] placeholder:text-[--text-soft] placeholder:font-medium focus:outline-none focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(255,122,61,.12)] transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-soft)' }}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
              Masuk
            </Button>
          </form>
        </div>

        <p className="text-center text-xs font-medium mt-5" style={{ color: 'var(--text-soft)' }}>
          © 2025 PawCare Clinic System
        </p>
      </div>
    </div>
  )
}
