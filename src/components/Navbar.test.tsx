import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * The navbar's supplier CTA changes meaning with approval status: it opens the
 * marketing "List an Experience" page for everyone else, and the supplier's own
 * portal for an approved supplier. It used to keep the same megaphone icon in
 * both states, which made "Supplier dashboard" look like the marketing link —
 * these tests pin the icon to the state (desktop and mobile drawer).
 */

const state = vi.hoisted(() => ({ approved: false }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      ({
        'nav.supplierDashboard': 'Supplier dashboard',
        'nav.listAnExperience': 'List an Experience',
        'nav.supplierDashboardSub': 'Manage your listings',
        'nav.listAnExperienceSub': 'Become a supplier and start earning',
      })[key] ?? fallback ?? key,
  }),
}))

vi.mock('../hooks/useSupplierStatus', () => ({
  useSupplierStatus: () => ({ profile: null, isApproved: state.approved }),
}))

vi.mock('../lib/auth', () => ({
  getStoredAuthUser: () => ({
    uid: 'test-user',
    email: 'supplier@example.com',
    displayName: 'Test Supplier',
    photoURL: null,
  }),
  subscribeToAuthState: () => Promise.resolve(() => {}),
  signOutUser: () => Promise.resolve(),
}))

vi.mock('../hooks/useExpeditionBookings', () => ({
  useMyBookingsCount: () => ({ data: 0 }),
}))

vi.mock('../contexts/CurrencyContext', () => ({
  useCurrency: () => ({ currency: { code: 'USD' } }),
}))

vi.mock('../context/WishlistContext', () => ({
  useWishlist: () => ({ wishlistCount: 0 }),
}))

vi.mock('../context/SearchInputContext', () => ({
  useSearchInput: () => ({ searchValue: '', setSearchValue: vi.fn() }),
}))

vi.mock('../context/LocationSearchContext', () => ({
  useLocationSearch: () => ({ hasActiveSearch: false, setLocation: vi.fn(), resetLocation: vi.fn() }),
}))

vi.mock('../context/ContinuePlanningContext', () => ({
  useContinuePlanning: () => ({ clearContinuePlanning: vi.fn() }),
}))

vi.mock('../hooks/useSearchAutocomplete', () => ({
  useSearchAutocomplete: () => ({ suggestions: [], isSearching: false }),
}))

vi.mock('../hooks/useRecentSearches', () => ({
  useRecentSearches: () => ({ recentSearches: [], addSearch: vi.fn(), removeSearch: vi.fn(), clearAll: vi.fn() }),
}))

import Navbar from './Navbar'

function renderNavbar(): HTMLElement {
  return render(
    <MemoryRouter>
      <Navbar onOpenAuth={() => {}} />
    </MemoryRouter>,
  ).container
}

/** The icon inside the CTA's icon box (classes come from lucide: `lucide-<name>`). */
function ctaIconClass(container: HTMLElement, boxSelector: string): string {
  return container.querySelector(`${boxSelector} svg`)?.getAttribute('class') ?? ''
}

function openMobileMenu(container: HTMLElement) {
  fireEvent.click(container.querySelector('.nav-hamburger') as Element)
}

describe('Navbar supplier CTA', () => {
  beforeEach(() => {
    state.approved = false
    window.localStorage.clear()
    cleanup()
  })

  it('shows the marketing megaphone and label to a non-supplier', () => {
    const container = renderNavbar()
    const iconClass = ctaIconClass(container, '.nav-list-experience-icon')

    expect(iconClass).toContain('lucide-megaphone')
    expect(iconClass).not.toContain('lucide-layout-dashboard')
    expect(screen.getAllByText('List an Experience').length).toBeGreaterThan(0)
  })

  it('swaps to a dashboard icon and label for an approved supplier', () => {
    state.approved = true
    const container = renderNavbar()
    const iconClass = ctaIconClass(container, '.nav-list-experience-icon')

    expect(iconClass).toContain('lucide-layout-dashboard')
    expect(iconClass).not.toContain('lucide-megaphone')
    expect(screen.getAllByText('Supplier dashboard').length).toBeGreaterThan(0)
  })

  it('uses the megaphone in the mobile drawer when the user is not a supplier', () => {
    const container = renderNavbar()
    openMobileMenu(container)

    expect(ctaIconClass(container, '.nav-mobile-list-experience-icon')).toContain('lucide-megaphone')
  })

  it('uses the dashboard icon in the mobile drawer for an approved supplier', () => {
    state.approved = true
    const container = renderNavbar()
    openMobileMenu(container)

    expect(ctaIconClass(container, '.nav-mobile-list-experience-icon')).toContain('lucide-layout-dashboard')
  })
})
