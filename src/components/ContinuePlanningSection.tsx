import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import TourCard from './TourCard'
import ContinuePlanningCard from './ContinuePlanningCard'
import { useContinuePlanning, type ContinuePlanningItem } from '../context/ContinuePlanningContext'
import { useSellOutContext } from '../context/SellOutContext'
import './ContinuePlanningSection.css'
import './skeleton.css'

const CARD_WIDTH = 560
const GAP = 24

// Maps a Continue Planning item onto the TourCard props used by the
// homepage's Recommended carousel, so the mobile cards render identically.
function toTourCardProps(item: ContinuePlanningItem, likelyToSellOut: boolean) {
  return {
    // Only the real backend id belongs in /tour/{id}/{slug}. Legacy items have
    // no `tourId`, so TourCard falls back to the slug-only URL the route
    // resolves instead of building a URL around the synthetic hash.
    id: item.tourId ?? '',
    title: item.title,
    location: item.location,
    price: item.price > 0 ? `$${item.price}` : '',
    duration: item.duration,
    features: item.features,
    image: item.imageUrl,
    photos: item.photos,
    rating: String(item.rating),
    reviews: item.reviewCount,
    category: item.category ?? '',
    languages: item.languages,
    difficulty: item.difficulty,
    cancellationPolicy: item.cancellationPolicy,
    pickupIncluded: item.pickupIncluded,
    meetingMode: item.meetingMode,
    source: item.source,
    externalUrl: item.externalUrl,
    slug: item.slug,
    supplierName: item.supplierName,
    discount: item.discount,
    specialOffers: item.specialOffers,
    likelyToSellOut,
  }
}

/** One carousel slide: shows a skeleton shaped exactly like the real card
 *  (vertical TourCard on mobile, horizontal cp-card on desktop/tablet) until
 *  that card's image has loaded, so cards never pop in over a blank box. */
function ContinuePlanningSlide({
  item,
  likelyToSellOut,
  isMobile,
}: {
  item: ContinuePlanningItem
  likelyToSellOut?: boolean
  isMobile: boolean
}) {
  const [imageReady, setImageReady] = useState(() => !item.imageUrl)

  useEffect(() => {
    if (!item.imageUrl) return
    let cancelled = false
    const img = new Image()
    const done = () => {
      if (!cancelled) setImageReady(true)
    }
    img.onload = done
    img.onerror = done
    img.src = item.imageUrl
    const timeout = window.setTimeout(done, 4000)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      img.onload = null
      img.onerror = null
    }
  }, [item.imageUrl])

  if (!imageReady) {
    return isMobile ? (
      <div className="continue-skeleton continue-skeleton-mobile" aria-hidden="true">
        <span className="continue-skeleton-media">
          <span className="skeleton-shimmer" />
        </span>
        <span className="continue-skeleton-mobile-body">
          <span className="skeleton-line continue-skeleton-loc" />
          <span className="skeleton-line continue-skeleton-title" />
          <span className="skeleton-line continue-skeleton-title-short" />
          <span className="continue-skeleton-row">
            <span className="skeleton-line continue-skeleton-price" />
            <span className="skeleton-line continue-skeleton-rating" />
          </span>
        </span>
      </div>
    ) : (
      <div className="continue-skeleton continue-skeleton-card" aria-hidden="true">
        <span className="continue-skeleton-media">
          <span className="skeleton-shimmer" />
        </span>
        <span className="continue-skeleton-card-body">
          <span className="skeleton-line continue-skeleton-card-line-title" />
          <span className="skeleton-line continue-skeleton-card-line-short" />
          <span className="skeleton-line continue-skeleton-card-line-facts" />
          <span className="continue-skeleton-card-row">
            <span className="skeleton-line continue-skeleton-card-line-rating" />
          </span>
        </span>
        <span className="continue-skeleton-card-price">
          <span className="skeleton-line continue-skeleton-card-line-price" />
        </span>
      </div>
    )
  }

  return isMobile ? (
    <TourCard {...toTourCardProps(item, likelyToSellOut ?? false)} imageClean hideFeatures hideOfferBadge />
  ) : (
    <ContinuePlanningCard item={item} likelyToSellOut={likelyToSellOut} />
  )
}

export default function ContinuePlanningSection() {
  const { t } = useTranslation()
  const { continuePlanning } = useContinuePlanning()
  const { isLikelyToSellOut } = useSellOutContext()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [hasOverflow, setHasOverflow] = useState(false)
  // On mobile the section reuses the Recommended carousel's vertical TourCard
  // so the two sections look identical; desktop keeps the horizontal card.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(max-width: 768px)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setHasOverflow(maxScroll > 1)
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
    const onScroll = () => updateArrows()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows, continuePlanning.length])

  if (continuePlanning.length === 0) return null

  return (
    <section className={`continue-planning-section${hasOverflow ? ' has-overflow' : ''}`}>
      <div className="continue-planning-container">
        <div className="continue-planning-viewport">
          <SectionHeading
            title={t('sections.continuePlanning')}
            onScrollLeft={() => scroll('left')}
            onScrollRight={() => scroll('right')}
            disableLeft={!canScrollLeft}
            disableRight={!canScrollRight}
          />
          <div className="continue-planning-clip">
            <div className="continue-planning-carousel" ref={scrollRef}>
              {continuePlanning.map((item) => (
                <div key={item.id} className="continue-planning-card-wrap">
                  <ContinuePlanningSlide
                    item={item}
                    likelyToSellOut={isLikelyToSellOut({ id: item.tourId || item.id, title: item.title })}
                    isMobile={isMobile}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
