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
 * - A return lands at the remembered offset in one jump. Below-fold sections
 *   normally mount only when their wrapper enters the viewport; a jump would
 *   skip those wrappers and be clamped short. The restore tells them to mount
 *   first, then jumps once and silently corrects while late content settles.
 *   Any real input cancels the correction — a reader who starts scrolling is
 *   never yanked back.
 */

import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { scrollToPosition, scrollToTop } from './scrollToTop'
import { beginScrollRestore, endScrollRestore } from './scrollRestoreSignal'

const STORAGE_PREFIX = 'travio:scroll:'
// How long to keep a silent correction alive while lazy content grows the page.
const MAX_WAIT_MS = 3000
// How long the reader has to sit at the top before 0 counts as deliberate.
const AT_TOP_MS = 350
// A wheel/touch/key can leave Lenis gliding for over a second. Keep treating
// its scroll events as the reader's for the length of that glide.
const USER_SCROLL_GRACE_MS = 1800

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

/**
 * React Router reports POP on the very first render too. Without this check a
 * reload — or a link pasted into the same tab — would restore the offset left
 * under the reused `default` key instead of opening at the top. Only a genuine
 * browser Back/Forward load is allowed to restore on first render.
 */
function isBackForwardLoad(): boolean {
  if (!isBrowser() || typeof performance === 'undefined') return false
  const entries = performance.getEntriesByType?.('navigation') as PerformanceNavigationTiming[] | undefined
  return entries?.[0]?.type === 'back_forward'
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
 * Put the reader back at `y` in one jump, then hold there quietly.
 *
 * `beginScrollRestore` tells below-fold wrappers to mount before the jump, so
 * the document is already tall enough and the landing is not clamped. Late
 * data can still grow the page; re-applying the same target each frame keeps
 * the reader at `y` without turning the correction into a visible scroll.
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
  // A two-finger horizontal swipe is how many trackpad users press Back. Its
  // wheel tail arrives *after* the navigation and must not abort the restore
  // it just triggered. Only a vertical wheel means "I am scrolling now".
  const cancelOnWheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaY) >= Math.abs(event.deltaX)) cancel()
  }
  window.addEventListener('wheel', cancelOnWheel, { passive: true })
  const events: [string, EventTarget][] = [
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
    window.removeEventListener('wheel', cancelOnWheel)
    for (const [name, target] of events) {
      target.removeEventListener(name, cancel)
    }
    endScrollRestore()
    onDone()
  }

  const apply = () => {
    const target = Math.min(y, maxScrollable())
    if (Math.abs(window.scrollY - target) > 1) scrollToPosition(target)
  }

  const tick = () => {
    if (cancelled) {
      cleanup()
      return
    }
    apply()
    if (performance.now() - startedAt < MAX_WAIT_MS) {
      frame = requestAnimationFrame(tick)
    } else {
      cleanup()
    }
  }

  beginScrollRestore()
  // First frame: let the restore event's state updates mount the sections.
  // Second frame: jump straight there, then keep quiet watch over the height.
  frame = requestAnimationFrame(() => {
    if (cancelled) {
      cleanup()
      return
    }
    apply()
    frame = requestAnimationFrame(tick)
  })

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
  // The route we last rendered. A first render is not a return to a saved
  // entry, even though React Router labels its navigation type POP.
  const lastRoute = useRef<string | null>(null)

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

    // The key distinguishes two entries on the same URL — e.g. the footer's
    // "Home" link pushes a second '/' while the reader is already on '/'.
    const route = key + pathname + search
    const isFirstRoute = lastRoute.current === null || lastRoute.current === route
    lastRoute.current = route

    // A fresh mount is not a return, even when React Router calls it POP.
    // The only exception is a real browser Back/Forward load, where the whole
    // document was recreated and sessionStorage still holds the old offset.
    if (navigationType === 'POP' && (!isFirstRoute || isBackForwardLoad())) {
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
