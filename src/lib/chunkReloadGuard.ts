/* ============================================================================
   Stale-chunk recovery.
   ----------------------------------------------------------------------------
   A freshly deployed SPA drops the hashed chunks an already-open tab still
   references, so the next lazy route it navigates to 404s.

   Vite reports that through `vite:preloadError`, and its handler only re-throws
   when the event was NOT default-prevented (vite/dist/node/chunks/node.js):

     function handlePreloadError(err) {
       const e = new Event("vite:preloadError", { cancelable: true })
       e.payload = err
       window.dispatchEvent(e)
       if (!e.defaultPrevented) throw err
     }
     ...
     return baseModule().catch(handlePreloadError)

   That is the trap this module exists to avoid: calling `preventDefault()`
   WITHOUT recovering silences the failure, so the dynamic import resolves to
   `undefined` and React's lazy payload dies reading `.default`:

     TypeError: Cannot read properties of undefined (reading 'default')
         at lazyInitializer (…)

   So the rule is: only silence Vite when we are about to reload, and otherwise
   let the error surface so the route boundary reports it honestly.
   ========================================================================== */

const CHUNK_RELOAD_KEY = 'expedition.chunkReloadedAt'

/**
 * Reloading again inside this window cannot recover — the chunk is either
 * still missing or the network is down — so treat it as a loop rather than a
 * recovery. Outside it, a later deploy is allowed to trigger a fresh reload,
 * which a one-shot "already reloaded" flag could never do.
 */
export const CHUNK_RELOAD_COOLDOWN_MS = 10_000

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
type WindowLike = Pick<Window, 'addEventListener' | 'location'>

function readStorage(): StorageLike | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    // Access can throw when storage is blocked by the browser.
    return null
  }
}

function readLastReloadAt(storage: StorageLike | null): number {
  if (!storage) return 0
  try {
    const raw = storage.getItem(CHUNK_RELOAD_KEY)
    const at = raw ? Number(raw) : 0
    return Number.isFinite(at) ? at : 0
  } catch {
    return 0
  }
}

/**
 * Whether a stale-chunk reload is still worth attempting. False while we are
 * inside the cooldown, i.e. we reloaded moments ago and it is still failing.
 *
 * Exported so the route error boundary shares one budget with the
 * `vite:preloadError` handler: an error that reaches the boundary without
 * going through Vite (`isChunkLoadError`) must not start a second, competing
 * reload loop.
 */
export function canAttemptChunkReload(
  storage: StorageLike | null = readStorage(),
  now: () => number = Date.now,
): boolean {
  const lastReloadAt = readLastReloadAt(storage)
  return !lastReloadAt || now() - lastReloadAt >= CHUNK_RELOAD_COOLDOWN_MS
}

/** Record that a stale-chunk reload is happening now. */
export function markChunkReload(
  storage: StorageLike | null = readStorage(),
  now: () => number = Date.now,
): void {
  try {
    storage?.setItem(CHUNK_RELOAD_KEY, String(now()))
  } catch {
    /* storage unavailable — the caller still reloads */
  }
}

export function installChunkReloadGuard(
  win: WindowLike | undefined = typeof window !== 'undefined' ? window : undefined,
  storage: StorageLike | null = readStorage(),
  now: () => number = Date.now,
): void {
  if (!win) return

  win.addEventListener('vite:preloadError', ((event: Event) => {
    if (!canAttemptChunkReload(storage, now)) {
      // We already reloaded moments ago and it is still failing. Do NOT
      // preventDefault: let Vite reject so the route boundary can report it,
      // instead of handing React an undefined module.
      return
    }

    // Only silence Vite once we are certain we are about to recover.
    ;(event as { preventDefault?: () => void }).preventDefault?.()
    markChunkReload(storage, now)
    win.location.reload()
  }) as EventListener)
}
