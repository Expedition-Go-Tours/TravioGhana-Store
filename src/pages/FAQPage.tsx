import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MotionConfig, motion } from 'framer-motion'
import {
  CreditCard,
  RefreshCw,
  MapPin,
  Tag,
  Headset,
  ChevronRight,
  Mail,
  MessageCircle,
  Plus,
  Minus,
  MessageSquare,
} from 'lucide-react'
import Footer from '../components/Footer'
import SEO, { buildFAQSchema, buildBreadcrumbSchema } from '../components/SEO'
import SupportSearch from '../components/support/SupportSearch'
import MobileContactBar from '../components/support/MobileContactBar'
import {
  fadeIn,
  fadeUp,
  revealViewport,
  stagger,
  staggerItem,
} from '../components/support/motion'
import { getAllFaqs, getFaqCategories } from '../lib/faq'
import type { FaqItemData } from '../lib/faq'
import { SUPPORT_EMAIL, WHATSAPP_URL } from '../lib/support'
import { scheduleSupportPrefetch } from '../lib/prefetchSupport'
import './SupportPages.css'
import './SupportHub.css'

/* ------------------------------------------------------------------ */
/*  Category bar config                                               */
/* ------------------------------------------------------------------ */

interface CatBarEntry {
  id: string
  label: string
  icon: typeof CreditCard
}

const SIDEBAR_LABELS: Record<string, { heading: string; subtitle: string }> = {
  booking: { heading: 'Booking & payment', subtitle: 'How to book, pay and confirm' },
  cancellation: { heading: 'Cancellation & refunds', subtitle: 'Cancel, reschedule and refunds' },
  pickup: { heading: 'Pickup & meeting points', subtitle: 'Pickup areas, meeting points' },
  offers: { heading: 'Offers & special deals', subtitle: 'Promo codes and deals' },
  help: { heading: 'Getting help', subtitle: 'Support and contact options' },
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function hashToFaqId(hash: string): string | null {
  const id = hash.replace(/^#/, '')
  return id.startsWith('faq-') ? id.slice(4) : null
}

function hashToCategoryId(hash: string): string | null {
  const id = hash.replace(/^#/, '')
  return id.startsWith('cat-') ? id.slice(4) : null
}

/* ------------------------------------------------------------------ */
/*  FAQ item (inline, not reusing FaqAccordion to support +/- icons)   */
/* ------------------------------------------------------------------ */

function FaqRow({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItemData
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={`sh-faq-item${isOpen ? ' open' : ''}`}
      id={`faq-${item.id}`}
    >
      <button
        type="button"
        className="sh-faq-q"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`faq-${item.id}-answer`}
      >
        <span>{item.q}</span>
        {isOpen ? (
          <Minus size={18} className="sh-faq-chevron" aria-hidden="true" />
        ) : (
          <Plus size={18} className="sh-faq-chevron" aria-hidden="true" />
        )}
      </button>
      <motion.div
        id={`faq-${item.id}-answer`}
        className="sh-faq-a"
        initial={false}
        animate={{
          height: isOpen ? 'auto' : 0,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{
          height: { type: 'spring', stiffness: 420, damping: 38 },
          opacity: { duration: 0.2, ease: 'easeOut' },
        }}
        style={{ overflow: 'hidden' }}
      >
        <p>{item.a}</p>
      </motion.div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function FAQPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const categories = useMemo(() => getFaqCategories(t), [t])
  const allFaqs = useMemo(() => getAllFaqs(t), [t])

  /* ---------- State ---------- */

  const [openIds, setOpenIds] = useState<Set<string>>(
    () => {
      const initial = hashToFaqId(window.location.hash)
      return initial ? new Set([initial]) : new Set()
    },
  )
  const [allExpanded, setAllExpanded] = useState(false)
  const [activeCategoryId, setActiveCategoryId] = useState<string>(categories[0]?.id ?? 'booking')
  const [lastHash, setLastHash] = useState(location.hash)
  const categoryBarRef = useRef<HTMLDivElement>(null)

  /* ---------- Deep-link: hash → open the targeted FAQ ---------- */

  if (location.hash !== lastHash) {
    setLastHash(location.hash)
    const faqId = hashToFaqId(location.hash)
    if (faqId) {
      setOpenIds((prev) => {
        const next = new Set(prev)
        next.add(faqId)
        return next
      })
    }
    const catId = hashToCategoryId(location.hash)
    if (catId) setActiveCategoryId(catId)
  }

  /* ---------- Prefetch Help Centre + Contact chunks ---------- */

  useEffect(() => {
    scheduleSupportPrefetch()
  }, [])

  /* ---------- Scroll to linked item after expand ---------- */

  useEffect(() => {
    const rawId = location.hash.replace(/^#/, '')
    if (!rawId) return
    const timer = window.setTimeout(() => {
      document.getElementById(rawId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [location.hash])

  /* ---------- Expand all / collapse all ---------- */

  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setOpenIds(new Set())
      setAllExpanded(false)
    } else {
      const all = categories.flatMap((c) => c.items.map((i) => i.id))
      setOpenIds(new Set(all))
      setAllExpanded(true)
    }
  }, [allExpanded, categories])

  /* ---------- Toggle a single FAQ item ---------- */

  const toggleItem = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  /* ---------- Category bar config (icons + labels) ---------- */

  const catBarEntries: CatBarEntry[] = useMemo(
    () =>
      categories.map((cat, i) => {
        const icons = [CreditCard, RefreshCw, MapPin, Tag, Headset]
        return {
          id: cat.id,
          label: cat.heading,
          icon: icons[i] ?? CreditCard,
        }
      }),
    [categories],
  )

  /* ---------- Category bar: scroll active pill into view ---------- */

  useEffect(() => {
    if (!categoryBarRef.current) return
    const active = categoryBarRef.current.querySelector<HTMLButtonElement>(
      `[data-cat="${activeCategoryId}"]`,
    )
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeCategoryId])

  /* ---------- Scroll observer: sync active category ---------- */

  useEffect(() => {
    const sectionIds = categories.map((c) => `cat-${c.id}`)
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const catId = entry.target.id.replace('cat-', '')
            setActiveCategoryId(catId)
            break
          }
        }
      },
      { rootMargin: '-180px 0px -60% 0px', threshold: 0 },
    )

    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [categories])

  /* ---------- Navigate to category ---------- */

  const goToCategory = useCallback((catId: string) => {
    setActiveCategoryId(catId)
    const el = document.getElementById(`cat-${catId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  /* ---------- Category sidebar icon ---------- */

  const catIcon = useCallback((catId: string) => {
    switch (catId) {
      case 'booking':
        return <CreditCard size={16} aria-hidden="true" />
      case 'cancellation':
        return <RefreshCw size={16} aria-hidden="true" />
      case 'pickup':
        return <MapPin size={16} aria-hidden="true" />
      case 'offers':
        return <Tag size={16} aria-hidden="true" />
      case 'help':
        return <Headset size={16} aria-hidden="true" />
      default:
        return <ChevronRight size={16} aria-hidden="true" />
    }
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <div className="support-page sh-hub">
        <SEO
          title="Ghana Tours FAQ - Booking, Cancellation & Travel Questions"
          description="Find answers to common questions about booking Ghana tours, cancellation policies, pickup details, payment methods, and more. Get help with your Ghana travel experience."
          keywords="Ghana tours FAQ, booking questions, cancellation policy, Ghana travel help, tour booking FAQ, Ghana experiences questions, Travio Ghana FAQ"
          jsonLd={[
            buildFAQSchema(allFaqs.map((faq) => ({ question: faq.q, answer: faq.a }))),
            buildBreadcrumbSchema([
              { name: 'Home', url: 'https://www.travioghana.com/' },
              { name: 'FAQ', url: 'https://www.travioghana.com/faq' },
            ]),
          ]}
        />

        {/* ============================================================ */}
        {/* 1. Hero section                                              */}
        {/* ============================================================ */}
        <header className="support-hero">
          <motion.div
            className="sh-hero-inner"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.p className="sh-eyebrow" variants={staggerItem}>
              <MessageSquare size={12} aria-hidden="true" />
              {t('supportHub.eyebrow')}
            </motion.p>
            <motion.h1 className="sh-title" id="faq-hero-title" variants={staggerItem}>
              {t('supportHub.faqTitle')}
            </motion.h1>
            <motion.p className="sh-sub" variants={staggerItem}>
              Quick, clear answers about tours, bookings, payments, cancellations, refunds and pickup arrangements.
            </motion.p>
            <motion.div variants={staggerItem}>
              <SupportSearch />
            </motion.div>
          </motion.div>
        </header>

        {/* ============================================================ */}
        {/* 2. Category bar (horizontal scrollable pills)                */}
        {/* ============================================================ */}
        <motion.nav
          className="sh-faq-nav"
          ref={categoryBarRef}
          aria-label={t('faq.categoriesAria')}
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <div className="sh-faq-nav-inner">
            <div className="sh-faq-nav-rail">
              <div className="sh-faq-nav-pills">
                {catBarEntries.map((entry) => {
                  const Icon = entry.icon
                  const isActive = activeCategoryId === entry.id
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      data-cat={entry.id}
                      className={`sh-faq-pill${isActive ? ' sh-faq-pill--active' : ''}`}
                      onClick={() => goToCategory(entry.id)}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <Icon size={14} aria-hidden="true" />
                      {entry.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.nav>

        {/* ============================================================ */}
        {/* 3. FAQ content                                               */}
        {/* ============================================================ */}
        <div className="support-container sh-main sh-main--faq">
          <div className="sh-faq-content">
              {/* Results bar */}
              <div className="sh-faq-results-bar">
                <p className="sh-faq-results-count">
                  {`${categories.reduce((sum, c) => sum + c.items.length, 0)} questions across ${categories.length} categories`}
                </p>
                <button
                  type="button"
                  className="sh-faq-expand-toggle"
                  onClick={toggleAll}
                >
                  {allExpanded ? (
                    <>
                      <Minus size={14} aria-hidden="true" />
                      Collapse all answers
                    </>
                  ) : (
                    <>
                      <Plus size={14} aria-hidden="true" />
                      Expand all answers
                    </>
                  )}
                </button>
              </div>

              {/* FAQ groups */}
              {categories.map((category) => (
                <motion.section
                  key={category.id}
                  id={`cat-${category.id}`}
                  className="sh-faq-group"
                  aria-labelledby={`cat-${category.id}-title`}
                  initial="hidden"
                  whileInView="visible"
                  viewport={revealViewport}
                  variants={fadeIn}
                >
                  <div className="sh-faq-group-header">
                    <div className="sh-faq-group-icon">{catIcon(category.id)}</div>
                    <div>
                      <h2 className="sh-faq-group-title" id={`cat-${category.id}-title`}>
                        {SIDEBAR_LABELS[category.id]?.heading ?? category.heading}
                      </h2>
                      <p className="sh-faq-group-subtitle">
                        {SIDEBAR_LABELS[category.id]?.subtitle ?? ''}
                      </p>
                    </div>
                  </div>

                  <motion.div
                    className="sh-faq-list"
                    initial="hidden"
                    whileInView="visible"
                    viewport={revealViewport}
                    variants={stagger}
                  >
                    {category.items.map((item) => (
                      <FaqRow
                        key={item.id}
                        item={item}
                        isOpen={openIds.has(item.id)}
                        onToggle={() => toggleItem(item.id)}
                      />
                    ))}
                  </motion.div>
                </motion.section>
              ))}

              {/* Contact CTA */}
              <motion.section
                className="sh-cta"
                aria-labelledby="sh-faq-cta-title"
                initial="hidden"
                whileInView="visible"
                viewport={revealViewport}
                variants={fadeUp}
              >
                <div>
                  <h2 className="sh-cta-title" id="sh-faq-cta-title">
                    {t('support.stillNeedHelp')}
                  </h2>
                  <p className="sh-cta-text">{t('faq.needHelpText')}</p>
                </div>
                <div className="sh-cta-actions">
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="sh-btn sh-btn--ghost"
                  >
                    <Mail size={16} aria-hidden="true" />
                    {t('support.emailUs')}
                  </a>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sh-btn sh-btn--ghost"
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                    WhatsApp
                  </a>
                </div>
              </motion.section>
          </div>
        </div>

        {/* Mobile contact bar */}
        <MobileContactBar />

        <Footer />
      </div>
    </MotionConfig>
  )
}
