import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ChangeBookingModal from './ChangeBookingModal'

const mocks = vi.hoisted(() => {
  const mutateAsync = vi.fn().mockResolvedValue({
    available: true,
    availableSpots: 10,
    pricing: { total: 100, currency: 'USD' },
    travelerSummary: { adults: 1, children: 0, infants: 0, total: 1 },
  })
  const lenis = { stop: vi.fn(), start: vi.fn() }
  return {
    mutateAsync,
    calculateCheckout: { mutateAsync },
    lenis,
    travelerSelection: {
      isPerGroup: false,
      groupSizeBands: [],
      travelerGroups: [],
      totalTravelers: 1,
      travelersPayload: { adults: 1 },
      bookableBounds: { min: 1, max: null },
      mixIssues: [],
      canIncrementCount: () => false,
      canDecrementCount: () => false,
      increment: vi.fn(),
      decrement: vi.fn(),
      clientSubtotal: 100,
      anyTieredPricing: false,
      formatPrice: (n: number) => `$${n}`,
      travelerOptions: [],
    },
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}))

vi.mock('../../hooks/useExpeditionBookings', () => ({
  useTourAvailability: () => ({ data: [] }),
  useCalculateCheckout: () => mocks.calculateCheckout,
}))

vi.mock('../../hooks/useTravelerSelection', () => ({
  useTravelerSelection: () => mocks.travelerSelection,
}))

vi.mock('../../lib/LenisProvider', () => ({
  getLenis: () => mocks.lenis,
}))

vi.mock('../ui/apple-calendar-picker', () => ({
  CalendarPicker: ({ inline }: { inline?: boolean }) => (
    <div data-testid="calendar-picker" data-inline={inline ? 'true' : 'false'} />
  ),
}))

vi.mock('../../pages/tour-detail/BookingDeadlineTimer', () => ({
  default: () => null,
}))

const tour = {
  id: 'tour-1',
  slug: 'tour-1',
  title: 'Test Tour',
  price: 100,
  scheduleType: 'operatingHours' as const,
  cancellation: 'Free cancellation up to 24 hours before',
}

function renderModal() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <ChangeBookingModal
        tour={tour}
        isOpen
        onClose={vi.fn()}
        onReserve={vi.fn()}
        initialTravelers={1}
        initialDate="2026-10-30"
        travelersCount={{ adults: 1 }}
      />
    </QueryClientProvider>,
  )
}

describe('ChangeBookingModal layout and scroll', () => {
  beforeEach(() => {
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'auto'
    document.body.style.paddingRight = ''
    document.documentElement.classList.remove('eg-modal-scroll-lock')
    mocks.lenis.stop.mockClear()
    mocks.lenis.start.mockClear()
  })

  afterEach(() => {
    cleanup()
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
    document.documentElement.classList.remove('eg-modal-scroll-lock')
  })

  it('locks the root, body and Lenis while open and restores them on unmount', () => {
    const { unmount } = renderModal()

    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.classList.contains('eg-modal-scroll-lock')).toBe(true)
    expect(mocks.lenis.stop).toHaveBeenCalledTimes(1)

    unmount()

    expect(document.documentElement.style.overflow).toBe('auto')
    expect(document.body.style.overflow).toBe('auto')
    expect(document.documentElement.classList.contains('eg-modal-scroll-lock')).toBe(false)
    expect(mocks.lenis.start).toHaveBeenCalledTimes(1)
  })

  it('opens the date calendar inline inside the modal body', () => {
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: /select date/i }))

    expect(screen.getByTestId('calendar-picker').getAttribute('data-inline')).toBe('true')
    const body = document.querySelector('.change-booking-body')
    expect(body?.className).toContain('min-h-0')
    expect(body?.className).toContain('overscroll-contain')
    expect(body?.hasAttribute('data-lenis-prevent')).toBe(true)
  })

  it('renders the sheet as a modal dialog', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
