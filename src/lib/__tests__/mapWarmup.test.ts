import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type ConnectionLike = { saveData?: boolean; effectiveType?: string }

function setConnection(connection: ConnectionLike | undefined): void {
  if (connection === undefined) {
    delete (navigator as unknown as { connection?: unknown }).connection
    return
  }
  Object.defineProperty(navigator, 'connection', { value: connection, configurable: true })
}

describe('mapWarmup resource warm-up', () => {
  beforeEach(() => {
    vi.resetModules()
    document.querySelectorAll('link[rel="preconnect"]').forEach((l) => l.remove())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    setConnection(undefined)
  })

  it('preconnects to the tile host and force-caches the style + worker', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { warmMapResources, TILE_STYLE, MAP_WORKER_URL } = await import('../mapWarmup')

    warmMapResources()

    const hosts = Array.from(document.querySelectorAll('link[rel="preconnect"]')).map((l) =>
      l.getAttribute('href'),
    )
    expect(hosts).toContain('https://tiles.openfreemap.org')
    expect(fetchMock).toHaveBeenCalledWith(
      TILE_STYLE,
      expect.objectContaining({ cache: 'force-cache', mode: 'cors' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      MAP_WORKER_URL,
      expect.objectContaining({ cache: 'force-cache', mode: 'same-origin' }),
    )
  })

  it('runs once per page load even when called repeatedly', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { warmMapResources } = await import('../mapWarmup')

    warmMapResources()
    warmMapResources()
    warmMapResources()

    expect(document.querySelectorAll('link[rel="preconnect"]')).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('never throws when fetch is unavailable', async () => {
    vi.stubGlobal('fetch', undefined)
    const { warmMapResources } = await import('../mapWarmup')
    expect(() => warmMapResources()).not.toThrow()
  })

  it('gates the heavy preload on save-data and slow connections', async () => {
    const { shouldSkipHeavyMapPrefetch } = await import('../mapWarmup')

    setConnection({ saveData: true })
    expect(shouldSkipHeavyMapPrefetch()).toBe(true)

    setConnection({ effectiveType: 'slow-2g' })
    expect(shouldSkipHeavyMapPrefetch()).toBe(true)
    setConnection({ effectiveType: '2g' })
    expect(shouldSkipHeavyMapPrefetch()).toBe(true)
    setConnection({ effectiveType: '3g' })
    expect(shouldSkipHeavyMapPrefetch()).toBe(true)

    setConnection({ effectiveType: '4g' })
    expect(shouldSkipHeavyMapPrefetch()).toBe(false)
    setConnection(undefined)
    expect(shouldSkipHeavyMapPrefetch()).toBe(false)
  })

  it('preloadMapEngine resolves without heavy work on save-data', async () => {
    setConnection({ saveData: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const { preloadMapEngine } = await import('../mapWarmup')

    await expect(preloadMapEngine()).resolves.toBeUndefined()
  })
})
