/**
 * "Join as a Supplier" — the focused supplier registration page
 * (/supplier/register), reached from the marketing page's CTAs.
 * The marketing story itself lives on /supplier/list-experience
 * (pages/supplier/ListExperiencePage.tsx).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, LoaderCircle, ShieldCheck, ShieldOff, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { SupplierApplicationForm } from '@/components/supplier/SupplierApplicationForm'
import { useAuthUser } from '@/hooks/useAuthUser'
import { useSupplierStatus, supplierStatusKey } from '@/hooks/useSupplierStatus'
import { getSupplierPortalUrl, isApprovedSupplier } from '@/lib/supplier'
import { SUPPORT_EMAIL } from '@/lib/support'
import { useQueryClient } from '@tanstack/react-query'
import { getAuthUserId, setAuthReturnTo } from '@/lib/auth'
import '@/styles/partner-pages.css'
import '@/styles/SupplierRegister.css'

/**
 * Status-aware copy for the "application submitted" card. The card used to say
 * "under review" for every state, which is misleading for rejected, suspended or
 * expired suppliers — only APPROVED/ACTIVE redirect to the supplier portal.
 */
type ApplicationTone = 'pending' | 'negative' | 'warning'

interface ApplicationCardState {
  tone: ApplicationTone
  icon: LucideIcon
  title: string
  description: string
  showReviewerNote: boolean
}

const APPLICATION_TONE_CARD: Record<ApplicationTone, string> = {
  pending: 'border-emerald-100 bg-emerald-50',
  negative: 'border-rose-100 bg-rose-50',
  warning: 'border-amber-100 bg-amber-50',
}

const APPLICATION_TONE_ICON: Record<ApplicationTone, string> = {
  pending: 'text-emerald-600',
  negative: 'text-rose-600',
  warning: 'text-amber-600',
}

const APPLICATION_TONE_PILL: Record<ApplicationTone, string> = {
  pending: 'text-emerald-700',
  negative: 'text-rose-700',
  warning: 'text-amber-700',
}

function applicationCardState(status?: string | null): ApplicationCardState {
  switch (status) {
    case 'REJECTED':
      return {
        tone: 'negative',
        icon: XCircle,
        title: 'Application not approved',
        description:
          'Our review team could not approve this application as submitted. Review the note below, then contact support so we can take it forward with you.',
        showReviewerNote: true,
      }
    case 'SUSPENDED':
      return {
        tone: 'negative',
        icon: ShieldOff,
        title: 'Supplier account suspended',
        description:
          'Your supplier account is suspended, so listings and payouts are paused. Contact support once the issue is resolved.',
        showReviewerNote: true,
      }
    case 'EXPIRED':
      return {
        tone: 'warning',
        icon: Clock,
        title: 'Supplier profile expired',
        description:
          'Your supplier profile has expired. Contact support to renew it and get your listings bookable again.',
        showReviewerNote: false,
      }
    case 'UNDER_REVIEW':
      return {
        tone: 'pending',
        icon: ShieldCheck,
        title: 'Application under review',
        description:
          'Our team is reviewing your details and documents. We will get back to you within 3-5 business days.',
        showReviewerNote: false,
      }
    default:
      return {
        tone: 'pending',
        icon: ShieldCheck,
        title: 'Application submitted',
        description:
          'Your supplier application has been received. Our team will review it and get back to you within 3-5 business days.',
        showReviewerNote: false,
      }
  }
}

interface SupplierRegisterPageProps {
  onOpenAuth?: (mode: 'signin' | 'signup') => void
}

export default function SupplierRegisterPage({ onOpenAuth }: SupplierRegisterPageProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useAuthUser()
  const { profile, isLoading } = useSupplierStatus({ forceEnabled: true })
  const [redirecting, setRedirecting] = useState(false)
  const userId = getAuthUserId(user)

  useEffect(() => { setAuthReturnTo('/supplier/register') }, [])

  const refreshStatus = () => { void queryClient.invalidateQueries({ queryKey: supplierStatusKey(userId) }) }

  useEffect(() => {
    if (!profile || !isApprovedSupplier(profile.status)) return
    let cancelled = false
    ;(async () => {
      const portalUrl = await getSupplierPortalUrl(profile)
      if (cancelled || !portalUrl) return
      setRedirecting(true)
      window.location.replace(portalUrl)
    })()
    return () => { cancelled = true }
  }, [profile])

  const application = profile
  const applicationState = applicationCardState(application?.status)
  const ApplicationStateIcon = applicationState.icon
  const handleSignInHere = async () => {
    if (application && isApprovedSupplier(application.status)) {
      const portalUrl = await getSupplierPortalUrl(application)
      if (portalUrl) { window.location.replace(portalUrl); return }
    }
    onOpenAuth?.('signin')
  }

  return (
    <motion.main
      className="le-page"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="relative bg-white py-10 sm:py-16">
        <div className="supplier-register-container">
          <Link
            to="/supplier/list-experience"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} />
            {t('supplierAuth.learnAboutListing', 'Learn about listing on Travio Ghana')}
          </Link>
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t('supplierAuth.registerTitle', 'Join as a Supplier')}
            </h1>
            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              {t('supplierAuth.registerDesc', 'Complete your supplier application to list tours, reach travellers across Ghana, and manage bookings from one dashboard.')}
            </p>
          </div>

          {(isLoading || redirecting) && !application ? (
            <div className="flex items-center justify-center py-24">
              <LoaderCircle className="size-6 animate-spin text-primary" />
              {redirecting && <span className="ml-3 text-sm text-slate-500">{t('supplierAuth.redirectingToPortal', 'Taking you to your supplier dashboard…')}</span>}
            </div>
          ) : application ? (
            <div className={`rounded-[1.4rem] border p-8 text-center ${APPLICATION_TONE_CARD[applicationState.tone]}`}>
              <ApplicationStateIcon className={`mx-auto mb-3 size-10 ${APPLICATION_TONE_ICON[applicationState.tone]}`} />
              <h2 className="text-lg font-bold text-slate-900">{applicationState.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{applicationState.description}</p>
              <p className={`mt-3 inline-block rounded-full bg-white px-4 py-1 text-xs font-semibold shadow-sm ${APPLICATION_TONE_PILL[applicationState.tone]}`}>
                {t('supplierAuth.applicationStatus', 'Status')}: {application?.status ?? 'PENDING'}
              </p>
              {applicationState.showReviewerNote && application.adminNotes ? (
                <div className="mx-auto mt-4 max-w-xl rounded-xl border border-black/5 bg-white/70 px-4 py-3 text-left">
                  <span className="block text-xs font-semibold text-slate-800">
                    {t('supplierAuth.reviewerNote', 'Note from our review team')}
                  </span>
                  <p className="mt-1 text-xs text-slate-600">{application.adminNotes}</p>
                </div>
              ) : null}
              {applicationState.tone !== 'pending' ? (
                <p className="mt-4 text-xs text-slate-500">
                  {t('supplierAuth.applicationSupport', 'Questions about this decision?')}{' '}
                  <a className="font-semibold text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                    {SUPPORT_EMAIL}
                  </a>
                </p>
              ) : null}
            </div>
          ) : (
            <SupplierApplicationForm onSubmitted={refreshStatus} onOpenAuth={onOpenAuth} />
          )}

          <p className="mt-10 text-center text-sm text-slate-500">
            {t('supplierAuth.alreadyHaveAccount', 'Already have a supplier account?')}{' '}
            <button type="button" onClick={handleSignInHere} className="bg-transparent p-0 font-semibold text-primary hover:underline">
              {t('supplierAuth.signInHere', 'Sign in here')}
            </button>
          </p>
          <p className="mt-4 text-center text-xs text-slate-400">
            By submitting this application, you agree to our{' '}
            <Link to="/supplier-terms" className="underline hover:text-slate-600">Supplier Terms</Link> and{' '}
            <Link to="/privacy-policy" className="underline hover:text-slate-600">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </motion.main>
  )
}
