import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * The navbar's supplier CTA changes meaning with approval status: it opens the
 * marketing "List an Experience" page for everyone else, and the supplier's own
 * portal for an approved supplier. It used to keep the same megaphone icon in
 * both states, which made "Supplier dashboard" look like the marketing link —
 * these tests pin the icon to the state (desktop and mobile drawer).
 */

const state = vi.hoisted(() => ({
  approved: false,
  hasActiveSearch: false,
  resetLocation: vi.fn(),
  clearContinuePlanning: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      const strings: Record<string, string> = {
        'nav.supplierDashboard': 'Supplier dashboard',
        'nav.listAnExperience': 'List an Experience',
        'nav.supplierDashboardSub': 'Manage your listings',
        'nav.listAnExperienceSub': 'Become a supplier and start earning',
        'nav.resetToDefault': 'Reset to default',
      }
      if (strings[key]) return strings[key]
      if (typeof fallback === 'string') return fallback
      return fallback?.defaultValue ?? key
    },
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
  useCurrency: () => ({ currency: { code: 'USD', symbol: '$' } }),
  availableCurrencies: [
    { code: 'USD', symbol: '$', label: 'US Dollar' },
    { code: 'GHS', symbol: '₵', label: 'Ghanaian Cedi' },
  ],
}))

vi.mock('../context/WishlistContext', () => ({
  useWishlist: () => ({ wishlistCount: 0 }),
}))

vi.mock('../context/SearchInputContext', () => ({
  useSearchInput: () => ({ searchValue: '', setSearchValue: vi.fn() }),
}))

vi.mock('../context/LocationSearchContext', () => ({
  useLocationSearch: () => ({
    hasActiveSearch: state.hasActiveSearch,
    setLocation: vi.fn(),
    resetLocation: state.resetLocation,
  }),
}))

vi.mock('../context/ContinuePlanningContext', () => ({
  useContinuePlanning: () => ({ clearContinuePlanning: state.clearContinuePlanning }),
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

/** Renders the navbar at a specific route so route-derived classes can be asserted. */
function renderNavbarAt(path: string): HTMLElement {
  return render(
    <MemoryRouter initialEntries={[path]}>
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

describe('Navbar route classes', () => {
  beforeEach(() => {
    state.approved = false
    window.localStorage.clear()
    cleanup()
  })

  it('does not apply the tour-detail column class on the All Tours listing', () => {
    const container = renderNavbarAt('/tours')

    expect(container.querySelector('.navbar')?.classList.contains('navbar--tour-detail')).toBe(false)
  })

  it('applies the tour-detail column class on a tour detail route', () => {
    const container = renderNavbarAt('/tour/abc123/accra-city-tour')

    expect(container.querySelector('.navbar')?.classList.contains('navbar--tour-detail')).toBe(true)
  })
})

/**
 * The language/currency picker must be one surface everywhere. The mobile menu
 * used to open MobileSubDrawer — a second, full-screen implementation of the
 * same two lists — while the desktop globe and the footer opened
 * LanguageCurrencyModal.
 */
describe('Navbar language and currency picker', () => {
  beforeEach(() => {
    state.approved = false
    window.localStorage.clear()
    cleanup()
  })

  it('opens the shared centred picker from the mobile menu, with no second drawer', () => {
    const container = renderNavbar()
    openMobileMenu(container)

    fireEvent.click(screen.getByText('nav.language'))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'nav.language')
    // the duplicated language/currency drawer must not be reachable any more
    expect(container.querySelector('.nav-subdrawer')).toBeNull()
    expect(screen.getByText('languages.en')).toBeInTheDocument()
  })

  it('opens the picker on the currency tab from the mobile menu', () => {
    const container = renderNavbar()
    openMobileMenu(container)

    fireEvent.click(screen.getByText('nav.currency'))

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'nav.currency')
    expect(screen.getByText('USD')).toBeInTheDocument()
  })
})

/**
 * The desktop avatar dropdown has always offered "Reset to default" for an
 * active region search, but its container (.nav-icons) is hidden below
 * 1024px and the hamburger drawer had no equivalent — a phone user who
 * searched a region had no way back to the unpersonalised homepage.
 */
describe('Navbar mobile reset to default', () => {
  beforeEach(() => {
    state.approved = false
    state.hasActiveSearch = false
    state.resetLocation.mockReset()
    state.clearContinuePlanning.mockReset()
    window.localStorage.clear()
    cleanup()
  })

  it('offers no reset row while no region search is active', () => {
    const container = renderNavbar()
    openMobileMenu(container)

    expect(screen.queryByText('Reset to default')).toBeNull()
  })

  it('shows the reset row directly after List an Experience', () => {
    state.hasActiveSearch = true
    const container = renderNavbar()
    openMobileMenu(container)

    const row = screen.getByText('Reset to default')
    expect(container.querySelector('.nav-mobile-list-experience')?.nextElementSibling).toBe(row)
  })

  it('clears the active region and closes the drawer when tapped', async () => {
    state.hasActiveSearch = true
    const container = renderNavbar()
    openMobileMenu(container)

    fireEvent.click(screen.getByText('Reset to default'))

    expect(state.resetLocation).toHaveBeenCalledTimes(1)
    expect(state.clearContinuePlanning).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(container.querySelector('.nav-mobile-menu')).toBeNull())
  })
})
