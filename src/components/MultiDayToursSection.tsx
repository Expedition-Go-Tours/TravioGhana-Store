import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import MultiDayCard from './MultiDayCard'
import { multiDayTours } from './data'
import './MultiDayToursSection.css'

const CARD_WIDTH = 295
const GAP = 16

export default function MultiDayToursSection() {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const items = [...multiDayTours].sort((a, b) => {
    if (a.source === 'travio-ghana' && b.source !== 'travio-ghana') return -1
    if (a.source !== 'travio-ghana' && b.source === 'travio-ghana') return 1
    return 0
  })

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

  return (
    <section className="multiday-section">
      <div className="multiday-container">
        <div className="multiday-viewport">
          <SectionHeading
            title={t('sections.multiDayTours')}
            viewAllLink="/tours?section=Multi-Day Tours"
            onScrollLeft={() => scroll('left')}
            onScrollRight={() => scroll('right')}
            disableLeft={!canScrollLeft}
            disableRight={!canScrollRight}
          />
          <div className="multiday-clip">
            <div className="multiday-carousel" ref={scrollRef}>
              {items.map((tour, i) => (
                <div key={`${tour.title}-${i}`} className="multiday-card-wrap">
                  <MultiDayCard {...tour} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
