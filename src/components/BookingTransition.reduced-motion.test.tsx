import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('../lib/perfProfile', () => ({
  isMobileViewport: () => true,
  prefersReducedData: () => false,
  prefersReducedMotion: () => true,
}))

import BookingTransition from './BookingTransition'

/** Reduced-motion users get the static CSS loader, never the Lottie player. */
describe('BookingTransition (reduced motion)', () => {
  afterEach(() => {
    cleanup()
    document.body.style.overflow = ''
  })

  it('skips the Lottie player and keeps the CSS loader', () => {
    render(<BookingTransition onDone={() => {}} caption="Preparing your booking" />)

    expect(document.querySelector('.bt-overlay')).toBeTruthy()
    expect(document.querySelector('.bt-lottie-player')).toBeNull()
    expect(document.querySelector('.bt-loader-ring')).toBeTruthy()
    expect(document.querySelector('.bt-loader')?.className).not.toContain('bt-loader--hidden')
    expect(document.body.textContent).toContain('Preparing your booking')
  })
})
