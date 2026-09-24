/**
 * "List Your Experience" — supplier registration page.
 * Marketing body ported verbatim from the HTML template, with the existing
 * SupplierApplicationForm appended at the end.
 */
import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LoaderCircle, ShieldCheck } from 'lucide-react'

import { SupplierApplicationForm } from '@/components/supplier/SupplierApplicationForm'
import { useAuthUser } from '@/hooks/useAuthUser'
import { useSupplierStatus, supplierStatusKey } from '@/hooks/useSupplierStatus'
import { getSupplierPortalUrl, isApprovedSupplier } from '@/lib/supplier'
import { useQueryClient } from '@tanstack/react-query'
import { getAuthUserId, setAuthReturnTo } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import Footer from '@/components/Footer'
import RevealOnScroll from '@/components/shared/RevealOnScroll'
import FAQAccordion from '@/components/shared/FAQAccordion'
import '@/styles/partner-pages.css'
import '@/styles/ListExperience.css'
import tour1 from '@/assets/tours/tour1.avif'
import tour2 from '@/assets/tours/tour2.avif'
import tour3 from '@/assets/tours/tour3.avif'
import tour4 from '@/assets/tours/tour4.avif'
import tour5 from '@/assets/tours/tour5.avif'
import tour6 from '@/assets/tours/tour6.avif'
import tour7 from '@/assets/tours/tour7.avif'
import tour8 from '@/assets/tours/tour8.avif'
import phoneLogin from '@/assets/phone-screens/login.png'
import phoneDashboard from '@/assets/phone-screens/dashboard.png'
import phoneProducts from '@/assets/phone-screens/products.png'

interface SupplierRegisterPageProps {
  onOpenAuth?: (mode: 'signin' | 'signup') => void
  /**
   * Show the "Join as a Supplier" application section at the end of the page.
   * `/supplier/list-experience` is the marketing page and passes `false`, so the
   * form only lives on `/supplier/register` where the apply CTAs lead.
   */
  showApplicationForm?: boolean
}

const HERO_IMAGES = [
  // Bundled screenshots — the previous srcs were absolute hashed URLs from an
  // older deployment (/assets/login-CVCOiS3v.png …), which 404 on every new
  // build, so the phone wall rendered empty frames.
  { src: phoneLogin, alt: 'Supplier login screen', cls: 'le-phone-a' },
  { src: phoneDashboard, alt: 'Supplier dashboard with bookings and earnings', cls: 'le-phone-b' },
  { src: phoneProducts, alt: 'Tour products management screen', cls: 'le-phone-c' },
]

const PROOF = [
  { strong: '0', span: 'upfront listing fees' },
  { strong: '85%', span: 'of each booking retained' },
  { strong: '15%', span: 'flat platform commission' },
  { strong: 'Global', span: 'traveller visibility' },
]

const STEPS = [
  { num: '01', title: 'Sign up and list your activity', desc: 'Create your account, add your tour or experience and follow the guided listing process.', arrow: '↘' },
  { num: '02', title: 'Get reviewed and approved', desc: 'Our team checks each listing for quality and safety before it goes live.', arrow: '↘' },
  { num: '03', title: 'Go live and get discovered', desc: 'Your experience becomes bookable and can be promoted across our site and partner channels.', arrow: '↘' },
  { num: '04', title: 'Deliver and get paid', desc: 'Complete each booking and receive consolidated payouts on your selected schedule.', arrow: '✓' },
]

const WHY_CARDS = [
  { icon: '◎', title: 'Reach travellers worldwide', desc: 'Be discovered by travellers actively searching for authentic tours, activities and attractions.' },
  { icon: '↗', title: 'We support the marketing', desc: 'Your activity can be promoted through social media, email, the platform and partner channels.' },
  { icon: '✓', title: 'Registered and regulated', desc: 'Partner with a platform registered with the Ghana Tourism Authority and focused on trusted standards.' },
  { icon: '♡', title: 'Support when you need it', desc: 'Get help with onboarding, listings and resolving issues so your products keep moving.' },
]

const TERMS = [
  { label: 'LISTING', text: 'No setup or maintenance fee' },
  { label: 'CONTROL', text: 'Set pricing and availability' },
  { label: 'PAYOUTS', text: 'Monthly or bi-weekly options' },
  { label: 'FLEXIBILITY', text: 'Deactivate when you choose' },
]

const EXPERIENCES = [
  { src: tour1, title: 'Guided Tours', desc: 'Stories, places and local insight' },
  { src: tour2, title: 'Cultural Experiences', desc: 'Tradition, community and heritage' },
  { src: tour3, title: 'Adventure & Wildlife', desc: 'Nature-led moments worth booking' },
  { src: tour4, title: 'Nature Walks', desc: 'Trails, waterfalls and landscapes' },
  { src: tour5, title: 'City Exploration', desc: 'Neighbourhoods, landmarks and life' },
  { src: tour6, title: 'Beach & Water Sports', desc: 'Coastal and on-the-water activities' },
  { src: tour7, title: 'Historical Tours', desc: 'Places that shape Ghana\'s story' },
  { src: tour8, title: 'Food & Culinary', desc: 'Flavours, kitchens and local makers' },
]

const FAQ_ITEMS = [
  { question: 'Who can register as a supplier?', answer: 'Registered companies and independent operators that are legally compliant and provide responsible, high-quality travel activities can apply. Listings are reviewed for quality, safety and sustainability.' },
  { question: 'How much does it cost to list?', answer: 'There is no fee to add or maintain an activity. You are charged only when a booking is successful.' },
  { question: 'What is the commission fee?', answer: 'A flat 15% commission applies to each successful booking, meaning you retain 85%. The fee supports platform management, tools, insights and promotion.' },
  { question: 'How and when will I be paid?', answer: 'Completed bookings are consolidated for payout. Suppliers can use the available monthly or bi-weekly schedule, subject to the platform\'s current payment terms and required business documentation.' },
  { question: 'Do I control my pricing and availability?', answer: 'Yes. Suppliers can manage pricing and availability and may deactivate an activity or account when they choose.' },
  { question: 'Do I need technical skills?', answer: 'No. The supplier dashboard is designed to guide you through adding, managing and updating tours, with support available along the way.' },
  { question: 'How are activities promoted?', answer: 'Eligible tours can be promoted through the Travio Ghana website, social channels, email, blog content and relevant partner distribution channels.' },
  { question: 'What happens after I sign up?', answer: 'Confirm your email, access your supplier portal, add your activity and submit the required business information. The Travio Ghana team then reviews your listing before it goes live.' },
]

export default function SupplierRegisterPage({ onOpenAuth, showApplicationForm = true }: SupplierRegisterPageProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useAuthUser()
  const { profile, isLoading } = useSupplierStatus({ forceEnabled: true })
  const [redirecting, setRedirecting] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
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
  const handleSignInHere = async () => {
    if (application && isApprovedSupplier(application.status)) {
      const portalUrl = await getSupplierPortalUrl(application)
      if (portalUrl) { window.location.replace(portalUrl); return }
    }
    onOpenAuth?.('signin')
  }
  const scrollToForm = () => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  // The apply CTAs live on this page too when the form is hidden, so send them
  // to the real application page instead of scrolling to nothing.
  const handleApplyCta = () => {
    if (showApplicationForm) {
      scrollToForm()
      return
    }
    navigate('/supplier/register')
  }

  return (
    <main>
      {/* ── Topline banner ──────────────────────────────── */}
      <div className="le-topline">
        <div className="wrap le-topline-inner">
          <span><strong>Built for Ghana's experience operators.</strong></span>
          <span>No listing fee • Global traveller reach • Supplier support</span>
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="le-hero">
        <div className="wrap le-hero-grid">
          <div className="le-hero-copy">
            <div className="le-kicker"><span />Travio Ghana supplier network</div>
            <h1>Manage your tours. <em>Grow your bookings.</em></h1>
            <p>List your tours and activities, manage availability, track bookings and reach more travellers—all through one powerful platform built for Ghana's experience operators.</p>
            <div className="le-hero-actions">
              <button className="le-btn le-btn-primary" onClick={handleApplyCta}>
                Become a supplier
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
              </button>
              <a className="le-btn le-btn-ghost" href="#how-it-works">See how it works</a>
            </div>
            <div className="le-micro">
              <span><i /> Free to list</span>
              <span><i /> Keep 85% of each booking</span>
              <span><i /> Control your prices</span>
            </div>
          </div>
          <div className="le-device-wall" aria-label="Travio Ghana supplier platform screens">
            {HERO_IMAGES.map((img) => (
              <div key={img.cls} className={`le-device ${img.cls}`}>
                <img src={img.src} alt={img.alt} loading="eager" />
              </div>
            ))}
            <div className="le-float-card le-float-earning">
              <span className="le-float-icon">₵</span>
              <span><strong>85% is yours</strong><small>Per successful booking</small></span>
            </div>
            <div className="le-float-card le-float-booking">
              <span className="le-float-icon">✓</span>
              <span><strong>Booking confirmed</strong><small>Manage it from your dashboard</small></span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Proof bar ───────────────────────────────────── */}
      <div className="wrap le-proof">
        <div className="le-proof-inner">
          {PROOF.map((p, i) => (
            <div key={i} className="le-proof-item">
              <strong>{p.strong}</strong>
              <span>{p.span}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="le-section" id="how-it-works">
        <div className="wrap">
          <RevealOnScroll>
            <div className="le-section-head"><span className="le-label">How it works</span><h2 className="le-title">From sign-up to your first booking.</h2><p className="le-lead">A guided supplier journey that keeps listing simple and gives travellers confidence in every experience.</p></div>
            <div className="le-steps-grid">
              {STEPS.map((s) => (
                <article key={s.num} className="le-step-card">
                  <span className="le-step-num">{s.num}</span>
                  <span className="le-step-arrow">{s.arrow}</span>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </article>
              ))}
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── Why Travio Ghana ─────────────────────────────── */}
      <section className="le-section le-why">
        <div className="wrap">
          <RevealOnScroll>
            <div className="le-why-head">
              <div><span className="le-label">Why Travio Ghana</span><h2 className="le-title">Built to help your business grow.</h2></div>
              <p>Local market understanding, an easy supplier dashboard and OTA-level distribution in one dependable partnership.</p>
            </div>
            <div className="le-why-grid">
              {WHY_CARDS.map((c, i) => (
                <article key={i} className="le-why-card">
                  <div className="le-why-icon">{c.icon}</div>
                  <h3>{c.title}</h3>
                  <p>{c.desc}</p>
                </article>
              ))}
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── Commission terms ──────────────────────────────── */}
      <section className="le-section le-terms">
        <div className="wrap le-terms-shell">
          <div className="le-split-visual">
            <div className="le-split-ring">
              <div className="le-split-inner"><div><strong>85%</strong><span>You keep</span></div></div>
            </div>
            <div className="le-commission-note"><strong>15%</strong> platform fee</div>
          </div>
          <div className="le-terms-copy">
            <span className="le-label">Simple commercial terms</span>
            <h2 className="le-title">You only pay when you receive a booking.</h2>
            <p>Adding and maintaining an activity is free. A flat 15% commission applies only to successful bookings and covers platform tools, insights, management and promotion.</p>
            <div className="le-term-list">
              {TERMS.map((tm, i) => (
                <div key={i} className="le-term-item"><span>{tm.label}</span>{tm.text}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── What you can list (experience carousel) ───────── */}
      <section className="le-section le-experiences">
        <div className="wrap">
          <div className="le-experience-head"><div><span className="le-label">What you can list</span><h2 className="le-title">Put your experience in front of the right traveller.</h2></div><p>From guided city walks and culture to wildlife, food and water adventures.</p></div>
        </div>
        <div className="le-experience-track" aria-label="Experience categories">
          <div className="le-experience-set">
            {EXPERIENCES.map((exp, i) => (
              <figure key={i} className="le-experience-card"><img src={exp.src} alt={exp.title} loading="lazy" /><figcaption><strong>{exp.title}</strong><span>{exp.desc}</span></figcaption></figure>
            ))}
          </div>
          <div className="le-experience-set" aria-hidden="true">
            {EXPERIENCES.map((exp, i) => (
              <figure key={`dup-${i}`} className="le-experience-card"><img src={exp.src} alt="" loading="lazy" /><figcaption><strong>{exp.title}</strong><span>{exp.desc}</span></figcaption></figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section className="le-section">
        <div className="wrap">
          <div className="le-faq-grid">
            <div className="le-faq-side">
              <span className="le-label">Supplier FAQ</span>
              <h2 className="le-title">Know before you list.</h2>
              <p>Clear answers about eligibility, pricing, payments and how the platform helps your business grow.</p>
              <a className="le-btn le-btn-primary" href="https://www.travioghana.com/help-centre">Visit Help Centre</a>
            </div>
            <RevealOnScroll>
              <FAQAccordion items={FAQ_ITEMS} />
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="le-cta-section">
        <div className="wrap">
          <RevealOnScroll>
            <div className="le-cta-inner">
              <div><h2>Ready to list your experience?</h2><p>Join Travio Ghana—it only takes a few minutes to get started.</p></div>
              <button className="le-btn le-btn-primary" onClick={handleApplyCta}>Become a supplier</button>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── Registration form (anchor) ──────────────────────
          Only rendered on /supplier/register. The list-experience marketing
          page passes showApplicationForm={false} so the "Join as a Supplier"
          wizard is not part of that page. */}
      {showApplicationForm && (
        <>
          <div id="apply" ref={formRef} />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative bg-white px-4 py-10 sm:py-16"
          >
            <div className="mx-auto w-full max-w-[720px]">
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
              ) : !user ? (
                <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-8 text-center">
                  <ShieldCheck className="mx-auto mb-3 size-10 text-primary" />
                  <h2 className="text-lg font-bold text-slate-900">{t('supplierAuth.signUpToApply', 'Sign up to apply')}</h2>
                  <p className="mt-2 text-sm text-slate-500">{t('supplierAuth.signUpToApplyDesc', 'You need to be signed up to submit a supplier application.')}</p>
                  <Button type="button" onClick={() => onOpenAuth?.('signup')} className="mt-6 h-12 px-8">
                    {t('supplierAuth.signUpButton', 'Sign Up')}
                  </Button>
                </div>
              ) : application ? (
                <div className="rounded-[1.4rem] border border-emerald-100 bg-emerald-50 p-8 text-center">
                  <ShieldCheck className="mx-auto mb-3 size-10 text-emerald-600" />
                  <h2 className="text-lg font-bold text-slate-900">{t('supplierAuth.applicationSubmitted', 'Application Submitted')}</h2>
                  <p className="mt-2 text-sm text-slate-600">{t('supplierAuth.applicationSubmittedDesc', 'Your supplier application is currently under review. Our team will get back to you within 3-5 business days.')}</p>
                  <p className="mt-3 inline-block rounded-full bg-white px-4 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                    {t('supplierAuth.applicationStatus', 'Status')}: {application?.status ?? 'PENDING'}
                  </p>
                </div>
              ) : (
                <SupplierApplicationForm onSubmitted={refreshStatus} />
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
          </motion.div>
        </>
      )}
      <Footer />
    </main>
  )
}