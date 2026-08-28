import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './StickyNavHeader.css'

interface StickyNavHeaderProps {
  show: boolean
  title: string
  onWriteReview?: () => void
}

export default function StickyNavHeader({ show, title, onWriteReview }: StickyNavHeaderProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className={`sticky-nav-header ${show ? 'visible' : ''}`}>
      <div className="sticky-nav-header-inner">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="sticky-nav-back"
          aria-label="Go back"
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
