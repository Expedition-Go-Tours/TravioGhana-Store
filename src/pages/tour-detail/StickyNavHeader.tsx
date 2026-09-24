import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import './StickyNavHeader.css'

interface StickyNavHeaderProps {
  show: boolean
  title: string
  /** History-aware back handler (see hooks/useBackNavigation). */
  onBack: () => void
  onWriteReview?: () => void
}

export default function StickyNavHeader({ show, title, onBack, onWriteReview }: StickyNavHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className={`sticky-nav-header ${show ? 'visible' : ''}`}>
      <div className="sticky-nav-header-inner">
        <button
          type="button"
          onClick={onBack}
          className="sticky-nav-back"
          aria-label={t('common.goBack', 'Go back')}
        >
          <ArrowLeft className="sticky-nav-back-icon" />
        </button>
        <h2 className="sticky-nav-title">{title}</h2>
        {onWriteReview && (
          <button type="button" onClick={onWriteReview} className="sticky-nav-write-review">
            {t('reviews.writeAReview')}
          </button>
        )}
      </div>
    </div>
  )
}
