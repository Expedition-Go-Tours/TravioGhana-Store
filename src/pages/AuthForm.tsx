import { useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import logoSrc from "../assets/TravioGhana_Logo.svg";
import authHero from "../assets/auth-hero.webp";
import { useComingSoon } from "../hooks/useComingSoon";
import {
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  setAuthReturnTo,
  clearAuthReturnTo,
  getAuthReturnTo,
} from "../lib/auth";
import "./AuthForm.css";

interface AuthFormProps {
  initialMode?: "signin" | "signup";
  onBack?: () => void;
  onAuthSuccess?: () => void;
}

/** After a successful sign-in/sign-up, honor a pending return path (e.g. supplier register). */
function useAuthSuccessRedirect(onAuthSuccess?: () => void) {
  const navigate = useNavigate()
  return () => {
    const returnTo = getAuthReturnTo()
    if (returnTo) {
      clearAuthReturnTo()
      navigate(returnTo)
      return
    }
    onAuthSuccess?.()
  }
}

/**
 * Google sign-in button. Always uses the OAuth redirect flow. Google One Tap is
 * deliberately **not** run here: the homepage `GoogleOneTapPrompt` is the
 * single owner of One Tap (it is delayed, frequency-capped and never hijacks
 * navigation). A silent One Tap credential arriving on this page used to sign
 * the visitor in and close the form out from under them.
 */
function useGoogleSignIn(successMessage: string, remember: boolean, onAuthSuccess?: () => void) {
  const [googleLoading, setGoogleLoading] = useState(false)
  const handleAuthSuccess = useAuthSuccessRedirect(onAuthSuccess)

  const handleGoogle = async () => {
    if (!getAuthReturnTo()) setAuthReturnTo('/')

    flushSync(() => setGoogleLoading(true))
    try {
      const result = await signInWithGoogle({ remember })

      if (result && 'redirected' in result && result.redirected) return

      toast.success(successMessage)
      handleAuthSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Google sign in failed')
    } finally {
      setGoogleLoading(false)
    }
  }

  return { googleLoading, handleGoogle }
}

/* --- Icons (ported from the design) --- */

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.38-.18-2.03H12v3.86h5.38a4.61 4.61 0 0 1-2 3.03v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.41l-3.23-2.5c-.9.6-2.04.96-3.39.96-2.61 0-4.83-1.77-5.62-4.15H3.05v2.58A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.38 13.9a6 6 0 0 1 0-3.8V7.52H3.05a10 10 0 0 0 0 8.96l3.33-2.58Z" />
      <path fill="#EA4335" d="M12 5.95c1.43 0 2.7.49 3.72 1.45l2.87-2.88A9.57 9.57 0 0 0 12 2a10 10 0 0 0-8.95 5.52l3.33 2.58C7.17 7.72 9.39 5.95 12 5.95Z" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg className="chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m7 4 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="arrow" viewBox="0 0 20 20" aria-hidden="true">
      <path d="m7 3 7 7-7 7" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
      <circle cx="12" cy="12" r="2.7" />
      <path d="M3 21 21 3" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="7" r="3.5" />
      <path d="M4.5 21v-2c0-3.2 3.1-5 7.5-5s7.5 1.8 7.5 5v2" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="m3 6 9 7 9-7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" />
    </svg>
  );
}

function BackArrow({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19 12H5m0 0 6-6m-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* --- Fields --- */

interface PasswordFieldProps {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  errorId?: string;
}

function PasswordField({ id, name, label, placeholder, autoComplete, value, onChange, error, errorId }: PasswordFieldProps) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(false)

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <LockIcon />
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={8}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="eye"
          aria-label={shown ? t('auth.hidePassword') : t('auth.showPassword')}
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
        >
          <EyeIcon />
        </button>
      </div>
      {error && <p className="field-error" id={errorId}>{error}</p>}
    </div>
  )
}

function GoogleButton({ onClick, loading }: { onClick?: () => void; loading?: boolean }) {
  const { t } = useTranslation()
  return (
    <button type="button" className="google" onClick={onClick} disabled={loading}>
      <GoogleG />
      {loading ? (
        <>
          <span className="auth-spinner" />
          <span>{t('auth.connecting')}</span>
        </>
      ) : (
        <span>{t('auth.google')}</span>
      )}
      <Chevron />
    </button>
  )
}

/* --- Views --- */

function SignInView({ onSwitchToSignUp, onAuthSuccess }: { onSwitchToSignUp: () => void; onAuthSuccess?: () => void }) {
  const { t } = useTranslation()
  const comingSoon = useComingSoon()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const handleAuthSuccess = useAuthSuccessRedirect(onAuthSuccess)
  const { googleLoading, handleGoogle } = useGoogleSignIn(t('auth.signedIn'), remember, onAuthSuccess)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNotice('')
    setLoading(true)
    try {
      await signInWithEmail(email, password, { remember })
      toast.success(t('auth.signedIn'))
      handleAuthSuccess()
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : t('auth.signInFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="signin-view">
      <h1>{t('auth.welcomeBack')}</h1>
      <p className="sub">{t('auth.signinSubtitle')}</p>

      <GoogleButton onClick={handleGoogle} loading={googleLoading} />

      <div className="divider">{t('auth.orContinueWithEmail')}</div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="signin-email">{t('auth.emailAddress')}</label>
          <div className="input-wrap">
            <MailIcon />
            <input
              id="signin-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setNotice('') }}
            />
          </div>
        </div>

        <PasswordField
          id="signin-password"
          name="password"
          label={t('auth.password')}
          placeholder={t('auth.passwordPlaceholder')}
          autoComplete="current-password"
          value={password}
          onChange={(v) => { setPassword(v); setNotice('') }}
        />

        <div className="signin-options">
          <label className="remember">
            <input
              name="remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            {t('auth.rememberMe')}
          </label>
          <a
            className="forgot is-coming-soon"
            href="/forgot-password"
            onClick={(e) => e.preventDefault()}
            {...comingSoon}
          >
            {t('auth.forgotPassword')}
          </a>
        </div>

        <button className="create" type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className="auth-spinner" />
              {t('auth.signingIn')}
            </>
          ) : (
            <>
              {t('auth.signIn')}
              <ArrowIcon />
            </>
          )}
        </button>
      </form>

      <p className="signin">
        {t('auth.newToTravioGhana')}{' '}
        <button type="button" onClick={onSwitchToSignUp}>{t('auth.createAnAccount')}</button>
      </p>
      <p className="notice" role="status" aria-live="polite">{notice}</p>
    </div>
  )
}

function SignUpView({ onSwitchToSignIn, onAuthSuccess }: { onSwitchToSignIn: () => void; onAuthSuccess?: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const handleAuthSuccess = useAuthSuccessRedirect(onAuthSuccess)
  const { googleLoading, handleGoogle } = useGoogleSignIn(t('auth.signedUpSuccess'), true, onAuthSuccess)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNotice('')
    setConfirmError('')
    if (password.length < 8) {
      setNotice(t('auth.passwordMinLength'))
      return
    }
    if (password !== confirm) {
      setConfirmError(t('auth.passwordsDoNotMatch'))
      return
    }
    setLoading(true)
    try {
      // Registrations always remember the new account (the design has no
      // remember-me control on sign-up).
      await registerWithEmail(name, email, password)
      toast.success(t('auth.signedUpSuccess'))
      handleAuthSuccess()
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : t('auth.registerFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>{t('auth.createYourAccount')}</h1>
      <p className="sub">{t('auth.signupSubtitle')}</p>

      <GoogleButton onClick={handleGoogle} loading={googleLoading} />

      <div className="divider">{t('auth.orContinueWithEmail')}</div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="full-name">{t('auth.fullName')}</label>
          <div className="input-wrap">
            <PersonIcon />
            <input
              id="full-name"
              name="fullName"
              autoComplete="name"
              placeholder={t('auth.fullNamePlaceholder')}
              required
              value={name}
              onChange={(e) => { setName(e.target.value); setNotice('') }}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="signup-email">{t('auth.emailAddress')}</label>
          <div className="input-wrap">
            <MailIcon />
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setNotice('') }}
            />
          </div>
        </div>

        <PasswordField
          id="signup-password"
          name="password"
          label={t('auth.password')}
          placeholder={t('auth.createPasswordPlaceholder')}
          autoComplete="new-password"
          value={password}
          onChange={(v) => { setPassword(v); setNotice('') }}
        />

        <PasswordField
          id="confirm-password"
          name="confirmPassword"
          label={t('auth.confirmPassword')}
          placeholder={t('auth.confirmPasswordPlaceholder')}
          autoComplete="new-password"
          value={confirm}
          onChange={(v) => { setConfirm(v); setConfirmError('') }}
          error={confirmError}
          errorId="confirm-password-error"
        />

        <button className="create" type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className="auth-spinner" />
              {t('auth.creatingAccount')}
            </>
          ) : (
            <>
              {t('auth.createAccount')}
              <ArrowIcon />
            </>
          )}
        </button>
      </form>

      <p className="signin">
        {t('auth.alreadyHaveAccount')}{' '}
        <button type="button" onClick={onSwitchToSignIn}>{t('auth.signIn')}</button>
      </p>
      <p className="notice" role="status" aria-live="polite">{notice}</p>
    </div>
  )
}

/* --- Trust bar --- */

function TrustBar() {
  const { t } = useTranslation()
  return (
    <div className="trust" aria-label={t('auth.trust.aria')}>
      <div className="trust-item">
        <span className="trust-icon">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path fill="currentColor" d="m16 2 12 5v9c0 7-5 11-12 14C9 27 4 23 4 16V7Z" />
            <path fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="m10 16 4 4 8-9" />
          </svg>
        </span>
        <span>
          <strong>{t('auth.trust.secureTitle')}</strong>
          <small>{t('auth.trust.secureText')}</small>
        </span>
      </div>
      <div className="trust-item">
        <span className="trust-icon">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path fill="currentColor" d="m16 1 4 3 5-.3 1.4 4.8 4 3-2 4.5 2 4.5-4 3-1.4 4.8-5-.3-4 3-4-3-5 .3-1.4-4.8-4-3 2-4.5-2-4.5 4-3L7 3.7l5 .3Z" />
            <path fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="m10 16 4 4 8-9" />
          </svg>
        </span>
        <span>
          <strong>{t('auth.trust.verifiedTitle')}</strong>
          <small>{t('auth.trust.verifiedText')}</small>
        </span>
      </div>
      <div className="trust-item">
        <span className="trust-icon">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <g fill="currentColor">
              <circle cx="16" cy="9" r="4" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="26" cy="12" r="3" />
              <path d="M8 25v-3c0-5 3-8 8-8s8 3 8 8v3H8Zm-7 0v-3c0-4 2-6 6-6l2 1c-1 2-2 4-2 7v1H1Zm24 0v-1c0-3-1-5-2-7l2-1c4 0 6 2 6 6v3h-6Z" />
            </g>
          </svg>
        </span>
        <span>
          <strong>{t('auth.trust.localTitle')}</strong>
          <small>{t('auth.trust.localText')}</small>
        </span>
      </div>
    </div>
  )
}

/* --- Page --- */

export default function AuthForm({ initialMode = "signin", onBack, onAuthSuccess }: AuthFormProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<"signin" | "signup">(initialMode)

  return (
    <>
      <div className="auth-page">
        <main className="card">
          <section className="scene" aria-label={t('auth.scene.aria')}>
            <img
              className="hero-photo"
              src={authHero}
              alt=""
              width={1024}
              height={1536}
              fetchPriority="high"
            />
            {onBack && (
              <button className="back-hit" type="button" onClick={onBack} aria-label={t('common.back')}>
                <BackArrow size={21} />
              </button>
            )}
            <div className="scene-copy">
              <p className="eyebrow">{t('auth.scene.eyebrow')}</p>
              <h2>{t('auth.scene.title')}</h2>
              <p>{t('auth.scene.subtitle')}</p>
            </div>
          </section>

          <section className="right" aria-label={mode === 'signin' ? t('auth.formAriaSignIn') : t('auth.formAriaSignUp')}>
            {onBack && (
              <button className="mobile-back" type="button" onClick={onBack} aria-label={t('common.back')}>
                <BackArrow size={20} />
              </button>
            )}
            <div className="content">
              <img className="brand" src={logoSrc} alt="Travio Ghana" width={2076} height={450} />
              <div className="auth-view" key={mode}>
                {mode === "signin" ? (
                  <SignInView onSwitchToSignUp={() => setMode("signup")} onAuthSuccess={onAuthSuccess} />
                ) : (
                  <SignUpView onSwitchToSignIn={() => setMode("signin")} onAuthSuccess={onAuthSuccess} />
                )}
              </div>
            </div>
            <TrustBar />
          </section>
        </main>
      </div>
    </>
  )
}
