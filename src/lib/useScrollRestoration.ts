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
 * - A zero from the scroll listener never replaces a remembered positive
 *   offset. On navigation the next route renders as a short skeleton first,
 *   which clamps the browser's scroll to 0 *before* the old entry's save
 *   listener is torn down. Writing that 0 would make Back look like the reader
 *   had left from the top. A sustained top (350ms on a tall page) is the only
 *   thing that clears the memory; a transient 0 from a re-layout or Lenis does
 *   not count as leaving from the top.
 * - Only POP navigations restore. PUSH/REPLACE still land at the top, so
 *   following a link behaves exactly as it did.
 * - The restore is a short convergence loop, not a single `scrollTo`: below-fold
 *   sections mount on view, so the document is shorter than the remembered
 *   offset when the effect first runs. It scrolls as far as the page allows,
 *   lets that mount the next batch, and repeats for up to 3 s. Saves are paused
 *   while it runs, so a clamped position never overwrites the real one. Any
 *   real input (wheel, touch, key, pointer) cancels it — a reader who starts
 *   scrolling immediately is never yanked back.
 */

import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { scrollToPosition, scrollToTop } from './scrollToTop'

const STORAGE_PREFIX = 'travio:scroll:'
// How long to keep correcting while lazy content grows the page.
const MAX_WAIT_MS = 3000
// How long the reader has to sit at the top before 0 counts as deliberate.
const AT_TOP_MS = 350

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
 * The document may be shorter than `y` when this runs — below-fold sections on
 * these pages mount on view — so this is a convergence loop, not a single jump:
 * scroll to what the page can hold, let that mount the next batch, scroll
 * again, until the target is reached or the budget runs out. Landing short of
 * `y` for a frame is invisible next to landing at the top for good.
 *
 * Returns a cleanup function so a second navigation during the restore (the
 * reader pressing Back again) cancels this one instead of fighting it.
 */
function restoreScroll(y: number, onDone: () => void): () => void {
  const startedAt = performance.now()
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

    const target = Math.min(y, maxScrollable())
    if (Math.abs(window.scrollY - target) > 1) {
      scrollToPosition(target)
    }

    if (performance.now() - startedAt < MAX_WAIT_MS) {
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
  // True while the convergence loop is moving the page. Scroll events are a
  // side effect of that movement, and saving them would overwrite the real
  // remembered offset with a clamped, half-loaded one.
  const restoring = useRef(false)

  // Manual, or the browser's own (instant, pre-hydration) restoration races
  // ours and wins on some engines.
  useEffect(() => {
    if (!isBrowser()) return
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  // Save. Keyed by entry, so going Back does not overwrite the page you are
  // returning to with the position of the page you left.
  useEffect(() => {
    if (!isBrowser() || !key) return

    let frame = 0
    // Held while the reader is at the top of a tall page. A single frame at 0
    // is not enough: Lenis and route-level re-layouts both produce those.
    let topTimer = 0
    const save = () => {
      frame = 0
      if (restoring.current) return
      const y = window.scrollY
      if (y > 0) {
        if (topTimer) window.clearTimeout(topTimer)
        topTimer = 0
        writeSavedScroll(key, y)
      } else if (!topTimer && maxScrollable() > 0) {
        topTimer = window.setTimeout(() => {
          topTimer = 0
          writeSavedScroll(key, 0, true)
        }, AT_TOP_MS)
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(save)
    }
    // The last scroll event can land a frame behind where the reader actually
    // stopped; flush synchronously when the tab is hidden or the page unloads.
    // Not forced: a teardown-time 0 is the short next page, not the reader.
    const flush = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      if (!restoring.current) {
        const y = window.scrollY
        if (y > 0) writeSavedScroll(key, y)
      }
    }
    // Capture the exact offset at the moment of navigation, before React
    // renders the next (temporarily short) route and clamps scroll to 0.
    // Capture phase so it runs before the link's own handler pushes history.
    // popstate covers Back/Forward, where no click happens. A 0 here is only
    // written when the reader has been holding the top for AT_TOP_MS.
    const capture = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      if (!restoring.current && window.scrollY > 0) {
        writeSavedScroll(key, window.scrollY)
      }
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
      flush()
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
