import { useRef, useState, useEffect, useCallback } from 'react'
import SectionHeading from './SectionHeading'
import TourCard from './TourCard'
import TourCardSkeleton from './TourCardSkeleton'
import { useCityRecommended, mapToTourCard } from '../hooks/useHomepageSections'
import './PreviousSearchRail.css'

const CARD_WIDTH = 295
const GAP = 16

interface Props {
  location: string
  title: string
  note: string
}

/**
 * A single search-history rail: a city the traveller searched earlier, shown
 * as a horizontal tour carousel so they can pick up where they left off.
 * Renders nothing once loaded if the city has no tours (never an empty rail).
 */
export default function PreviousSearchRail({ location, title, note }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const { data: tours, isLoading } = useCityRecommended(location, 12)

  const items = tours?.length ? tours.map(mapToTourCard) : null

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
  }, [updateArrows, items])

  if (!isLoading && !items) return null

  return (
    <section className="history-rail">
      <div className="history-rail-container">
        <div className="history-rail-viewport">
          <SectionHeading
            title={title}
            subtitle={note}
            viewAllLink={`/tours?location=${encodeURIComponent(location)}`}
            onScrollLeft={() => scroll('left')}
            onScrollRight={() => scroll('right')}
            disableLeft={!canScrollLeft}
            disableRight={!canScrollRight}
          />
          <div className="history-rail-clip">
            <div className="history-rail-carousel" ref={scrollRef}>
              {isLoading && !items
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="history-rail-card-wrap">
                      <TourCardSkeleton />
                    </div>
                  ))
                : items?.map((tour, i) => (
                    <div key={`${tour.title}-${i}`} className="history-rail-card-wrap">
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
