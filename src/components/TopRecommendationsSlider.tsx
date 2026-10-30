import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import OptimizedImage from '@/components/shared/OptimizedImage'
import { getCategoryMeta } from './categoryMeta'
import { tourPath } from '../lib/tourPath'
import { getTourBlurb } from '../lib/tourBlurbs'
import useMediaQuery from '../hooks/useMediaQuery'
import type { TopRecItem } from './TopRecommendationsGrid'
import './TopRecommendationsSlider.css'

interface Props {
  items: TopRecItem[]
  /** Tour id → full description (detail endpoint). */
  descriptions: Map<string, string>
  title: string
  isLoading?: boolean
}

const SKELETON_SLIDES = 5
/** Copies used for the mobile endless rail (previous / current / next). */
const LOOP_COPIES = 3
const MOBILE_RAIL_QUERY = '(max-width: 760px)'
/** The photo is a 108px column at ≤390px, 124px up to 760px, then the card width. */
const IMAGE_SIZES =
  '(max-width: 390px) 108px, (max-width: 760px) 124px, (max-width: 1050px) 33vw, (max-width: 1300px) 25vw, 295px'

interface SliderSlot {
  key: string
  item: TopRecItem
  itemIndex: number
  copy: number
  decorative: boolean
}

/**
 * The homepage "Our top recommendations" rail.
 *
 * Desktop shows five cards at a time (four ≤1300px, three ≤1050px), phones one
 * card with the next peeking in. It is a native scroll-snap rail — trackpad,
 * touch and keyboard all work for free — with the prototype's circular arrows
 * stepping one card and disabling at the ends on desktop. On phones the rail
 * loops through three copies so a swipe never dead-ends.
 */
export default function TopRecommendationsSlider({ items, descriptions, title, isLoading }: Props) {
  const { t } = useTranslation()
  const railRef = useRef<HTMLDivElement>(null)
  // Cached card + gap width. Measured on layout/resize only: the scroll handler
  // must never force synchronous style/layout reads while the rail is moving.
  const stepWidthRef = useRef(0)
  const reduceMotion = useReducedMotion()
  const isMobile = useMediaQuery(MOBILE_RAIL_QUERY)
  const looping = isMobile && items.length > 1
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const slots = useMemo<SliderSlot[]>(() => {
    if (!looping) {
      return items.map((item, itemIndex) => ({
        key: item.id,
        item,
        itemIndex,
        copy: 0,
        decorative: false,
      }))
    }

    const copies: SliderSlot[] = []
    for (let copy = 0; copy < LOOP_COPIES; copy += 1) {
      items.forEach((item, itemIndex) => {
        copies.push({
          key: `${copy}:${item.id}`,
          item,
          itemIndex,
          copy,
          decorative: copy !== 1,
        })
      })
    }
    return copies
  }, [items, looping])

  /** One card + the rail gap, measured from the DOM so it follows the CSS. */
  const measureStep = useCallback(() => {
    const el = railRef.current
    if (!el) return 0
    const first = el.querySelector<HTMLElement>('.top-recs-slide')
    if (!first) return 0
    const gap = parseFloat(getComputedStyle(el).columnGap || '0') || 0
    return first.getBoundingClientRect().width + gap
  }, [])

  const wrapLoop = useCallback(() => {
    const el = railRef.current
    if (!el || !looping) return
    const loopWidth = stepWidthRef.current * items.length
    if (loopWidth <= 0) return
    if (el.scrollLeft <= 1) {
      el.scrollLeft += loopWidth
    } else if (el.scrollLeft >= loopWidth * 2) {
      el.scrollLeft -= loopWidth
    }
  }, [looping, items.length])

  const updateArrows = useCallback(() => {
    const el = railRef.current
    if (!el) return
    if (looping) {
      setCanPrev(true)
      setCanNext(true)
      return
    }
    setCanPrev(el.scrollLeft > 2)
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [looping])

  // Refresh the cached step and, on phones, start in the middle copy so the
  // first swipe works in both directions.
  useLayoutEffect(() => {
    const el = railRef.current
    if (!el) return
    const stepWidth = measureStep()
    stepWidthRef.current = stepWidth
    if (looping && stepWidth > 0) el.scrollLeft = stepWidth * items.length
  }, [looping, measureStep, items.length])

  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const onScroll = () => {
      wrapLoop()
      updateArrows()
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          const stepWidth = measureStep()
          stepWidthRef.current = stepWidth
          if (looping) {
            const loopWidth = stepWidth * items.length
            if (loopWidth > 0 && (el.scrollLeft <= 1 || el.scrollLeft >= loopWidth * 2)) {
              el.scrollLeft = loopWidth
            }
          }
          updateArrows()
        })
      : null
    observer?.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      observer?.disconnect()
    }
  }, [isLoading, items.length, looping, measureStep, updateArrows, wrapLoop])

  const step = (direction: 1 | -1) => {
    const el = railRef.current
    if (!el) return
    const delta = stepWidthRef.current || measureStep()
    if (!delta) return
    el.scrollBy({ left: direction * delta, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return (
    <>
      <div className="top-recs-head">
        <h2 className="top-recs-heading">{title}</h2>
        <div className="top-recs-actions">
          <div className="top-recs-nav">
            <button
              type="button"
              className="top-recs-nav-btn"
              onClick={() => step(-1)}
              disabled={!canPrev}
              aria-label="Previous tours"
            >
              <ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="top-recs-nav-btn"
              onClick={() => step(1)}
              disabled={!canNext}
              aria-label="Next tours"
            >
              <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
          <Link to="/tours?section=Top Recommendations" className="top-recs-viewall">
            {t('common.seeMore')}
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="top-recs-rail" ref={railRef}>
        {isLoading
          ? Array.from({ length: SKELETON_SLIDES }, (_, index) => (
              <div className="top-recs-slide top-recs-slide--skeleton" key={index} aria-hidden="true">
                <div className="top-recs-skeleton-photo" />
                <div className="top-recs-skeleton-body">
                  <span className="top-recs-skeleton-line" />
                  <span className="top-recs-skeleton-line top-recs-skeleton-line--short" />
                  <span className="top-recs-skeleton-line top-recs-skeleton-line--short" />
                </div>
              </div>
            ))
          : slots.map(({ key, item, itemIndex, copy, decorative }) => {
              // Curated card copy first; a cleaned excerpt of the detail text otherwise.
              const description = getTourBlurb(item.title, descriptions.get(item.id) ?? '')
              const category = getCategoryMeta(item.category)?.label
              return (
                <article
                  className="top-recs-slide"
                  key={key}
                  aria-hidden={decorative || undefined}
                >
                  <a
                    className="top-recs-card"
                    href={tourPath(item.id, item.slug)}
                    target="_blank"
                    rel="noopener"
                    aria-label={item.title}
                    tabIndex={decorative ? -1 : undefined}
                  >
                    <div className="top-recs-photo">
                      {item.image ? (
                        <OptimizedImage
                          src={item.image}
                          alt=""
                          width={320}
                          sizes={IMAGE_SIZES}
                          loading="eager"
                          priority={looping ? copy === 1 && itemIndex === 0 : itemIndex === 0}
                          className="top-recs-img"
                        />
                      ) : (
                        <span className="top-recs-photo-fallback" />
                      )}
                      {category && <span className="top-recs-tag">{category}</span>}
                    </div>
                    <div className="top-recs-body">
                      <h3 className="top-recs-card-title">{item.title}</h3>
                      {description && <p className="top-recs-desc">{description}</p>}
                      <span className="top-recs-go">
                        Check availability
                        <span className="top-recs-go-arrow" aria-hidden="true">→</span>
                      </span>
                    </div>
                  </a>
                </article>
              )
            })}
      </div>
    </>
  )
}
