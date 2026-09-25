import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(), fetchWithAuth: vi.fn() }))
vi.mock('@/hooks/useExpeditionTours', () => ({ mapRawTourToListing: (tour: unknown) => tour }))
vi.mock('@/components/Footer', () => ({ default: () => <div>FOOTER</div> }))
vi.mock('@/components/SEO', () => ({ default: () => null, buildBreadcrumbSchema: () => ({}) }))
vi.mock('@/components/TourCard', () => ({ default: () => <div>TOUR_CARD</div> }))
vi.mock('@/components/shared/OptimizedImage', () => ({
  default: ({ src, alt }: { src: string; alt?: string }) => <img src={src} alt={alt ?? ''} />,
}))

const { apiFetch, fetchWithAuth } = await import('@/lib/api')
const apiFetchMock = vi.mocked(apiFetch)
const fetchMock = vi.mocked(/** @type {any} */ (fetchWithAuth))

const jsonResponse = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response

/** Routes each API path the page and its resolver use. */
function mockApi({ catalogueMatch = true, detailAvailable = true }: { catalogueMatch?: boolean; detailAvailable?: boolean } = {}) {
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
      // Deliberately an empty page with a larger total: the header count must
      // come from pagination.totalCount, never from the fetched array length.
      return { tours: [], pagination: { hasNextPage: false, totalCount: 3 } } as never
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
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  apiFetchMock.mockReset()
  fetchMock.mockReset()
})

describe('SupplierPage — direct visit by name (no router state)', () => {
  it('resolves the supplier through their catalogue tour and renders the full account profile', async () => {
    mockApi()
    renderSupplier('/supplier/Kadelo%20Travels')

    // the supplier's own About copy, not a synthesised sentence
    expect(await screen.findByText(businessInfo.description)).toBeInTheDocument()
    // contact details that used to be dropped by the mapper
    expect(screen.getByText('+233241112223')).toHaveAttribute('href', 'tel:+233241112223')
    expect(screen.getByText(businessInfo.address)).toBeInTheDocument()
    expect(screen.getByText('https://kadelotravels.com')).toBeInTheDocument()
    // account-page extras
    expect(screen.getByText('Mon–Fri 09:00–17:00; Sat 10:00–14:00')).toBeInTheDocument()
    expect(screen.getByText('Instagram')).toHaveAttribute('href', 'https://instagram.com/kadelotravels')
    expect(screen.getByText('Registered as Kadelo Travels Ltd')).toBeInTheDocument()
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
