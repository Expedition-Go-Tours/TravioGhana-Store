import { useTranslation } from 'react-i18next'
import './MobileStickyBar.css'

interface MobileStickyBarProps {
  show: boolean
  priceFormatted: string
  onCheckAvailability: () => void
}

export default function MobileStickyBar({ show, priceFormatted, onCheckAvailability }: MobileStickyBarProps) {
  const { t } = useTranslation()
  return (
    <div className={`mobile-sticky-bar ${show ? 'visible' : ''}`}>
      <div className="mobile-sticky-bar-price">
        <span className="mobile-sticky-bar-from">{t('common.from')}</span>
        <span className="mobile-sticky-bar-amount">{priceFormatted}</span>
        <span className="mobile-sticky-bar-per">{t('tourDetail.perAdultShort')}</span>
      </div>
      <button
        type="button"
        onClick={onCheckAvailability}
        className="mobile-sticky-bar-btn"
      >
        {t('tourDetail.checkAvailability')}
      </button>
    </div>
  )
}
