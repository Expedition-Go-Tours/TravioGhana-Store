import { describe, expect, it, vi } from 'vitest'
import {
  CHUNK_RELOAD_COOLDOWN_MS,
  canAttemptChunkReload,
  installChunkReloadGuard,
  markChunkReload,
} from '../chunkReloadGuard'

function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  }
}

function makeWindow() {
  let listener: ((event: Event) => void) | null = null
  const reload = vi.fn()
  return {
    win: {
      addEventListener: (_type: string, cb: EventListener) => {
        listener = cb as (event: Event) => void
      },
      location: { reload },
    },
    /** Dispatch a chunk error and report whether the handler silenced Vite. */
    fire() {
      const event = { preventDefault: vi.fn() }
      listener?.(event as unknown as Event)
      return { prevented: event.preventDefault.mock.calls.length > 0 }
    },
    reload,
  }
}

describe('installChunkReloadGuard', () => {
  it('reloads and silences Vite on the first stale chunk', () => {
    const storage = makeStorage()
    const w = makeWindow()
    installChunkReloadGuard(w.win as never, storage, () => 1_000)

    const { prevented } = w.fire()

    expect(prevented).toBe(true)
    expect(w.reload).toHaveBeenCalledTimes(1)
    expect(storage.map.get('expedition.chunkReloadedAt')).toBe('1000')
  })

  it('does not silence Vite when it cannot recover, so the error surfaces', () => {
    // Reloaded 2s ago and the chunk is still missing: reloading again would
    // loop. Leaving the event un-prevented makes Vite reject, which the route
    // boundary reports — instead of handing React an undefined module.
    const storage = makeStorage({ 'expedition.chunkReloadedAt': '1000' })
    const w = makeWindow()
    installChunkReloadGuard(w.win as never, storage, () => 1_000 + 2_000)

    const { prevented } = w.fire()

    expect(prevented).toBe(false)
    expect(w.reload).not.toHaveBeenCalled()
  })

  it('recovers again after the cooldown, so a later deploy is not stuck', () => {
    // Regression: the old guard stored a one-shot flag that was never cleared,
    // so every stale chunk after the first reload the tab session was silenced
    // without recovery — which is exactly what crashed the route.
    const storage = makeStorage({ 'expedition.chunkReloadedAt': '1000' })
    const w = makeWindow()
    const later = 1_000 + CHUNK_RELOAD_COOLDOWN_MS + 1
    installChunkReloadGuard(w.win as never, storage, () => later)

    const { prevented } = w.fire()

    expect(prevented).toBe(true)
    expect(w.reload).toHaveBeenCalledTimes(1)
    expect(storage.map.get('expedition.chunkReloadedAt')).toBe(String(later))
  })

  it('still reloads when storage is unavailable', () => {
    const w = makeWindow()
    installChunkReloadGuard(w.win as never, null, () => 5_000)

    const { prevented } = w.fire()

    expect(prevented).toBe(true)
    expect(w.reload).toHaveBeenCalledTimes(1)
  })

  it('ignores a corrupt stored timestamp instead of skipping recovery', () => {
    const storage = makeStorage({ 'expedition.chunkReloadedAt': 'not-a-number' })
    const w = makeWindow()
    installChunkReloadGuard(w.win as never, storage, () => 1_000)

    expect(w.fire().prevented).toBe(true)
    expect(w.reload).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a window', () => {
    expect(() => installChunkReloadGuard(undefined, null)).not.toThrow()
  })
})

describe('shared reload budget', () => {
  it('allows a reload when nothing has been attempted', () => {
    expect(canAttemptChunkReload(makeStorage(), () => 1_000)).toBe(true)
  })

  it('blocks a second reload inside the cooldown', () => {
    const storage = makeStorage()
    markChunkReload(storage, () => 1_000)
    expect(canAttemptChunkReload(storage, () => 1_000 + CHUNK_RELOAD_COOLDOWN_MS - 1)).toBe(false)
  })

  it('allows a reload again once the cooldown has passed', () => {
    const storage = makeStorage()
    markChunkReload(storage, () => 1_000)
    expect(canAttemptChunkReload(storage, () => 1_000 + CHUNK_RELOAD_COOLDOWN_MS)).toBe(true)
  })
})
