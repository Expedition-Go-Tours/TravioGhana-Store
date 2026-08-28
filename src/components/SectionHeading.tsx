import { useTranslation } from 'react-i18next'
import './SectionHeading.css'

interface SectionHeadingProps {
  title: string
  subtitle?: string
  viewAllLink?: string
  onViewAllClick?: () => void
  onScrollLeft?: () => void
  onScrollRight?: () => void
  disableLeft?: boolean
  disableRight?: boolean
}

export default function SectionHeading({
  title,
  subtitle,
  viewAllLink,
  onViewAllClick,
  onScrollLeft,
  onScrollRight,
  disableLeft,
  disableRight,
}: SectionHeadingProps) {
  const { t } = useTranslation()

  return (
    <div className="section-heading">
      <div className="section-heading-text">
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {viewAllLink || onScrollLeft || onScrollRight || onViewAllClick ? (
        <div className="section-heading-actions">
          {viewAllLink && (
            <a href={viewAllLink} className="section-view-all">{t('sections.viewAll')}</a>
          )}
          {onViewAllClick && (
            <button className="section-view-all" onClick={onViewAllClick}>{t('sections.viewAll')}</button>
          )}
          {(onScrollLeft || onScrollRight) && (
            <div className="section-arrows">
              <button className={`section-arrow${disableLeft ? ' muted' : ''}`} onClick={onScrollLeft} aria-label="Scroll left" disabled={disableLeft}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button className={`section-arrow${disableRight ? ' muted' : ''}`} onClick={onScrollRight} aria-label="Scroll right" disabled={disableRight}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
