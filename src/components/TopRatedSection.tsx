import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import TourCard from './TourCard'
import TourCardSkeleton from './TourCardSkeleton'
import { useTopRated, mapToTourCard, type HomepageTour, type HomepageBackfill } from '../hooks/useHomepageSections'
import './TopRatedSection.css'

const CARD_WIDTH = 295
const GAP = 16

interface Props {
  preloaded?: HomepageTour[]
  isLoading?: boolean
  title?: string
  location?: string
  backfill?: HomepageBackfill | null
}

export default function TopRatedSection({ preloaded, isLoading, title, location, backfill }: Props) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const { data: liveData } = useTopRated(12, !preloaded)

  const localItems = (preloaded ?? liveData)?.length
    ? (preloaded ?? liveData)!.map(mapToTourCard)
    : null

  const backfillTours = useMemo(() => {
    if (!backfill?.tours?.length) return []
    return backfill.tours.map(mapToTourCard)
  }, [backfill])

  const items = useMemo(() => {
    if (!localItems) return null
    return backfillTours.length > 0 ? [...localItems, ...backfillTours] : localItems
  }, [localItems, backfillTours])

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
    <section className="toprated-section">
      <div className="toprated-container">
        <div className="toprated-viewport">
          <SectionHeading
            title={title || t('sections.topRatedTitle')}
            viewAllLink={location ? `/tours?near=${encodeURIComponent(location)}&section=Top Rated` : "/tours?section=Top Rated"}
            onScrollLeft={() => scroll('left')}
            onScrollRight={() => scroll('right')}
            disableLeft={!canScrollLeft}
            disableRight={!canScrollRight}
          />
          <div className="toprated-clip">
            <div className="toprated-carousel" ref={scrollRef}>
              {isLoading && !items
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="toprated-card-wrap">
                      <TourCardSkeleton />
                    </div>
                  ))
                : items?.map((tour, i) => (
                    <div key={`${tour.title}-${i}`} className="toprated-card-wrap">
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
