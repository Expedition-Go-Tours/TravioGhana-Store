/**
 * A Back restore must land at the remembered offset, not scroll there.
 *
 * Below-fold homepage sections normally mount only when their wrapper comes
 * into view. Jumping straight to an offset would leave the wrappers we skipped
 * at zero height, the page would stay short, and the jump would be clamped.
 * During a restore we ask those wrappers to mount up front, then jump once and
 * quietly correct while any late content finishes loading.
 */
export const SCROLL_RESTORE_EVENT = 'travio:scroll-restore'

let activeRestores = 0

export function beginScrollRestore(): void {
  activeRestores += 1
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SCROLL_RESTORE_EVENT))
  }
}

export function endScrollRestore(): void {
  activeRestores = Math.max(0, activeRestores - 1)
}

export function isScrollRestoring(): boolean {
  return activeRestores > 0
}
