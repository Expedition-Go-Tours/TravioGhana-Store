import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuthUser } from '../hooks/useAuthUser'
import {
  signInWithGoogleOneTap,
  getGoogleClientId,
  googleOneTapSupported,
} from '../lib/auth'
import { prefersReducedData } from '../lib/perfProfile'

// Only loaded after the prompt arms, keeping @react-oauth/google out of the
// entry bundle.
const GoogleOneTapLazy = lazy(() => import('./GoogleOneTapLazy'))

/**
 * Homepage Google One Tap for signed-out visitors.
 *
 * **The single owner of One Tap.** The auth page (`/login`, and the auth
 * overlay on `/`) deliberately does not run One Tap: its own prompt had no
 * frequency caps and a silent browser-issued credential (`select_by: 'auto'`)
 * would sign the visitor in and close the form out from under them. Here the
 * prompt is delayed, capped and never navigates on its own.
 *
 * Google's One Tap is powerful but intrusive — production sites cap how often
 * it can appear so it never nags. Rules enforced here:
 *   - only for signed-out visitors (and only when backend auth + client id
 *     are configured, same gate as the auth page);
 *   - shown at most once per browser session and at most once per calendar
 *     day, then suppressed until the visitor signs out (so a returning user
 *     can be prompted again, per Google's guidance);
 *   - a dismissal, a success, or an exchange failure all record the "shown"
 *     marker so it won't immediately re-prompt;
 *   - a ~2s delay after mount so it never fights first paint.
 */

const SESSION_KEY = 'expedition.googleOnetap.dismissedSession'
const DAILY_KEY = 'expedition.googleOnetap.lastShownDay'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Whether a homepage One Tap prompt should appear right now. Pure + testable. */
export function shouldPromptHomeOneTap(): boolean {
  if (!googleOneTapSupported()) return false
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false
    return localStorage.getItem(DAILY_KEY) !== todayKey()
  } catch {
    // Storage blocked (private mode etc.) — fall back to allowing the prompt.
    return true
  }
}

/** Record that the prompt was shown/answered so it is not re-shown too soon. */
export function markHomeOneTapShown(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
    localStorage.setItem(DAILY_KEY, todayKey())
  } catch {
    /* ignore — storage is best-effort */
  }
}

/** Re-enable prompting (called when the visitor signs out). */
export function clearHomeOneTapCaps(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(DAILY_KEY)
  } catch {
    /* ignore */
  }
}

export default function GoogleOneTapPrompt() {
  const user = useAuthUser()
  const [armed, setArmed] = useState(false)
  const prevUserRef = useRef(user)

  // Arm (after a short delay) only while signed out and within the caps.
  // Skip on save-data/2G-3G connections: the prompt pulls Google's GSI script
  // and 1.2 MB lottie-style payloads have no place competing with first paint
  // on a constrained connection.
  useEffect(() => {
    if (user || !googleOneTapSupported()) return
    if (!shouldPromptHomeOneTap()) return
    if (prefersReducedData()) return
    const timer = window.setTimeout(() => setArmed(true), 3000)
    return () => window.clearTimeout(timer)
  }, [user])

  // A real sign-out should allow prompting again on the next visit/session.
  useEffect(() => {
    if (prevUserRef.current && !user) {
      clearHomeOneTapCaps()
      setArmed(false)
    }
    prevUserRef.current = user
  }, [user])

  if (user || !googleOneTapSupported() || !armed) return null

  return (
    <Suspense fallback={null}>
      <GoogleOneTapLazy
        clientId={getGoogleClientId()}
        onSuccess={async (credential) => {
          markHomeOneTapShown()
          if (!credential) return
          try {
            await signInWithGoogleOneTap(credential)
            toast.success('Signed in successfully')
          } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Google sign in failed')
          }
        }}
        onError={() => {
          // Covers the visitor dismissing the prompt — don't re-ask this session.
          markHomeOneTapShown()
        }}
      />
    </Suspense>
  )
}
