import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './WhyBookSection.css'

function FeatureIcon({ type }: { type: string }) {
  if (type === 'check') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    )
  }
  if (type === 'card') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    )
  }
  if (type === 'star') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    )
  }
  if (type === 'chat') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    )
  }
  return null
}

export default function WhyBookSection() {
  const { t } = useTranslation()
  const features = [
    { title: t('features.whyBookVerifiedTitle'), text: t('features.whyBookVerifiedDesc'), icon: 'check' },
    { title: t('features.whyBookPaymentsTitle'), text: t('features.whyBookPaymentsDesc'), icon: 'card' },
    { title: t('features.whyBookReviewsTitle'), text: t('features.whyBookReviewsDesc'), icon: 'star' },
    { title: t('features.whyBookSupportTitle'), text: t('features.whyBookSupportDesc'), icon: 'chat' },
  ]
  const [activeDot, setActiveDot] = useState(0)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const cardWidth = el.scrollWidth / features.length
    const index = Math.round(el.scrollLeft / cardWidth)
    setActiveDot(Math.min(index, features.length - 1))
  }

  return (
    <section className="whybook-section">
      <div className="whybook-container">
        <div className="whybook-viewport">
          <h2 className="whybook-heading">{t('features.whyBookHeading')}</h2>
        <div className="whybook-grid" onScroll={handleScroll}>
          {features.map((f) => (
            <div key={f.title} className="whybook-card">
              <div className="whybook-icon-wrap">
                <FeatureIcon type={f.icon} />
              </div>
              <h3 className="whybook-title">{f.title}</h3>
              <p className="whybook-text">{f.text}</p>
            </div>
          ))}
        </div>
        <div className="whybook-dots">
          {features.map((_, i) => (
            <span key={i} className={`whybook-dot${i === activeDot ? ' active' : ''}`} />
          ))}
        </div>
        </div>
      </div>
    </section>
  )
}
