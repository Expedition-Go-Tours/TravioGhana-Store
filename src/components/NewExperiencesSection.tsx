import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import TourCard from './TourCard'
import TourCardSkeleton from './TourCardSkeleton'
import { useNewExperiences, mapToTourCard, type HomepageBackfill, type HomepageTour } from '../hooks/useHomepageSections'
import SectionRailDivider from './SectionRailDivider'
import './NewExperiencesSection.css'

const CARD_WIDTH = 295
const GAP = 16

interface Props {
  preloaded?: HomepageTour[]
  isLoading?: boolean
  title?: string
  location?: string
  backfill?: HomepageBackfill | null
}

export default function NewExperiencesSection({ preloaded, isLoading, title, location, backfill }: Props) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  // Scoped sections are authoritative — App passes the city-scoped rows as
  // `preloaded`, so the global new list must not stand in for them.
  const scoped = Boolean(location)
  const { data: liveTours } = useNewExperiences(30, !preloaded && !scoped)

  const localItems = (preloaded ?? liveTours)?.length
    ? (preloaded ?? liveTours)!.map(t => mapToTourCard(t))
    : null

  const backfillTours = useMemo(() => {
    if (!backfill?.tours?.length) return []
    const localIds = new Set((localItems ?? []).map((t) => t.id))
    // The rail must never repeat a card the local rows already show.
    return backfill.tours.map(t => mapToTourCard(t)).filter((t) => !localIds.has(t.id))
  }, [backfill, localItems])

  const items = useMemo(() => {
    if (!localItems && backfillTours.length === 0) return null
    return [...(localItems ?? []), ...backfillTours]
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
            title={title || t('sections.newExperiences')}
            viewAllLink={location ? `/tours?near=${encodeURIComponent(location)}&section=New Experiences` : "/tours?section=New Experiences"}
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
                : (
                    <>
                      {localItems?.map((tour, i) => (
                        <div key={`${tour.id ?? tour.title}-${i}`} className="newexp-card-wrap">
                          <TourCard {...tour} isNew hideSourceBadge hideFeatures imageClean />
                        </div>
                      ))}
                      <SectionRailDivider label={backfill?.label} />
                      {backfillTours.map((tour, i) => (
                        <div key={`rail-${tour.id ?? tour.title}-${i}`} className="newexp-card-wrap">
                          <TourCard {...tour} isNew hideSourceBadge hideFeatures imageClean />
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
