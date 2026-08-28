/**
 * Persists in-progress supplier registration in sessionStorage and localStorage.
 *   sessionStorage: same-tab refresh; cleared when the tab closes.
 *   localStorage: survives new tabs and browser restarts.
 *   On load, the draft with the latest updatedAt wins.
 *   Drafts stay keyed to the last signed-in user after logout (localStorage last-user pointer).
 */

export interface SupplierApplicationForm {
  supplierType: string
  businessInfo: {
    legalBusinessName: string
    displayName: string
    businessType: string
    country: string
    address: {
      line1: string
      line2: string
      city: string
      state: string
      postalCode: string
    }
    website: string
    phoneNumber: string
  }
  operatingInfo: {
    tourCategories: string[]
    destinations: string[]
    languages: string[]
    yearsInBusiness: string
    cancellationPolicy: string
    meetingStyle: string
  }
  representativeInfo: {
    fullName: string
    email: string
    dateOfBirth: string
    address: {
      line1: string
      line2: string
      city: string
      state: string
      postalCode: string
    }
    idType: string
    idDocument: File | null
  }
  businessDocuments: {
    registrationDocument: File | null
    taxDocument: File | null
    proofOfAddress: File | null
    licenses: File[]
  }
  verificationDocuments: VerificationDocumentDraft[]
  vehicles: VehicleDraft[]
  guides: GuideDraft[]
  compliance: {
    acceptedTerms: boolean
    agreedToPayoutTerms: boolean
  }
}

/** One verification document entry (paired with `documentMeta` on submit). */
export interface VerificationDocumentDraft {
  key: string
  type: string
  ownerType: 'SUPPLIER' | 'VEHICLE' | 'GUIDE'
  ownerKey?: string
  file: File | null
}

export interface VehicleDraft {
  key: string
  make: string
  model: string
  year: string
  registrationNumber: string
  photos: File[]
}

export interface GuideDraft {
  key: string
  fullName: string
  phone: string
  email: string
}

interface StoredDraft {
  step: number
  form: SupplierApplicationForm
  updatedAt: number
}

const DRAFT_PREFIX = 'supplier_application_draft:'
const LAST_DRAFT_USER_KEY = 'supplier_application_draft_last_user'
const STEPS_COUNT = 6

const STORAGES: { name: string; get: () => Storage }[] = [
  { name: 'session', get: () => sessionStorage },
  { name: 'local', get: () => localStorage },
]

export function createEmptySupplierApplicationForm(): SupplierApplicationForm {
  return {
    supplierType: '',
    businessInfo: {
      legalBusinessName: '',
      displayName: '',
      businessType: '',
      country: '',
      address: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        postalCode: '',
      },
      website: '',
      phoneNumber: '',
    },
    operatingInfo: {
      tourCategories: [],
      destinations: [],
      languages: [],
      yearsInBusiness: '',
      cancellationPolicy: '',
      meetingStyle: '',
    },
    representativeInfo: {
      fullName: '',
      email: '',
      dateOfBirth: '',
      address: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        postalCode: '',
      },
      idType: '',
      idDocument: null,
    },
    businessDocuments: {
      registrationDocument: null,
      taxDocument: null,
      proofOfAddress: null,
      licenses: [],
    },
    verificationDocuments: [],
    vehicles: [],
    guides: [],
    compliance: {
      acceptedTerms: false,
      agreedToPayoutTerms: false,
    },
  }
}

function draftStorageKey(userId?: string | null): string {
  const id = String(userId || '').trim()
  return `${DRAFT_PREFIX}${id || 'anonymous'}`
}

/** Remember who last saved a draft so logout does not lose progress. */
export function rememberDraftUserId(userId: string): void {
  const id = String(userId || '').trim()
  if (!id || typeof window === 'undefined') return
  try {
    localStorage.setItem(LAST_DRAFT_USER_KEY, id)
  } catch {
    // ignore
  }
}

export function getLastDraftUserId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(LAST_DRAFT_USER_KEY)?.trim() || null
  } catch {
    return null
  }
}

/**
 * Stable key for load/save — stays on the signed-in user after logout.
 */
export function resolveDraftUserId(
  user:
    | { id?: string; _id?: string; uid?: string; firebaseUid?: string; email?: string }
    | null
    | undefined
): string | null {
  return (
    user?.id ??
    user?._id ??
    user?.uid ??
    user?.firebaseUid ??
    user?.email ??
    getLastDraftUserId() ??
    null
  )
}

/** Promote pre-login (anonymous) draft when the user signs in. */
export function migrateAnonymousDraftToUser(userId: string): void {
  if (!userId || typeof window === 'undefined') return

  const userKey = draftStorageKey(userId)
  const anonKey = draftStorageKey(null)

  let userDraft: StoredDraft | null = null
  let anonDraft: StoredDraft | null = null

  for (const { get } of STORAGES) {
    const storage = get()
    const u = readRawDraft(storage, userKey)
    const a = readRawDraft(storage, anonKey)
    if (u && (!userDraft || u.updatedAt >= userDraft.updatedAt)) userDraft = u
    if (a && (!anonDraft || a.updatedAt >= anonDraft.updatedAt)) anonDraft = a
  }

  if (!anonDraft) return

  const shouldMigrate = !userDraft || anonDraft.updatedAt > userDraft.updatedAt

  if (!shouldMigrate) {
    for (const { get } of STORAGES) {
      try {
        get().removeItem(anonKey)
      } catch {
        // ignore
      }
    }
    return
  }

  const payload: StoredDraft = {
    step: anonDraft.step,
    form: serializeFormForDraft(anonDraft.form),
    updatedAt: Date.now(),
  }

  for (const { get } of STORAGES) {
    writeRawDraft(get(), userKey, payload)
    try {
      get().removeItem(anonKey)
    } catch {
      // ignore
    }
  }
}

/** Strip File objects — they cannot be stored in the browser. */
function serializeFormForDraft(form: SupplierApplicationForm): SupplierApplicationForm {
  return {
    ...form,
    representativeInfo: {
      ...form.representativeInfo,
      idDocument: null,
    },
    businessDocuments: {
      registrationDocument: null,
      taxDocument: null,
      proofOfAddress: null,
      licenses: [],
    },
    verificationDocuments: form.verificationDocuments.map((d) => ({ ...d, file: null })),
    vehicles: form.vehicles.map((v) => ({ ...v, photos: [] })),
  }
}

function normalizeDraftPayload(parsed: unknown): StoredDraft | null {
  if (!parsed || typeof parsed !== 'object') return null

  const record = parsed as Record<string, unknown>
  const step = Number(record.step)
  const safeStep = Number.isFinite(step) && step >= 0 && step < STEPS_COUNT ? Math.floor(step) : 0
  const updatedAt = Number(record.updatedAt) || 0

  return {
    step: safeStep,
    form: mergeSupplierApplicationDraft(record.form),
    updatedAt,
  }
}

function readRawDraft(storage: Storage, key: string): StoredDraft | null {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    return normalizeDraftPayload(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeRawDraft(storage: Storage, key: string, payload: StoredDraft): boolean {
  try {
    storage.setItem(key, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function mergeSupplierApplicationDraft(saved?: unknown): SupplierApplicationForm {
  const empty = createEmptySupplierApplicationForm()
  if (!saved || typeof saved !== 'object') return empty

  const savedForm = saved as Partial<SupplierApplicationForm>

  return {
    supplierType: typeof savedForm.supplierType === 'string' ? savedForm.supplierType : empty.supplierType,
    businessInfo: {
      ...empty.businessInfo,
      ...savedForm.businessInfo,
      address: { ...empty.businessInfo.address, ...savedForm.businessInfo?.address },
    },
    operatingInfo: {
      ...empty.operatingInfo,
      ...savedForm.operatingInfo,
      tourCategories: Array.isArray(savedForm.operatingInfo?.tourCategories)
        ? savedForm.operatingInfo.tourCategories
        : [],
      destinations: Array.isArray(savedForm.operatingInfo?.destinations)
        ? savedForm.operatingInfo.destinations
        : [],
      languages: Array.isArray(savedForm.operatingInfo?.languages) ? savedForm.operatingInfo.languages : [],
    },
    representativeInfo: {
      ...empty.representativeInfo,
      ...savedForm.representativeInfo,
      idDocument: null,
      address: {
        ...empty.representativeInfo.address,
        ...savedForm.representativeInfo?.address,
      },
    },
    businessDocuments: { ...empty.businessDocuments },
    verificationDocuments: Array.isArray(savedForm.verificationDocuments)
      ? savedForm.verificationDocuments.map((d) => ({ ...d, file: null }))
      : [],
    vehicles: Array.isArray(savedForm.vehicles)
      ? savedForm.vehicles.map((v) => ({ ...v, photos: [] }))
      : [],
    guides: Array.isArray(savedForm.guides) ? savedForm.guides : [],
    compliance: { ...empty.compliance, ...savedForm.compliance },
  }
}

/**
 * @returns The latest draft (step + form) for the user, or null.
 */
export function loadSupplierApplicationDraft(
  userId?: string | null
): { step: number; form: SupplierApplicationForm } | null {
  if (typeof window === 'undefined') return null

  const key = draftStorageKey(userId)
  let best: StoredDraft | null = null

  for (const { get } of STORAGES) {
    const draft = readRawDraft(get(), key)
    if (!draft) continue
    if (!best || draft.updatedAt >= best.updatedAt) {
      best = draft
    }
  }

  if (!best) return null

  return { step: best.step, form: best.form }
}

/**
 * Save the in-progress application so a refresh does not lose input.
 */
export function saveSupplierApplicationDraft(
  userId: string | null | undefined,
  draft: { step: number; form: SupplierApplicationForm }
): void {
  if (typeof window === 'undefined') return

  if (userId) rememberDraftUserId(userId)

  const step = Number(draft?.step)
  const safeStep = Number.isFinite(step) && step >= 0 && step < STEPS_COUNT ? Math.floor(step) : 0

  const payload: StoredDraft = {
    step: safeStep,
    form: serializeFormForDraft(draft.form),
    updatedAt: Date.now(),
  }

  const key = draftStorageKey(userId)
  for (const { get } of STORAGES) {
    writeRawDraft(get(), key, payload)
  }
}

/** Remove any saved draft for the user. */
export function clearSupplierApplicationDraft(userId?: string | null): void {
  if (typeof window === 'undefined') return

  const key = draftStorageKey(userId)
  for (const { get } of STORAGES) {
    try {
      get().removeItem(key)
    } catch {
      // ignore
    }
  }
}
