/**
 * Map warm-up helpers — deliberately maplibre-free so the app entry
 * (`main.tsx`) can preconnect/prefetch the tile style and render worker
 * without pulling the ~1 MB map engine into the initial bundle. The heavy
 * engine preload (dynamic `import('./mapUtils')` + an offscreen map) lives in
 * `preloadMapEngine` and is only triggered on booking intent.
 */

import { prefersReducedData } from './perfProfile'

/** OpenFreeMap "Liberty" vector style (keyless OSM tiles). */
export const TILE_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

/** Origin of the OpenFreeMap tile CDN (preconnect target). */
export const TILE_ORIGIN = 'https://tiles.openfreemap.org'

/**
 * Same-origin copy of maplibre's render worker. maplibre resolves the worker
 * from `import.meta.url` at runtime, which bundlers cannot emit; the
 * `copy-maplibre-worker` Vite plugin copies it (and its shared chunk) to
 * `public/maplibre-gl/` on every dev/build. Pinning this URL lets the warm-up
 * fetch the exact file the first real map will request.
 */
export const MAP_WORKER_URL = '/maplibre-gl/maplibre-gl-worker.mjs'

/** Default camera fallback — Accra, the platform's origin market. */
export const DEFAULT_CENTER: [number, number] = [-0.187, 5.6037]

let warmResourcesStarted = false

/**
 * Idempotent warm-up for the tile style and map worker: a preconnect hint to
 * the tile host plus force-cached fetches so the first map opens fast instead
 * of cold-starting against the CDN. Runs once per page load; best-effort and
 * can never throw.
 */
export function warmMapResources(): void {
  if (warmResourcesStarted || typeof document === 'undefined') return
  warmResourcesStarted = true

  try {
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = TILE_ORIGIN
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  } catch {
    /* warm-up is best-effort */
  }

  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return
  const fetchFn = window.fetch.bind(window)
  const targets: { url: string; init: RequestInit }[] = [
    { url: TILE_STYLE, init: { cache: 'force-cache', mode: 'cors' } },
    { url: MAP_WORKER_URL, init: { cache: 'force-cache', mode: 'same-origin' } },
  ]
  for (const { url, init } of targets) {
    try {
      fetchFn(url, init).catch(() => {
        /* best-effort warm-up; a failed prefetch must never break the app */
      })
    } catch {
      /* fetch unavailable — ignore */
    }
  }
}

/**
 * True when the heavy map preload should be skipped: save-data is on, or the
 * connection is 2G/3G. The light warm-up (preconnect + style/worker fetch)
 * still runs — this only gates the ~1 MB engine chunk and offscreen map.
 */
export function shouldSkipHeavyMapPrefetch(): boolean {
  return prefersReducedData()
}

let enginePreloadPromise: Promise<void> | null = null

interface PreloadMapEngineOptions {
  /** Camera to warm tiles for (map convention: [lng, lat]); Accra by default. */
  center?: [number, number]
  zoom?: number
}

/**
 * Warms the full map stack ahead of navigation to the booking page:
 *  1. the light resource warm-up above;
 *  2. on non-slow connections, the maplibre chunk (via `mapUtils`, which also
 *     pins the worker URL) plus a tiny offscreen map that forces the worker,
 *     style, sprites, glyphs, WebGL and first tiles to load into cache.
 *
 * Single-flight and best-effort — it is fully guarded so a failed preload can
 * never delay or break the actual booking navigation.
 */
export function preloadMapEngine(options: PreloadMapEngineOptions = {}): Promise<void> {
  if (!enginePreloadPromise) {
    enginePreloadPromise = runEnginePreload(options)
  }
  return enginePreloadPromise
}

async function runEnginePreload({ center = DEFAULT_CENTER, zoom = 11 }: PreloadMapEngineOptions): Promise<void> {
  warmMapResources()
  if (shouldSkipHeavyMapPrefetch() || typeof document === 'undefined') return

  let container: HTMLDivElement | null = null
  try {
    const { createMapLibreMap } = await import('./mapUtils')

    container = document.createElement('div')
    container.setAttribute('aria-hidden', 'true')
    container.style.cssText =
      'position:fixed;left:-9999px;top:0;width:2px;height:2px;overflow:hidden;opacity:0;pointer-events:none;'
    document.body.appendChild(container)

    const map = createMapLibreMap(container, {
      style: TILE_STYLE,
      center,
      zoom,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    })
    if (!map) {
      container.remove()
      return
    }

    await new Promise<void>((resolve) => {
      let settled = false
      const finish = (): void => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        resolve()
      }
      const timeout = window.setTimeout(finish, 8000)
      map.on('load', () => {
        // Hold briefly after the first render so in-flight sprite/glyph/tile
        // requests can complete and land in the HTTP cache.
        window.setTimeout(finish, 1200)
      })
      map.on('idle', finish)
      map.on('error', () => window.setTimeout(finish, 200))
    })

    map.remove()
  } catch {
    /* best-effort: never surface preload failures to the user */
  } finally {
    container?.remove()
  }
}
