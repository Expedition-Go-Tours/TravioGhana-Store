import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import SectionHeading from './SectionHeading'
import TourCardSkeleton from './TourCardSkeleton'
import { type Attraction } from './attractionsData'
import { useAttractions, type HomepageAttraction } from '../hooks/useHomepageSections'
import { storeLocation } from '../lib/analytics'
import { transformImage } from '../lib/image'
import './TopAttractionsNearbySection.css'

const CARD_WIDTH = 295
const GAP = 16

function AttractionCard({
  attraction,
  onClick,
}: {
  attraction: Attraction
  onClick: () => void
}) {
  const { t } = useTranslation()
  const priceStr = attraction.startingPrice != null ? `$${attraction.startingPrice}` : ''
  const distanceStr = attraction._distance != null
    ? attraction._distance < 1
      ? `${Math.round(attraction._distance * 1000)}m`
      : `${attraction._distance.toFixed(1)} km`
    : null

  return (
    <button type="button" className="attraction-card" onClick={onClick}>
      {attraction.heroImage && (
        <img
          src={transformImage(attraction.heroImage, { width: 590, height: 672, quality: 'auto:best', format: 'auto', fit: 'fill' }) ?? attraction.heroImage}
          alt={attraction.name}
          className="attraction-card-img"
          loading="lazy"
          decoding="async"
          width={295}
          height={336}
          onError={(e) => {
            const target = e.currentTarget
            target.onerror = null
            target.src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=590&h=672&fit=crop'
          }}
        />
      )}
      <div className="attraction-card-overlay" />
      <div className="attraction-card-badges">
        <span className="attraction-card-badge">
          {t('sections.attractionsBadge', { defaultValue: 'Attraction' })}
        </span>
        {distanceStr && (
          <span className="attraction-card-distance">
            {distanceStr}
          </span>
        )}
      </div>
      <div className="attraction-card-footer">
        <div className="attraction-card-location">
          <MapPin className="attraction-card-pin" size={13} />
          <span>{attraction.tourCount} {t('sections.tours', { defaultValue: 'tours' })}</span>
        </div>
        <div className="attraction-card-title-row">
          <h3 className="attraction-card-title" title={attraction.name}>{attraction.name}</h3>
          {priceStr && (
            <div className="attraction-card-price">
              <p className="attraction-card-from">{t('common.from')}</p>
              <p className="attraction-card-amount">{priceStr}</p>
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

interface Props {
  preloaded?: HomepageAttraction[]
  title?: string
  location?: string
}

export default function TopAttractionsNearbySection({ preloaded, title, location }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const { data: attractionsData, isLoading } = useAttractions(12, !preloaded)
  const locationRequestedRef = useRef(false)

  const attractions = (preloaded ?? attractionsData) ?? []

  // Request geolocation permission once to store location for the hook.
  // Backend now handles proximity sorting — this just ensures the stored
  // location is available for subsequent API calls. (Ref guard — no re-render
  // needed for a one-time request.) Deferred past the first paint/network
  // burst so the prompt + proximity fetch don't compete with the initial load.
  useEffect(() => {
    if (locationRequestedRef.current) return
    if (!navigator.geolocation) return

    const request = () => {
      if (locationRequestedRef.current) return
      locationRequestedRef.current = true
      navigator.geolocation.getCurrentPosition(
        (position) => {
          storeLocation(position.coords.latitude, position.coords.longitude)
        },
        () => { /* permission denied — hook will use global popularity sort */ },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
      )
    }

    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(request, { timeout: 4000 })
      : window.setTimeout(request, 2500)

    return () => {
      if (w.requestIdleCallback && w.cancelIdleCallback) w.cancelIdleCallback(id)
      else window.clearTimeout(id)
    }
  }, [])

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < maxScroll - 2)
  }, [])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const cardStep = CARD_WIDTH + GAP
    const currentIndex = Math.round(el.scrollLeft / cardStep)
    const maxIndex = Math.ceil(el.scrollWidth / cardStep) - 1
    const targetIndex = direction === 'left'
      ? Math.max(0, currentIndex - 3)
      : Math.min(currentIndex + 3, maxIndex)
    el.scrollTo({ left: targetIndex * cardStep, behavior: 'smooth' })
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows, { passive: true })
    return () => el.removeEventListener('scroll', updateArrows)
  }, [updateArrows])

  return (
    <section className="attractions-section">
      <div className="attractions-container">
        <div className="attractions-viewport">
          <SectionHeading
            title={title || t('sections.topAttractionsNearby')}
            viewAllLink={location ? `/tours?near=${encodeURIComponent(location)}&section=Top Attractions Nearby` : "/tours?section=Top Attractions Nearby"}
            onScrollLeft={() => scroll('left')}
            onScrollRight={() => scroll('right')}
            disableLeft={!canScrollLeft}
            disableRight={!canScrollRight}
          />
          {isLoading ? (
            <div className="attractions-clip">
              <div className="attractions-carousel" ref={scrollRef}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`skeleton-${i}`} className="attractions-card-wrap">
                    <TourCardSkeleton />
                  </div>
                ))}
              </div>
            </div>
          ) : attractions.length === 0 ? (
            <div className="attractions-empty">{t('sections.noAttractions', { defaultValue: 'No attractions found.' })}</div>
          ) : (
            <div className="attractions-clip">
              <div className="attractions-carousel" ref={scrollRef}>
                {attractions.map((attraction, i) => (
                  <div key={`${attraction.name}-${i}`} className="attractions-card-wrap">
                    <AttractionCard
                      attraction={attraction}
                      onClick={() => navigate(`/tours?attraction=${encodeURIComponent(attraction.name)}`)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
