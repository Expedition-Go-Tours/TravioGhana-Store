import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act, cleanup, waitFor } from '@testing-library/react'

vi.mock('../lib/perfProfile', () => ({
  isMobileViewport: () => true,
  prefersReducedData: () => false,
  prefersReducedMotion: () => false,
}))

vi.mock('@lottiefiles/dotlottie-react', async () => {
  const React = await import('react')
  return {
    setWasmUrl: () => {},
    DotLottieReact: ({ dotLottieRefCallback }: { dotLottieRefCallback?: (player: unknown) => void }) => {
      React.useEffect(() => {
        // Simulate the player creating its instance and finishing the load
        // with the first frame ready.
        dotLottieRefCallback?.({
          isLoaded: true,
          addEventListener: () => {},
          removeEventListener: () => {},
        })
      }, [dotLottieRefCallback])
      return null
    },
  }
})

// The self-hosted WASM is emitted by Vite as an asset URL; tests only need a
// stub so the lazy player import resolves.
vi.mock('@lottiefiles/dotlottie-web/dotlottie-player.wasm?url', () => ({
  default: '/assets/dotlottie-player.test.wasm',
}))

import BookingTransition from './BookingTransition'

/**
 * The Lottie animation must render on phones too — the pure-CSS loader is only
 * the fallback while the player boots, and it crossfades out once loaded.
 */
describe('BookingTransition (phone profile)', () => {
  afterEach(() => {
    cleanup()
    document.body.style.overflow = ''
  })

  it('renders the Lottie player and crossfades the CSS loader out', async () => {
    render(<BookingTransition onDone={() => {}} caption="Preparing your booking" />)

    expect(document.querySelector('.bt-overlay')).toBeTruthy()
    expect(document.querySelector('.bt-loader-ring')).toBeTruthy()

    await waitFor(() => {
      expect(document.querySelector('.bt-lottie-player')).toBeTruthy()
      expect(document.querySelector('.bt-loader')?.className).toContain('bt-loader--hidden')
    })

    expect(document.body.textContent).toContain('Preparing your booking')
    expect(document.querySelectorAll('.bt-dot').length).toBe(3)
  })

  it('locks body scroll while visible and restores it on unmount', () => {
    const { unmount } = render(<BookingTransition onDone={() => {}} />)
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('calls onDone exactly once after the constrained-profile duration', () => {
    vi.useFakeTimers()
    try {
      const onDone = vi.fn()
      render(<BookingTransition onDone={onDone} />)

      act(() => {
        vi.advanceTimersByTime(2199)
      })
      expect(onDone).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(onDone).toHaveBeenCalledTimes(1)

      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(onDone).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
