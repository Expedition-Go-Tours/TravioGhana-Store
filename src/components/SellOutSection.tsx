import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import TourCard from './TourCard'
import TourCardSkeleton from './TourCardSkeleton'
import { useLikelySellOut, mapToTourCard, type HomepageTour } from '../hooks/useHomepageSections'
import './SellOutSection.css'

const CARD_WIDTH = 295
const GAP = 16

interface Props {
  preloaded?: HomepageTour[]
  isLoading?: boolean
}

export default function SellOutSection({ preloaded, isLoading }: Props) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const { data: liveData } = useLikelySellOut(12)
  const items = (preloaded ?? liveData)?.length
    ? (preloaded ?? liveData)!.map((t) => ({ ...mapToTourCard(t), likelyToSellOut: true }))
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
    <section className="sellout-section">
      <div className="sellout-container">
        <div className="sellout-viewport">
          <SectionHeading
            title={t('sections.likelyToSellOut')}
            viewAllLink="/tours?section=Sell Out"
            onScrollLeft={() => scroll('left')}
            onScrollRight={() => scroll('right')}
            disableLeft={!canScrollLeft}
            disableRight={!canScrollRight}
          />
          <div className="sellout-clip">
            <div className="sellout-carousel" ref={scrollRef}>
              {isLoading && !items
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="sellout-card-wrap">
                      <TourCardSkeleton />
                    </div>
                  ))
                : items?.map((tour, i) => (
                    <div key={`${tour.title}-${i}`} className="sellout-card-wrap">
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
