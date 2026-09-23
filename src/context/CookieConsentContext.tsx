import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  DENIED_STATE,
  GRANTED_STATE,
  hasChosen,
  readConsent,
  subscribeConsent,
  writeConsent,
  type ConsentCategory,
  type ConsentRecord,
  type ConsentState,
} from '../lib/cookieConsent'
import { flushGatedMemory, purgeFunctionalStorage } from '../lib/consentGatedStorage'
import { recordConsentOnServer } from '../lib/consentAudit'

interface CookieConsentValue {
  /** The effective state — everything optional is off until the visitor chooses. */
  consent: ConsentState
  /** True once a choice has been made against the current policy version. */
  hasDecided: boolean
  /** True while the first-layer banner should be on screen. */
  isBannerVisible: boolean
  /** True while the category panel is open (from the banner or the footer). */
  isPreferencesOpen: boolean
  acceptAll: () => void
  rejectNonEssential: () => void
  savePreferences: (state: Partial<Record<ConsentCategory, boolean>>) => void
  openPreferences: () => void
  closePreferences: () => void
}

const CookieConsentContext = createContext<CookieConsentValue | null>(null)

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentState>(() => {
    const record = readConsent()
    return record && hasChosen() ? record : { ...DENIED_STATE }
  })
  const [hasDecided, setHasDecided] = useState(() => hasChosen())
  const [isPreferencesOpen, setPreferencesOpen] = useState(false)
  const [isBannerVisible, setBannerVisible] = useState(() => !hasChosen())

  // Tracks the last functional value we acted on, so a cross-tab change can be
  // detected as a revocation rather than a no-op.
  const functionalRef = useRef(consent.functional)

  /** Apply a stored record to React state and reconcile device storage with it. */
  const applyRecord = useCallback((record: ConsentRecord | null, decided: boolean) => {
    const next: ConsentState = record && decided
      ? {
          necessary: true,
          functional: record.functional,
          analytics: record.analytics,
          marketing: record.marketing,
        }
      : { ...DENIED_STATE }

    // Withdrawing functional consent removes what was already stored; granting
    // it persists anything the visitor built up before answering the banner.
    if (functionalRef.current && !next.functional) purgeFunctionalStorage()
    else if (!functionalRef.current && next.functional) flushGatedMemory()

    functionalRef.current = next.functional
    setConsent(next)
    setHasDecided(decided)
    if (decided) setBannerVisible(false)
  }, [])

  // Stay in step with choices made in another tab.
  useEffect(() => {
    return subscribeConsent(() => {
      applyRecord(readConsent(), hasChosen())
    })
  }, [applyRecord])

  const commit = useCallback(
    (state: Partial<Record<ConsentCategory, boolean>>, source: 'accept-all' | 'reject-non-essential' | 'preferences') => {
      const record = writeConsent(state, source)
      applyRecord(record, true)
      setPreferencesOpen(false)
      void recordConsentOnServer(record)
    },
    [applyRecord],
  )

  const acceptAll = useCallback(() => commit(GRANTED_STATE, 'accept-all'), [commit])

  const rejectNonEssential = useCallback(
    () => commit(DENIED_STATE, 'reject-non-essential'),
    [commit],
  )

  const savePreferences = useCallback(
    (state: Partial<Record<ConsentCategory, boolean>>) => commit(state, 'preferences'),
    [commit],
  )

  const openPreferences = useCallback(() => {
    setPreferencesOpen(true)
    setBannerVisible(false)
  }, [])

  // Closing without saving must not leave a first-time visitor with no way to
  // choose, so the banner comes back if nothing has been decided yet.
  const closePreferences = useCallback(() => {
    setPreferencesOpen(false)
    if (!hasChosen()) setBannerVisible(true)
  }, [])

  const value = useMemo<CookieConsentValue>(
    () => ({
      consent,
      hasDecided,
      isBannerVisible,
      isPreferencesOpen,
      acceptAll,
      rejectNonEssential,
      savePreferences,
      openPreferences,
      closePreferences,
    }),
    [
      consent,
      hasDecided,
      isBannerVisible,
      isPreferencesOpen,
      acceptAll,
      rejectNonEssential,
      savePreferences,
      openPreferences,
      closePreferences,
    ],
  )

  return (
    <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
  )
}

export function useCookieConsent(): CookieConsentValue {
  const ctx = useContext(CookieConsentContext)
  if (!ctx) throw new Error('useCookieConsent must be used within a CookieConsentProvider')
  return ctx
}
