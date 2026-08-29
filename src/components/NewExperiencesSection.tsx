import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import TourCard from './TourCard'
import TourCardSkeleton from './TourCardSkeleton'
import { useNewExperiences, mapToTourCard } from '../hooks/useHomepageSections'
import './NewExperiencesSection.css'

const CARD_WIDTH = 295
const GAP = 16

interface Props {
  isLoading?: boolean
}

export default function NewExperiencesSection({ isLoading }: Props) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const { data: liveTours } = useNewExperiences(30)

  const items = liveTours?.length
    ? liveTours.map(t => {
        const card = mapToTourCard(t)
        // Carousel slides: the supplier-chosen cover photo leads, followed by
        // the remaining unique photos — so cards get the same image carousel
        // as every other section while the best-quality cover stays first.
        const rest = (card.photos ?? []).filter(p => typeof p === 'string' && p.length > 0 && p !== card.image)
        return { ...card, photos: card.image ? [card.image, ...rest] : card.photos }
      })
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
    // Re-evaluate when the tour data arrives — the carousel starts empty (so
    // both arrows compute as muted), then grows once the newest tours load.
    // Without this the right arrow would stay muted forever, even though the
    // carousel is scrollable.
    const ro = new ResizeObserver(() => updateArrows())
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [updateArrows])

  return (
    <section className="newexp-section">
      <div className="newexp-container">
        <div className="newexp-viewport">
          <SectionHeading
            title={t('sections.newExperiences')}
            viewAllLink="/tours?section=New Experiences"
            onScrollLeft={() => scroll('left')}
            onScrollRight={() => scroll('right')}
            disableLeft={!canScrollLeft}
            disableRight={!canScrollRight}
          />
          <div className="newexp-clip">
            <div className="newexp-carousel" ref={scrollRef}>
              {isLoading && !items
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="newexp-card-wrap">
                      <TourCardSkeleton />
                    </div>
                  ))
                : items?.map((tour, i) => (
                    <div key={`${tour.id ?? tour.title}-${i}`} className="newexp-card-wrap">
                      <TourCard {...tour} isNew hideSourceBadge hideFeatures imageClean />
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
