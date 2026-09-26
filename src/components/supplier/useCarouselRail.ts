import { useCallback, useEffect, useState, type RefObject } from 'react'

/**
 * The homepage carousels' rail mechanics: a scroll-snap strip whose arrows
 * advance three cards at a time, mirroring RecommendSection and
 * ExternalReviewsSection so the supplier profile behaves identically.
 *
 * The rail ref stays in the component (owning code passes it in) so the hook's
 * return value carries no ref under the React Compiler lint rules. `count`
 * re-measures whenever the rendered cards change (data arriving after first
 * paint).
 */
export function useCarouselRail(
  railRef: RefObject<HTMLDivElement | null>,
  cardWidth: number,
  gap: number,
  count: number,
) {
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const updateArrows = useCallback(() => {
    const el = railRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < maxScroll - 2)
  }, [railRef])

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = railRef.current
    if (!el) return
    const step = cardWidth + gap
    const currentIndex = Math.round(el.scrollLeft / step)
    const maxIndex = Math.ceil(el.scrollWidth / step) - 1
    const targetIndex = direction === 'left'
      ? Math.max(0, currentIndex - 3)
      : Math.min(currentIndex + 3, maxIndex)
    el.scrollTo({ left: targetIndex * step, behavior: 'smooth' })
  }, [railRef, cardWidth, gap])

  useEffect(() => {
    const el = railRef.current
    if (!el) return
    updateArrows()
    const onScroll = () => updateArrows()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', updateArrows)
    }
  }, [railRef, updateArrows, count])

  return { scroll, canScrollLeft, canScrollRight }
}
