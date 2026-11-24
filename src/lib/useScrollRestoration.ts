/**
 * Remember where the reader was, and put them back on Back.
 *
 * Every route change used to land at the top. That is right for a link you
 * *follow* and wrong for one you *return from*: tapping a footer link at the
 * bottom of the homepage and pressing Back dropped you at the top of the
 * homepage, thousands of pixels from where you left.
 *
 * How it works:
 * - `location.key` identifies a history entry. It is stable across Back and
 *   Forward, so it is the natural key for "where this entry was".
 * - The current offset is written to `sessionStorage` on scroll (one write per
 *   animation frame, not per scroll event) and flushed when the tab is hidden.
 *   Session storage, not local: a restored position belongs to this tab.
 * - Only scrolls that follow real input (wheel/touch/key/pointer) are saved.
 *   Lenis, the browser's own POP jump and this hook's restore loop all emit
 *   scroll events with no input behind them; writing those replaced the
 *   remembered offset with a half-rendered, clamped one.
 * - A zero never replaces a remembered positive offset unless the reader held
 *   the top for AT_TOP_MS. The next route renders as a short skeleton first,
 *   which clamps scrollY to 0 before the outgoing save listener is removed.
 * - The restore is a short walk down, not a single `scrollTo`: below-fold
 *   sections mount on view, so a jump to the remembered offset skips their
 *   zero-height wrappers, they never mount, and the page stays short. The walk
 *   advances a viewport at a time, letting each observer fire, then holds at
 *   the target while lazy content settles (up to 3 s). Any real input cancels
 *   it — a reader who starts scrolling is never yanked back.
 */

import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { scrollToPosition, scrollToTop } from './scrollToTop'

const STORAGE_PREFIX = 'travio:scroll:'
// How long to keep walking/correcting while lazy content grows the page.
const MAX_WAIT_MS = 3000
// Pause between steps so IntersectionObservers can mount the next section.
const STEP_MS = 90
// How long the reader has to sit at the top before 0 counts as deliberate.
const AT_TOP_MS = 350
// A wheel/touch/key can leave Lenis gliding for over a second. Keep treating
// its scroll events as the reader's for the length of that glide.
const USER_SCROLL_GRACE_MS = 1800

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

/** sessionStorage throws in some privacy modes; a lost position is not fatal. */
export function readSavedScroll(key: string): number | null {
  if (!isBrowser() || !key) return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key)
    if (raw == null) return null
    const y = Number(raw)
    return Number.isFinite(y) && y > 0 ? y : null
  } catch {
    return null
  }
}

export function writeSavedScroll(key: string, y: number, force = false): void {
  if (!isBrowser() || !key) return
  const next = Math.max(0, Math.round(y))
  try {
    // A clamped 0 during a route swap is not the reader scrolling to the top;
    // it is the next page not having rendered yet. Keep the real offset.
    // `force` is only used once we have proof the reader chose the top.
    if (!force && next === 0 && readSavedScroll(key) !== null) return
    window.sessionStorage.setItem(STORAGE_PREFIX + key, String(next))
  } catch {
    // Private mode or a full quota: keep the navigation, lose the memory.
  }
}

function maxScrollable(): number {
  const doc = document.documentElement
  return Math.max(0, doc.scrollHeight - window.innerHeight)
}

/**
 * Put the reader back at `y`, then stop.
 *
 * Below-fold sections mount on view. Jumping straight to `y` skips their
 * zero-height wrappers: they never intersect, never mount, and the page stays
 * short. Walk down in viewport-sized steps instead, pausing at each so its
 * observer can fire and grow the document, then hold at `y` while the last
 * sections settle. Landing short for a moment is invisible next to landing at
 * the top for good.
 *
 * Returns a cleanup function so a second navigation during the restore (the
 * reader pressing Back again) cancels this one instead of fighting it.
 */
function restoreScroll(y: number, onDone: () => void): () => void {
  const startedAt = performance.now()
  const stepSize = Math.max(300, (window.innerHeight || 800) * 0.75)
  let nextStep = 0
  let lastStepAt = 0
  let frame = 0
  let cancelled = false

  // The reader taking over is the signal to stop correcting. `pointerdown`
  // covers grabbing the scrollbar, which fires no wheel or touch event.
  const cancel = () => {
    cancelled = true
  }
  const events: [string, EventTarget][] = [
    ['wheel', window],
    ['touchstart', window],
    ['keydown', window],
    ['pointerdown', window],
  ]
  for (const [name, target] of events) {
    target.addEventListener(name, cancel, { passive: true, once: true })
  }

  const cleanup = () => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    for (const [name, target] of events) {
      target.removeEventListener(name, cancel)
    }
    onDone()
  }

  const tick = () => {
    if (cancelled) {
      cleanup()
      return
    }

    const now = performance.now()
    if (now - lastStepAt >= STEP_MS) {
      lastStepAt = now
      const max = maxScrollable()
      // Walk from the top towards y. Each pause lets an observer mount the
      // next section; skipping a section leaves a zero-height hole forever.
      const desired = Math.min(nextStep, y)
      const target = Math.min(desired, max)
      if (Math.abs(window.scrollY - target) > 1 || desired > max) {
        scrollToPosition(target)
      }
      nextStep += stepSize
    }

    if (now - startedAt < MAX_WAIT_MS) {
      frame = requestAnimationFrame(tick)
    } else {
      cleanup()
    }
  }

  frame = requestAnimationFrame(tick)

  return () => {
    cancelled = true
    cleanup()
  }
}

/**
 * Mount once, inside the router: saves the offset for the current entry and
 * restores it when the reader comes back to that entry.
 */
export function useScrollRestoration(): void {
  const location = useLocation()
  const navigationType = useNavigationType()
  const { key, pathname, search } = location
  // True while the convergence loop is moving the page.
  const restoring = useRef(false)
  // Last real scroll input, used to tell the reader's scroll from Lenis's,
  // the browser's POP jump and our own restore loop.
  const lastInputAt = useRef(0)

  useEffect(() => {
    if (!isBrowser()) return
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    const markInput = () => {
      lastInputAt.current = performance.now()
    }
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown']
    for (const name of events) {
      window.addEventListener(name, markInput, { passive: true, capture: true })
    }
    return () => {
      for (const name of events) {
        window.removeEventListener(name, markInput, true)
      }
    }
  }, [])

  // Save. Keyed by entry, so going Back does not overwrite the page you are
  // returning to with the position of the page you left.
  useEffect(() => {
    if (!isBrowser() || !key) return

    let frame = 0
    let topTimer = 0
    let sustainedTop = false
    const save = () => {
      frame = 0
      if (restoring.current) return
      // A programmatic scroll (Lenis glide, browser POP jump, restore loop)
      // is not a statement of where the reader wants to return.
      if (performance.now() - lastInputAt.current > USER_SCROLL_GRACE_MS) return

      const y = window.scrollY
      if (y > 0) {
        if (topTimer) window.clearTimeout(topTimer)
        topTimer = 0
        sustainedTop = false
        writeSavedScroll(key, y)
      } else if (!topTimer && !sustainedTop && maxScrollable() > 0) {
        topTimer = window.setTimeout(() => {
          topTimer = 0
          sustainedTop = true
          writeSavedScroll(key, 0, true)
        }, AT_TOP_MS)
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(save)
    }
    // The last scroll event can land a frame behind where the reader actually
    // stopped; flush synchronously when the tab is hidden or the page unloads.
    const flush = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      if (!restoring.current && window.scrollY > 0) {
        writeSavedScroll(key, window.scrollY)
      }
    }
    // Capture the exact offset at the moment of navigation, before React
    // renders the next (temporarily short) route and clamps scroll to 0.
    // Capture phase so it runs before the link's own handler pushes history.
    // popstate covers Back/Forward, where no click happens.
    const capture = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      if (restoring.current) return
      const y = window.scrollY
      if (y > 0) writeSavedScroll(key, y)
      else if (sustainedTop) writeSavedScroll(key, 0, true)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    document.addEventListener('click', capture, true)
    window.addEventListener('popstate', capture)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
      document.removeEventListener('click', capture, true)
      window.removeEventListener('popstate', capture)
      if (topTimer) window.clearTimeout(topTimer)
      // No teardown flush: a route swap's scrollY belongs to the next page.
      // The capture above has already recorded where the reader left.
    }
  }, [key])

  // Restore on Back/Forward; land at the top for everything else.
  //
  // Depends on path+search rather than `location.key`: a hash-only navigation
  // (FAQ jump links) keeps the same path and must be left to the page, which
  // scrolls to its own anchor.
  useEffect(() => {
    if (!isBrowser()) return

    if (navigationType === 'POP') {
      const y = readSavedScroll(key)
      if (y) {
        restoring.current = true
        const stop = restoreScroll(y, () => {
          restoring.current = false
        })
        return () => {
          restoring.current = false
          stop()
        }
      }
    }

    scrollToTop()
    // `key` is read above but deliberately not a dependency: see the comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search, navigationType])
}
