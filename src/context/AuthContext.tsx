/**
 * React integration for the session manager.
 *
 * Provides:
 * - A global session-expired modal that appears immediately on protected pages
 * - A `promptSignIn` function callable from any component (or from non-React
 *   code via the module-level `promptSignIn` export)
 * - Cross-tab and focus/visibility session lifecycle
 */
import {
  createContext, useContext, useEffect, useState, useCallback, type ReactNode,
} from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { subscribeToAuthState, setAuthReturnTo, getAuthReturnTo, type AuthUser } from '../lib/auth'
import { onSessionInvalidated } from '../auth/sessionManager'
import { authSyncSubscribe } from '../auth/authSync'

// ── Protected page detection ───────────────────────────────────────────
// NOTE: /supplier/list-experience is NOT here — it renders the public
// "become a supplier" landing page. Only /supplier/register (the application
// form/status) needs a session.
const PROTECTED_PREFIXES = ['/dashboard', '/booking', '/supplier/register', '/review']

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
}

// ── Module-level promptSignIn (accessible from non-React code) ──────────

type PromptSignInFn = (returnTo?: string) => void
let externalPromptSignIn: PromptSignInFn | null = null

/**
 * Global sign-in prompt. Can be called from any module — React or not.
 * If a returnTo is provided, the user will be redirected there after auth.
 */
export function promptSignIn(returnTo?: string) {
  externalPromptSignIn?.(returnTo)
}

// ── Context ────────────────────────────────────────────────────────────

interface AuthContextValue {
  isSessionExpired: boolean
  showAuthModal: boolean
  promptSignIn: (returnTo?: string) => void
  dismissSessionExpired: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}

// ── Session expired modal ──────────────────────────────────────────────

function SessionExpiredModal({
  onSignIn,
  onDismiss,
  canDismiss,
}: {
  onSignIn: () => void
  onDismiss: () => void
  canDismiss: boolean
}) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={canDismiss ? onDismiss : undefined}
        />

        {/* Dialog */}
        <motion.div
          className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Your session expired
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Please sign in again to continue.
          </p>

          <Button
            onClick={onSignIn}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Sign in
          </Button>

          {canDismiss && (
            <button
              onClick={onDismiss}
              className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Continue browsing
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Provider ───────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [isSessionExpired, setIsSessionExpired] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [returnTo, setReturnTo] = useState<string | null>(null)
  const [, setUser] = useState<AuthUser | null>(null)

  // ── Subscribe to auth state changes ────────────────────────────────
  useEffect(() => {
    let unsub: (() => void) | undefined
    subscribeToAuthState((user) => {
      setUser(user)
      if (user) {
        // User signed in — clear any expired state and dismiss modal.
        setIsSessionExpired(false)
        setShowAuthModal(false)
        setReturnTo(null)
      }
    }).then((fn) => { unsub = fn })
    return () => { unsub?.() }
  }, [])

  // ── Register with session manager ──────────────────────────────────
  useEffect(() => {
    const unsub = onSessionInvalidated(() => {
      setIsSessionExpired(true)
      if (isProtectedPage(window.location.pathname)) {
        setShowAuthModal(true)
      }
    })
    return unsub
  }, [])

  // ── Cross-tab sync ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub = authSyncSubscribe((msg) => {
      if (msg.type === 'AUTH_LOGGED_OUT') {
        setIsSessionExpired(true)
        if (isProtectedPage(window.location.pathname)) {
          setShowAuthModal(true)
        }
      }
    })
    return unsub
  }, [])

  // ── promptSignIn implementation ────────────────────────────────────
  const handlePromptSignIn = useCallback((rt?: string) => {
    const path = rt || `${location.pathname}${location.search}`
    setReturnTo(path)
    setAuthReturnTo(path)
    setShowAuthModal(true)
    setIsSessionExpired(true)
  }, [location.pathname, location.search])

  // Expose promptSignIn to non-React code (sessionManager, api.ts, etc.)
  useEffect(() => {
    externalPromptSignIn = handlePromptSignIn
    return () => { externalPromptSignIn = null }
  }, [handlePromptSignIn])

  // ── Modal actions ──────────────────────────────────────────────────
  const handleSignIn = useCallback(() => {
    // Navigate to login with returnTo preserved in sessionStorage.
    const rt = returnTo || `${location.pathname}${location.search}`
    setAuthReturnTo(rt)
    navigate(`/login?returnTo=${encodeURIComponent(rt)}`)
    setShowAuthModal(false)
  }, [returnTo, location.pathname, location.search, navigate])

  const handleDismiss = useCallback(() => {
    setShowAuthModal(false)
    // isSessionExpired stays true so the next protected action re-triggers.
  }, [])

  // ── ReturnTo handling: after login, redirect ───────────────────────
  useEffect(() => {
    // Check for a pending returnTo after login (handles page reload during auth flow).
    const rt = getAuthReturnTo()
    if (rt && window.location.pathname === '/login') {
      // The login page itself will handle the redirect via its own onSuccess.
    }
  }, [])

  const value: AuthContextValue = {
    isSessionExpired,
    showAuthModal,
    promptSignIn: handlePromptSignIn,
    dismissSessionExpired: handleDismiss,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showAuthModal && (
        <SessionExpiredModal
          onSignIn={handleSignIn}
          onDismiss={handleDismiss}
          canDismiss={!isProtectedPage(window.location.pathname)}
        />
      )}
    </AuthContext.Provider>
  )
}
