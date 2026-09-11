import { useTranslation } from 'react-i18next'
import { useLocationSearch } from '../context/LocationSearchContext'
import PreviousSearchRail from './PreviousSearchRail'
import './PreviousSearchSections.css'

/**
 * Search-history rails shown at the bottom of the personalized homepage.
 *
 * Surfaces the traveller's two most recent previous searches as tour carousels
 * so they can pick up where they left off:
 *   - most recent  → "Continue your search in X"  / "Pick up where you left off."
 *   - the one before → "Previously searched in Y" / "Your earlier destination search."
 *
 * Only rendered while a location is active and there is history. The current
 * location is never repeated.
 */
export default function PreviousSearchSections() {
  const { t } = useTranslation()
  const { hasActiveSearch, currentLocation, previousLocations } = useLocationSearch()

  if (!hasActiveSearch || previousLocations.length === 0) return null

  const rails = previousLocations
    .filter((loc) => loc.toLowerCase() !== currentLocation?.toLowerCase())
    .slice(0, 2)

  if (rails.length === 0) return null

  return (
    <div className="previous-search">
      {rails.map((loc, i) => (
        <PreviousSearchRail
          key={loc}
          location={loc}
          title={
            i === 0
              ? t('sections.continueSearchIn', {
                  location: loc,
                  defaultValue: 'Continue your search in {{location}}',
                })
              : t('sections.previouslySearchedIn', {
                  location: loc,
                  defaultValue: 'Previously searched in {{location}}',
                })
          }
          note={
            i === 0
              ? t('sections.pickUpWhereYouLeftOff', { defaultValue: 'Pick up where you left off.' })
              : t('sections.earlierDestinationSearch', { defaultValue: 'Your earlier destination search.' })
          }
        />
      ))}
    </div>
  )
}
