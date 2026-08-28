import { useTranslation } from 'react-i18next'
import './TourHighlights.css'

interface TourHighlightsProps {
  highlights: string[]
}

export default function TourHighlights({ highlights }: TourHighlightsProps) {
  const { t } = useTranslation()
  return (
    <section className="tour-highlights">
      <h2 className="tour-section-title">{t('tourDetail.highlights')}</h2>
      <ul className="tour-highlights-list">
        {highlights.map((highlight, index) => (
          <li key={index} className="tour-highlight-item">
            <svg className="tour-highlight-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
