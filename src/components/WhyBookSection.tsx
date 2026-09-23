import { useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import './WhyBookSection.css'

function RibbonIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="6" />
      <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
    </svg>
  )
}

function LockCardIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <rect x="6" y="13" width="4" height="4" rx="1" />
      <line x1="8" y1="14" x2="8" y2="16" />
    </svg>
  )
}

function StarChatIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
    </svg>
  )
}

function HeadsetIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  )
}

/** Card copy lives in the locale files (`features.whyBook*Title/Desc`). */
const FEATURES = [
  { Icon: RibbonIcon, titleKey: 'features.whyBookVerifiedTitle', textKey: 'features.whyBookVerifiedDesc' },
  { Icon: LockCardIcon, titleKey: 'features.whyBookPaymentsTitle', textKey: 'features.whyBookPaymentsDesc' },
  { Icon: StarChatIcon, titleKey: 'features.whyBookReviewsTitle', textKey: 'features.whyBookReviewsDesc' },
  { Icon: HeadsetIcon, titleKey: 'features.whyBookSupportTitle', textKey: 'features.whyBookSupportDesc' },
]

export default function WhyBookSection() {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeDot, setActiveDot] = useState(0)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    // Cards are separated by the 12px flex gap — offsetWidth alone drifts.
    const cardWidth = el.children[0] instanceof HTMLElement ? el.children[0].offsetWidth + 12 : 200
    const index = Math.round(el.scrollLeft / cardWidth)
    setActiveDot(Math.min(Math.max(index, 0), FEATURES.length - 1))
  }, [])

  return (
    <section className="whybook-section" aria-labelledby="whybook-heading">
      <div className="whybook-container">
        <div className="whybook-viewport">
        <div className="whybook-card-wrapper">
          <div className="whybook-left">
            <h2 className="whybook-heading" id="whybook-heading">{t('features.whyBookHeading', 'Why travellers book with us')}</h2>
            <div className="whybook-heading-underline" />
            <p className="whybook-description">
              {t('features.whyBookDescription', 'Local expertise, trusted partners and care at every step\u2014so you can explore Ghana with total confidence.')}
            </p>
            <div className="whybook-badge">
              <ShieldCheck size={18} />
              <span>{t('features.whyBookBadge', 'Locally vetted in Ghana')}</span>
            </div>
          </div>
          <div className="whybook-right-wrap">
            <div className="whybook-right" ref={scrollRef} onScroll={handleScroll}>
              {FEATURES.map((f) => (
                <div key={f.titleKey} className="whybook-feature">
                  <div className="whybook-icon-circle">
                    <f.Icon />
                  </div>
                  <div className="whybook-feature-text">
                    <h3 className="whybook-feature-title">{t(f.titleKey)}</h3>
                    <p className="whybook-feature-desc">{t(f.textKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
        <div className="whybook-dots" aria-hidden="true">
          {FEATURES.map((f, i) => (
            <span key={f.titleKey} className={`whybook-dot${i === activeDot ? ' active' : ''}`} />
          ))}
        </div>
      </div>
    </section>
  )
}
