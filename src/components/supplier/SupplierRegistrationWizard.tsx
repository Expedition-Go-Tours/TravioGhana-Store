/**
 * Supplier registration wizard — React port of
 * ~/Downloads/travio_supplier_registration.html (7 form steps + success).
 *
 * Visuals come from the scoped port in styles/SupplierRegistration.css. The
 * submit path reuses the existing POST /suppliers/apply pipeline
 * (lib/supplier.ts + lib/supplierRegistration.ts) and the repo's
 * canvas-confetti celebration on success.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { Eye, EyeOff } from 'lucide-react'
import logoSrc from '@/assets/TravioGhana_Supplier_Logo.png'
import { useAuthUser } from '@/hooks/useAuthUser'
import { getAuthUserId, registerWithEmail } from '@/lib/auth'
import { applyAsSupplier, getSupplierApplicationStatus, getSupplierPortalUrl } from '@/lib/supplier'
import {
  buildSupplierApplicationFormData,
  firstInvalidStep,
  selectedServiceGroups,
  validateRegistrationStep,
} from '@/lib/supplierRegistration'
import {
  clearSupplierRegistrationDraft,
  createEmptySupplierRegistrationForm,
  loadSupplierRegistrationDraft,
  mergeSupplierRegistrationDraft,
  migrateAnonymousDraftToUser,
  rememberDraftUserId,
  resolveDraftUserId,
  saveSupplierRegistrationDraft,
  type SupplierRegistrationForm,
} from '@/lib/supplierApplicationDraft'
import {
  BANK_CURRENCIES,
  GHANA_REGIONS,
  ID_TYPE_OPTIONS,
  MOMO_NETWORKS,
  PAYOUT_METHODS,
  PAYOUT_SCHEDULES,
  SERVICE_CARDS,
  SUPPLIER_CARDS,
  SUPPLIER_STANDARDS,
  WIZARD_STEPS,
  laterDocumentsFor,
  primaryDocumentFor,
  supplierCard,
} from '@/components/supplier/registrationConfig'
import '@/styles/SupplierRegistration.css'

interface SupplierRegistrationWizardProps {
  /** Opens the app's auth modal (used when the account step finds an existing email). */
  onOpenAuth?: (mode: 'signin' | 'signup') => void
  /** Called after a verified successful submission so the parent can refresh status. */
  onSubmitted?: () => void
}

const TOTAL_STEPS = 7

export default function SupplierRegistrationWizard({
  onOpenAuth,
  onSubmitted,
}: SupplierRegistrationWizardProps) {
  const navigate = useNavigate()
  const user = useAuthUser()
  const draftUserId = resolveDraftUserId(user)

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<SupplierRegistrationForm>(createEmptySupplierRegistrationForm)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [toast, setToast] = useState('')
  const [taxNudge, setTaxNudge] = useState(false)
  const [standardsNudge, setStandardsNudge] = useState(false)
  const [laterDocsOpen, setLaterDocsOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const restoredForIdRef = useRef<string | null>(null)
  const toastTimerRef = useRef<number | undefined>(undefined)
  const confettiFiredRef = useRef(false)
  const activeStepRef = useRef<HTMLLIElement | null>(null)

  const signedIn = Boolean(user && (user.id || user._id || user.uid || user.firebaseUid || user.email))

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2200)
  }, [])

  // ── Draft persistence ────────────────────────────────────────────────
  useEffect(() => {
    if (!signedIn) return
    const signedInId = getAuthUserId(user) ?? user?.email
    if (!signedInId) return
    rememberDraftUserId(signedInId)
    migrateAnonymousDraftToUser(signedInId)
  }, [signedIn, user])

  useEffect(() => {
    // Restore once per mount. The anonymous -> signed-in transition changes the
    // draft key mid-flow (step 1 creates the account); the migration already
    // carried the draft over, and the in-memory form is newer than anything
    // saved, so re-hydrating here would clobber it and reset the step.
    if (restoredForIdRef.current !== null) return
    const id = draftUserId || 'anonymous'
    restoredForIdRef.current = id

    const draft = loadSupplierRegistrationDraft(draftUserId)
    if (!draft) return

    window.setTimeout(() => {
      setStep(draft.step === 7 ? 6 : draft.step)
      setForm(mergeSupplierRegistrationDraft(draft.form))
    }, 0)
  }, [draftUserId])

  useEffect(() => {
    if (submitted) return
    const timeoutId = window.setTimeout(() => {
      saveSupplierRegistrationDraft(draftUserId, { step: Math.min(step, 7), form })
    }, 350)
    return () => window.clearTimeout(timeoutId)
  }, [step, form, draftUserId, submitted])

  // ── Prefill the account step from the session ─────────────────────────
  useEffect(() => {
    if (!signedIn) return
    const nameParts = (user?.name ?? '').trim().split(/\s+/).filter(Boolean)
    window.setTimeout(() => {
      setForm((prev) => {
        const nextFirstName = prev.account.firstName || nameParts[0] || ''
        const nextLastName = prev.account.lastName || nameParts.slice(1).join(' ') || ''
        const nextEmail = prev.account.email || user?.email || ''
        if (
          nextFirstName === prev.account.firstName &&
          nextLastName === prev.account.lastName &&
          nextEmail === prev.account.email
        ) {
          return prev
        }
        return {
          ...prev,
          account: { ...prev.account, firstName: nextFirstName, lastName: nextLastName, email: nextEmail },
        }
      })
    }, 0)
  }, [signedIn, user])

  // ── Confetti on verified success ──────────────────────────────────────
  useEffect(() => {
    if (!submitted || confettiFiredRef.current) return
    confettiFiredRef.current = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const defaults = { startVelocity: 30, spread: 360, ticks: 80, zIndex: 99999 }
    const end = Date.now() + 3000
    const frame = () => {
      confetti({
        ...defaults,
        particleCount: 3,
        origin: { x: Math.random(), y: 0 },
        colors: ['#087747', '#f2c94c', '#ff7f50', '#3aa1ff', '#ef476f'],
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [submitted])

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), [])

  // ── Derived state ─────────────────────────────────────────────────────
  const card = supplierCard(form.supplierCardId)
  const kind = form.supplierKind || card?.kind || ''
  const isIndividual = kind === 'individual'
  const isBusiness = kind === 'business'
  const primaryDoc = primaryDocumentFor(kind === 'individual' ? 'individual' : 'business')
  const serviceGroups = useMemo(() => selectedServiceGroups(form.services), [form.services])
  const laterDocs = useMemo(
    () => laterDocumentsFor(form.supplierCardId, kind, serviceGroups),
    [form.supplierCardId, kind, serviceGroups],
  )

  const visibleStep = Math.min(step + 1, TOTAL_STEPS)
  const progressPct = Math.min(100, Math.round((visibleStep / TOTAL_STEPS) * 100))
  const progressText = step < TOTAL_STEPS ? `Step ${visibleStep} of ${TOTAL_STEPS}` : 'Complete'

  const currentValidationContext = useMemo(
    () => ({ signedIn, password, confirmPassword }),
    [signedIn, password, confirmPassword],
  )

  // Scroll the horizontal step rail to the active step on tablet/mobile.
  useEffect(() => {
    const el = activeStepRef.current
    if (!el) return
    if (window.innerWidth > 1180 || window.innerWidth <= 620) return
    el.scrollIntoView?.({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [step])

  const goToStep = useCallback((next: number) => {
    setStep(next)
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [])

  const nudge = useCallback((setter: (v: boolean) => void) => {
    setter(true)
    window.setTimeout(() => setter(false), 1400)
  }, [])

  const handleBack = useCallback(() => {
    if (step > 0) goToStep(step - 1)
  }, [step, goToStep])

  const handleCreateProfile = useCallback(async () => {
    const invalid = firstInvalidStep(form, currentValidationContext)
    if (invalid != null) {
      goToStep(invalid)
      const message = validateRegistrationStep(invalid, form, currentValidationContext)
      showToast(message || 'Please complete the required information.')
      if (invalid === 2 && isBusiness && !form.business.taxAck) nudge(setTaxNudge)
      if (invalid === 6) nudge(setStandardsNudge)
      return
    }

    setSubmitting(true)
    try {
      await applyAsSupplier(buildSupplierApplicationFormData(form))

      // Verify the application actually persisted before telling the user it
      // worked — mirrors SupplierApplicationForm's post-submit check.
      const confirmation = await getSupplierApplicationStatus()
      if (!confirmation) {
        throw new Error(
          'Your application was received but could not be verified. Please try again or contact support — your draft was not lost.'
        )
      }

      clearSupplierRegistrationDraft(draftUserId)
      setSubmitted(true)
      goToStep(TOTAL_STEPS)
      onSubmitted?.()
    } catch (err) {
      showToast((err as Error)?.message || 'Failed to submit application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [form, currentValidationContext, goToStep, showToast, isBusiness, nudge, draftUserId, onSubmitted])

  const handleNext = useCallback(async () => {
    const message = validateRegistrationStep(step, form, currentValidationContext)
    if (message) {
      showToast(message)
      if (step === 2) {
        if (isBusiness && !form.business.taxAck) nudge(setTaxNudge)
      }
      return
    }

    if (step === 0 && !signedIn) {
      setSubmitting(true)
      try {
        await registerWithEmail(
          `${form.account.firstName} ${form.account.lastName}`.trim(),
          form.account.email.trim(),
          password
        )
      } catch (err) {
        const raw = (err as Error)?.message || ''
        if (/exist|already/i.test(raw)) {
          showToast('An account with this email already exists. Sign in to continue.')
          onOpenAuth?.('signin')
        } else {
          showToast(raw || 'Could not create your account. Please try again.')
        }
        setSubmitting(false)
        return
      }
      setSubmitting(false)
    }

    if (step === 6) {
      await handleCreateProfile()
      return
    }

    goToStep(Math.min(step + 1, TOTAL_STEPS))
  }, [step, form, currentValidationContext, showToast, isBusiness, nudge, signedIn, password, handleCreateProfile, goToStep, onOpenAuth])

  // ── Field helpers ─────────────────────────────────────────────────────
  const setAccount = (key: keyof SupplierRegistrationForm['account'], value: string) =>
    setForm((prev) => ({ ...prev, account: { ...prev.account, [key]: value } }))

  const setIndividual = (key: keyof SupplierRegistrationForm['individual'], value: string) =>
    setForm((prev) => ({ ...prev, individual: { ...prev.individual, [key]: value } }))

  const setBusiness = (key: keyof SupplierRegistrationForm['business'], value: string | boolean) =>
    setForm((prev) => ({ ...prev, business: { ...prev.business, [key]: value } }))

  const setPayout = <K extends 'bank' | 'paypal' | 'momo'>(method: K, key: string, value: string) =>
    setForm((prev) => ({
      ...prev,
      payout: { ...prev.payout, [method]: { ...prev.payout[method], [key]: value } },
    }))

  const selectCard = (id: string) => {
    const nextCard = supplierCard(id)
    if (!nextCard) return
    setForm((prev) => {
      const next = { ...prev, supplierCardId: id, supplierKind: nextCard.kind }
      if (nextCard.kind === 'individual') {
        next.individual = {
          ...next.individual,
          firstName: next.individual.firstName || prev.account.firstName,
          lastName: next.individual.lastName || prev.account.lastName,
        }
      }
      return next
    })
  }

  const toggleService = (id: string) =>
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(id)
        ? prev.services.filter((s) => s !== id)
        : [...prev.services, id],
    }))

  const toggleRegion = (region: string) =>
    setForm((prev) => ({
      ...prev,
      operatingRegions: prev.operatingRegions.includes(region)
        ? prev.operatingRegions.filter((r) => r !== region)
        : [...prev.operatingRegions, region],
    }))

  const selectPayoutMethod = (method: string) =>
    setForm((prev) => ({ ...prev, payout: { ...prev.payout, method } }))

  const selectPayoutSchedule = (schedule: string) =>
    setForm((prev) => ({ ...prev, payout: { ...prev.payout, schedule } }))

  const handlePrimaryFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setForm((prev) => ({ ...prev, primaryDocument: file }))
    if (file) showToast('Document added')
  }

  const handleOpenDashboard = useCallback(async () => {
    const url = await getSupplierPortalUrl()
    if (url) {
      window.location.assign(url)
      return
    }
    navigate('/')
  }, [navigate])

  const summarySupplier = card?.title || 'Not selected'
  const summaryServices = useMemo(
    () =>
      SERVICE_CARDS.filter((c) => form.services.includes(c.id))
        .map((c) => c.title)
        .join(', ') || 'Not selected',
    [form.services],
  )
  const summarySchedule = PAYOUT_SCHEDULES.find((s) => s.id === form.payout.schedule)
  const summaryPayoutCard = PAYOUT_METHODS.find((m) => m.id === form.payout.method)
  const summaryPayout = summaryPayoutCard
    ? `${summaryPayoutCard.title}${summarySchedule ? ` · ${summarySchedule.title}` : ''}`
    : 'Can be completed later'

  return (
    <div
      className={`sr-page${step === TOTAL_STEPS ? ' completion-screen' : ''}${step === 0 ? ' first-registration-step' : ''}`}
    >
      <div className="shell">
        <aside className="sidebar panel">
          <div className="brand">
            <img className="brand-logo" src={logoSrc} alt="TravioGhana logo" />
            <div className="brand-copy">
              <strong>Supplier onboarding</strong>
              <span>TravioGhana partner registration</span>
            </div>
          </div>

          <div className="intro-card">
            <h2>Start selling experiences across Ghana.</h2>
            <p>Create one supplier account for tours, activities, transfers and transport services.</p>
          </div>

          <ol className="steps" id="sidebarSteps">
            {WIZARD_STEPS.map((item, index) => {
              const state = index === step ? 'active' : index < step ? 'done' : ''
              return (
                <li
                  key={item.title}
                  ref={state === 'active' ? activeStepRef : undefined}
                  className={`step-item${state ? ` ${state}` : ''}`}
                >
                  <div className="step-dot">{index + 1}</div>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="sidebar-foot">
            You can save progress and finish verification later. Some documents may only be required
            before a product goes live or before your first payout.
          </div>
        </aside>

        <main className="main panel">
          <div className="topbar">
            <span className="eyebrow">TravioGhana Supplier Registration</span>
            <div className="progress-wrap">
              <div className="progress-meta">
                <span id="progressText">{progressText}</span>
                <span id="progressPercent">{progressPct}%</span>
              </div>
              <div className="progress">
                <div id="progressBar" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>

          <form
            id="supplierForm"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void handleNext()
            }}
          >
            {/* ── Step 1: Account ─────────────────────────────────────── */}
            <section className={`form-step${step === 0 ? ' active' : ''}`}>
              <div className="heading">
                <h1>Create your supplier account</h1>
                <p>
                  Start with the basics. You can use the same account to list tours, activities,
                  airport transfers and other transport services on TravioGhana.
                </p>
              </div>
              <div className="grid">
                <div className="field">
                  <label htmlFor="sr-first-name">
                    First name <span className="required-accent">Required</span>
                  </label>
                  <input
                    id="sr-first-name"
                    type="text"
                    placeholder="e.g. Peter"
                    value={form.account.firstName}
                    onChange={(e) => setAccount('firstName', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="sr-last-name">
                    Last name <span className="required-accent">Required</span>
                  </label>
                  <input
                    id="sr-last-name"
                    type="text"
                    placeholder="e.g. Mensah"
                    value={form.account.lastName}
                    onChange={(e) => setAccount('lastName', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="sr-email">
                    Email address <span className="required-accent">Required</span>
                  </label>
                  <input
                    id="sr-email"
                    type="email"
                    placeholder="name@company.com"
                    value={form.account.email}
                    onChange={(e) => setAccount('email', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="sr-phone">
                    Phone / WhatsApp number <span className="required-accent">Required</span>
                  </label>
                  <input
                    id="sr-phone"
                    type="tel"
                    placeholder="+233 ..."
                    value={form.account.phone}
                    onChange={(e) => setAccount('phone', e.target.value)}
                  />
                </div>
                {!signedIn && (
                  <>
                    <div className="field">
                      <label htmlFor="sr-password">Create password</label>
                      <div className="password-input">
                        <input
                          id="sr-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="At least 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword((shown) => !shown)}
                        >
                          {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                        </button>
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="sr-confirm-password">Confirm password</label>
                      <div className="password-input">
                        <input
                          id="sr-confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="Repeat password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                          aria-pressed={showConfirmPassword}
                          onClick={() => setShowConfirmPassword((shown) => !shown)}
                        >
                          {showConfirmPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {signedIn ? (
                <div className="notice">✓ You are signed in as {user?.email}. We'll link this application to your existing account.</div>
              ) : (
                <div className="notice">
                  🔒 Your details are used to manage your supplier account and communicate about
                  bookings, verification and payouts.
                </div>
              )}
            </section>

            {/* ── Step 2: Supplier type ───────────────────────────────── */}
            <section className={`form-step${step === 1 ? ' active' : ''}`}>
              <div className="heading">
                <h1>How are you joining TravioGhana?</h1>
                <p>
                  Select the option that best describes you. This helps us show only the information
                  and documents that are relevant to your type of business.
                </p>
              </div>
              <div className="cards single-select" data-name="supplierType">
                {SUPPLIER_CARDS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`choice-card${form.supplierCardId === item.id ? ' selected' : ''}`}
                    aria-pressed={form.supplierCardId === item.id}
                    onClick={() => selectCard(item.id)}
                  >
                    <div className="check">✓</div>
                    <div className="choice-icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">{item.icon}</svg>
                    </div>
                    <h4>{item.title}</h4>
                    <p>{item.description}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* ── Step 3: Profile ─────────────────────────────────────── */}
            <section className={`form-step${step === 2 ? ' active' : ''}`}>
              <div className="heading">
                <h1 id="profileHeading">
                  {isIndividual ? 'Tell us about yourself' : 'Tell us about your business'}
                </h1>
                <p id="profileSubheading">
                  {isIndividual
                    ? 'We need a few personal details to verify you as an independent supplier.'
                    : 'Add your business profile. Formal registration details can be completed later where applicable.'}
                </p>
              </div>

              <div id="individualProfile" style={{ display: isIndividual ? 'block' : 'none' }}>
                <div className="profile-stack">
                  <div className="form-block">
                    <div className="form-block-head">
                      <div>
                        <h3>Identity details</h3>
                        <p>Keep this exactly as it appears on your government-issued ID.</p>
                      </div>
                      <span className="form-block-badge">Individual profile</span>
                    </div>
                    <div className="profile-grid">
                      <div className="field">
                        <label htmlFor="sr-ind-first">
                          First name <span className="required-accent">Required</span>
                        </label>
                        <input
                          id="sr-ind-first"
                          type="text"
                          placeholder="As shown on your ID"
                          value={form.individual.firstName}
                          onChange={(e) => setIndividual('firstName', e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="sr-ind-last">
                          Last name <span className="required-accent">Required</span>
                        </label>
                        <input
                          id="sr-ind-last"
                          type="text"
                          placeholder="As shown on your ID"
                          value={form.individual.lastName}
                          onChange={(e) => setIndividual('lastName', e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="sr-ind-dob">
                          Date of birth <span className="required-accent">Required</span>
                        </label>
                        <input
                          id="sr-ind-dob"
                          type="date"
                          value={form.individual.dob}
                          onChange={(e) => setIndividual('dob', e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="sr-ind-id-type">
                          ID type <span className="required-accent">Required</span>
                        </label>
                        <select
                          id="sr-ind-id-type"
                          value={form.individual.idType}
                          onChange={(e) => setIndividual('idType', e.target.value)}
                        >
                          <option value="">Select ID type</option>
                          {ID_TYPE_OPTIONS.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field wide">
                        <label htmlFor="sr-ind-id-number">
                          ID number <span className="required-accent">Required</span>
                        </label>
                        <input
                          id="sr-ind-id-number"
                          type="text"
                          placeholder="Enter the number shown on your ID"
                          value={form.individual.idNumber}
                          onChange={(e) => setIndividual('idNumber', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-block">
                    <div className="form-block-head">
                      <div>
                        <h3>Residential or operating address</h3>
                        <p>Use your GhanaPost GPS code or the address where you mainly operate.</p>
                      </div>
                    </div>
                    <div className="profile-grid">
                      <div className="field wide">
                        <label htmlFor="sr-ind-address">
                          Address / GhanaPost GPS <span className="required-accent">Required</span>
                        </label>
                        <input
                          id="sr-ind-address"
                          type="text"
                          placeholder="e.g. GA-123-4567 or street / area address"
                          value={form.individual.address}
                          onChange={(e) => setIndividual('address', e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="sr-ind-region">
                          Region <span className="required-accent">Required</span>
                        </label>
                        <select
                          id="sr-ind-region"
                          value={form.individual.region}
                          onChange={(e) => setIndividual('region', e.target.value)}
                        >
                          <option value="">Select region</option>
                          {GHANA_REGIONS.map((region) => (
                            <option key={region}>{region}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="sr-ind-city">
                          City / Town <span className="required-accent">Required</span>
                        </label>
                        <input
                          id="sr-ind-city"
                          type="text"
                          placeholder="e.g. Accra"
                          value={form.individual.city}
                          onChange={(e) => setIndividual('city', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="subtle-divider" />
                    <div className="field">
                      <label htmlFor="sr-ind-brand">
                        Business / Brand name <span className="required-accent">Required</span>
                      </label>
                      <input
                        id="sr-ind-brand"
                        type="text"
                        placeholder="Your public brand or business name"
                        value={form.individual.brandName}
                        onChange={(e) => setIndividual('brandName', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="compact-note">
                    🔒 Your personal details are used for identity verification, account security,
                    compliance and payouts.
                  </div>
                </div>
              </div>

              <div id="businessProfile" style={{ display: isBusiness ? 'block' : 'none' }}>
                <div className="profile-stack">
                  <div className="form-block">
                    <div className="form-block-head">
                      <div>
                        <h3>Business profile</h3>
                        <p>
                          Keep this part simple. Start with the name customers know you by and your
                          public contact details.
                        </p>
                      </div>
                      <span className="form-block-badge">Business profile</span>
                    </div>
                    <div className="profile-grid">
                      <div className="field">
                        <label htmlFor="sr-biz-brand">
                          Business / Brand name <span className="required-accent">Required</span>
                        </label>
                        <input
                          id="sr-biz-brand"
                          type="text"
                          placeholder="e.g. Expedition-Go Tours"
                          value={form.business.brandName}
                          onChange={(e) => setBusiness('brandName', e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="sr-biz-year">
                          Year established <span className="required-accent">Required</span>
                        </label>
                        <input
                          id="sr-biz-year"
                          type="number"
                          min={1900}
                          max={2100}
                          placeholder="e.g. 2023"
                          value={form.business.yearEstablished}
                          onChange={(e) => setBusiness('yearEstablished', e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="sr-biz-website">
                          Website <span className="optional">(optional)</span>
                        </label>
                        <input
                          id="sr-biz-website"
                          type="url"
                          placeholder="https://"
                          value={form.business.website}
                          onChange={(e) => setBusiness('website', e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="sr-biz-social">
                          Social media <span className="optional">(optional)</span>
                        </label>
                        <input
                          id="sr-biz-social"
                          type="text"
                          placeholder="Instagram, Facebook or TikTok"
                          value={form.business.social}
                          onChange={(e) => setBusiness('social', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-block">
                    <div className="form-block-head">
                      <div>
                        <h3>Business registration details</h3>
                        <p>
                          Add your formal business details if you have them now. You can still
                          continue if some information will be completed later.
                        </p>
                      </div>
                      <span className="form-block-badge">Legal details</span>
                    </div>
                    <div className="profile-grid">
                      <div className="field">
                        <label htmlFor="sr-biz-legal">
                          Legal business name <span className="required-accent">Required</span>
                        </label>
                        <input
                          id="sr-biz-legal"
                          type="text"
                          placeholder="Registered legal name"
                          value={form.business.legalName}
                          onChange={(e) => setBusiness('legalName', e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="sr-biz-reg">
                          Business registration number <span className="required-accent">Required</span>
                        </label>
                        <input
                          id="sr-biz-reg"
                          type="text"
                          placeholder="Registration number"
                          value={form.business.regNumber}
                          onChange={(e) => setBusiness('regNumber', e.target.value)}
                        />
                      </div>
                      <div className="field wide">
                        <label htmlFor="sr-biz-tin">
                          TIN <span className="optional">(optional)</span>
                        </label>
                        <input
                          id="sr-biz-tin"
                          type="text"
                          placeholder="Tax identification number"
                          value={form.business.tin}
                          onChange={(e) => setBusiness('tin', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-block">
                    <div className="form-block-head">
                      <div>
                        <h3>Business address</h3>
                        <p>
                          Use your business location, street address or GhanaPost GPS code in the
                          format that best matches how addresses are used in Ghana.
                        </p>
                      </div>
                      <span className="form-block-badge">Location</span>
                    </div>
                    <div className="profile-grid">
                      <div className="field wide">
                        <label htmlFor="sr-biz-address">
                          Business address / GhanaPost GPS{' '}
                          <span className="required-accent">Required</span>
                        </label>
                        <input
                          id="sr-biz-address"
                          type="text"
                          placeholder="e.g. GA-123-4567 or street / area address"
                          value={form.business.address}
                          onChange={(e) => setBusiness('address', e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="sr-biz-region">
                          Region <span className="required-accent">Required</span>
                        </label>
                        <select
                          id="sr-biz-region"
                          value={form.business.region}
                          onChange={(e) => setBusiness('region', e.target.value)}
                        >
                          <option value="">Select region</option>
                          {GHANA_REGIONS.map((region) => (
                            <option key={region}>{region}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="sr-biz-city">
                          City / Town <span className="required-accent">Required</span>
                        </label>
                        <input
                          id="sr-biz-city"
                          type="text"
                          placeholder="e.g. Accra, Kumasi, Cape Coast"
                          value={form.business.city}
                          onChange={(e) => setBusiness('city', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-block tax-responsibility-block">
                    <div className="form-block-head">
                      <div>
                        <h3>
                          Tax responsibility <span className="required-accent">Required</span>
                        </h3>
                        <p>Please review the note below and confirm once to continue.</p>
                      </div>
                    </div>

                    <div className="compact-note tax-note">
                      TravioGhana provides the marketplace and payout service. Your business remains
                      responsible for its own applicable tax registration, declarations, payments,
                      levies and statutory obligations, except where TravioGhana is legally required
                      to withhold or remit an amount.
                    </div>

                    <label
                      className={`tax-accept-box${taxNudge ? ' needs-attention' : ''}`}
                      id="taxAcceptBox"
                    >
                      <input
                        type="checkbox"
                        id="businessTaxAck"
                        checked={form.business.taxAck}
                        onChange={(e) => setBusiness('taxAck', e.target.checked)}
                      />
                      <span className="tax-accept-check" aria-hidden="true" />
                      <span className="tax-accept-copy">
                        <strong>I understand and accept my tax responsibility.</strong>
                        <small>
                          I understand that I / my business am responsible for managing and paying my
                          own applicable taxes and statutory obligations.
                        </small>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="section-title">
                  <h3>
                    Where do you mainly operate? <span className="required-accent">Required</span>
                  </h3>
                  <span>Select at least one region</span>
                </div>
                <div className="pill-wrap multi-select" id="operatingRegions">
                  {GHANA_REGIONS.map((region) => (
                    <button
                      key={region}
                      type="button"
                      className={`pill${form.operatingRegions.includes(region) ? ' selected' : ''}`}
                      aria-pressed={form.operatingRegions.includes(region)}
                      onClick={() => toggleRegion(region)}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Step 4: Services ────────────────────────────────────── */}
            <section className={`form-step${step === 3 ? ' active' : ''}`}>
              <div className="heading">
                <h1>What would you like to sell?</h1>
                <p>
                  You can choose more than one. Your TravioGhana supplier account can manage tours,
                  activities and transport services from one dashboard.
                </p>
              </div>
              <div className="cards multi-card-select" id="serviceCards">
                {SERVICE_CARDS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`choice-card${form.services.includes(item.id) ? ' selected' : ''}`}
                    aria-pressed={form.services.includes(item.id)}
                    onClick={() => toggleService(item.id)}
                  >
                    <div className="check">✓</div>
                    <div className="choice-icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">{item.icon}</svg>
                    </div>
                    <h4>{item.title}</h4>
                    <p>{item.description}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* ── Step 5: Verification ────────────────────────────────── */}
            <section className={`form-step${step === 4 ? ' active' : ''}`} id="verificationStep">
              <div className="heading">
                <h1>Quick verification</h1>
                <p>
                  We only need one document to get your supplier account started. You can create
                  your listings next, and we&rsquo;ll ask for any service-specific documents only when
                  they become relevant.
                </p>
              </div>

              <div className="quick-verify-shell">
                <div className="quick-verify-progress">
                  <div className="quick-verify-badge">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 3 4.5 6v5.5c0 4.8 3.1 7.9 7.5 9.5 4.4-1.6 7.5-4.7 7.5-9.5V6L12 3Z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <span>QUICK START</span>
                    <strong id="quickVerifyTitle">1 document required</strong>
                    <p id="quickVerifySubtitle">{primaryDoc.quickSubtitle}</p>
                  </div>
                </div>

                <div className="section quick-document-section">
                  <div className="quick-document-copy">
                    <span className="stage-eyebrow required-now-accent">REQUIRED NOW</span>
                    <h3 id="primaryDocumentTitle">{primaryDoc.title}</h3>
                    <p id="primaryDocumentDescription">{primaryDoc.description}</p>
                  </div>

                  <label
                    className={`quick-upload-card document-upload${form.primaryDocument ? ' uploaded' : ''}`}
                    id="primaryDocumentUpload"
                  >
                    <div className="quick-upload-icon" id="primaryDocumentIcon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="4" y="3" width="16" height="18" rx="3" />
                        <circle cx="9" cy="10" r="2.5" />
                        <path d="M6.5 17c.7-2 1.6-3 2.5-3s1.8 1 2.5 3M14 9h3M14 13h3" />
                      </svg>
                    </div>
                    <div className="quick-upload-text">
                      <strong id="primaryUploadLabel">{primaryDoc.uploadLabel}</strong>
                      <span>JPG, PNG or PDF</span>
                      <small className="upload-file-name">
                        {form.primaryDocument?.name || 'No file selected'}
                      </small>
                    </div>
                    <div className="quick-upload-action">
                      <span className="upload-action-label">
                        {form.primaryDocument ? 'Replace file' : 'Choose file'}
                      </span>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 16V4M8 8l4-4 4 4M5 14v5h14v-5" />
                      </svg>
                    </div>
                    <input
                      type="file"
                      hidden
                      accept="image/*,.pdf"
                      onChange={handlePrimaryFile}
                    />
                  </label>
                </div>

                <div className="quick-done-card">
                  <div className="quick-done-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m8 12 2.5 2.5L16 9" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  </div>
                  <div>
                    <strong>That&rsquo;s all we need for now.</strong>
                    <p>
                      You&rsquo;re ready to continue. Start creating your listings now, and we&rsquo;ll
                      guide you through any additional verification only when it becomes relevant.
                    </p>
                  </div>
                </div>

                <div className="later-documents-card">
                  <button
                    type="button"
                    className="later-documents-toggle"
                    id="laterDocumentsToggle"
                    aria-expanded={laterDocsOpen}
                    onClick={() => setLaterDocsOpen((open) => !open)}
                  >
                    <div>
                      <span className="stage-eyebrow">LATER, IF NEEDED</span>
                      <strong>Documents we may ask for before a listing goes live</strong>
                      <small>Based on your supplier type and the services you selected.</small>
                    </div>
                    <svg className="later-chevron" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m8 10 4 4 4-4" />
                    </svg>
                  </button>

                  <div
                    className={`later-documents-body${laterDocsOpen ? ' open' : ''}`}
                    id="laterDocumentsBody"
                  >
                    <div className="later-documents-list" id="laterDocumentsList">
                      {laterDocs.length > 0 ? (
                        laterDocs.map((doc, index) => (
                          <div className="later-document-item" key={doc.name}>
                            <div className="later-dot">{index + 1}</div>
                            <div>
                              <strong>{doc.name}</strong>
                              <span>{doc.detail}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="later-document-item">
                          <div className="later-dot">✓</div>
                          <div>
                            <strong>No extra documents right now</strong>
                            <span>
                              If a future listing needs additional verification, TravioGhana will ask
                              you at that point.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="later-documents-note">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 11v5M12 8h.01" />
                      </svg>
                      <span>
                        You do not need to upload these during registration. TravioGhana will only ask
                        when they are relevant to the service you are about to publish or operate.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Step 6: Payout ──────────────────────────────────────── */}
            <section className={`form-step${step === 5 ? ' active' : ''}`}>
              <div className="heading">
                <h1>How should we pay you?</h1>
                <p>
                  Choose how you would like to receive your TravioGhana earnings and how often you
                  want payouts to be generated. You can complete or change these details later from
                  your supplier dashboard.
                </p>
              </div>

              <div className="section">
                <div className="section-title">
                  <h3>
                    Payout method <span className="required-accent">Required</span>
                  </h3>
                  <span>Choose one</span>
                </div>
                <div className="cards single-select" data-name="payoutType" id="payoutMethodCards">
                  {PAYOUT_METHODS.map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      className={`choice-card${form.payout.method === method.id ? ' selected' : ''}`}
                      aria-pressed={form.payout.method === method.id}
                      onClick={() => selectPayoutMethod(method.id)}
                    >
                      <div className="check">✓</div>
                      <div className="choice-icon">
                        <svg viewBox="0 0 24 24" aria-hidden="true">{method.icon}</svg>
                      </div>
                      <h4>{method.title}</h4>
                      <p>{method.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="section"
                id="bankPayoutFields"
                style={{ display: form.payout.method === 'bank' ? 'block' : 'none' }}
              >
                <div className="section-title">
                  <h3>Bank transfer details</h3>
                  <span>Can be completed later</span>
                </div>
                <div className="grid one">
                  <div className="field">
                    <label htmlFor="sr-bank-account-name">
                      Account name <span className="optional">(optional)</span>
                    </label>
                    <input
                      id="sr-bank-account-name"
                      type="text"
                      placeholder="Name on the bank account"
                      value={form.payout.bank.accountName}
                      onChange={(e) => setPayout('bank', 'accountName', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid" style={{ marginTop: 16 }}>
                  <div className="field">
                    <label htmlFor="sr-bank-account-number">
                      Account number <span className="optional">(optional)</span>
                    </label>
                    <input
                      id="sr-bank-account-number"
                      type="text"
                      placeholder="Enter account number"
                      value={form.payout.bank.accountNumber}
                      onChange={(e) => setPayout('bank', 'accountNumber', e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="sr-bank-name">
                      Bank name <span className="optional">(optional)</span>
                    </label>
                    <input
                      id="sr-bank-name"
                      type="text"
                      placeholder="e.g. Ecobank Ghana"
                      value={form.payout.bank.bankName}
                      onChange={(e) => setPayout('bank', 'bankName', e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="sr-bank-country">
                      Bank country <span className="optional">(optional)</span>
                    </label>
                    <input
                      id="sr-bank-country"
                      type="text"
                      placeholder="Ghana"
                      value={form.payout.bank.bankCountry}
                      onChange={(e) => setPayout('bank', 'bankCountry', e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="sr-bank-currency">
                      Currency <span className="optional">(optional)</span>
                    </label>
                    <select
                      id="sr-bank-currency"
                      value={form.payout.bank.currency}
                      onChange={(e) => setPayout('bank', 'currency', e.target.value)}
                    >
                      {BANK_CURRENCIES.map((currency) => (
                        <option key={currency}>{currency}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div
                className="section"
                id="paypalPayoutFields"
                style={{ display: form.payout.method === 'paypal' ? 'block' : 'none' }}
              >
                <div className="section-title">
                  <h3>PayPal details</h3>
                  <span>Can be completed later</span>
                </div>
                <div className="grid">
                  <div className="field">
                    <label htmlFor="sr-paypal-name">
                      PayPal account name <span className="optional">(optional)</span>
                    </label>
                    <input
                      id="sr-paypal-name"
                      type="text"
                      placeholder="Name on your PayPal account"
                      value={form.payout.paypal.accountName}
                      onChange={(e) => setPayout('paypal', 'accountName', e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="sr-paypal-email">
                      PayPal email address <span className="optional">(optional)</span>
                    </label>
                    <input
                      id="sr-paypal-email"
                      type="email"
                      placeholder="name@example.com"
                      value={form.payout.paypal.email}
                      onChange={(e) => setPayout('paypal', 'email', e.target.value)}
                    />
                  </div>
                </div>
                <div className="notice" style={{ marginTop: 16 }}>
                  ℹ️ Make sure the email address is linked to an active PayPal account that can
                  receive payments.
                </div>
              </div>

              <div
                className="section"
                id="momoPayoutFields"
                style={{ display: form.payout.method === 'momo' ? 'block' : 'none' }}
              >
                <div className="section-title">
                  <h3>Mobile money details</h3>
                  <span>Can be completed later</span>
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="sr-momo-name">
                      Account holder name <span className="optional">(optional)</span>
                    </label>
                    <input
                      id="sr-momo-name"
                      type="text"
                      placeholder="Name registered on the wallet"
                      value={form.payout.momo.accountName}
                      onChange={(e) => setPayout('momo', 'accountName', e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="sr-momo-network">
                      Mobile money network <span className="optional">(optional)</span>
                    </label>
                    <select
                      id="sr-momo-network"
                      value={form.payout.momo.network}
                      onChange={(e) => setPayout('momo', 'network', e.target.value)}
                    >
                      <option value="">Select network</option>
                      {MOMO_NETWORKS.map((network) => (
                        <option key={network}>{network}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="sr-momo-number">
                      Mobile money number <span className="optional">(optional)</span>
                    </label>
                    <input
                      id="sr-momo-number"
                      type="tel"
                      placeholder="e.g. 024 000 0000"
                      value={form.payout.momo.number}
                      onChange={(e) => setPayout('momo', 'number', e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="sr-momo-currency">Currency</label>
                    <select
                      id="sr-momo-currency"
                      value={form.payout.momo.currency}
                      onChange={(e) => setPayout('momo', 'currency', e.target.value)}
                    >
                      <option>GHS</option>
                    </select>
                  </div>
                </div>
                <div className="notice" style={{ marginTop: 16 }}>
                  ℹ️ The mobile money account must be active and able to receive payments. The
                  registered account name should match the supplier or authorised payout recipient.
                </div>
              </div>

              <div className="section">
                <div className="section-title">
                  <div>
                    <h3 style={{ marginBottom: 5 }}>
                      Payout schedule <span className="required-accent">Required</span>
                    </h3>
                    <span>
                      Choose how often your completed-booking earnings are paid out automatically.
                    </span>
                  </div>
                  <span>Choose one</span>
                </div>
                <div className="cards single-select" data-name="payoutSchedule" id="payoutScheduleCards">
                  {PAYOUT_SCHEDULES.map((schedule) => (
                    <button
                      key={schedule.id}
                      type="button"
                      className={`choice-card${form.payout.schedule === schedule.id ? ' selected' : ''}`}
                      aria-pressed={form.payout.schedule === schedule.id}
                      onClick={() => selectPayoutSchedule(schedule.id)}
                    >
                      <div className="check">✓</div>
                      <div className="choice-icon">
                        <svg viewBox="0 0 24 24" aria-hidden="true">{schedule.icon}</svg>
                      </div>
                      <h4>{schedule.title}</h4>
                      <p>
                        <strong>{schedule.lead}</strong>
                        <br />
                        <br />
                        {schedule.detail}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="notice" style={{ marginTop: 16 }}>
                  ℹ️ Changes to your payout schedule can take effect from the start of the next
                  payout cycle so an active cycle is not split.
                </div>
              </div>

              <div className="section">
                <div className="toggle-row">
                  <div className="toggle-copy">
                    <strong>Use this as the primary payout method</strong>
                    <span>
                      You can change your payout method and schedule later from your supplier
                      dashboard.
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`switch${form.payout.primary ? ' on' : ''}`}
                    role="switch"
                    aria-checked={form.payout.primary}
                    aria-label="Use this as the primary payout method"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        payout: { ...prev.payout, primary: !prev.payout.primary },
                      }))
                    }
                  >
                    <span />
                  </button>
                </div>
              </div>
            </section>

            {/* ── Step 7: Review ──────────────────────────────────────── */}
            <section className={`form-step${step === 6 ? ' active' : ''}`}>
              <div className="heading">
                <h1>Review your setup</h1>
                <p>
                  You&rsquo;re almost ready. Review the information below and confirm the supplier
                  standards before creating your TravioGhana supplier profile.
                </p>
              </div>

              <div className="summary">
                <div className="summary-card">
                  <span>Account</span>
                  <strong>Contact details added</strong>
                </div>
                <div className="summary-card">
                  <span>Supplier type</span>
                  <strong id="summarySupplier">{summarySupplier}</strong>
                </div>
                <div className="summary-card">
                  <span>Profile</span>
                  <strong>Ghana supplier profile</strong>
                </div>
                <div className="summary-card">
                  <span>Services</span>
                  <strong id="summaryServices">{summaryServices}</strong>
                </div>
                <div className="summary-card">
                  <span>Verification</span>
                  <strong>Can be completed later</strong>
                </div>
                <div className="summary-card">
                  <span>Payout</span>
                  <strong id="summaryPayout">{summaryPayout}</strong>
                </div>
              </div>

              <div className="section supplier-standards-section">
                <div className="section-title">
                  <div>
                    <h3>
                      Review &amp; accept <span className="required-accent">Required</span>
                    </h3>
                    <span>
                      Please review the supplier standards below. You only need to confirm once to
                      continue.
                    </span>
                  </div>
                </div>

                <div className="standards-list">
                  {SUPPLIER_STANDARDS.map((standard) => (
                    <div className="standard-item" key={standard.title}>
                      <div className="standard-icon">✓</div>
                      <div className="standard-copy">
                        <strong>{standard.title}</strong>
                        <span>{standard.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <label
                  className={`accept-all-box${standardsNudge ? ' needs-attention' : ''}`}
                >
                  <input
                    type="checkbox"
                    id="acceptAllStandards"
                    checked={form.compliance.acceptAll}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        compliance: { ...prev.compliance, acceptAll: e.target.checked },
                      }))
                    }
                  />
                  <span className="accept-all-check" aria-hidden="true" />
                  <span className="accept-all-copy">
                    <strong>I have read and agree to all of the supplier standards above.</strong>
                    <small>
                      This includes the TravioGhana Supplier Terms, information processing and
                      verification, and distribution terms.
                    </small>
                  </span>
                </label>
              </div>
            </section>

            {/* ── Success ─────────────────────────────────────────────── */}
            <section className={`form-step${step === TOTAL_STEPS ? ' active' : ''}`}>
              <div className="success" id="successScreen">
                <div className="success-shell">
                  <div className="success-badge">🎉 Supplier setup complete</div>
                  <div className="success-icon">✓</div>
                  <h2>Your supplier profile is ready</h2>
                  <p>
                    Welcome to TravioGhana. Your supplier account has been created successfully and
                    you can now open your supplier dashboard to complete your setup, manage
                    verification and start creating listings.
                  </p>

                  <div className="success-highlights">
                    <div className="success-highlight">
                      <strong>Account created</strong>
                      <span>Your core supplier profile is now set up.</span>
                    </div>
                    <div className="success-highlight">
                      <strong>Next step</strong>
                      <span>Open your supplier dashboard and start adding products.</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn primary success-dashboard-btn"
                    onClick={() => void handleOpenDashboard()}
                  >
                    Open Supplier Dashboard
                  </button>
                </div>
              </div>
            </section>

            {step < TOTAL_STEPS && (
              <div className="actions" id="actions">
                <button
                  type="button"
                  className="btn secondary"
                  id="backBtn"
                  onClick={handleBack}
                  style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  id="nextBtn"
                  disabled={submitting}
                >
                  {step === 6 ? 'Create supplier profile' : 'Continue'}
                </button>
              </div>
            )}
          </form>
        </main>
      </div>

      <div className={`toast${toast ? ' show' : ''}`} id="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  )
}
