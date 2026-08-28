import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import TourCard from './TourCard'
import TourCardSkeleton from './TourCardSkeleton'
import type { TourCardData } from '../hooks/useExpeditionTours'
import { useHomepageOffers, type HomepageOfferTour } from '../hooks/useHomepageSections'
import './LastMinuteDealsSection.css'

const CARD_WIDTH = 295
const GAP = 16

function mapOfferToCardProps(t: HomepageOfferTour): TourCardData {
  const durationStr = t.durationMinutes
    ? t.durationMinutes >= 1440
      ? `${Math.round(t.durationMinutes / 1440)} days`
      : `${Math.round(t.durationMinutes / 60)} hours`
    : ''
  const location = [t.city, t.country].filter(Boolean).join(', ')

  // Compute discount label from the specific offer on this card
  let discount: string | undefined
  if (t.discountType === 'PERCENTAGE' && t.discountPercentage) {
    discount = `-${t.discountPercentage}%`
  } else if (t.discountType === 'FIXED_AMOUNT' && t.fixedDiscountValue && t.startingPrice) {
    const pct = Math.round((t.fixedDiscountValue / t.startingPrice) * 100)
    if (pct > 0) discount = `-${pct}%`
  }

  return {
    id: t.offerId,
    title: t.title,
    slug: t.slug,
    category: t.category || '',
    duration: durationStr,
    features: t.tags?.join(', ') || '',
    price: t.startingPrice != null ? `$${t.startingPrice}` : '',
    rating: t.averageRating != null ? String(t.averageRating) : '',
    reviews: t.reviewCount || 0,
    location,
    image: t.coverPhoto || t.photos?.[0] || '',
    photos: t.photos,
    source: 'Travio Ghana' as const,
    priceValue: t.startingPrice,
    discount,
    specialOffers: t.specialOffers,
    difficulty: t.difficulty || undefined,
    languages: t.languages?.length ? t.languages : undefined,
    cancellationPolicy: t.cancellationPolicy || undefined,
    pickupIncluded: t.pickupIncluded,
    meetingMode: t.meetingMode,
    accommodationIncluded: t.accommodationIncluded || undefined,
  }
}

interface Props {
  preloaded?: HomepageOfferTour[]
  isLoading?: boolean
}

export default function LastMinuteDealsSection({ preloaded, isLoading }: Props) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const { data: offerTours } = useHomepageOffers(12)
  const items = (preloaded ?? offerTours) && (preloaded ?? offerTours)!.length > 0
    ? (preloaded ?? offerTours)!.map(mapOfferToCardProps)
    : null

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
    const onScroll = () => updateArrows()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [updateArrows])

  if (!items && !isLoading) return null

  return (
    <section className="lastminute-section">
      <div className="lastminute-container">
        <div className="lastminute-viewport">
          <SectionHeading
            title={t('sections.lastMinuteDeals')}
            viewAllLink="/tours?section=Last Minute Deals"
            onScrollLeft={() => scroll('left')}
            onScrollRight={() => scroll('right')}
            disableLeft={!canScrollLeft}
            disableRight={!canScrollRight}
          />
          <div className="lastminute-clip">
            <div className="lastminute-carousel" ref={scrollRef}>
              {isLoading && !items
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="lastminute-card-wrap">
                      <TourCardSkeleton />
                    </div>
                  ))
                : items?.map((tour, i) => (
                    <div key={`${tour.title}-${i}`} className="lastminute-card-wrap">
                      <TourCard {...tour} imageClean hideFeatures hideOfferBadge />
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
