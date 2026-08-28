import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import TourCard from './TourCard'
import TourCardSkeleton from './TourCardSkeleton'
import { useRecommendedTours, useExpeditionOffers, type TourCardData } from '../hooks/useExpeditionTours'
import { useRecommended, mapToTourCard, type HomepageTour } from '../hooks/useHomepageSections'
import './RecommendSection.css'

const CARD_WIDTH = 295
const GAP = 16

interface Props {
  preloaded?: HomepageTour[]
  isLoading?: boolean
}

export default function RecommendSection({ preloaded, isLoading }: Props) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const { data: personalizedTours } = useRecommended(12)
  const { data: liveTours } = useRecommendedTours(12)
  const { data: offerTours } = useExpeditionOffers(12)

  // Prefer preloaded > personalized > liveTours
  const baseTours = preloaded?.length
    ? preloaded.map(mapToTourCard)
    : personalizedTours?.length
      ? personalizedTours.map(mapToTourCard)
      : liveTours && liveTours.length > 0
        ? liveTours
        : null

  // Offer tours replace their plain card when present, appended otherwise.
  const items = useMemo(() => {
    if (!baseTours) return null
    if (!offerTours || offerTours.length === 0) return baseTours
    const keyOf = (t: { slug?: string; title: string }) => t.slug || t.title
    const offerByKey = new Map<string, TourCardData>()
    for (const tour of offerTours) offerByKey.set(keyOf(tour), tour)

    const seen = new Set<string>()
    const merged: Array<typeof baseTours[number]> = []
    for (const tour of baseTours) {
      const key = keyOf(tour)
      seen.add(key)
      const offer = offerByKey.get(key)
      merged.push(offer ?? tour)
    }
    for (const tour of offerTours) {
      const key = keyOf(tour)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(tour)
    }
    return merged
  }, [baseTours, offerTours])

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
    <section className="recommend-section">
      <div className="recommend-container">
        <div className="carousel-viewport">
          <SectionHeading
            title={t('sections.recommendedTitle')}
            viewAllLink="/tours?section=Recommended"
            onScrollLeft={() => scroll('left')}
            onScrollRight={() => scroll('right')}
            disableLeft={!canScrollLeft}
            disableRight={!canScrollRight}
          />
          <div className="carousel-clip">
            <div className="recommend-carousel" ref={scrollRef}>
              {isLoading && !items
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="carousel-card-wrap">
                      <TourCardSkeleton />
                    </div>
                  ))
                : items?.map((tour, i) => (
                    <div key={`${tour.title}-${i}`} className="carousel-card-wrap">
                      <TourCard {...tour} imageClean hideFeatures />
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
