import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CookieBanner from './CookieBanner'
import { useCookieConsent } from '../../context/CookieConsentContext'

vi.mock('../../context/CookieConsentContext', () => ({
  useCookieConsent: vi.fn(),
}))

const mockConsent = vi.mocked(useCookieConsent)

const acceptAll = vi.fn()
const rejectNonEssential = vi.fn()
const openPreferences = vi.fn()

function renderBanner(visible = true) {
  mockConsent.mockReturnValue({
    isBannerVisible: visible,
    acceptAll,
    rejectNonEssential,
    openPreferences,
  } as unknown as ReturnType<typeof useCookieConsent>)

  return render(
    <MemoryRouter>
      <CookieBanner />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockConsent.mockReset()
  acceptAll.mockReset()
  rejectNonEssential.mockReset()
  openPreferences.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  document.documentElement.style.removeProperty('--cookie-banner-space')
})

describe('CookieBanner', () => {
  it('presents the notice as a non-modal dialog with its copy and policy link', () => {
    renderBanner()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'false')
    expect(
      screen.getByRole('heading', { name: 'Your privacy, your choice' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cookie Policy' })).toHaveAttribute(
      'href',
      '/cookies-policy',
    )
  })

  it('gives the two decisions equal prominence and calls the matching action', () => {
    renderBanner()

    const reject = screen.getByRole('button', { name: 'Reject non-essential' })
    const accept = screen.getByRole('button', { name: 'Accept all' })
    // Same class gives them the same size, radius and weight.
    expect(reject).toHaveClass('cookie-banner__btn')
    expect(accept).toHaveClass('cookie-banner__btn')

    fireEvent.click(reject)
    expect(rejectNonEssential).toHaveBeenCalledTimes(1)

    fireEvent.click(accept)
    expect(acceptAll).toHaveBeenCalledTimes(1)
  })

  it('keeps "Manage preferences" a tertiary text action, not a button-shaped CTA', () => {
    renderBanner()

    const manage = screen.getByRole('button', { name: 'Manage preferences' })
    expect(manage).toHaveClass('cookie-banner__manage')
    expect(manage).not.toHaveClass('bk-btn')

    fireEvent.click(manage)
    expect(openPreferences).toHaveBeenCalledTimes(1)
  })

  it('moves focus to the card on mount so assistive tech meets the notice', () => {
    vi.useFakeTimers()
    renderBanner()

    const dialog = screen.getByRole('dialog')
    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(document.activeElement).toBe(dialog)
  })

  it('reserves the banner height for the page and releases it on unmount', () => {
    const { unmount } = renderBanner()

    // jsdom reports a zero-height card, but the variable must still be set so
    // the page reserves (or clears) space consistently.
    expect(document.documentElement.style.getPropertyValue('--cookie-banner-space')).not.toBe('')

    unmount()
    expect(document.documentElement.style.getPropertyValue('--cookie-banner-space')).toBe('')
  })

  it('renders nothing once a choice has been made', () => {
    const { container } = renderBanner(false)
    expect(container).toBeEmptyDOMElement()
  })
})
