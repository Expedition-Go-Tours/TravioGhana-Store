import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import TourCard from './TourCard'
import TourCardSkeleton from './TourCardSkeleton'
import { useRecommendedTours, useExpeditionOffers, type TourCardData } from '../hooks/useExpeditionTours'
import { useRecommended, mapToTourCard, type HomepageTour, type HomepageBackfill } from '../hooks/useHomepageSections'
import SectionRailDivider from './SectionRailDivider'
import './RecommendSection.css'

const CARD_WIDTH = 295
const GAP = 16

interface Props {
  preloaded?: HomepageTour[]
  isLoading?: boolean
  title?: string
  location?: string
  backfill?: HomepageBackfill | null
}

export default function RecommendSection({ preloaded, isLoading, title, location, backfill }: Props) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  // Scoped sections are authoritative: with a location active the payload
  // carries the local rows plus their labelled nearby rail, so none of the
  // global fallbacks may fill in behind it.
  const scoped = Boolean(location)
  const { data: personalizedTours } = useRecommended(12, !preloaded && !scoped)
  // Only fall back to live endpoints when the aggregate homepage payload did
  // not supply the section — otherwise these duplicate the boot requests.
  const { data: liveTours } = useRecommendedTours(12, !preloaded && !scoped)
  const { data: offerTours } = useExpeditionOffers(12, !preloaded && !scoped)

  // Prefer preloaded > personalized > liveTours
  const baseTours = preloaded?.length
    ? preloaded.map(mapToTourCard)
    : personalizedTours?.length
      ? personalizedTours.map(mapToTourCard)
      : liveTours && liveTours.length > 0
        ? liveTours
        : null

  // Backfill tours (from nearby regions when local has few)
  const backfillTours = useMemo(() => {
    if (!backfill?.tours?.length) return []
    const localIds = new Set((baseTours ?? []).map((t) => t.id))
    // The rail must never repeat a card the local rows already show.
    return backfill.tours.map(mapToTourCard).filter((t) => !localIds.has(t.id))
  }, [backfill, baseTours])

  // Offer tours replace their plain card when present, appended otherwise.
  const items = useMemo(() => {
    if (!baseTours && backfillTours.length === 0) return null
    const all = [...(baseTours ?? []), ...backfillTours]
    if (!offerTours || offerTours.length === 0) return all
    const keyOf = (t: { slug?: string; title: string }) => t.slug || t.title
    const offerByKey = new Map<string, TourCardData>()
    for (const tour of offerTours) offerByKey.set(keyOf(tour), tour)

    const seen = new Set<string>()
    const merged: Array<typeof all[number]> = []
    for (const tour of all) {
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
  }, [baseTours, offerTours, backfillTours])

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
            title={title || t('sections.recommendedTitle')}
            viewAllLink={location ? `/tours?near=${encodeURIComponent(location)}&section=Recommended` : "/tours?section=Recommended"}
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
                : (
                    <>
                      {baseTours?.map((tour, i) => (
                        <div key={`${tour.title}-${i}`} className="carousel-card-wrap">
                          <TourCard {...tour} imageClean hideFeatures priority={i === 0} />
                        </div>
                      ))}
                      {baseTours?.length ? <SectionRailDivider label={backfill?.label} /> : null}
                      {backfillTours.map((tour, i) => (
                        <div key={`rail-${tour.title}-${i}`} className="carousel-card-wrap">
                          <TourCard {...tour} imageClean hideFeatures />
                        </div>
                      ))}
                    </>
                  )
              }
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
