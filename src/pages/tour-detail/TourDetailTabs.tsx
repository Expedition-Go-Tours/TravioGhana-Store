import './TourDetailTabs.css'

export interface Tab {
  key: string
  label: string
}

interface TourDetailTabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (key: string) => void
}

export default function TourDetailTabs({ tabs, activeTab, onTabChange }: TourDetailTabsProps) {
  return (
    <nav className="tour-detail-tabs">
      <div className="tour-detail-tabs-inner">
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
