import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { scrollToTop } from './scrollToTop'
import { getLenis } from './LenisProvider'

vi.mock('./LenisProvider', () => ({
  getLenis: vi.fn(),
}))

const mockGetLenis = vi.mocked(getLenis)

type LenisDouble = { scrollTo: ReturnType<typeof vi.fn> }

describe('scrollToTop', () => {
  beforeEach(() => {
    // jsdom's window.scrollTo is a "not implemented" stub — replace it.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockGetLenis.mockReset()
  })

  it('drives Lenis with immediate+force so a mid-glide reset sticks', () => {
    const lenis: LenisDouble = { scrollTo: vi.fn() }
    mockGetLenis.mockReturnValue(lenis as never)

    scrollToTop()

    expect(lenis.scrollTo).toHaveBeenCalledTimes(1)
    expect(lenis.scrollTo).toHaveBeenCalledWith(0, { immediate: true, force: true })
  })

  it('also issues the native scroll so a desynced window position lands at 0', () => {
    const lenis: LenisDouble = { scrollTo: vi.fn() }
    mockGetLenis.mockReturnValue(lenis as never)

    scrollToTop()

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('falls back to the native scroll when Lenis is not mounted', () => {
    mockGetLenis.mockReturnValue(null)

    expect(() => scrollToTop()).not.toThrow()
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })
})
