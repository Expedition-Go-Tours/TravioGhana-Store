import { describe, expect, it, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ComponentType } from 'react'
import RefundPolicyPage from './RefundPolicyPage'
import TermsAndConditionsPage from './TermsAndConditionsPage'
import PrivacyPolicyPage from './PrivacyPolicyPage'
import CookiesPolicyPage from './CookiesPolicyPage'
import SupplierTermsPage from './SupplierTermsPage'

/**
 * Every legal document names the operating company, Expedition-Go Tours Ltd.
 * Those mentions must be backlinks to its own site, so search engines and
 * readers can reach it directly from each policy.
 */

const COMPANY_URL = 'https://www.expeditiongotours.com/'

vi.mock('../components/Footer', () => ({ default: () => <div>FOOTER</div> }))
vi.mock('../components/SEO', () => ({
  default: () => null,
  buildBreadcrumbSchema: () => ({}),
  SITE_URL: 'https://www.travioghana.com',
}))
vi.mock('../context/CookieConsentContext', () => ({
  useCookieConsent: () => ({ openPreferences: vi.fn() }),
}))

/** LegalPageShell and Terms/Supplier pages construct IntersectionObservers. */
class StubIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: StubIntersectionObserver as unknown as typeof IntersectionObserver,
  })
})

const PAGES: [string, ComponentType][] = [
  ['Refund Policy', RefundPolicyPage],
  ['Terms & Conditions', TermsAndConditionsPage],
  ['Privacy Policy', PrivacyPolicyPage],
  ['Cookies Policy', CookiesPolicyPage],
  ['Supplier Terms', SupplierTermsPage],
]

describe('legal documents link Expedition-Go Tours to its own site', () => {
  it.each(PAGES)('%s', (_name, Page) => {
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    )

    // Both the registered name and the trading-name variant are linked.
    const links = screen.getAllByRole('link', { name: /^Expedition-Go Tours(?: Ltd)?$/ })
    expect(links.length).toBeGreaterThan(0)

    for (const link of links) {
      expect(link).toHaveAttribute('href', COMPANY_URL)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })
})
