import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './TourInfo.css'

interface TourInfoProps {
  duration: string
  languages: string[]
  difficulty?: 'Easy' | 'Moderate' | 'Challenging' | 'Strenuous'
  groupSize: number
}

export default function TourInfo({ duration, languages, difficulty, groupSize }: TourInfoProps) {
  const { t } = useTranslation()
  const [activeIndex, setActiveIndex] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)

  const difficultyColor = {
    'Easy': '#22c55e',
    'Moderate': '#f59e0b',
    'Challenging': '#ef4444',
    'Strenuous': '#dc2626'
  }

  const cards = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      label: t('common.duration'),
      value: <span className="tour-info-value">{duration}</span>,
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      label: t('tourInfo.groupSize'),
      value: <span className="tour-info-value">{t('tourInfo.upTo', { count: groupSize })}</span>,
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          <path d="M2 12h20" />
        </svg>
      ),
      label: t('tourInfo.languages'),
      value: (
        <div className="tour-info-languages">
          {languages.map((lang, idx) => (
            <span key={idx} className="language-badge">{lang}</span>
          ))}
        </div>
      ),
    },
    ...(difficulty
      ? [
          {
            icon: (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            ),
            label: t('tourInfo.difficulty'),
            value: (
              <span
                className="difficulty-badge"
                style={{ backgroundColor: `${difficultyColor[difficulty]}15`, color: difficultyColor[difficulty] }}
              >
                {difficulty}
              </span>
            ),
          },
        ]
      : []),
  ]

  useEffect(() => {
    const el = gridRef.current
    if (!el) return

    const handleScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth)
      setActiveIndex(Math.min(idx, cards.length - 1))
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => el.removeEventListener('scroll', handleScroll)
  }, [cards.length])

  return (
    <section className="tour-info">
      <h2 className="tour-section-title">{t('tourInfo.title')}</h2>

      <div className="tour-info-grid" ref={gridRef}>
        {cards.map((card, idx) => (
          <div key={idx} className="tour-info-card">
            <div className="tour-info-icon">{card.icon}</div>
            <div className="tour-info-content">
              <span className="tour-info-label">{card.label}</span>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="tour-info-dots">
        {cards.map((_, idx) => (
          <button
            key={idx}
            className={`tour-info-dot ${idx === activeIndex ? 'active' : ''}`}
            onClick={() => {
              const el = gridRef.current
              if (!el) return
              const child = el.children[idx] as HTMLElement
              if (child) child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
            }}
            aria-label={`Go to card ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  )
}
