import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RestaurantDetailPage from './RestaurantDetailPage'
import RestaurantReviewFormPage from './RestaurantReviewFormPage'
import RestaurantClaimPage from './RestaurantClaimPage'
import RestaurantManagePage from './RestaurantManagePage'
import type { RestaurantVenueDetail } from '../../hooks/useRestaurantVenues'

const mocks = vi.hoisted(() => ({
  promptSignIn: vi.fn(),
  navigate: vi.fn(),
  useAuthUser: vi.fn(),
  useRestaurantVenue: vi.fn(),
  useRestaurantVenueReviews: vi.fn(),
  useMyRestaurantClaim: vi.fn(),
  useReportRestaurantReview: vi.fn(),
  useMyRestaurantReview: vi.fn(),
  useCreateRestaurantReview: vi.fn(),
  useReplaceRestaurantReview: vi.fn(),
  useUploadRestaurantReviewPhotos: vi.fn(),
  useSubmitRestaurantClaim: vi.fn(),
  useMyRestaurantVenues: vi.fn(),
  useUpdateOwnRestaurantVenue: vi.fn(),
  reportMutate: vi.fn(),
  createMutate: vi.fn(),
  replaceMutate: vi.fn(),
  uploadMutate: vi.fn(),
  claimMutate: vi.fn(),
  updateMutate: vi.fn(),
}))

vi.mock('../../hooks/useAuthUser', () => ({ useAuthUser: () => mocks.useAuthUser() }))
vi.mock('../../context/AuthContext', () => ({
  useAuthContext: () => ({ promptSignIn: mocks.promptSignIn }),
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mocks.navigate }
})
vi.mock('../../components/SEO', () => ({
  default: () => null,
  SITE_URL: 'https://www.travioghana.com',
}))
vi.mock('../../components/Footer', () => ({ default: () => <footer /> }))
vi.mock('../../components/shared/OptimizedImage', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('../../hooks/useRestaurantVenues', () => ({
  useRestaurantVenue: () => mocks.useRestaurantVenue(),
  useRestaurantVenueReviews: () => mocks.useRestaurantVenueReviews(),
  useRestaurantVenues: () => ({
    data: { pages: [{ venues: [], pagination: { hasMore: false, nextCursor: null, limit: 12 } }] },
    isPending: false,
    isError: false,
  }),
}))

vi.mock('../../hooks/useRestaurantActions', () => ({
  useMyRestaurantClaim: (...args: unknown[]) => mocks.useMyRestaurantClaim(...args),
  useReportRestaurantReview: (...args: unknown[]) => mocks.useReportRestaurantReview(...args),
  useMyRestaurantReview: (...args: unknown[]) => mocks.useMyRestaurantReview(...args),
  useCreateRestaurantReview: (...args: unknown[]) => mocks.useCreateRestaurantReview(...args),
  useReplaceRestaurantReview: (...args: unknown[]) => mocks.useReplaceRestaurantReview(...args),
  useUploadRestaurantReviewPhotos: (...args: unknown[]) =>
    mocks.useUploadRestaurantReviewPhotos(...args),
  useSubmitRestaurantClaim: (...args: unknown[]) => mocks.useSubmitRestaurantClaim(...args),
  useMyRestaurantVenues: (...args: unknown[]) => mocks.useMyRestaurantVenues(...args),
  useUpdateOwnRestaurantVenue: (...args: unknown[]) => mocks.useUpdateOwnRestaurantVenue(...args),
}))

const venue: RestaurantVenueDetail = {
  id: 'v1',
  slug: 'the-place',
  name: 'The Place',
  city: 'Accra',
  region: 'Greater Accra',
  country: 'Ghana',
  neighbourhood: 'Osu',
  addressLine: '1 Street',
  latitude: 5.5,
  longitude: -0.2,
  cuisines: ['Ghanaian'],
  dietary: ['vegetarian'],
  priceBand: 2,
  amenities: ['Outdoor seating'],
  coverPhoto: null,
  photos: [],
  rating: 4.6,
  reviewCount: 1,
  recentRating: null,
  recentReviewCount: 0,
  external: { source: 'GOOGLE', rating: 4.4, reviewCount: 80 },
  verifiedReviewCount: 1,
  rank: { position: 1, of: 20 },
  featured: false,
  displayOrder: 0,
  hours: { monday: { open: '11:00', close: '22:00' } },
  timezone: 'Africa/Accra',
  phone: '+233 20 000 0000',
  website: 'https://example.com',
  description: 'A neighbourhood restaurant.',
  distribution: { '5': 1, '4': 0, '3': 0, '2': 0, '1': 0 },
  externalStats: [
    {
      source: 'GOOGLE',
      rating: 4.4,
      reviewCount: 80,
      distribution: null,
      productUrl: 'https://maps.example.com',
      syncedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
}

const review = {
  id: 'r1',
  venueId: 'v1',
  status: 'APPROVED' as const,
  rating: 5,
  foodRating: 5,
  serviceRating: 4,
  atmosphereRating: null,
  valueRating: null,
  title: 'Good jollof',
  body: 'The jollof was excellent and the service was quick.',
  photos: [],
  companions: ['COUPLES'],
  visitedAt: '2026-02-10T00:00:00.000Z',
  source: 'TRAVIO_VERIFIED',
  proofMethod: 'EMAIL_INVITE',
  verified: true,
  helpfulCount: 2,
  createdAt: '2026-02-12T00:00:00.000Z',
}

function renderAt(path: string, pattern: string, element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={element} />
      </Routes>
    </MemoryRouter>,
  )
}

function setDefaultMocks() {
  mocks.promptSignIn.mockReset()
  mocks.navigate.mockReset()
  mocks.useAuthUser.mockReturnValue({ id: 'u1', email: 'diner@example.com' })
  mocks.useRestaurantVenue.mockReturnValue({
    data: venue,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  })
  mocks.useRestaurantVenueReviews.mockReturnValue({
    data: {
      pages: [
        {
          venueId: 'v1',
          reviews: [
            {
              ...review,
              author: { name: 'Ama', photoURL: null },
              verified: true,
            },
          ],
          distribution: venue.distribution,
          pagination: { limit: 10, hasMore: false, nextCursor: null },
        },
      ],
    },
    isPending: false,
    isError: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  })
  mocks.useMyRestaurantClaim.mockReturnValue({
    data: { claim: null, membership: null, venue },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  })
  mocks.reportMutate.mockReset().mockResolvedValue({})
  mocks.useReportRestaurantReview.mockReturnValue({
    mutateAsync: mocks.reportMutate,
    isPending: false,
  })

  mocks.useMyRestaurantReview.mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
  })
  mocks.createMutate.mockReset().mockResolvedValue({ review })
  mocks.replaceMutate.mockReset().mockResolvedValue({ review })
  mocks.uploadMutate.mockReset().mockResolvedValue({ photos: ['https://res.cloudinary.com/demo/image/upload/v1/photo.jpg'] })
  mocks.useCreateRestaurantReview.mockReturnValue({ mutateAsync: mocks.createMutate, isPending: false })
  mocks.useReplaceRestaurantReview.mockReturnValue({ mutateAsync: mocks.replaceMutate, isPending: false })
  mocks.useUploadRestaurantReviewPhotos.mockReturnValue({ mutateAsync: mocks.uploadMutate, isPending: false })

  mocks.claimMutate.mockReset().mockResolvedValue({ claim: {} })
  mocks.useSubmitRestaurantClaim.mockReturnValue({ mutateAsync: mocks.claimMutate, isPending: false })

  mocks.useMyRestaurantVenues.mockReturnValue({
    data: {
      venues: [
        {
          membership: { id: 'm1', role: 'OWNER', status: 'ACTIVE' },
          venue,
        },
      ],
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  })
  mocks.updateMutate.mockReset().mockResolvedValue({ venue })
  mocks.useUpdateOwnRestaurantVenue.mockReturnValue({ mutateAsync: mocks.updateMutate, isPending: false })
}

beforeEach(() => {
  localStorage.clear()
  setDefaultMocks()
})

describe('RestaurantDetailPage', () => {
  it('shows Travio reviews and outside scores separately', () => {
    renderAt('/restaurants/the-place', '/restaurants/:slug', <RestaurantDetailPage />)

    expect(screen.getByRole('heading', { name: 'The Place' })).toBeInTheDocument()
    expect(screen.getAllByText(/1 review/).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Ratings from other sites' })).toBeInTheDocument()
    expect(screen.getAllByText('Google').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Good jollof').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Claim this restaurant' })).toBeInTheDocument()
  })

  it('submits a review report through the real hook', async () => {
    renderAt('/restaurants/the-place', '/restaurants/:slug', <RestaurantDetailPage />)

    fireEvent.click(screen.getByRole('button', { name: /Report/ }))
    fireEvent.change(screen.getByLabelText('More detail (optional)'), {
      target: { value: 'This was not a first-hand visit.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

    await vi.waitFor(() =>
      expect(mocks.reportMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewId: 'r1',
          detail: 'This was not a first-hand visit.',
        }),
      ),
    )
  })
})

describe('RestaurantReviewFormPage', () => {
  it('asks a signed-out diner to sign in', () => {
    mocks.useAuthUser.mockReturnValue(null)
    renderAt('/restaurants/the-place/review', '/restaurants/:slug/review', <RestaurantReviewFormPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(mocks.promptSignIn).toHaveBeenCalledWith('/restaurants/the-place/review')
    expect(mocks.createMutate).not.toHaveBeenCalled()
  })

  it('uploads photos first, then creates a review with real payload fields', async () => {
    const file = new File(['image'], 'meal.jpg', { type: 'image/jpeg' })
    renderAt('/restaurants/the-place/review', '/restaurants/:slug/review', <RestaurantReviewFormPage />)

    fireEvent.click(screen.getByRole('radio', { name: /Excellent/ }))
    fireEvent.change(screen.getByLabelText(/Your review/), {
      target: { value: 'The food and service were both excellent.' },
    })
    fireEvent.change(screen.getByLabelText('Add review photos'), { target: { files: [file] } })
    fireEvent.click(screen.getByLabelText('Couples'))
    fireEvent.click(screen.getByRole('checkbox', { name: /I certify that this review/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await vi.waitFor(() => expect(mocks.uploadMutate).toHaveBeenCalledWith([file]))
    await vi.waitFor(() =>
      expect(mocks.createMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: 5,
          body: 'The food and service were both excellent.',
          companions: ['COUPLES'],
          photos: ['https://res.cloudinary.com/demo/image/upload/v1/photo.jpg'],
        }),
      ),
    )
    expect(mocks.navigate).toHaveBeenCalledWith('/restaurants/the-place?review=submitted', {
      replace: true,
    })
  })

  it('does not submit until the diner certifies the review', () => {
    renderAt('/restaurants/the-place/review', '/restaurants/:slug/review', <RestaurantReviewFormPage />)

    fireEvent.click(screen.getByRole('radio', { name: /Excellent/ }))
    fireEvent.change(screen.getByLabelText(/Your review/), {
      target: { value: 'The food and service were both excellent.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(mocks.createMutate).not.toHaveBeenCalled()
  })

  it('loads an owned review and submits a correction through the replace endpoint', async () => {
    mocks.useMyRestaurantReview.mockReturnValue({
      data: { review },
      isPending: false,
      isError: false,
      error: null,
    })
    renderAt(
      '/restaurants/the-place/reviews/r1/edit',
      '/restaurants/:slug/reviews/:reviewId/edit',
      <RestaurantReviewFormPage />,
    )

    expect(screen.getByRole('heading', { name: 'Update your review' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /I certify that this review/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await vi.waitFor(() =>
      expect(mocks.replaceMutate).toHaveBeenCalledWith(
        expect.objectContaining({ rating: 5, body: review.body }),
      ),
    )
    expect(mocks.createMutate).not.toHaveBeenCalled()
  })
})

describe('RestaurantClaimPage', () => {
  it('starts a signed-in claim', async () => {
    renderAt('/restaurants/the-place/claim', '/restaurants/:slug/claim', <RestaurantClaimPage />)

    fireEvent.change(screen.getByLabelText(/Why should we believe/), {
      target: { value: 'I have managed this restaurant for six years.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send claim' }))

    await vi.waitFor(() =>
      expect(mocks.claimMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          contactEmail: 'diner@example.com',
          message: 'I have managed this restaurant for six years.',
        }),
      ),
    )
  })

  it('shows a pending claim without a second submit form', () => {
    mocks.useMyRestaurantClaim.mockReturnValue({
      data: {
        claim: { ...review, id: 'c1', status: 'PENDING', contactEmail: 'diner@example.com' },
        membership: null,
        venue,
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })
    renderAt('/restaurants/the-place/claim', '/restaurants/:slug/claim', <RestaurantClaimPage />)

    expect(screen.getByText('Your claim is waiting for review')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send claim' })).not.toBeInTheDocument()
  })

  it('sends an approved member to owner tools', () => {
    mocks.useMyRestaurantClaim.mockReturnValue({
      data: {
        claim: null,
        membership: { id: 'm1', role: 'OWNER', status: 'ACTIVE' },
        venue,
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })
    renderAt('/restaurants/the-place/claim', '/restaurants/:slug/claim', <RestaurantClaimPage />)

    expect(screen.getByText('You already manage this restaurant')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open owner tools' })).toHaveAttribute(
      'href',
      '/restaurants/the-place/manage',
    )
  })
})

describe('RestaurantManagePage', () => {
  it('lists restaurants an account is approved to manage', () => {
    renderAt('/restaurants/manage', '/restaurants/manage', <RestaurantManagePage />)

    expect(screen.getByRole('heading', { name: 'My restaurants' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'The Place' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      '/restaurants/the-place/manage',
    )
  })

  it('saves presentation fields without sending rating fields', async () => {
    renderAt(
      '/restaurants/the-place/manage',
      '/restaurants/:slug/manage',
      <RestaurantManagePage />,
    )

    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Updated description for diners.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }))

    await vi.waitFor(() => expect(mocks.updateMutate).toHaveBeenCalledOnce())
    const payload = mocks.updateMutate.mock.calls[0][0]
    expect(payload).toEqual(
      expect.objectContaining({ description: 'Updated description for diners.' }),
    )
    expect(payload).not.toHaveProperty('rating')
    expect(payload).not.toHaveProperty('externalStats')
  })
})
