import { describe, expect, it, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SupplierPage from './SupplierPage'

const KADELO_ID = 'cmue3ye1z000fhstgqzazqslg'
const KADELO_TOUR_ID = 'cmuf00tour0001hstgqzazqslh'

const businessInfo = {
  city: 'Achimota',
  phone: '+233241112223',
  address: 'Achimota Mall Road, Accra, Ghana',
  country: 'GH',
  website: 'https://kadelotravels.com',
  legalBusinessName: 'Kadelo Travels Ltd',
  businessType: 'Tour Operator',
  description: 'Kadelo Travels runs small-group trips across southern Ghana.',
  instagram: 'https://instagram.com/kadelotravels',
  operatingHours: {
    Monday: [{ startTime: '09:00', endTime: '17:00' }],
    Tuesday: [{ startTime: '09:00', endTime: '17:00' }],
    Wednesday: [{ startTime: '09:00', endTime: '17:00' }],
    Thursday: [{ startTime: '09:00', endTime: '17:00' }],
    Friday: [{ startTime: '09:00', endTime: '17:00' }],
    Saturday: [{ startTime: '10:00', endTime: '14:00' }],
  },
}

const detailTour = {
  id: KADELO_TOUR_ID,
  supplierId: KADELO_ID,
  supplier: {
    id: KADELO_ID,
    name: 'Kadelo Travels',
    photoURL: 'https://example.com/kadelo.png',
    verified: true,
    supplierType: 'TOUR_COMPANY',
    supplierProfile: {
      averageRating: null,
      totalBookings: 0,
      status: 'ACTIVE',
      supplierType: 'TOUR_COMPANY',
      businessInfo,
    },
  },
}

const listSupplierBlock = {
  id: KADELO_ID,
  name: 'Kadelo Travels',
  supplierProfile: { averageRating: null, totalBookings: 0, status: 'ACTIVE', supplierType: 'TOUR_COMPANY' },
}

/** Raw supplier tours (the mapper is mocked to identity, so these pass through). */
const supplierTour = (over: Record<string, unknown> = {}) => ({
  id: KADELO_TOUR_ID,
  title: 'Accra City Tour',
  location: 'Accra, Ghana',
  photos: ['https://cdn.example.com/supplier-a.jpg'],
  supplierName: 'Kadelo Travels',
  ...over,
})

const review = {
  id: 'review-1',
  source: 'TRIPADVISOR',
  reviewerName: 'Kirk L.',
  reviewerAvatar: null,
  rating: 5,
  title: 'Great tour',
  text: 'Great tour, very professional and overall a good experience.',
  textTruncated: null,
  tourTitle: 'Accra City Tour',
  tourThumbnail: null,
  tourUrl: 'https://www.tripadvisor.com/ShowUserReviews-x',
  tourLink: '/tours',
  coverPhoto: null,
  originalDate: '2026-08-01T00:00:00.000Z',
  productId: 'product-1',
}

const state = vi.hoisted(() => ({
  authUser: null as null | { id: string },
  supplierReviews: {
    summary: { rating: null as number | null, count: 0, distribution: null as Record<number, number> | null },
    reviews: [] as unknown[],
    isLoading: false,
  },
}))

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(), fetchWithAuth: vi.fn() }))
vi.mock('@/hooks/useExpeditionTours', () => ({
  mapRawTourToListing: (tour: unknown) => tour,
  // The homepage review card's "Check Availability" link resolves destinations.
  useTourFilterOptions: () => ({ data: undefined }),
}))
vi.mock('@/components/Footer', () => ({ default: () => <div>FOOTER</div> }))
vi.mock('@/components/SEO', () => ({ default: () => null, buildBreadcrumbSchema: () => ({}) }))
vi.mock('@/components/TourCard', () => ({ default: () => <div>TOUR_CARD</div> }))
vi.mock('@/components/shared/OptimizedImage', () => ({
  default: ({ src, alt }: { src: string; alt?: string }) => <img src={src} alt={alt ?? ''} />,
}))
vi.mock('@/hooks/useAuthUser', () => ({ useAuthUser: () => state.authUser }))
vi.mock('@/chat/chatApi', () => ({ getOrCreateConversation: vi.fn() }))
vi.mock('@/hooks/useExternalReviews', () => ({
  useSupplierReviews: () => state.supplierReviews,
}))

const { apiFetch, fetchWithAuth } = await import('@/lib/api')
const { getOrCreateConversation } = await import('@/chat/chatApi')
const apiFetchMock = vi.mocked(apiFetch)
const fetchMock = vi.mocked(/** @type {any} */ (fetchWithAuth))
const getOrCreateConversationMock = vi.mocked(getOrCreateConversation)

const jsonResponse = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response

/** Routes each API path the page and its resolver use. */
function mockApi({
  catalogueMatch = true,
  detailAvailable = true,
  tours = [] as unknown[],
}: {
  catalogueMatch?: boolean
  detailAvailable?: boolean
  tours?: unknown[]
} = {}) {
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path.startsWith('/tours?limit=')) {
      return {
        tours: catalogueMatch ? [{ id: KADELO_TOUR_ID, supplier: listSupplierBlock }] : [],
        pagination: { hasNextPage: false, totalCount: catalogueMatch ? 1 : 0 },
      } as never
    }
    if (/[?&]limit=1(&|$)/.test(path)) {
      return { tours: detailAvailable ? [{ id: KADELO_TOUR_ID }] : [] } as never
    }
    if (/[?&]limit=100(&|$)/.test(path)) {
      // totalCount is authoritative: the header must never count the array.
      return { tours, pagination: { hasNextPage: false, totalCount: 3 } } as never
    }
    return {} as never
  })

  fetchMock.mockImplementation(async () =>
    detailAvailable
      ? jsonResponse({ data: { tour: detailTour } })
      : ({ ok: false, json: async () => ({}) } as unknown as Response),
  )
}

function renderSupplier(initialPath: string, routerState?: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: initialPath, state: routerState }]}>
        <Routes>
          <Route path="/supplier/:supplierName" element={<SupplierPage />} />
          <Route path="/login" element={<div>LOGIN_PAGE</div>} />
          <Route path="/dashboard/chat" element={<div>CHAT_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/**
 * jsdom has no matchMedia, and the page's mobile branch (photo rail, etc.) is
 * driven by `useMediaQuery`. `matches: true` renders the ≤768px layout.
 */
function setViewport(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

beforeAll(() => {
  setViewport(false)
  // The homepage review card measures its clamped text with a ResizeObserver.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})

beforeEach(() => {
  apiFetchMock.mockReset()
  fetchMock.mockReset()
  getOrCreateConversationMock.mockReset()
  state.authUser = null
  state.supplierReviews = {
    summary: { rating: null, count: 0, distribution: null },
    reviews: [],
    isLoading: false,
  }
})

describe('SupplierPage — direct visit by name (no router state)', () => {
  it('resolves the supplier through their catalogue tour and renders the revamped profile', async () => {
    mockApi()
    renderSupplier('/supplier/Kadelo%20Travels')

    // the supplier's own About copy, not a synthesised sentence
    expect(await screen.findByText(businessInfo.description)).toBeInTheDocument()
    // provider details keep the location + hours that the revamp displays…
    expect(screen.getByText('Achimota, Ghana')).toBeInTheDocument()
    expect(screen.getByText('Mon–Fri 09:00–17:00; Sat 10:00–14:00')).toBeInTheDocument()
    // …while the old contact block is dropped entirely
    expect(screen.queryByText('+233241112223')).not.toBeInTheDocument()
    expect(screen.queryByText(businessInfo.address)).not.toBeInTheDocument()
    expect(screen.queryByText('https://kadelotravels.com')).not.toBeInTheDocument()
    expect(screen.queryByText('Instagram')).not.toBeInTheDocument()
    expect(screen.queryByText('Registered as Kadelo Travels Ltd')).not.toBeInTheDocument()
    // count comes from pagination.totalCount (3), not the empty fetched array
    expect((await screen.findAllByText('3 tours')).length).toBeGreaterThan(0)
    // the walk that got us here: catalogue scan → supplier's tour → detail payload
    expect(apiFetchMock).toHaveBeenCalledWith('/tours?limit=500&page=1')
    expect(apiFetchMock).toHaveBeenCalledWith(`/tours?supplierId=${KADELO_ID}&limit=1`)
    expect(fetchMock).toHaveBeenCalledWith(`/tours/${KADELO_TOUR_ID}`)
  })

  it('no longer invents social proof for the supplier', async () => {
    mockApi()
    renderSupplier('/supplier/Kadelo%20Travels')

    await screen.findByText(businessInfo.description)
    expect(screen.queryByText(/4\.9\/5 from 15 travellers/)).not.toBeInTheDocument()
    expect(screen.queryByText('Handpicked tours')).not.toBeInTheDocument()
  })
})

describe('SupplierPage — supplier-owned photos', () => {
  it('builds the photo strip only from this supplier’s tours and links the rail out', async () => {
    mockApi({
      tours: [
        supplierTour({
          id: 'tour-a',
          photos: ['https://cdn.example.com/a1.jpg', 'https://cdn.example.com/a2.jpg'],
        }),
        supplierTour({
          id: 'tour-b',
          title: 'Cape Coast Castles',
          photos: ['https://cdn.example.com/b1.jpg'],
        }),
      ],
    })
    renderSupplier('/supplier/Kadelo%20Travels')

    await screen.findByText(businessInfo.description)

    // Only the images carried by this supplier's own tours appear…
    expect(await screen.findByAltText('Kadelo Travels tour photo 1')).toHaveAttribute('src', 'https://cdn.example.com/a1.jpg')
    expect(screen.getByAltText('Kadelo Travels tour photo 2')).toHaveAttribute('src', 'https://cdn.example.com/a2.jpg')
    expect(screen.getByAltText('Kadelo Travels tour photo 3')).toHaveAttribute('src', 'https://cdn.example.com/b1.jpg')
    // …with the gallery counter and the view-all affordance.
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByText('View all photos')).toBeInTheDocument()

    // The rail uses the homepage's own tour cards, scoped to this supplier.
    expect(await screen.findAllByText('TOUR_CARD')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'View all activities' })).toHaveAttribute('href', '/tours')

    // Four or fewer photos: nothing to page through.
    expect(screen.queryByLabelText('Next photos')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Previous photos')).not.toBeInTheDocument()
  })

  it('scrolls the rail with the chevrons and opens the full image in the lightbox', async () => {
    const photos = Array.from({ length: 6 }, (_, i) => `https://cdn.example.com/p${i + 1}.jpg`)
    mockApi({ tours: [supplierTour({ photos })] })
    const { container } = renderSupplier('/supplier/Kadelo%20Travels')

    await screen.findByText(businessInfo.description)
    expect(await screen.findByAltText('Kadelo Travels tour photo 1')).toBeInTheDocument()
    expect(screen.getByText('1 / 6')).toBeInTheDocument()
    // Desktop keeps every photo in the rail; four fit per view.
    expect(container.querySelectorAll('.supplier-photo-open')).toHaveLength(6)
    expect(screen.getByLabelText('Next photos')).toBeInTheDocument()

    // The counter tracks the rail as it scrolls.
    const rail = container.querySelector('.supplier-photo-strip')!
    rail.scrollLeft = 8
    fireEvent.scroll(rail)
    expect(await screen.findByText('2 / 6')).toBeInTheDocument()

    // Clicking a tile opens the lightbox at that photo.
    screen.getByLabelText('Open photo 4 of 6').click()
    expect(await screen.findByText('4 / 6', { selector: '.gallery-viewer-counter' })).toBeInTheDocument()
    expect(document.querySelector('.gallery-dialog')).not.toBeNull()
  })

  it('opens the full-image lightbox from "View all photos"', async () => {
    const photos = Array.from({ length: 6 }, (_, i) => `https://cdn.example.com/p${i + 1}.jpg`)
    mockApi({ tours: [supplierTour({ photos })] })
    renderSupplier('/supplier/Kadelo%20Travels')

    await screen.findByText(businessInfo.description)
    ;(await screen.findByText('View all photos')).click()

    expect(await screen.findByText('1 / 6', { selector: '.gallery-viewer-counter' })).toBeInTheDocument()
  })
})

describe('SupplierPage — reviews', () => {
  it('renders the summary beside the homepage review cards and links to all reviews', async () => {
    state.supplierReviews = {
      summary: { rating: 4.9, count: 925, distribution: { 5: 870, 4: 37, 3: 18, 2: 0, 1: 0 } },
      reviews: [review],
      isLoading: false,
    }

    mockApi()
    renderSupplier('/supplier/Kadelo%20Travels')

    await screen.findByText(businessInfo.description)

    expect(screen.getByText('4.9')).toBeInTheDocument()
    expect(screen.getByText('925 provider reviews')).toBeInTheDocument()
    expect(screen.getByText('Traveller reviews')).toBeInTheDocument()
    // the homepage review card renders the featured row…
    expect(screen.getByText('Kirk L.')).toBeInTheDocument()
    // …and the rail links out to the public reviews page.
    expect(screen.getByRole('link', { name: 'View all reviews' })).toHaveAttribute('href', '/reviews')
  })

  it('hides the reviews section when the supplier has no reviews at all', async () => {
    mockApi()
    renderSupplier('/supplier/Kadelo%20Travels')

    await screen.findByText(businessInfo.description)
    expect(screen.queryByText('Traveller reviews')).not.toBeInTheDocument()
  })
})

describe('SupplierPage — message provider', () => {
  it('sends signed-out visitors to login', async () => {
    mockApi()
    renderSupplier('/supplier/Kadelo%20Travels')

    await screen.findByText(businessInfo.description)
    screen.getByRole('button', { name: /Message provider/i }).click()

    expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument()
    expect(getOrCreateConversationMock).not.toHaveBeenCalled()
  })

  it('opens the supplier conversation for signed-in visitors', async () => {
    state.authUser = { id: 'user-1' }
    getOrCreateConversationMock.mockResolvedValue({ id: 'conversation-1' } as never)
    mockApi()
    renderSupplier('/supplier/Kadelo%20Travels')

    await screen.findByText(businessInfo.description)
    screen.getByRole('button', { name: /Message provider/i }).click()

    expect(await screen.findByText('CHAT_PAGE')).toBeInTheDocument()
    expect(getOrCreateConversationMock).toHaveBeenCalledWith(KADELO_ID, 'SUPPLIER_CUSTOMER')
  })
})

describe('SupplierPage — direct visit by supplier id', () => {
  it('skips the catalogue scan entirely', async () => {
    mockApi()
    renderSupplier(`/supplier/${KADELO_ID}`)

    expect(await screen.findByText(businessInfo.description)).toBeInTheDocument()
    expect(apiFetchMock).not.toHaveBeenCalledWith('/tours?limit=500&page=1')
    expect(apiFetchMock).toHaveBeenCalledWith(`/tours?supplierId=${KADELO_ID}&limit=1`)
  })
})

describe('SupplierPage — unresolvable supplier', () => {
  it('shows the not-found state instead of a half-empty profile', async () => {
    mockApi({ catalogueMatch: false, detailAvailable: false })
    renderSupplier('/supplier/Nobody%20Travels')

    expect(await screen.findByText('Supplier not found')).toBeInTheDocument()
  })

  it('shows a retry state — not "not found" — when the request itself fails', async () => {
    apiFetchMock.mockRejectedValue(new Error('Network down'))
    fetchMock.mockRejectedValue(new Error('Network down'))
    renderSupplier('/supplier/Kadelo%20Travels')

    expect(await screen.findByText("We couldn't load this supplier.")).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()
    expect(screen.queryByText('Supplier not found')).not.toBeInTheDocument()
  })
})

/**
 * Mobile (≤768px) swaps the paged desktop galleries for swipeable rails: the
 * photo strip shows every photo with no chevrons, and the counter / view-all
 * stay pinned over the rail.
 */
describe('SupplierPage — mobile photo rail', () => {
  beforeEach(() => {
    setViewport(true)
  })

  afterEach(() => {
    setViewport(false)
  })

  it('renders every photo in a swipe rail and drops the chevrons', async () => {
    const photos = Array.from({ length: 6 }, (_, i) => `https://cdn.example.com/p${i + 1}.jpg`)
    mockApi({ tours: [supplierTour({ photos })] })
    const { container } = renderSupplier('/supplier/Kadelo%20Travels')

    await screen.findByText(businessInfo.description)
    expect(await screen.findByAltText('Kadelo Travels tour photo 1')).toBeInTheDocument()

    expect(container.querySelectorAll('.supplier-photo-open')).toHaveLength(6)
    expect(container.querySelector('.supplier-photo-strip')).not.toBeNull()
    expect(screen.queryByLabelText('Next photos')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Previous photos')).not.toBeInTheDocument()
    // counter + view-all are pinned over the rail, not inside a tile
    expect(container.querySelector('.supplier-photo-strip-wrap .supplier-photo-count')).toHaveTextContent('1 / 6')
    expect(container.querySelector('.supplier-photo-strip-wrap .supplier-view-photos')).not.toBeNull()
  })
})
