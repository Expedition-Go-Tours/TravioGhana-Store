import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import SectionHeading from './SectionHeading'
import PopularLocationCard from './PopularLocationCard'
import DestinationsModal from './DestinationsModal'
import { usePopularDestinations, type PopularDestination } from '../hooks/useHomepageSections'
import './PopularLocations.css'

const CARD_WIDTH = 295
const GAP = 16

function mapToDestination(d: PopularDestination) {
  return {
    title: d.city,
    tours: d.tourCount > 0 ? `${d.tourCount}+ Tours` : 'Explore',
    image: d.heroImage || 'https://images.unsplash.com/photo-1590181076255-de1dbbc106ed?auto=format&fit=crop&w=800&q=80',
    region: d.country || '',
  }
}

interface Props {
  preloaded?: PopularDestination[]
}

export default function PopularLocations({ preloaded }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { data: liveDestinations, isLoading } = usePopularDestinations(10)
  const items = (preloaded ?? liveDestinations)?.length
    ? (preloaded ?? liveDestinations)!.map(mapToDestination)
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
    <section className="popular-locations-section">
      <div className="popular-locations-container">
        <div className="location-viewport">
          <SectionHeading
            title={t('sections.destinations')}
            onViewAllClick={() => setIsModalOpen(true)}
            onScrollLeft={() => scroll('left')}
            onScrollRight={() => scroll('right')}
            disableLeft={!canScrollLeft}
            disableRight={!canScrollRight}
          />
          <div className="location-clip">
            <div className="popular-locations-carousel" ref={scrollRef}>
              {isLoading && !items ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={`skeleton-${i}`} className="location-card-wrap">
                    <div className="location-card-skeleton">
                      <div className="skeleton-shimmer" />
                    </div>
                  </div>
                ))
              ) : (
                items?.map((dest, i) => (
                  <div key={`${dest.title}-${i}`} className="location-card-wrap">
                    <PopularLocationCard {...dest} onClick={() => navigate(`/tours?location=${encodeURIComponent(dest.title)}`)} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <DestinationsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </section>
  )
}
