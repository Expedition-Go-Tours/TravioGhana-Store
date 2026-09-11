import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import NoToursAnimation from './NoToursAnimation'
import SectionHeading from './SectionHeading'
import TourCard from './TourCard'
import { useSearchFallback } from '../hooks/useSearchFallback'
import './NoToursEmptyState.css'

interface Props {
  /** The searched destination, when known (drives the copy + suggestions). */
  location?: string
  /** Primary CTA. Defaults to navigating to the full catalogue. */
  onBrowseAll?: () => void
  /** Optional secondary CTA (e.g. "clear filters" on the tours page). */
  onSecondary?: () => void
  secondaryLabel?: string
}

export default function NoToursEmptyState({ location = '', onBrowseAll, onSecondary, secondaryLabel }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading } = useSearchFallback(location)

  const nearby = data?.nearbyLocations ?? []
  const recommended = data?.recommended ?? []
  const alsoLike = data?.youMayAlsoLike ?? []
  const place = location || t('empty.thisPlace', { defaultValue: 'this destination' })

  return (
    <div className="no-tours">
      <div className="no-tours-hero">
        <NoToursAnimation />
        <h2 className="no-tours-title">{t('empty.title', { defaultValue: "We're not quite there yet" })}</h2>
        <p className="no-tours-sub">
          {t('empty.body', {
            location: place,
            defaultValue:
              'Our team is working hard to bring {{location}} to Expedition-Go. In the meantime, explore handpicked experiences and nearby destinations we think you’ll love.',
          })}
        </p>
        <div className="no-tours-actions">
          <button
            type="button"
            className="no-tours-btn no-tours-btn--primary"
            onClick={onBrowseAll ?? (() => navigate('/tours'))}
          >
            {t('empty.browseAll', { defaultValue: 'Browse all experiences' })}
          </button>
          {onSecondary ? (
            <button type="button" className="no-tours-btn no-tours-btn--ghost" onClick={onSecondary}>
              {secondaryLabel ?? t('empty.clearFilters', { defaultValue: 'Clear filters' })}
            </button>
          ) : (
            nearby.length > 0 && (
              <a href="#no-tours-nearby" className="no-tours-btn no-tours-btn--ghost">
                {t('empty.exploreNearby', { defaultValue: 'Explore nearby' })}
              </a>
            )
          )}
        </div>
      </div>

      {nearby.length > 0 && (
        <section id="no-tours-nearby" className="no-tours-section">
          <SectionHeading title={t('empty.nearbyTitle', { defaultValue: 'Close by' })} />
          <div className="no-tours-chips">
            {nearby.map((loc) => (
              <button
                key={`${loc.city}-${loc.country ?? ''}`}
                type="button"
                className="no-tours-chip"
                onClick={() => navigate(`/tours?place=${encodeURIComponent(loc.city)}`)}
              >
                {loc.coverPhoto && <img src={loc.coverPhoto} alt="" loading="lazy" />}
                <span className="no-tours-chip-body">
                  <span className="no-tours-chip-city">
                    <MapPin size={13} aria-hidden="true" /> {loc.city}
                  </span>
                  <span className="no-tours-chip-meta">
                    {t('empty.experiencesCount', { count: loc.tourCount, defaultValue: '{{count}} experiences' })}
                    {loc.distanceKm ? ` · ${loc.distanceKm} km` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {recommended.length > 0 && (
        <section className="no-tours-section">
          <SectionHeading title={t('empty.recommendedTitle', { defaultValue: 'Recommended for you' })} />
          <div className="no-tours-rail">
            {recommended.map((tour, i) => (
              <div className="no-tours-rail-item" key={tour.id ?? `${tour.title}-${i}`}>
                <TourCard {...tour} imageClean hideFeatures priority={i === 0} />
              </div>
            ))}
          </div>
        </section>
      )}

      {alsoLike.length > 0 && (
        <section className="no-tours-section">
          <SectionHeading title={t('empty.alsoLikeTitle', { defaultValue: 'You may also like' })} />
          <div className="no-tours-rail">
            {alsoLike.map((tour, i) => (
              <div className="no-tours-rail-item" key={tour.id ?? `${tour.title}-${i}`}>
                <TourCard {...tour} imageClean hideFeatures />
              </div>
            ))}
          </div>
        </section>
      )}

      {isLoading && recommended.length === 0 && (
        <p className="no-tours-loading" role="status" aria-live="polite">
          {t('empty.loading', { defaultValue: 'Finding great experiences for you…' })}
        </p>
      )}
    </div>
  )
}
