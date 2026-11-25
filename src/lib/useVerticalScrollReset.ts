import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { isVerticalPath } from './heroVertical'
import { scrollToPosition } from './scrollToTop'

/**
 * Clear scroll-driven chrome at the instant a vertical tab is clicked.
 *
 * React Router commits the new route a frame later. Without this the old,
 * scrolled navbar (and its compact search dock) is still painted over the new
 * hero for that frame — the "navbar looks scrolled" flash. The scroll reset is
 * instant here as well, so an in-flight Lenis glide cannot keep dragging the
 * old page while the new one mounts.
 */
export function prepareVerticalSwitch(): void {
  document.body.classList.remove('hero--search-sticky')
  // Both switch destinations are vertical homepages with a hero, so the
  // translucent navbar belongs there immediately — before React commits the
  // route and recomputes isOverHero.
  document.querySelector('.navbar')?.classList.remove('scrolled', 'navbar--elevated')
  document.querySelector('.navbar')?.classList.add('navbar--over-hero')
  scrollToPosition(0)
}

/**
 * A vertical switch is a tab change, not a page you arrived at mid-scroll.
 * Reset its offset before paint so the incoming hero is framed from the top;
 * doing it in a normal effect let the browser paint the new page at the old
 * scroll position first, which reads as a jump.
 *
 * Real Back/Forward is left to useScrollRestoration — only pushed navigation
 * between verticals is handled here. scrollToPosition drives Lenis as well as
 * the native scroller, so an in-flight glide cannot drag the new page back down.
 */
export function useVerticalScrollReset(): void {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const previous = useRef(pathname)

  useLayoutEffect(() => {
    const from = previous.current
    previous.current = pathname
    if (navigationType === 'POP' || from === pathname) return
    if (!(isVerticalPath(from) || isVerticalPath(pathname))) return
    scrollToPosition(0)
    document.body.classList.remove('hero--search-sticky')
  }, [pathname, navigationType])
}
