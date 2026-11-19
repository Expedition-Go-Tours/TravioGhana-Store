import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../i18n/config'
import Footer from './Footer'

vi.mock('../contexts/CurrencyContext', () => ({
  useCurrency: () => ({ currency: { code: 'USD', symbol: '$' } }),
  availableCurrencies: [
    { code: 'USD', symbol: '$', label: 'US Dollar' },
    { code: 'GHS', symbol: '₵', label: 'Ghanaian Cedi' },
  ],
}))

vi.mock('../context/CookieConsentContext', () => ({
  useCookieConsent: () => ({ openPreferences: vi.fn() }),
}))

function stubMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  )
}

describe('Footer work-with-us links', () => {
  beforeEach(async () => {
    cleanup()
    stubMatchMedia()
    await i18n.changeLanguage('en')
  })

  it('hides the three pages removed from the footer', () => {
    renderFooter()

    expect(screen.queryByRole('link', { name: 'Content Creators' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Travel Agents' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Transport Partners' })).not.toBeInTheDocument()
  })

  it('keeps the supplier and accommodation links', () => {
    renderFooter()

    expect(screen.getByRole('link', { name: 'List Your Experience' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Hotels & Stays' })).toBeInTheDocument()
    expect(screen.getByText('Work with Us')).toBeInTheDocument()
  })

  it('shows the exact regional language label', async () => {
    await i18n.changeLanguage('de-AT')
    renderFooter()

    expect(screen.getByText(/Deutsch \(Österreich\)/)).toBeInTheDocument()
  })
})
