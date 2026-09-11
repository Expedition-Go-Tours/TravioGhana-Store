import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { useLocationSearch } from '../context/LocationSearchContext'
import './HistorySections.css'

/**
 * Shows previous location searches as tappable cards beneath the
 * hero when no active location search is set. Each card re-applies
 * that location as the active filter and navigates to the homepage.
 */
export default function HistorySections() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { previousLocations, setLocation } = useLocationSearch()

  if (previousLocations.length === 0) return null

  return (
    <section className="history-sections">
      <div className="history-sections-container">
        <h2 className="history-sections-title">
          {t('sections.recentlySearched', { defaultValue: 'Recently searched' })}
        </h2>
        <div className="history-sections-cards">
          {previousLocations.map((loc) => (
            <button
              key={loc}
              type="button"
              className="history-sections-card"
              onClick={() => {
                setLocation(loc)
                // Navigate home if not already there
                if (window.location.pathname !== '/') {
                  navigate('/')
                }
              }}
            >
              <MapPin size={18} className="history-sections-card-icon" />
              <span className="history-sections-card-label">{loc}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
