import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { transformImage } from '@/lib/image'
import { useMoodKeywords, type MoodKeyword } from '../hooks/useHomepageSections'
import { trackMoodClick } from '../lib/analytics'
import CategorySkeleton from './CategorySkeleton'
import './MoodSection.css'

const CARD_WIDTH = 295
const GAP = 16

// Per-keyword fallback images — prevents all missing images from showing
// the same generic photo (previously fell back to FALLBACK_CATEGORIES[0])
const CATEGORY_IMAGE_FALLBACKS: Record<string, string> = {
  'Sports & Adventure': 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=600&q=80',
  'Food & Drink': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
  'Art & Museums': 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=600&q=80',
  'Architecture': 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=600&q=80',
  'Music & Shows': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=600&q=80',
  'Culture & Heritage': 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
  'Animals & Nature': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80',
  'Water Activities': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80',
  'Winter & Snow': 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?auto=format&fit=crop&w=600&q=80',
  'Desert & Safari': 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=600&q=80',
  'Nature & Outdoors': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80',
  'City & Walking Tours': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=600&q=80',
  'Seasonal & Events': 'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?auto=format&fit=crop&w=600&q=80',
  'Wellness & Relaxation': 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
  'Royalty & History': 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
  'Pop Culture & Media': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=600&q=80',
  'Mystery & Horror': 'https://images.unsplash.com/photo-1509248961957-4b7b5a2807bd?auto=format&fit=crop&w=600&q=80',
  'Nightlife & Party': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=600&q=80',
  'Religion & Spirituality': 'https://images.unsplash.com/photo-1509248961957-4b7b5a2807bd?auto=format&fit=crop&w=600&q=80',
  'Transportation': 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=600&q=80',
}

function getKeywordFallbackImage(keyword: string): string {
  if (CATEGORY_IMAGE_FALLBACKS[keyword]) return CATEGORY_IMAGE_FALLBACKS[keyword]
  // Generic nature fallback for unknown keywords
  return 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80'
}

interface Props {
  preloaded?: MoodKeyword[]
  isLoading?: boolean
}

export default function MoodSection({ preloaded, isLoading }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const { data: liveKeywords } = useMoodKeywords(8)

  const items = (preloaded ?? liveKeywords)?.length
    ? (preloaded ?? liveKeywords)!.map((k: MoodKeyword) => ({
        keyword: k.keyword,
        image: k.image && typeof k.image === 'string' && k.image.startsWith('http')
          ? k.image
          : getKeywordFallbackImage(k.keyword),
        tourCount: k.tourCount,
      }))
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
    <section className="mood-section">
      <div className="mood-container">
        <div className="mood-viewport">
          <div className="mood-header">
            <h2 className="mood-title">{t('mood.title')}</h2>
            <div className="mood-arrows">
              <button className={`mood-arrow${!canScrollLeft ? ' muted' : ''}`} onClick={() => scroll('left')} aria-label={t('common.scrollLeft')} disabled={!canScrollLeft}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button className={`mood-arrow${!canScrollRight ? ' muted' : ''}`} onClick={() => scroll('right')} aria-label={t('common.scrollRight')} disabled={!canScrollRight}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mood-clip">
            <div className="mood-carousel" ref={scrollRef}>
                {isLoading && !items
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <div key={`skeleton-${i}`} className="mood-card-wrap">
                        <CategorySkeleton />
                      </div>
                    ))
                  : items?.map((cat, i) => (
                  <div key={`${cat.keyword}-${i}`} className="mood-card-wrap">
                    <button
                      className="mood-card"
                      onClick={() => {
                        trackMoodClick(cat.keyword, i)
                        navigate(`/tours?mood=${encodeURIComponent(cat.keyword)}`)
                      }}
                    >
                      <img
                        src={transformImage(cat.image, { width: 400, height: 280, quality: 'auto:good', format: 'auto', fit: 'crop', gravity: 'auto' }) ?? cat.image}
                        alt={cat.keyword}
                        loading={i < 4 ? 'eager' : 'lazy'}
                        fetchPriority={i === 0 ? 'high' : undefined}
                        decoding="async"
                        width={400}
                        height={280}
                        className="mood-card-img"
                        onError={(e) => {
                          const fallback = getKeywordFallbackImage(cat.keyword)
                          if (e.currentTarget.src !== fallback) {
                            e.currentTarget.src = fallback
                          }
                        }}
                      />
                      <span className="mood-tag">{cat.keyword}</span>
                      <span className="mood-count">{cat.tourCount} {t('mood.tours')}</span>
                      <div className="mood-gradient" />
                      <div className="mood-footer">
                        <h3 className="mood-card-title">{cat.keyword}</h3>
                        <div className="mood-arrow-btn">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </div>
                    </button>
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
