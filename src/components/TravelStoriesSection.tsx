import { useRef, useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import { travelStories, storySlug } from './data'
import type { TravelStory } from './data'
import './TravelStoriesSection.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

const CARD_WIDTH = 295
const GAP = 16

function StoryCard({ story, t }: { story: TravelStory; t: (key: string) => string }) {
  return (
    <div className="story-card-wrap">
      <Link to={`/stories/${storySlug(story.title)}`} className="story-card">
        <div className="story-card-image">
          <OptimizedImage src={story.image} alt={story.title} width={600} />
        </div>
        <div className="story-card-body">
          <div className="story-card-meta">
            <span className="story-card-date">{story.date}</span>
            <span className="story-card-author">{story.author}</span>
          </div>
          <h3 className="story-card-title">{story.title}</h3>
          <p className="story-card-excerpt">{story.excerpt}</p>
          <span className="story-card-link">{t('stories.readMore')}</span>
        </div>
      </Link>
    </div>
  )
}

export default function TravelStoriesSection() {
  const { t } = useTranslation()
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

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollRef.current
    if (!el) return
    const cardStep = CARD_WIDTH + GAP
    el.scrollTo({ left: index * cardStep, behavior: 'smooth' })
  }, [])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const cardStep = CARD_WIDTH + GAP
    const currentIndex = Math.round(el.scrollLeft / cardStep)
    const maxIndex = Math.ceil(el.scrollWidth / cardStep) - 1
    const targetIndex = direction === 'left'
      ? Math.max(0, currentIndex - 2)
      : Math.min(currentIndex + 2, maxIndex)
    scrollToIndex(targetIndex)
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
    <section className="stories-section">
      <div className="stories-container">
        <div className="stories-viewport">
          <SectionHeading
            title={t('sections.travelStories')}
            viewAllLink="/stories"
            onScrollLeft={() => scroll('left')}
            onScrollRight={() => scroll('right')}
            disableLeft={!canScrollLeft}
            disableRight={!canScrollRight}
          />
          <div className="stories-clip">
            <div className="stories-carousel" ref={scrollRef}>
                {travelStories.map((story, i) => (
                  <StoryCard key={`${story.title}-${i}`} story={story} t={t} />
                ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
