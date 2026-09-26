/**
 * Seven-step supplier registration wizard (account → type → profile →
 * services → verification → payout → review), a faithful port of the approved
 * `travio_supplier_registration` prototype.
 *
 * Behaviour notes vs the prototype:
 *   - Step 1 owns account creation: signed-out visitors fill password +
 *     confirm and `POST /auth/register` runs on Continue (signed-in visitors
 *     get an identity notice instead of password fields).
 *   - Validation is inline (`.field-error` under each field) instead of the
 *     prototype's toast-only gates; the two checkbox gates (tax responsibility,
 *     supplier standards) keep their toast + nudge.
 *   - Everything persists to the versioned draft store; passwords never do.
 *   - On submit it mirrors the previous form's contract: multipart payload →
 *     apply → confirm the status endpoint → success screen; `onSubmitted` fires
 *     when leaving the success screen so the parent can show live status.
 *
 * @see lib/supplierRegistration.ts (options, validation, payload builder)
 * @see lib/supplierApplicationDraft.ts (persisted form model)
 * @see pages/supplier/SupplierRegisterPage.tsx
 * @see styles/SupplierRegister.css (scoped prototype styles)
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import confetti from 'canvas-confetti'
import supplierLogo from '@/assets/TravioGhana_Supplier_Logo.png'
import {
  Check,
  ChevronDown,
  CircleCheckBig,
  FileText,
  IdCard,
  Info,
  LoaderCircle,
  Lock,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useAuthUser } from '@/hooks/useAuthUser'
import { getAuthUserId, refreshStoredUserFromBackend, registerWithEmail, setAccountPassword } from '@/lib/auth'
import { applyAsSupplier, getSupplierApplicationStatus, MAX_SUPPLIER_APPLICATION_FILES, MAX_SUPPLIER_DOCUMENT_BYTES } from '@/lib/supplier'
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, isValidPhoneInput } from '@/lib/phone'
import { SelectInput, TextInput } from '@/components/booking/FormFields'
import SocialLinksManager from './SocialLinksManager'
import {
  clearSupplierApplicationDraft,
  createEmptySupplierApplicationForm,
  loadSupplierApplicationDraft,
  mergeSupplierApplicationDraft,
  migrateAnonymousDraftToUser,
  rememberDraftUserId,
  resolveDraftUserId,
  saveSupplierApplicationDraft,
  type SupplierApplicationForm as DraftForm,
} from '@/lib/supplierApplicationDraft'
import {
  buildSupplierPayload,
  GHANA_REGIONS,
  ID_TYPE_OPTIONS,
  laterDocumentsFor,
  MOMO_NETWORKS,
  PAYOUT_CURRENCIES,
  PAYOUT_METHODS,
  PAYOUT_SCHEDULES,
  requiredSupplierDocuments,
  serviceLabels,
  STEPS_COUNT,
  STEP_ACCOUNT,
  STEP_PAYOUT,
  STEP_PROFILE,
  STEP_REVIEW,
  STEP_SERVICES,
  STEP_SUCCESS,
  STEP_TYPE,
  STEP_VERIFICATION,
  supplierTypeOption,
  SUPPLIER_TYPE_OPTIONS,
  SERVICE_OPTIONS,
  validateSupplierStep,
} from '@/lib/supplierRegistration'

// ── Static copy ───────────────────────────────────────────────────────────

const SIDEBAR_STEPS = [
  { title: 'Account', subtitle: 'Your contact details' },
  { title: 'Supplier type', subtitle: 'How you operate' },
  { title: 'Profile', subtitle: 'You or your business' },
  { title: 'Services', subtitle: 'What you want to sell' },
  { title: 'Verification', subtitle: 'Documents & trust' },
  { title: 'Payout', subtitle: 'How you get paid' },
  { title: 'Review', subtitle: 'Check and submit' },
]

const STANDARDS = [
  {
    title: 'Information is accurate',
    text: 'I confirm the information provided is accurate and I will keep my supplier information current.',
  },
  {
    title: 'Authorised to sell',
    text: 'I am authorised to sell the tours, activities, experiences or transport services I list.',
  },
  {
    title: 'TravioGhana Supplier Terms',
    text: 'I agree to the applicable booking, cancellation, payout, service-quality and supplier obligations.',
  },
  {
    title: 'Information processing & verification',
    text: 'I allow Expedition-Go Tours Ltd to process and verify the information and documents I provide for supplier verification, compliance, account administration and marketplace operations.',
  },
  {
    title: 'Distribution across our network',
    text: 'I agree that eligible listings may be distributed through TravioGhana, the Expedition-Go Tours network and authorised partners where applicable.',
  },
]

/** Same palette as the supplier dashboard's "tour submitted" celebration. */
const CONFETTI_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#f59e0b', '#3b82f6', '#ec4899']

/** Document picker: phone photos and PDFs, matching the backend's multer filter. */
const DOCUMENT_ACCEPT = 'image/*,.pdf'

/**
 * Image formats the backend/Cloudinary accepts as-is (config/cloudinary.js).
 * Anything else — most importantly iPhone HEIC — is converted to JPEG before
 * upload, otherwise the submission fails only after the whole form is filled.
 */
const UPLOADABLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/** Longest edge kept when re-encoding a photo (plenty for an ID document). */
const MAX_DOCUMENT_DIMENSION = 2400

/** Human file size for the upload card ("2.4 MB"). */
function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Re-encode a decoded image as a JPEG, capped at `MAX_DOCUMENT_DIMENSION`.
 * Converts formats the upload pipeline rejects (HEIC/HEIF/GIF) and shrinks
 * photos that would exceed the 10 MB per-file limit.
 */
async function reencodeImageAsJpeg(file: File, bitmap: ImageBitmap): Promise<File> {
  const longestEdge = Math.max(bitmap.width, bitmap.height) || MAX_DOCUMENT_DIMENSION
  const scale = Math.min(1, MAX_DOCUMENT_DIMENSION / longestEdge)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available')

  context.drawImage(bitmap, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) throw new Error('Could not encode the image')

  const baseName = file.name.replace(/\.[^./\\]+$/, '') || 'document'
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
}

// ── Presentational helpers (module-level so inputs keep focus) ────────────

function Field({
  path,
  label,
  required,
  optional,
  error,
  children,
}: {
  path: string
  label: string
  required?: boolean
  optional?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <div className={`field${error ? ' has-error' : ''}`} data-field={path}>
      <label>
        {label}
        {required && <span className="required-accent" title="Required">*</span>}
        {optional && <span className="optional">(optional)</span>}
      </label>
      {children}
      {error && (
        <div className="field-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div className="field-error" role="alert">
      {message}
    </div>
  )
}

function StepHeading({
  title,
  description,
  error,
  onSignIn,
}: {
  title: string
  description: string
  error?: string
  onSignIn?: () => void
}) {
  return (
    <div className="heading">
      <h1>{title}</h1>
      <p>{description}</p>
      {error && (
        <div className="notice notice-error" role="alert">
          <span>{error}</span>
          {onSignIn && (
            <button type="button" className="notice-link" onClick={onSignIn}>
              Sign in instead
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function ChoiceCard({
  selected,
  onClick,
  icon: Icon,
  title,
  description,
}: {
  selected: boolean
  onClick: () => void
  icon: LucideIcon
  title: string
  description: ReactNode
}) {
  return (
    <button
      type="button"
      className={`choice-card${selected ? ' selected' : ''}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <div className="check" aria-hidden="true">
        <Check size={13} strokeWidth={3} />
      </div>
      <div className="choice-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <h4>{title}</h4>
      <p>{description}</p>
    </button>
  )
}

interface SupplierApplicationFormProps {
  /** Called when the supplier leaves the success screen (refresh status). */
  onSubmitted?: () => void
  /** Opens the auth overlay — used by the "email already registered" hint. */
  onOpenAuth?: (mode: 'signin' | 'signup') => void
}

export function SupplierApplicationForm({ onSubmitted, onOpenAuth }: SupplierApplicationFormProps = {}) {
  const user = useAuthUser()
  const hasSession = Boolean(user)
  /** Signed in through a provider that has no password yet (e.g. Google). */
  const canSetPassword = hasSession && user?.hasPassword === false
  const showPasswordFields = !hasSession || canSetPassword
  const draftUserId = resolveDraftUserId(user)
  const restoredForIdRef = useRef<string | null>(null)

  const [step, setStep] = useState(STEP_ACCOUNT)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState<DraftForm>(createEmptySupplierApplicationForm)

  // Account-creation fields — component state only, never persisted to drafts.
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [signInHint, setSignInHint] = useState(false)
  const [toast, setToast] = useState('')
  const [nudge, setNudge] = useState<'' | 'tax' | 'standards'>('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const [laterDocsOpen, setLaterDocsOpen] = useState(false)

  // Document upload: `preparing` covers the client-side read/decode of the
  // chosen file, `uploadPercent` the real multipart upload on submit. Business
  // types upload two documents, so the transient state is keyed by document type.
  const [docStatusByType, setDocStatusByType] = useState<Record<string, 'idle' | 'preparing' | 'ready'>>({})
  const [docPreviewByType, setDocPreviewByType] = useState<Record<string, string>>({})
  const [docErrorByType, setDocErrorByType] = useState<Record<string, string>>({})
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const previewsRef = useRef<Record<string, string>>({})

  const toastTimerRef = useRef<number | undefined>(undefined)
  const nudgeTimerRef = useRef<number | undefined>(undefined)
  const sidebarRef = useRef<HTMLOListElement | null>(null)

  // ── Toast / nudge ───────────────────────────────────────────────────────

  const showToast = (message: string) => {
    setToast(message)
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2200)
  }

  const showNudge = (which: 'tax' | 'standards') => {
    setNudge(which)
    window.clearTimeout(nudgeTimerRef.current)
    nudgeTimerRef.current = window.setTimeout(() => setNudge(''), 1400)
  }

  useEffect(
    () => () => {
      window.clearTimeout(toastTimerRef.current)
      window.clearTimeout(nudgeTimerRef.current)
    },
    []
  )

  // ── Draft lifecycle ─────────────────────────────────────────────────────

  useEffect(() => {
    const signedInId = user ? getAuthUserId(user) ?? user.email ?? null : null
    if (signedInId) {
      rememberDraftUserId(signedInId)
      migrateAnonymousDraftToUser(signedInId)
    }
  }, [user])

  // Stored sessions created before `hasPassword` existed would hide the
  // optional password fields for Google accounts — refresh the flag once.
  const passwordFlagRefreshedRef = useRef(false)
  useEffect(() => {
    if (!user || user.hasPassword !== undefined || passwordFlagRefreshedRef.current) return
    passwordFlagRefreshedRef.current = true
    void refreshStoredUserFromBackend()
  }, [user])

  useEffect(() => {
    const id = draftUserId || 'anonymous'
    if (restoredForIdRef.current === id) return
    restoredForIdRef.current = id

    const draft = loadSupplierApplicationDraft(draftUserId)
    if (!draft) return

    window.setTimeout(() => setStep(draft.step), 0)
    window.setTimeout(() => setForm(mergeSupplierApplicationDraft(draft.form)), 0)
  }, [draftUserId])

  useEffect(() => {
    if (submitted) return
    const timeoutId = window.setTimeout(() => {
      saveSupplierApplicationDraft(draftUserId, { step, form })
    }, 350)
    return () => window.clearTimeout(timeoutId)
  }, [step, form, draftUserId, submitted])

  // Account details: the session email is authoritative; names fill in when empty.
  useEffect(() => {
    if (!user) return
    const sessionEmail = user.email ?? ''
    const names = (user.name ?? '').trim().split(/\s+/).filter(Boolean)
    const timeoutId = window.setTimeout(() => {
      setForm((prev) => {
        const firstName = prev.account.firstName || names[0] || ''
        const lastName = prev.account.lastName || names.slice(1).join(' ') || ''
        const email = sessionEmail || prev.account.email
        if (
          firstName === prev.account.firstName &&
          lastName === prev.account.lastName &&
          email === prev.account.email
        ) {
          return prev
        }
        return { ...prev, account: { ...prev.account, firstName, lastName, email } }
      })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [user])

  // ── Field helpers ───────────────────────────────────────────────────────

  const clearFieldError = (path: string) => {
    setFieldErrors((prev) => {
      if (!prev[path]) return prev
      const next = { ...prev }
      delete next[path]
      return next
    })
  }

  const scrollToField = (path: string) => {
    window.setTimeout(() => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-field="${path}"]`)
      )
      // Shared profile fields render once (id switches with supplier kind), but
      // guard anyway: focus only what is actually visible.
      const target =
        candidates.find((el) => el.offsetParent !== null) ?? candidates[0]
      if (!target) return
      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      const focusable = target.querySelector<HTMLElement>(
        'input:not([type="hidden"]), button, select, textarea'
      )
      focusable?.focus({ preventScroll: true })
    }, 150)
  }

  const scrollToFirstError = (errors: Record<string, string>) => {
    const first = Object.keys(errors)[0]
    if (first) scrollToField(first)
  }

  const updateAccount = (
    key: 'firstName' | 'lastName' | 'email' | 'phone' | 'phoneCountryCode',
    value: string
  ) => {
    clearFieldError(`account.${key}`)
    if (key === 'email') setSignInHint(false)
    setForm((prev) => ({ ...prev, account: { ...prev.account, [key]: value } }))
  }

  const updateProfile = (key: keyof DraftForm['profile'], value: string) => {
    clearFieldError(`profile.${key}`)
    setForm((prev) => ({ ...prev, profile: { ...prev.profile, [key]: value } }))
  }

  const updatePayout = (key: keyof DraftForm['payout'], value: string) => {
    clearFieldError(`payout.${key}`)
    setForm((prev) => ({ ...prev, payout: { ...prev.payout, [key]: value } }))
  }

  // ── Step navigation ─────────────────────────────────────────────────────

  const goToStep = (next: number) => {
    setError('')
    setFieldErrors({})
    setNudge('')
    setSignInHint(false)
    setStep(next)

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  // Keep the active sidebar chip in view on tablet widths (prototype render()).
  useEffect(() => {
    const list = sidebarRef.current
    if (!list || submitted) return
    const item = list.children[step]
    if (!(item instanceof HTMLElement)) return
    if (window.innerWidth <= 1180 && window.innerWidth > 620 && typeof item.scrollIntoView === 'function') {
      item.scrollIntoView({
        behavior:
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [step, submitted])

  const handleBack = () => {
    if (step > STEP_ACCOUNT) goToStep(step - 1)
  }

  // ── Step 0: account (creates the account when signed out) ───────────────

  const handleContinue = async () => {
    const errors = validateSupplierStep(step, form, { hasSession, password, confirmPassword })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      if (errors['taxAcknowledged']) {
        showToast(errors['taxAcknowledged'])
        showNudge('tax')
      }
      scrollToFirstError(errors)
      return
    }
    setFieldErrors({})
    setError('')

    if (step === STEP_ACCOUNT && !hasSession) {
      setCreatingAccount(true)
      try {
        const fullName = `${form.account.firstName} ${form.account.lastName}`.trim()
        const created = await registerWithEmail(fullName, form.account.email.trim(), password)
        const newId = getAuthUserId(created) ?? created.email ?? null
        if (newId) {
          // Pin in-progress work to the new account before anything re-renders,
          // then skip the restore pass so the live state is not clobbered.
          rememberDraftUserId(newId)
          migrateAnonymousDraftToUser(newId)
          saveSupplierApplicationDraft(newId, { step: STEP_TYPE, form })
          restoredForIdRef.current = newId
        }
        setPassword('')
        setConfirmPassword('')
        goToStep(STEP_TYPE)
      } catch (err) {
        const message = (err as Error)?.message || 'Could not create your account. Please try again.'
        if (/already exists/i.test(message)) {
          setError('This email already has a TravioGhana account — sign in to continue with this application.')
          setSignInHint(true)
          setFieldErrors({
            'account.email': 'An account with this email already exists — sign in to continue.',
          })
          scrollToField('account.email')
        } else {
          setError(message)
        }
      } finally {
        setCreatingAccount(false)
      }
      return
    }

    // Signed in (e.g. via Google) and opted to add a password: store it before
    // moving on so the account can also sign in with email later.
    if (step === STEP_ACCOUNT && canSetPassword && password) {
      setSavingPassword(true)
      try {
        await setAccountPassword(password)
        setPassword('')
        setConfirmPassword('')
        goToStep(STEP_TYPE)
      } catch (err) {
        setError((err as Error)?.message || 'Could not save your password. Please try again.')
      } finally {
        setSavingPassword(false)
      }
      return
    }

    goToStep(step + 1)
  }

  // ── Step 1: supplier type ───────────────────────────────────────────────

  const selectSupplierType = (id: string) => {
    clearFieldError('supplierChoice')
    if (form.supplierChoice === id) return
    // The up-front document no longer depends on the type, so an uploaded ID is
    // kept when the applicant switches between supplier types.
    setForm((prev) => ({ ...prev, supplierChoice: id }))
  }

  // ── Step 3: services ────────────────────────────────────────────────────

  const toggleService = (id: string) => {
    clearFieldError('services')
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(id)
        ? prev.services.filter((service) => service !== id)
        : [...prev.services, id],
    }))
  }

  // ── Step 3: operating regions ───────────────────────────────────────────

  const toggleRegion = (region: string) => {
    clearFieldError('operatingRegions')
    setForm((prev) => ({
      ...prev,
      operatingRegions: prev.operatingRegions.includes(region)
        ? prev.operatingRegions.filter((item) => item !== region)
        : [...prev.operatingRegions, region],
    }))
  }

  // ── Step 4: required documents (ID + business certificate when applicable) ─

  /** Set a document slot's preview, dropping the object URL it replaces. */
  const setDocPreviewFor = (type: string, url: string) => {
    setDocPreviewByType((prev) => {
      const old = prev[type]
      if (old && old !== url) URL.revokeObjectURL(old)
      return { ...prev, [type]: url }
    })
  }

  const setDocStatusFor = (type: string, status: 'idle' | 'preparing' | 'ready') =>
    setDocStatusByType((prev) => ({ ...prev, [type]: status }))

  const setDocErrorFor = (type: string, message: string) =>
    setDocErrorByType((prev) => ({ ...prev, [type]: message }))

  // Keep the latest preview URLs reachable from the unmount cleanup, then drop
  // every one of them (the per-slot replace/remove paths already revoke theirs).
  useEffect(() => {
    previewsRef.current = docPreviewByType
  }, [docPreviewByType])

  useEffect(
    () => () => {
      Object.values(previewsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    },
    []
  )

  /** Upsert the SUPPLIER-owned document of a given type (ID, certificate, …). */
  const setDocumentFile = (type: string, file: File | null) => {
    clearFieldError('verificationDocuments')
    setDocErrorFor(type, '')
    setForm((prev) => {
      const others = prev.verificationDocuments.filter(
        (doc) => doc.ownerType !== 'SUPPLIER' || doc.type !== type
      )
      const existing = prev.verificationDocuments.find(
        (doc) => doc.ownerType === 'SUPPLIER' && doc.type === type
      )
      return {
        ...prev,
        verificationDocuments: [
          ...others,
          {
            key: existing?.key ?? `sup-${type}-${Math.random().toString(36).slice(2, 8)}`,
            type,
            ownerType: 'SUPPLIER' as const,
            file,
          },
        ],
      }
    })
  }

  /**
   * Validate, read and prepare the chosen document.
   *
   * The `preparing` state is real work, not a decoration: images are decoded,
   * and anything the upload pipeline can't take as-is (iPhone HEIC, or a photo
   * past the 10 MB limit) is re-encoded to JPEG here — so the supplier learns
   * about it now instead of after submitting the whole application.
   */
  const handleDocumentSelected = async (type: string, file: File | null) => {
    if (!file) return
    clearFieldError('verificationDocuments')
    setDocErrorFor(type, '')

    const isImage = file.type.startsWith('image/')
    if (!isImage && file.type !== 'application/pdf') {
      setDocStatusFor(type, 'idle')
      setDocumentFile(type, null)
      setDocErrorFor(type, 'Please upload a JPG, PNG or PDF of your document.')
      return
    }

    setDocStatusFor(type, 'preparing')
    let prepared = file

    if (isImage && typeof createImageBitmap !== 'undefined') {
      let bitmap: ImageBitmap | null = null
      try {
        // Decoding also proves the file really is an image.
        bitmap = await createImageBitmap(file)
      } catch {
        // Unreadable/unsupported image — handled below.
      }
      if (!bitmap) {
        setDocStatusFor(type, 'idle')
        setDocumentFile(type, null)
        setDocErrorFor(type, 'We could not read that image. Try another photo, or upload a PDF of the document.')
        return
      }

      const unsupportedFormat = !UPLOADABLE_IMAGE_TYPES.includes(file.type)
      const tooLarge = file.size > MAX_SUPPLIER_DOCUMENT_BYTES
      if (unsupportedFormat || tooLarge) {
        try {
          prepared = await reencodeImageAsJpeg(file, bitmap)
          showToast('Photo prepared for upload')
        } catch {
          bitmap.close()
          setDocStatusFor(type, 'idle')
          setDocumentFile(type, null)
          setDocErrorFor(type, 'We could not prepare that image for upload. Try a JPG, PNG or PDF of your document.')
          return
        }
      }
      bitmap.close()
    }

    if (prepared.size > MAX_SUPPLIER_DOCUMENT_BYTES) {
      setDocStatusFor(type, 'idle')
      setDocumentFile(type, null)
      setDocErrorFor(
        type,
        `That file is ${formatFileSize(prepared.size)}. The largest document we accept is ${formatFileSize(MAX_SUPPLIER_DOCUMENT_BYTES)} — please compress it or take a smaller photo.`
      )
      return
    }

    const previewUrl =
      prepared.type.startsWith('image/') && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(prepared)
        : ''

    setDocPreviewFor(type, previewUrl)
    setDocumentFile(type, prepared)
    setDocStatusFor(type, 'ready')
    const input = fileInputRefs.current[type]
    if (input) input.value = ''
  }

  const removeDocument = (type: string) => {
    setDocPreviewFor(type, '')
    setDocStatusFor(type, 'idle')
    setDocErrorFor(type, '')
    setDocumentFile(type, null)
    const input = fileInputRefs.current[type]
    if (input) input.value = ''
  }

  // ── Step 6 + submit ─────────────────────────────────────────────────────

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (submitted || loading || creatingAccount || savingPassword) return
    if (step !== STEP_REVIEW) {
      await handleContinue()
      return
    }

    const errors = validateSupplierStep(step, form, { hasSession, password, confirmPassword })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      if (errors['compliance.acceptedTerms']) {
        showToast(errors['compliance.acceptedTerms'])
        showNudge('standards')
      }
      scrollToFirstError(errors)
      return
    }

    setLoading(true)
    setUploadPercent(0)
    setError('')
    setFieldErrors({})

    try {
      // Pre-flight the upload count: the backend caps one request and answers
      // with a generic 400, which is not actionable for the supplier.
      const uploadCount = form.verificationDocuments.filter((doc) => doc.file).length
      if (uploadCount > MAX_SUPPLIER_APPLICATION_FILES) {
        const excess = uploadCount - MAX_SUPPLIER_APPLICATION_FILES
        throw new Error(
          `Your application includes ${uploadCount} files, but a single submission can include at most ${MAX_SUPPLIER_APPLICATION_FILES}. Please remove ${excess} file${excess === 1 ? '' : 's'} and submit again.`
        )
      }

      // Real upload progress for the documents (XHR under the hood) — a
      // multi-megabyte phone photo on mobile data takes a while.
      await applyAsSupplier(buildSupplierPayload(form), setUploadPercent)

      // Verify it actually persisted before celebrating — a silent failure
      // would leave the supplier polling a 404 with no feedback.
      const confirmation = await getSupplierApplicationStatus()
      if (!confirmation) {
        throw new Error(
          "Your application was received but couldn't be verified. Please try again or contact support — your draft was not lost."
        )
      }

      setSubmitted(true)
      clearSupplierApplicationDraft(draftUserId)
    } catch (err) {
      setError((err as Error)?.message || 'Failed to submit application. Please try again.')
    } finally {
      setLoading(false)
      setUploadPercent(null)
    }
  }

  const handleNextClick = () => {
    if (step === STEP_REVIEW) void handleSubmit()
    else void handleContinue()
  }

  // Celebrate the account going live with the same canvas-confetti burst the
  // supplier dashboard fires when a tour is submitted: a centre burst from the
  // top, then two angled side bursts a beat later.
  useEffect(() => {
    if (!submitted) return

    confetti({
      particleCount: 90,
      spread: 75,
      angle: 270,
      startVelocity: 42,
      gravity: 0.9,
      ticks: 220,
      scalar: 0.9,
      origin: { x: 0.5, y: 0 },
      colors: CONFETTI_COLORS,
      zIndex: 200,
    })

    const timer = window.setTimeout(() => {
      confetti({
        particleCount: 55,
        spread: 60,
        angle: 300,
        startVelocity: 38,
        origin: { x: 0.15, y: 0.1 },
        colors: CONFETTI_COLORS,
        zIndex: 200,
      })
      confetti({
        particleCount: 55,
        spread: 60,
        angle: 240,
        startVelocity: 38,
        origin: { x: 0.85, y: 0.1 },
        colors: CONFETTI_COLORS,
        zIndex: 200,
      })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      confetti.reset()
    }
  }, [submitted])

  const handleViewStatus = () => onSubmitted?.()

  // Auto-accept: the supplier account is live the moment the application is
  // submitted, so walk them straight to their dashboard. The button below stays
  // as a manual fallback for anyone who wants to read this screen first, and
  // `onSubmitted` (the parent's status refresh) is what triggers the SSO
  // redirect once the account reads back as ACTIVE.
  const autoRedirected = useRef(false)
  useEffect(() => {
    if (!submitted || !onSubmitted || autoRedirected.current) return
    const timer = window.setTimeout(() => {
      autoRedirected.current = true
      onSubmitted()
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [submitted, onSubmitted])

  // ── Derived display values ──────────────────────────────────────────────

  const selectedOption = supplierTypeOption(form.supplierChoice)
  const isIndividual = selectedOption?.kind === 'individual'
  const requiredDocs = requiredSupplierDocuments(form.supplierChoice)
  const requiredDocCount = requiredDocs.length
  const uploadedRequiredCount = requiredDocs.filter((requirement) =>
    form.verificationDocuments.some(
      (doc) => doc.ownerType === 'SUPPLIER' && doc.type === requirement.type && doc.file
    )
  ).length
  const quickVerifyTitle =
    requiredDocCount === 1 ? '1 document required' : `${requiredDocCount} documents required`
  const quickVerifySubtitle = "That's all we need from you for now."
  const laterDocs = laterDocumentsFor(form.supplierChoice, form.services)
  const serviceSummary = serviceLabels(form.services)
  const payoutMethodLabel = PAYOUT_METHODS.find((method) => method.id === form.payout.method)?.label ?? ''
  const payoutScheduleLabel =
    PAYOUT_SCHEDULES.find((schedule) => schedule.id === form.payout.schedule)?.label ?? ''
  const sidebarIndex = submitted ? STEP_SUCCESS : step

  // Document upload states: `isDocUploading` is the real submit upload, and
  // 100% only means the bytes are sent — the server still stores them.
  const isDocUploading = uploadPercent !== null
  const docUploadPercent = uploadPercent ?? 0
  const docUploadFinishing = docUploadPercent >= 100

  const visibleStep = Math.min(step + 1, STEPS_COUNT)
  const progressPercent = submitted ? 100 : Math.min(100, Math.round((visibleStep / STEPS_COUNT) * 100))
  const progressText = submitted ? 'Complete' : `Step ${visibleStep} of ${STEPS_COUNT}`
  const nextLabel = loading
    ? isDocUploading
      ? docUploadFinishing
        ? 'Finalising your profile…'
        : `Uploading documents… ${docUploadPercent}%`
      : 'Submitting…'
    : creatingAccount
      ? 'Creating your account…'
      : savingPassword
        ? 'Saving password…'
        : step === STEP_REVIEW
          ? 'Create supplier profile'
          : 'Continue'

  // ── Step renderers ──────────────────────────────────────────────────────

  const renderAccount = () => (
    <section className={`form-step${step === STEP_ACCOUNT ? ' active' : ''}`}>
      <StepHeading
        title="Create your supplier account"
        description="Start with the basics. You can use the same account to list tours, activities, airport transfers and other transport services on TravioGhana."
        error={error}
        onSignIn={signInHint ? () => onOpenAuth?.('signin') : undefined}
      />
      <div className="grid">
        <Field path="account.firstName" label="First name" required error={fieldErrors['account.firstName']}>
          <input
            type="text"
            placeholder="e.g. Peter"
            autoComplete="given-name"
            value={form.account.firstName}
            onChange={(event) => updateAccount('firstName', event.target.value)}
          />
        </Field>
        <Field path="account.lastName" label="Last name" required error={fieldErrors['account.lastName']}>
          <input
            type="text"
            placeholder="e.g. Mensah"
            autoComplete="family-name"
            value={form.account.lastName}
            onChange={(event) => updateAccount('lastName', event.target.value)}
          />
        </Field>
        <Field path="account.email" label="Email address" required error={fieldErrors['account.email']}>
          <input
            type="email"
            placeholder="name@company.com"
            autoComplete="email"
            readOnly={hasSession}
            value={form.account.email}
            onChange={(event) => updateAccount('email', event.target.value)}
          />
        </Field>
        <Field path="account.phone" label="Phone / WhatsApp number" required error={fieldErrors['account.phone']}>
          {/* Same number input as the booking checkout: country calling code +
              national number, digits only, validated with libphonenumber-js. */}
          <div className="phone-field">
            <SelectInput
              value={form.account.phoneCountryCode || DEFAULT_COUNTRY_CODE}
              onChange={(event) => updateAccount('phoneCountryCode', event.target.value)}
              options={COUNTRY_CODES}
              ariaLabel="Country calling code"
            />
            <TextInput
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              ariaLabel="Phone / WhatsApp number"
              placeholder="e.g. 024 123 4567"
              value={form.account.phone}
              onChange={(event) => updateAccount('phone', event.target.value.replace(/\D/g, ''))}
              valid={isValidPhoneInput(
                form.account.phoneCountryCode || DEFAULT_COUNTRY_CODE,
                form.account.phone
              )}
            />
          </div>
        </Field>
        {showPasswordFields && (
          <>
            <Field
              path="account.password"
              label="Create password"
              required={!hasSession}
              optional={hasSession}
              error={fieldErrors['account.password']}
            >
              <input
                type="password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  clearFieldError('account.password')
                }}
              />
            </Field>
            <Field
              path="account.confirmPassword"
              label="Confirm password"
              required={!hasSession}
              optional={hasSession}
              error={fieldErrors['account.confirmPassword']}
            >
              <input
                type="password"
                placeholder="Repeat password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  clearFieldError('account.confirmPassword')
                }}
              />
            </Field>
          </>
        )}
      </div>
      {hasSession && (
        <div className="notice">
          <Lock size={15} aria-hidden="true" />
          <span>
            You&rsquo;re signed in as <strong>{user?.email}</strong>.
            {canSetPassword
              ? ' You signed in with Google, so you can create a password for email sign-in below — or leave it blank and keep using Google.'
              : ' No password is needed here — this application will be attached to that account.'}
          </span>
        </div>
      )}
      <div className="notice">
        <Lock size={15} aria-hidden="true" />
        <span>
          Your details are used to manage your supplier account and communicate about bookings,
          verification and payouts.
        </span>
      </div>
    </section>
  )

  const renderType = () => (
    <section className={`form-step${step === STEP_TYPE ? ' active' : ''}`}>
      <StepHeading
        title="How are you joining TravioGhana?"
        description="Select the option that best describes you. This helps us show only the information and documents that are relevant to your type of business."
        error={error}
      />
      <div className="cards single-select" data-name="supplierType" data-field="supplierChoice">
        {SUPPLIER_TYPE_OPTIONS.map((option) => (
          <ChoiceCard
            key={option.id}
            icon={option.icon}
            title={option.label}
            description={option.description}
            selected={form.supplierChoice === option.id}
            onClick={() => selectSupplierType(option.id)}
          />
        ))}
      </div>
      <ErrorText message={fieldErrors['supplierChoice']} />
    </section>
  )

  const renderProfile = () => (
    <section className={`form-step${step === STEP_PROFILE ? ' active' : ''}`}>
      <StepHeading
        title={isIndividual ? 'Tell us about yourself' : 'Tell us about your business'}
        description={
          isIndividual
            ? 'We need a few personal details to verify you as an independent supplier.'
            : 'Add your business profile. Formal registration details can be completed later where applicable.'
        }
        error={error}
      />

      <div id={isIndividual ? 'individualProfile' : 'businessProfile'}>
        <div className="profile-stack">
          {isIndividual ? (
            <>
              <div className="form-block">
                <div className="form-block-head">
                  <div>
                    <h3>Identity details</h3>
                    <p>Keep this exactly as it appears on your government-issued ID.</p>
                  </div>
                  <span className="form-block-badge">Individual profile</span>
                </div>
                <div className="profile-grid">
                  <Field path="profile.firstName" label="First name" required error={fieldErrors['profile.firstName']}>
                    <input
                      type="text"
                      placeholder="As shown on your ID"
                      value={form.profile.firstName}
                      onChange={(event) => updateProfile('firstName', event.target.value)}
                    />
                  </Field>
                  <Field path="profile.lastName" label="Last name" required error={fieldErrors['profile.lastName']}>
                    <input
                      type="text"
                      placeholder="As shown on your ID"
                      value={form.profile.lastName}
                      onChange={(event) => updateProfile('lastName', event.target.value)}
                    />
                  </Field>
                  <Field
                    path="profile.dateOfBirth"
                    label="Date of birth"
                    required
                    error={fieldErrors['profile.dateOfBirth']}
                  >
                    <input
                      type="date"
                      value={form.profile.dateOfBirth}
                      onChange={(event) => updateProfile('dateOfBirth', event.target.value)}
                    />
                  </Field>
                  <Field path="profile.idType" label="ID type" required error={fieldErrors['profile.idType']}>
                    <select
                      value={form.profile.idType}
                      onChange={(event) => updateProfile('idType', event.target.value)}
                    >
                      <option value="">Select ID type</option>
                      {ID_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="wide">
                    <Field
                      path="profile.idNumber"
                      label="ID number"
                      required
                      error={fieldErrors['profile.idNumber']}
                    >
                      <input
                        type="text"
                        placeholder="Enter the number shown on your ID"
                        value={form.profile.idNumber}
                        onChange={(event) => updateProfile('idNumber', event.target.value)}
                      />
                    </Field>
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
                  <div className="wide">
                    <Field
                      path="profile.address"
                      label="Address / GhanaPost GPS"
                      required
                      error={fieldErrors['profile.address']}
                    >
                      <input
                        type="text"
                        placeholder="e.g. GA-123-4567 or street / area address"
                        value={form.profile.address}
                        onChange={(event) => updateProfile('address', event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field path="profile.region" label="Region" required error={fieldErrors['profile.region']}>
                    <select
                      value={form.profile.region}
                      onChange={(event) => updateProfile('region', event.target.value)}
                    >
                      <option value="">Select region</option>
                      {GHANA_REGIONS.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field path="profile.city" label="City / Town" required error={fieldErrors['profile.city']}>
                    <input
                      type="text"
                      placeholder="e.g. Accra"
                      value={form.profile.city}
                      onChange={(event) => updateProfile('city', event.target.value)}
                    />
                  </Field>
                </div>
                <div className="subtle-divider" />
                <Field
                  path="profile.brandName"
                  label="Business / Brand name"
                  required
                  error={fieldErrors['profile.brandName']}
                >
                  <input
                    type="text"
                    placeholder="Your public brand or business name"
                    value={form.profile.brandName}
                    onChange={(event) => updateProfile('brandName', event.target.value)}
                  />
                </Field>
              </div>

              <div className="compact-note">
                <Lock size={15} aria-hidden="true" />
                <span>
                  Your personal details are used for identity verification, account security,
                  compliance and payouts.
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="form-block">
                <div className="form-block-head">
                  <div>
                    <h3>Business profile</h3>
                    <p>Keep this part simple. Start with the name customers know you by and your public contact details.</p>
                  </div>
                  <span className="form-block-badge">Business profile</span>
                </div>
                <div className="profile-grid">
                  <Field
                    path="profile.brandName"
                    label="Business / Brand name"
                    required
                    error={fieldErrors['profile.brandName']}
                  >
                    <input
                      type="text"
                      placeholder="e.g. Expedition-Go Tours"
                      value={form.profile.brandName}
                      onChange={(event) => updateProfile('brandName', event.target.value)}
                    />
                  </Field>
                  <Field
                    path="profile.yearEstablished"
                    label="Year established"
                    required
                    error={fieldErrors['profile.yearEstablished']}
                  >
                    <input
                      type="number"
                      min={1900}
                      max={2100}
                      placeholder="e.g. 2023"
                      value={form.profile.yearEstablished}
                      onChange={(event) => updateProfile('yearEstablished', event.target.value)}
                    />
                  </Field>
                  <Field path="profile.website" label="Website" optional>
                    <input
                      type="url"
                      placeholder="https://"
                      value={form.profile.website}
                      onChange={(event) => updateProfile('website', event.target.value)}
                    />
                  </Field>
                  <div className="wide">
                    <Field path="profile.socialLinks" label="Social Media Links" optional>
                      <SocialLinksManager
                        value={form.profile.socialLinks}
                        onChange={(next) => {
                          clearFieldError('profile.socialLinks')
                          setForm((prev) => ({
                            ...prev,
                            profile: { ...prev.profile, socialLinks: next },
                          }))
                        }}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="form-block">
                <div className="form-block-head">
                  <div>
                    <h3>Business registration details</h3>
                    <p>
                      Add your formal business details if you have them now. You can still continue if
                      some information will be completed later.
                    </p>
                  </div>
                  <span className="form-block-badge">Legal details</span>
                </div>
                <div className="profile-grid">
                  <Field
                    path="profile.legalBusinessName"
                    label="Legal business name"
                    required
                    error={fieldErrors['profile.legalBusinessName']}
                  >
                    <input
                      type="text"
                      placeholder="Registered legal name"
                      value={form.profile.legalBusinessName}
                      onChange={(event) => updateProfile('legalBusinessName', event.target.value)}
                    />
                  </Field>
                  <Field
                    path="profile.registrationNumber"
                    label="Business registration number"
                    required
                    error={fieldErrors['profile.registrationNumber']}
                  >
                    <input
                      type="text"
                      placeholder="Registration number"
                      value={form.profile.registrationNumber}
                      onChange={(event) => updateProfile('registrationNumber', event.target.value)}
                    />
                  </Field>
                  <div className="wide">
                    <Field path="profile.tin" label="TIN" optional>
                      <input
                        type="text"
                        placeholder="Tax identification number"
                        value={form.profile.tin}
                        onChange={(event) => updateProfile('tin', event.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="form-block">
                <div className="form-block-head">
                  <div>
                    <h3>Business address</h3>
                    <p>
                      Use your business location, street address or GhanaPost GPS code in the format
                      that best matches how addresses are used in Ghana.
                    </p>
                  </div>
                  <span className="form-block-badge">Location</span>
                </div>
                <div className="profile-grid">
                  <div className="wide">
                    <Field
                      path="profile.address"
                      label="Business address / GhanaPost GPS"
                      required
                      error={fieldErrors['profile.address']}
                    >
                      <input
                        type="text"
                        placeholder="e.g. GA-123-4567 or street / area address"
                        value={form.profile.address}
                        onChange={(event) => updateProfile('address', event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field path="profile.region" label="Region" required error={fieldErrors['profile.region']}>
                    <select
                      value={form.profile.region}
                      onChange={(event) => updateProfile('region', event.target.value)}
                    >
                      <option value="">Select region</option>
                      {GHANA_REGIONS.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field path="profile.city" label="City / Town" required error={fieldErrors['profile.city']}>
                    <input
                      type="text"
                      placeholder="e.g. Accra, Kumasi, Cape Coast"
                      value={form.profile.city}
                      onChange={(event) => updateProfile('city', event.target.value)}
                    />
                  </Field>
                </div>
              </div>

              <div className="form-block tax-responsibility-block">
                <div className="form-block-head">
                  <div>
                    <h3>
                      Tax responsibility <span className="required-accent" title="Required">*</span>
                    </h3>
                    <p>Please review the note below and confirm once to continue.</p>
                  </div>
                </div>

                <div className="compact-note tax-note">
                  TravioGhana provides the marketplace and payout service. Your business remains
                  responsible for its own applicable tax registration, declarations, payments, levies
                  and statutory obligations, except where TravioGhana is legally required to withhold
                  or remit an amount.
                </div>

                <label
                  className={`tax-accept-box${nudge === 'tax' ? ' needs-attention' : ''}`}
                  id="taxAcceptBox"
                  data-field="taxAcknowledged"
                >
                  <input
                    type="checkbox"
                    id="businessTaxAck"
                    checked={form.taxAcknowledged}
                    onChange={(event) => {
                      clearFieldError('taxAcknowledged')
                      setForm((prev) => ({ ...prev, taxAcknowledged: event.target.checked }))
                    }}
                  />
                  <span className="tax-accept-check" aria-hidden="true" />
                  <span className="tax-accept-copy">
                    <strong>I understand and accept my tax responsibility.</strong>
                    <small>
                      I understand that I / my business am responsible for managing and paying my own
                      applicable taxes and statutory obligations.
                    </small>
                  </span>
                </label>
                <ErrorText message={fieldErrors['taxAcknowledged']} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h3>
            Where do you mainly operate? <span className="required-accent" title="Required">*</span>
          </h3>
          <span>Select at least one region</span>
        </div>
        <div className="pill-wrap multi-select" id="operatingRegions" data-field="operatingRegions">
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
        <ErrorText message={fieldErrors['operatingRegions']} />
      </div>
    </section>
  )

  const renderServices = () => (
    <section className={`form-step${step === STEP_SERVICES ? ' active' : ''}`}>
      <StepHeading
        title="What would you like to sell?"
        description="You can choose more than one. Your TravioGhana supplier account can manage tours, activities and transport services from one dashboard."
        error={error}
      />
      <div className="cards multi-card-select" id="serviceCards" data-field="services">
        {SERVICE_OPTIONS.map((option) => (
          <ChoiceCard
            key={option.id}
            icon={option.icon}
            title={option.label}
            description={option.description}
            selected={form.services.includes(option.id)}
            onClick={() => toggleService(option.id)}
          />
        ))}
      </div>
      <ErrorText message={fieldErrors['services']} />
    </section>
  )

  const renderVerification = () => (
    <section className={`form-step${step === STEP_VERIFICATION ? ' active' : ''}`} id="verificationStep">
      <StepHeading
        title="Quick verification"
        description={
          requiredDocCount === 1
            ? "We only need one document to get your supplier account started. You can create your listings next, and we'll ask for any service-specific documents only when they become relevant."
            : "We need your ID and your business registration certificate to get your supplier account started. You can create your listings next, and we'll ask for any service-specific documents only when they become relevant."
        }
        error={error}
      />

      <div className="quick-verify-shell">
        <div className="quick-verify-progress">
          <div className="quick-verify-badge">
            <ShieldCheck size={21} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div>
            <span>QUICK START</span>
            <strong id="quickVerifyTitle">{quickVerifyTitle}</strong>
            <p id="quickVerifySubtitle">{quickVerifySubtitle}</p>
          </div>
        </div>

        {requiredDocs.map((requirement) => {
          const doc = form.verificationDocuments.find(
            (entry) => entry.ownerType === 'SUPPLIER' && entry.type === requirement.type
          )
          const file = doc?.file ?? null
          const preview = docPreviewByType[requirement.type] ?? ''
          const status = docStatusByType[requirement.type] ?? 'idle'
          const preparing = status === 'preparing'
          const cardError = docErrorByType[requirement.type] ?? ''
          const cardTitle = preparing
            ? 'Preparing your document…'
            : isDocUploading
              ? 'Uploading your document…'
              : requirement.uploadLabel
          const cardHint = preparing
            ? 'Checking the file — this only takes a moment.'
            : isDocUploading
              ? docUploadFinishing
                ? 'Uploaded — finishing up your application.'
                : `${docUploadPercent}% of your document uploaded.`
              : `JPG, PNG or PDF · up to ${formatFileSize(MAX_SUPPLIER_DOCUMENT_BYTES)}`
          const cardFile = file
            ? `${file.name}${file.size ? ` · ${formatFileSize(file.size)}` : ''}`
            : 'No file selected'

          return (
            <div
              className="section quick-document-section"
              data-field="verificationDocuments"
              key={requirement.type}
            >
              <div className="quick-document-copy">
                <span className="stage-eyebrow required-now-accent">REQUIRED NOW</span>
                <h3 id={`primaryDocumentTitle-${requirement.type}`}>{requirement.title}</h3>
                <p id={`primaryDocumentDescription-${requirement.type}`}>{requirement.description}</p>
              </div>

              <label
                className={`quick-upload-card document-upload${file ? ' uploaded' : ''}${preparing ? ' is-preparing' : ''}${isDocUploading ? ' is-uploading' : ''}${cardError ? ' has-error' : ''}`}
                aria-busy={preparing || isDocUploading}
              >
                <div className="quick-upload-icon">
                  {preparing || isDocUploading ? (
                    <LoaderCircle className="doc-spinner" size={22} strokeWidth={2} aria-hidden="true" />
                  ) : preview ? (
                    <img className="doc-thumb" src={preview} alt="" />
                  ) : file ? (
                    <FileText size={22} strokeWidth={1.7} aria-hidden="true" />
                  ) : (
                    <IdCard size={22} strokeWidth={1.7} aria-hidden="true" />
                  )}
                </div>
                <div className="quick-upload-text">
                  <strong>{cardTitle}</strong>
                  <span className="doc-upload-hint" aria-live="polite">
                    {cardHint}
                  </span>
                  <small className="upload-file-name">{cardFile}</small>
                  {isDocUploading && (
                    <div
                      className="doc-progress"
                      role="progressbar"
                      aria-label="Document upload progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={docUploadPercent}
                    >
                      <span className="doc-progress-fill" style={{ width: `${docUploadPercent}%` }} />
                    </div>
                  )}
                </div>
                <div className="quick-upload-action">
                  <span className="upload-action-label">
                    {preparing
                      ? 'Preparing…'
                      : isDocUploading
                        ? `${docUploadPercent}%`
                        : file
                          ? 'Replace file'
                          : 'Choose file'}
                  </span>
                  {!preparing && !isDocUploading && <Upload size={15} strokeWidth={2} aria-hidden="true" />}
                </div>
                <input
                  ref={(element) => {
                    fileInputRefs.current[requirement.type] = element
                  }}
                  type="file"
                  hidden
                  accept={DOCUMENT_ACCEPT}
                  onChange={(event) =>
                    void handleDocumentSelected(requirement.type, event.target.files?.[0] ?? null)
                  }
                />
              </label>

              {file && status === 'ready' && !isDocUploading && (
                <div className="doc-upload-footer">
                  <span>Uploads securely when you submit your application.</span>
                  <button
                    type="button"
                    className="doc-remove-btn"
                    onClick={(event) => {
                      // The card is a <label>, so stop it re-opening the picker.
                      event.preventDefault()
                      event.stopPropagation()
                      removeDocument(requirement.type)
                    }}
                  >
                    <X size={12} strokeWidth={2.6} aria-hidden="true" />
                    Remove
                  </button>
                </div>
              )}

              {cardError && <ErrorText message={cardError} />}
            </div>
          )
        })}

        <ErrorText message={fieldErrors['verificationDocuments']} />

        <div className="quick-done-card">
          <div className="quick-done-icon">
            <CircleCheckBig size={19} strokeWidth={1.9} aria-hidden="true" />
          </div>
          <div>
            <strong>That&rsquo;s all we need for now.</strong>
            <p>
              You&rsquo;re ready to continue. Start creating your listings now, and we&rsquo;ll guide
              you through any additional verification only when it becomes relevant.
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
            <ChevronDown className="later-chevron" size={18} aria-hidden="true" />
          </button>

          <div className={`later-documents-body${laterDocsOpen ? ' open' : ''}`} id="laterDocumentsBody">
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
                  <div className="later-dot">
                    <Check size={13} strokeWidth={3} aria-hidden="true" />
                  </div>
                  <div>
                    <strong>No extra documents right now</strong>
                    <span>
                      If a future listing needs additional verification, TravioGhana will ask you at
                      that point.
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="later-documents-note">
              <Info size={16} strokeWidth={1.9} aria-hidden="true" />
              <span>
                You do not need to upload these during registration. TravioGhana will only ask when
                they are relevant to the service you are about to publish or operate.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )

  const renderPayout = () => (
    <section className={`form-step${step === STEP_PAYOUT ? ' active' : ''}`}>
      <StepHeading
        title="How should we pay you?"
        description="Choose how you would like to receive your TravioGhana earnings and how often you want payouts to be generated. You can complete or change these details later from your supplier dashboard."
        error={error}
      />

      <div className="section">
        <div className="section-title">
          <h3>
            Payout method <span className="required-accent" title="Required">*</span>
          </h3>
          <span>Choose one</span>
        </div>
        <div
          className="cards single-select"
          data-name="payoutType"
          id="payoutMethodCards"
          style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}
        >
          {PAYOUT_METHODS.map((method) => (
            <ChoiceCard
              key={method.id}
              icon={method.icon}
              title={method.label}
              description={method.description}
              selected={form.payout.method === method.id}
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  payout: {
                    ...prev.payout,
                    method: method.id,
                    ...(method.id === 'momo' ? { currency: 'GHS' } : {}),
                  },
                }))
              }}
            />
          ))}
        </div>
      </div>

      <div className="section" id="bankPayoutFields" style={{ display: form.payout.method === 'bank' ? 'block' : 'none' }}>
        <div className="section-title">
          <h3>Bank transfer details</h3>
          <span>Can be completed later</span>
        </div>
        <div className="grid one">
          <Field path="payout.bankAccountName" label="Account name" optional>
            <input
              type="text"
              placeholder="Name on the bank account"
              value={form.payout.bankAccountName}
              onChange={(event) => updatePayout('bankAccountName', event.target.value)}
            />
          </Field>
        </div>
        <div className="grid" style={{ marginTop: 16 }}>
          <Field path="payout.bankAccountNumber" label="Account number" optional error={fieldErrors['payout.bankAccountNumber']}>
            <input
              type="text"
              placeholder="Enter account number"
              value={form.payout.bankAccountNumber}
              onChange={(event) => updatePayout('bankAccountNumber', event.target.value)}
            />
          </Field>
          <Field path="payout.bankName" label="Bank name" optional>
            <input
              type="text"
              placeholder="e.g. Ecobank Ghana"
              value={form.payout.bankName}
              onChange={(event) => updatePayout('bankName', event.target.value)}
            />
          </Field>
          <Field path="payout.bankCountry" label="Bank country" optional>
            <input
              type="text"
              placeholder="Ghana"
              value={form.payout.bankCountry}
              onChange={(event) => updatePayout('bankCountry', event.target.value)}
            />
          </Field>
          <Field path="payout.currency" label="Currency" optional>
            <select
              value={form.payout.currency}
              onChange={(event) => updatePayout('currency', event.target.value)}
            >
              {PAYOUT_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="section" id="paypalPayoutFields" style={{ display: form.payout.method === 'paypal' ? 'block' : 'none' }}>
        <div className="section-title">
          <h3>PayPal details</h3>
          <span>Can be completed later</span>
        </div>
        <div className="grid">
          <Field path="payout.paypalAccountName" label="PayPal account name" optional>
            <input
              type="text"
              placeholder="Name on your PayPal account"
              value={form.payout.paypalAccountName}
              onChange={(event) => updatePayout('paypalAccountName', event.target.value)}
            />
          </Field>
          <Field path="payout.paypalEmail" label="PayPal email address" optional error={fieldErrors['payout.paypalEmail']}>
            <input
              type="email"
              placeholder="name@example.com"
              value={form.payout.paypalEmail}
              onChange={(event) => updatePayout('paypalEmail', event.target.value)}
            />
          </Field>
        </div>
        <div className="notice" style={{ marginTop: 16 }}>
          <Info size={15} aria-hidden="true" />
          <span>
            Make sure the email address is linked to an active PayPal account that can receive
            payments.
          </span>
        </div>
      </div>

      <div className="section" id="momoPayoutFields" style={{ display: form.payout.method === 'momo' ? 'block' : 'none' }}>
        <div className="section-title">
          <h3>Mobile money details</h3>
          <span>Can be completed later</span>
        </div>
        <div className="grid-2">
          <Field path="payout.momoAccountName" label="Account holder name" optional>
            <input
              type="text"
              placeholder="Name registered on the wallet"
              value={form.payout.momoAccountName}
              onChange={(event) => updatePayout('momoAccountName', event.target.value)}
            />
          </Field>
          <Field path="payout.momoNetwork" label="Mobile money network" optional>
            <select
              value={form.payout.momoNetwork}
              onChange={(event) => updatePayout('momoNetwork', event.target.value)}
            >
              <option value="">Select network</option>
              {MOMO_NETWORKS.map((network) => (
                <option key={network} value={network}>
                  {network}
                </option>
              ))}
            </select>
          </Field>
          <Field path="payout.momoNumber" label="Mobile money number" optional error={fieldErrors['payout.momoNumber']}>
            <input
              type="tel"
              placeholder="e.g. 024 000 0000"
              value={form.payout.momoNumber}
              onChange={(event) => updatePayout('momoNumber', event.target.value)}
            />
          </Field>
          <Field path="payout.momoCurrency" label="Currency">
            <select defaultValue="GHS" disabled>
              <option value="GHS">GHS</option>
            </select>
          </Field>
        </div>
        <div className="notice" style={{ marginTop: 16 }}>
          <Info size={15} aria-hidden="true" />
          <span>
            The mobile money account must be active and able to receive payments. The registered
            account name should match the supplier or authorised payout recipient.
          </span>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <div>
            <h3 style={{ marginBottom: 5 }}>
              Payout schedule <span className="required-accent" title="Required">*</span>
            </h3>
            <span>Choose how often your completed-booking earnings are paid out automatically.</span>
          </div>
          <span>Choose one</span>
        </div>
        <div className="cards single-select" data-name="payoutSchedule" id="payoutScheduleCards">
          {PAYOUT_SCHEDULES.map((schedule) => (
            <ChoiceCard
              key={schedule.id}
              icon={schedule.icon}
              title={schedule.label}
              description={
                <>
                  <strong>{schedule.lead}</strong>
                  <br />
                  <br />
                  {schedule.description}
                </>
              }
              selected={form.payout.schedule === schedule.id}
              onClick={() => setForm((prev) => ({ ...prev, payout: { ...prev.payout, schedule: schedule.id } }))}
            />
          ))}
        </div>
        <div className="notice" style={{ marginTop: 16 }}>
          <Info size={15} aria-hidden="true" />
          <span>
            Changes to your payout schedule can take effect from the start of the next payout cycle
            so an active cycle is not split.
          </span>
        </div>
      </div>

      <div className="section">
        <div className="toggle-row">
          <div className="toggle-copy">
            <strong>Use this as the primary payout method</strong>
            <span>You can change your payout method and schedule later from your supplier dashboard.</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.primaryPayoutPreference}
            aria-label="Use this as the primary payout method"
            className={`switch${form.primaryPayoutPreference ? ' on' : ''}`}
            onClick={() =>
              setForm((prev) => ({ ...prev, primaryPayoutPreference: !prev.primaryPayoutPreference }))
            }
          >
            <span />
          </button>
        </div>
      </div>
    </section>
  )

  const renderReview = () => (
    <section className={`form-step${step === STEP_REVIEW ? ' active' : ''}`}>
      <StepHeading
        title="Review your setup"
        description="You're almost ready. Review the information below and confirm the supplier standards before creating your TravioGhana supplier profile."
        error={error}
      />

      <div className="summary">
        <div className="summary-card">
          <span>Account</span>
          <strong>Contact details added</strong>
        </div>
        <div className="summary-card">
          <span>Supplier type</span>
          <strong id="summarySupplier">{selectedOption?.label ?? 'Not selected'}</strong>
        </div>
        <div className="summary-card">
          <span>Profile</span>
          <strong>Ghana supplier profile</strong>
        </div>
        <div className="summary-card">
          <span>Services</span>
          <strong id="summaryServices">{serviceSummary.length ? serviceSummary.join(', ') : 'Not selected'}</strong>
        </div>
        <div className="summary-card">
          <span>Verification</span>
          <strong id="summaryVerification">
            {uploadedRequiredCount > 0
              ? `${uploadedRequiredCount} document${uploadedRequiredCount === 1 ? '' : 's'} uploaded`
              : 'Can be completed later'}
          </strong>
        </div>
        <div className="summary-card">
          <span>Payout</span>
          <strong id="summaryPayout">
            {payoutMethodLabel ? `${payoutMethodLabel} · ${payoutScheduleLabel}` : 'Can be completed later'}
          </strong>
        </div>
      </div>

      <div className="section supplier-standards-section">
        <div className="section-title">
          <div>
            <h3>
              Review &amp; accept <span className="required-accent" title="Required">*</span>
            </h3>
            <span>Please review the supplier standards below. You only need to confirm once to continue.</span>
          </div>
        </div>

        <div className="standards-list">
          {STANDARDS.map((standard) => (
            <div className="standard-item" key={standard.title}>
              <div className="standard-icon">
                <Check size={14} strokeWidth={3} aria-hidden="true" />
              </div>
              <div className="standard-copy">
                <strong>{standard.title}</strong>
                <span>{standard.text}</span>
              </div>
            </div>
          ))}
        </div>

        <label
          className={`accept-all-box${nudge === 'standards' ? ' needs-attention' : ''}`}
          data-field="compliance.acceptedTerms"
        >
          <input
            type="checkbox"
            id="acceptAllStandards"
            checked={form.compliance.acceptedTerms}
            onChange={(event) => {
              clearFieldError('compliance.acceptedTerms')
              setForm((prev) => ({
                ...prev,
                compliance: {
                  acceptedTerms: event.target.checked,
                  agreedToPayoutTerms: event.target.checked,
                },
              }))
            }}
          />
          <span className="accept-all-check" aria-hidden="true" />
          <span className="accept-all-copy">
            <strong>I have read and agree to all of the supplier standards above.</strong>
            <small>
              This includes the TravioGhana Supplier Terms, information processing and verification,
              and distribution terms.
            </small>
          </span>
        </label>
        <ErrorText message={fieldErrors['compliance.acceptedTerms']} />
      </div>
    </section>
  )

  const renderSuccess = () => (
    <section className={`form-step${submitted ? ' active' : ''}`}>
      <div className="success" id="successScreen">
        <div className="success-shell">
          <div className="success-badge">
            <CircleCheckBig size={14} strokeWidth={2.2} aria-hidden="true" />
            Supplier setup complete
          </div>
          <div className="success-icon">
            <Check size={34} strokeWidth={2.6} aria-hidden="true" />
          </div>
          <h2>Your supplier profile is ready</h2>
          <p>
            Welcome to TravioGhana. Your supplier account has been created successfully and you can
            now open your supplier dashboard to complete your setup, manage verification and start
            creating listings.
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

          <button type="button" className="btn primary success-dashboard-btn" onClick={handleViewStatus}>
            Open Supplier Dashboard
          </button>
          <p className="success-redirect-note" role="status">
            Taking you to your supplier dashboard&hellip;
          </p>
        </div>
      </div>
    </section>
  )

  // ── Shell ───────────────────────────────────────────────────────────────

  return (
    <div
      className={`srp-page${submitted ? ' completion-screen' : step === STEP_ACCOUNT ? ' first-registration-step' : ''}`}
    >
      <div className="shell">
        <aside className="sidebar panel">
          <div className="brand">
            <img className="brand-logo" src={supplierLogo} alt="TravioGhana" />
          </div>

          <div className="intro-card">
            <h2>Start selling experiences across Ghana.</h2>
            <p>Create one supplier account for tours, activities, transfers and transport services.</p>
          </div>

          <ol className="steps" id="sidebarSteps" ref={sidebarRef}>
            {SIDEBAR_STEPS.map((item, index) => (
              <li
                key={item.title}
                className={`step-item${index === sidebarIndex ? ' active' : ''}${index < sidebarIndex ? ' done' : ''}`}
                aria-current={index === sidebarIndex ? 'step' : undefined}
              >
                <div className="step-dot">{index + 1}</div>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                </div>
              </li>
            ))}
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
                <span id="progressPercent">{progressPercent}%</span>
              </div>
              <div className="progress">
                <div id="progressBar" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>

          <form id="supplierForm" noValidate onSubmit={handleSubmit}>
            {renderAccount()}
            {renderType()}
            {renderProfile()}
            {renderServices()}
            {renderVerification()}
            {renderPayout()}
            {renderReview()}
            {renderSuccess()}

            {isDocUploading && (
              <div className="upload-progress-strip" role="status" aria-live="polite">
                <div className="upload-progress-meta">
                  <span>
                    {docUploadFinishing
                      ? 'Document uploaded — finalising your application…'
                      : 'Uploading your document…'}
                  </span>
                  <span>{docUploadPercent}%</span>
                </div>
                <div
                  className="progress"
                  role="progressbar"
                  aria-label="Application upload progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={docUploadPercent}
                >
                  <div style={{ width: `${Math.max(docUploadPercent, 6)}%` }} />
                </div>
              </div>
            )}

            <div className="actions" id="actions" style={submitted ? { display: 'none' } : undefined}>
              <button
                type="button"
                className="btn secondary"
                id="backBtn"
                style={{ visibility: step === STEP_ACCOUNT || submitted ? 'hidden' : 'visible' }}
                onClick={handleBack}
                disabled={loading || creatingAccount || savingPassword}
              >
                Back
              </button>
              <button
                type="button"
                className="btn primary"
                id="nextBtn"
                onClick={handleNextClick}
                disabled={loading || creatingAccount || savingPassword}
              >
                {nextLabel}
              </button>
            </div>
          </form>
        </main>
      </div>

      <div className={`toast${toast ? ' show' : ''}`} id="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  )
}
