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
 * - Only POP navigations restore. PUSH/REPLACE still land at the top, so
 *   following a link behaves exactly as it did.
 * - The restore is not a single `scrollTo`: pages are lazy and mount on view,
 *   so the document may be too short when the effect runs. We hold until the
 *   remembered offset is reachable, then settle for a beat in case content
 *   above still arrives. Any real input (wheel, touch, key, pointer) cancels
 *   it — a reader who starts scrolling immediately is never yanked back.
 */

import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { scrollToPosition, scrollToTop } from './scrollToTop'

const STORAGE_PREFIX = 'travio:scroll:'
// How long to wait for lazy content to make the remembered offset reachable.
const MAX_WAIT_MS = 2500
// How long to keep correcting after the offset is first applied.
const SETTLE_MS = 600

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

export function writeSavedScroll(key: string, y: number): void {
  if (!isBrowser() || !key) return
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, String(Math.max(0, Math.round(y))))
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
 * Returns a cleanup function so a second navigation during the restore (the
 * reader pressing Back again) cancels this one instead of fighting it.
 */
function restoreScroll(y: number): () => void {
  const startedAt = performance.now()
  let appliedAt: number | null = null
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
  }

  const tick = () => {
    if (cancelled) {
      cleanup()
      return
    }

    const now = performance.now()
    const max = maxScrollable()

    // Too short to hold the remembered offset yet. Wait for lazy sections and
    // images to arrive rather than parking the reader at the bottom of a
    // half-rendered page.
    if (max + 1 < y && now - startedAt < MAX_WAIT_MS) {
      frame = requestAnimationFrame(tick)
      return
    }

    const target = Math.min(y, max)
    if (Math.abs(window.scrollY - target) > 1) {
      scrollToPosition(target)
    }

    if (appliedAt === null) appliedAt = now
    if (now - appliedAt < SETTLE_MS) {
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
    const save = () => {
      frame = 0
      writeSavedScroll(key, window.scrollY)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(save)
    }
    // The last scroll event can land a frame behind where the reader actually
    // stopped; flush synchronously when the tab is hidden or the page unloads.
    const flush = () => {
      if (frame) cancelAnimationFrame(frame)
      save()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
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
      if (y) return restoreScroll(y)
    }

    scrollToTop()
    // `key` is read above but deliberately not a dependency: see the comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search, navigationType])
}
