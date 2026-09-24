import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import './TourDetailTabs.css'

export interface Tab {
  key: string
  label: string
}

interface TourDetailTabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (key: string) => void
  /** History-aware back handler (see hooks/useBackNavigation). */
  onBack?: () => void
  /**
   * Show the back button. The bar is `position: sticky`, so this is switched on
   * once it has taken the top of the viewport — at which point the separate
   * title bar steps aside and would otherwise leave the page with no back
   * affordance for the rest of the scroll.
   */
  showBack?: boolean
}

export default function TourDetailTabs({
  tabs,
  activeTab,
  onTabChange,
  onBack,
  showBack,
}: TourDetailTabsProps) {
  const { t } = useTranslation()

  return (
    <nav className="tour-detail-tabs">
      <div className="tour-detail-tabs-inner">
        {showBack && onBack && (
          <button
            type="button"
            className="tour-detail-tabs-back"
            onClick={onBack}
            aria-label={t('common.goBack', 'Go back')}
          >
            <ArrowLeft size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`tour-detail-tab ${activeTab === tab.key ? 'active' : ''}`}
            aria-pressed={activeTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
