import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation, Trans } from 'react-i18next'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { PawPrint, Check, ChevronRight, ChevronLeft, Eye, EyeOff, Loader2, Building2, User, Package, Sparkles } from 'lucide-react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Plan {
  id: string; code: string; name: string
  priceMonthly: number; priceYearly: number
  maxBranches: number; maxUsers: number; maxPatients: number
  features: Record<string, boolean>
}

interface FormState {
  clinicName: string; clinicSlug: string; clinicEmail: string
  clinicPhone: string; address: string
  adminName: string; adminUsername: string; adminPassword: string
  adminEmail: string; adminPhone: string
  planCode: string; cycle: 'monthly' | 'yearly'
}

const STEP_ICONS = [Building2, User, Package, Sparkles]

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

// ── Step components ───────────────────────────────────────────────────────────
function StepClinic({ form, setForm, errors }: any) {
  const { t } = useTranslation()
  const [checking, setChecking] = useState(false)
  const [slugAvail, setSlugAvail] = useState<boolean | null>(null)

  const checkSlug = async (slug: string) => {
    if (!slug) return
    setChecking(true)
    try {
      const r: any = await api.get(`/onboarding/check-slug/${slug}`)
      setSlugAvail(r.data.available)
    } finally { setChecking(false) }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">{t('onboarding.clinic.name')} <span className="text-red-500">*</span></label>
        <input value={form.clinicName} onChange={e => {
          const v = e.target.value
          setForm((f: any) => ({ ...f, clinicName: v, clinicSlug: slugify(v) }))
          setSlugAvail(null)
        }} placeholder={t('onboarding.clinic.namePlaceholder')} className="input" />
        {errors?.clinicName && <p className="err">{errors.clinicName}</p>}
      </div>

      <div>
        <label className="label">{t('onboarding.clinic.slug')} <span className="text-red-500">*</span></label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400 bg-gray-50 border rounded-l-lg px-3 py-2 border-r-0">pawcare.app/</span>
          <input value={form.clinicSlug} onChange={e => {
            const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
            setForm((f: any) => ({ ...f, clinicSlug: v }))
            setSlugAvail(null)
          }} onBlur={() => checkSlug(form.clinicSlug)}
            placeholder={t('onboarding.clinic.slugPlaceholder')} className="input rounded-l-none flex-1" />
        </div>
        {checking && <p className="text-xs text-gray-400 mt-1">{t('onboarding.clinic.slugChecking')}</p>}
        {slugAvail === true  && <p className="text-xs text-green-600 mt-1">{t('onboarding.clinic.slugAvailable')}</p>}
        {slugAvail === false && <p className="text-xs text-red-500 mt-1">{t('onboarding.clinic.slugTaken')}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">{t('onboarding.clinic.email')} <span className="text-red-500">*</span></label>
          <input type="email" value={form.clinicEmail} onChange={e => setForm((f: any) => ({ ...f, clinicEmail: e.target.value }))}
            placeholder={t('onboarding.clinic.emailPlaceholder')} className="input" />
          {errors?.clinicEmail && <p className="err">{errors.clinicEmail}</p>}
        </div>
        <div>
          <label className="label">{t('onboarding.clinic.phone')}</label>
          <input value={form.clinicPhone} onChange={e => setForm((f: any) => ({ ...f, clinicPhone: e.target.value }))}
            placeholder={t('onboarding.clinic.phonePlaceholder')} className="input" />
        </div>
      </div>

      <div>
        <label className="label">{t('onboarding.clinic.address')}</label>
        <textarea value={form.address} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))}
          rows={2} placeholder={t('onboarding.clinic.addressPlaceholder')} className="input resize-none" />
      </div>
    </div>
  )
}

function StepAdmin({ form, setForm, errors }: any) {
  const { t } = useTranslation()
  const [showPass, setShowPass] = useState(false)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">{t('onboarding.admin.name')} <span className="text-red-500">*</span></label>
          <input value={form.adminName} onChange={e => setForm((f: any) => ({ ...f, adminName: e.target.value }))}
            placeholder={t('onboarding.admin.namePlaceholder')} className="input" />
          {errors?.adminName && <p className="err">{errors.adminName}</p>}
        </div>
        <div>
          <label className="label">{t('onboarding.admin.username')} <span className="text-red-500">*</span></label>
          <input value={form.adminUsername} onChange={e => setForm((f: any) => ({ ...f, adminUsername: e.target.value.toLowerCase() }))}
            placeholder={t('onboarding.admin.usernamePlaceholder')} className="input" />
          {errors?.adminUsername && <p className="err">{errors.adminUsername}</p>}
        </div>
      </div>

      <div>
        <label className="label">{t('onboarding.admin.password')} <span className="text-red-500">*</span></label>
        <div className="relative">
          <input type={showPass ? 'text' : 'password'} value={form.adminPassword}
            onChange={e => setForm((f: any) => ({ ...f, adminPassword: e.target.value }))}
            placeholder={t('onboarding.admin.passwordPlaceholder')} className="input pr-10" />
          <button type="button" onClick={() => setShowPass(p => !p)}
            className="absolute right-3 top-2.5 text-gray-400">
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {form.adminPassword && (
          <div className="mt-1 flex gap-1">
            {[1,2,3,4].map(i => (
              <div key={i} className={`h-1 flex-1 rounded ${form.adminPassword.length >= i*2 ? i<=1?'bg-red-400':i<=2?'bg-yellow-400':i<=3?'bg-blue-400':'bg-green-500' : 'bg-gray-200'}`} />
            ))}
          </div>
        )}
        {errors?.adminPassword && <p className="err">{errors.adminPassword}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">{t('onboarding.admin.email')}</label>
          <input type="email" value={form.adminEmail} onChange={e => setForm((f: any) => ({ ...f, adminEmail: e.target.value }))}
            placeholder={t('onboarding.admin.emailPlaceholder')} className="input" />
        </div>
        <div>
          <label className="label">{t('onboarding.admin.phone')}</label>
          <input value={form.adminPhone} onChange={e => setForm((f: any) => ({ ...f, adminPhone: e.target.value }))}
            placeholder={t('onboarding.admin.phonePlaceholder')} className="input" />
        </div>
      </div>
    </div>
  )
}

function StepPlan({ form, setForm, plans }: any) {
  const { t } = useTranslation()
  const planColors: Record<string, string> = {
    free: 'border-gray-300', starter: 'border-primary-400', pro: 'border-violet-400', enterprise: 'border-amber-400',
  }
  const planBadge: Record<string, string> = {
    free: 'bg-gray-100 text-gray-600', starter: 'bg-primary-100 text-primary-700',
    pro: 'bg-violet-100 text-violet-700', enterprise: 'bg-amber-100 text-amber-700',
  }

  return (
    <div className="space-y-4">
      {/* Cycle toggle */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className={`text-sm ${form.cycle === 'monthly' ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>{t('onboarding.plan.monthly')}</span>
        <button type="button" onClick={() => setForm((f: any) => ({ ...f, cycle: f.cycle === 'monthly' ? 'yearly' : 'monthly' }))}
          className={`relative shrink-0 w-12 h-6 rounded-full transition-colors ${form.cycle === 'yearly' ? 'bg-primary-500' : 'bg-gray-300'}`}>
          <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.cycle === 'yearly' ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
        <span className={`text-sm ${form.cycle === 'yearly' ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>
          {t('onboarding.plan.yearly')} <span className="text-green-600 font-medium">{t('onboarding.plan.yearlySave')}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((plan: Plan) => {
          const selected = form.planCode === plan.code
          const price = form.cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly
          const activeFeatures = Object.entries(plan.features).filter(([, v]) => v).map(([k]) => k)
          return (
            <button key={plan.id} onClick={() => setForm((f: any) => ({ ...f, planCode: plan.code }))}
              className={`text-left p-4 rounded-xl border-2 transition-all ${selected ? `${planColors[plan.code]} ring-2 ring-offset-1 ${planColors[plan.code].replace('border-','ring-')} bg-white shadow-md` : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${planBadge[plan.code]}`}>{plan.name}</span>
                {selected && <Check className="w-5 h-5 text-primary-600" />}
              </div>
              <div className="mb-3">
                {price === 0 ? (
                  <p className="text-2xl font-bold text-gray-800">{t('onboarding.plan.free')}</p>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-800">Rp {price.toLocaleString('id-ID')}</p>
                    <p className="text-xs text-gray-400">{form.cycle === 'yearly' ? t('onboarding.plan.perYear') : t('onboarding.plan.perMonth')}</p>
                  </>
                )}
              </div>
              <ul className="space-y-1 mb-3">
                <li className="text-xs text-gray-600">✓ {plan.maxBranches === 999 ? t('onboarding.plan.branchesUnlimited') : t('onboarding.plan.branches', { count: plan.maxBranches })}</li>
                <li className="text-xs text-gray-600">✓ {plan.maxUsers === 999 ? t('onboarding.plan.usersUnlimited') : t('onboarding.plan.users', { count: plan.maxUsers })}</li>
                <li className="text-xs text-gray-600">✓ {plan.maxPatients === 999999 ? t('onboarding.plan.patientsUnlimited') : t('onboarding.plan.patients', { count: plan.maxPatients })}</li>
              </ul>
              <div className="border-t pt-2 space-y-1">
                {activeFeatures.map(f => (
                  <p key={f} className="text-xs text-primary-600">✓ {t(`onboarding.featureLabels.${f}`, f)}</p>
                ))}
              </div>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-center text-gray-400">
        <Trans i18nKey="onboarding.plan.trialNote" components={{ bold: <span className="font-medium text-gray-600" /> }} />
      </p>
    </div>
  )
}

function StepConfirm({ form, plans }: any) {
  const { t } = useTranslation()
  const plan = plans.find((p: Plan) => p.code === form.planCode)
  const price = form.cycle === 'yearly' ? plan?.priceYearly : plan?.priceMonthly
  return (
    <div className="space-y-4">
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-primary-800">{t('onboarding.confirm.clinicInfo')}</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-gray-500">{t('onboarding.confirm.name')}</span><span className="font-medium">{form.clinicName}</span>
          <span className="text-gray-500">{t('onboarding.confirm.slug')}</span><span className="font-medium">vetcore.app/{form.clinicSlug}</span>
          <span className="text-gray-500">{t('onboarding.confirm.email')}</span><span className="font-medium">{form.clinicEmail}</span>
          {form.clinicPhone && <><span className="text-gray-500">{t('onboarding.confirm.phone')}</span><span className="font-medium">{form.clinicPhone}</span></>}
        </div>
      </div>
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-violet-800">{t('onboarding.confirm.adminAccount')}</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-gray-500">{t('onboarding.confirm.name')}</span><span className="font-medium">{form.adminName}</span>
          <span className="text-gray-500">{t('onboarding.confirm.username')}</span><span className="font-medium">{form.adminUsername}</span>
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-amber-800">{t('onboarding.confirm.planChosen')}</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-gray-500">{t('onboarding.confirm.plan')}</span><span className="font-medium">{plan?.name}</span>
          <span className="text-gray-500">{t('onboarding.confirm.cycle')}</span><span className="font-medium">{form.cycle === 'monthly' ? t('onboarding.confirm.cycleMonthly') : t('onboarding.confirm.cycleYearly')}</span>
          <span className="text-gray-500">{t('onboarding.confirm.price')}</span><span className="font-medium">{price === 0 ? t('onboarding.plan.free') : `Rp ${price?.toLocaleString('id-ID')}`}</span>
          <span className="text-gray-500">{t('onboarding.confirm.trial')}</span><span className="font-medium text-green-600">{t('onboarding.confirm.trialValue')}</span>
        </div>
      </div>
      <p className="text-xs text-center text-gray-400">{t('onboarding.confirm.terms')}</p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.login)

  const STEPS = [
    { label: t('onboarding.steps.clinic'), icon: STEP_ICONS[0] },
    { label: t('onboarding.steps.admin'), icon: STEP_ICONS[1] },
    { label: t('onboarding.steps.plan'), icon: STEP_ICONS[2] },
    { label: t('onboarding.steps.confirm'), icon: STEP_ICONS[3] },
  ]

  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState<FormState>({
    clinicName: '', clinicSlug: '', clinicEmail: '', clinicPhone: '', address: '',
    adminName: '', adminUsername: '', adminPassword: '', adminEmail: '', adminPhone: '',
    planCode: 'free', cycle: 'monthly',
  })

  const { data: plans = [] } = useQuery({
    queryKey: ['onboarding-plans'],
    queryFn: () => api.get('/onboarding/plans').then((r: any) => r.data.data),
  })

  const registerMut = useMutation({
    mutationFn: (data: any) => api.post('/onboarding/register', data).then((r: any) => r.data),
    onSuccess: (res) => {
      const { user, accessToken, refreshToken, tenant } = res.data
      setAuth({ ...user, accessToken, refreshToken, tenant })
      navigate('/dashboard')
    },
  })

  const validate = (currentStep: number): boolean => {
    const e: Record<string, string> = {}
    if (currentStep === 0) {
      if (!form.clinicName.trim())  e.clinicName  = t('onboarding.errors.clinicName')
      if (!form.clinicSlug.trim())  e.clinicSlug  = t('onboarding.errors.clinicSlug')
      if (!form.clinicEmail.trim()) e.clinicEmail = t('onboarding.errors.clinicEmail')
    }
    if (currentStep === 1) {
      if (!form.adminName.trim())     e.adminName     = t('onboarding.errors.adminName')
      if (!form.adminUsername.trim()) e.adminUsername = t('onboarding.errors.adminUsername')
      if (form.adminPassword.length < 8) e.adminPassword = t('onboarding.errors.adminPassword')
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => { if (validate(step)) setStep(s => Math.min(s + 1, 3)) }
  const prev = () => setStep(s => Math.max(s - 1, 0))

  const submit = () => {
    registerMut.mutate({
      clinicName:    form.clinicName,
      clinicSlug:    form.clinicSlug,
      clinicEmail:   form.clinicEmail,
      clinicPhone:   form.clinicPhone || undefined,
      address:       form.address || undefined,
      adminName:     form.adminName,
      adminUsername: form.adminUsername,
      adminPassword: form.adminPassword,
      adminEmail:    form.adminEmail || undefined,
      adminPhone:    form.adminPhone || undefined,
      planCode:      form.planCode,
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="p-2 bg-primary-500 rounded-xl"><PawPrint className="w-6 h-6 text-white" /></div>
            <span className="text-2xl font-bold text-gray-800">{t('onboarding.brand')}</span>
          </div>
          <p className="text-gray-500 text-sm">{t('onboarding.tagline')}</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center mb-8 gap-0">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = i === step
            const done   = i < step
            return (
              <div key={i} className="flex items-center">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${active ? 'bg-primary-500 text-white shadow-md' : done ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-primary-300' : 'bg-gray-200'}`} />}
              </div>
            )
          })}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border p-6 md:p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">{STEPS[step].label}</h2>

          {step === 0 && <StepClinic form={form} setForm={setForm} errors={errors} />}
          {step === 1 && <StepAdmin  form={form} setForm={setForm} errors={errors} />}
          {step === 2 && <StepPlan   form={form} setForm={setForm} plans={plans} />}
          {step === 3 && <StepConfirm form={form} plans={plans} />}

          {registerMut.isError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {(registerMut.error as any)?.response?.data?.message ?? t('onboarding.errors.generic')}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            {step > 0 ? (
              <button onClick={prev} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
                <ChevronLeft className="w-4 h-4" /> {t('onboarding.nav.back')}
              </button>
            ) : (
              <a href="/login" className="text-sm text-gray-400 hover:text-gray-600">{t('onboarding.nav.haveAccount')}</a>
            )}

            {step < 3 ? (
              <button onClick={next} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-xl font-medium text-sm">
                {t('onboarding.nav.next')} <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={submit} disabled={registerMut.isPending}
                className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-medium text-sm">
                {registerMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('onboarding.nav.submitting')}</> : <><Sparkles className="w-4 h-4" /> {t('onboarding.nav.submit')}</>}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">{t('onboarding.footer', { year: new Date().getFullYear() })}</p>
      </div>
    </div>
  )
}
