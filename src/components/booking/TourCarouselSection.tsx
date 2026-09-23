import { useRef, useState, useEffect, useCallback } from 'react'
import SectionHeading from '../SectionHeading'
import TourCard from '../TourCard'
import TourCardSkeleton from '../TourCardSkeleton'
import type { TourCardData } from '../../hooks/useExpeditionTours'
import './TourCarouselSection.css'

const CARD_WIDTH = 295
const GAP = 16

interface TourCarouselSectionProps {
  title: string
  subtitle?: string
  viewAllLink?: string
  titleRight?: React.ReactNode
  tours: TourCardData[]
  isLoading?: boolean
  cardWidth?: number
  gap?: number
  scrollStep?: number
  className?: string
}

export default function TourCarouselSection({
  title,
  subtitle,
  viewAllLink,
  titleRight,
  tours,
  isLoading,
  cardWidth = CARD_WIDTH,
  gap = GAP,
  scrollStep = 3,
  className = '',
}: TourCarouselSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

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
    const cardStep = cardWidth + gap
    const currentIndex = Math.round(el.scrollLeft / cardStep)
    const maxIndex = Math.ceil(el.scrollWidth / cardStep) - 1
    const targetIndex = direction === 'left'
      ? Math.max(0, currentIndex - scrollStep)
      : Math.min(currentIndex + scrollStep, maxIndex)
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

  if (!tours.length && !isLoading) return null

  return (
    <div className={`carousel-viewport ${className}`}>
      <div className="carousel-head">
        <SectionHeading
          title={title}
          subtitle={subtitle}
          viewAllLink={viewAllLink}
          onScrollLeft={() => scroll('left')}
          onScrollRight={() => scroll('right')}
          disableLeft={!canScrollLeft}
          disableRight={!canScrollRight}
        />
        {titleRight && <div className="carousel-title-right">{titleRight}</div>}
      </div>
      <div className="carousel-clip">
        <div className="carousel-track" ref={scrollRef} style={{ gap }}>
          {isLoading && !tours.length
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="carousel-card-wrap" style={{ width: cardWidth, minWidth: cardWidth }}>
                  <TourCardSkeleton />
                </div>
              ))
            : tours.map((tour, i) => (
                <div key={`${tour.slug}-${i}`} className="carousel-card-wrap" style={{ width: cardWidth, minWidth: cardWidth }}>
                  <TourCard {...tour} imageClean hideFeatures />
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )
}
