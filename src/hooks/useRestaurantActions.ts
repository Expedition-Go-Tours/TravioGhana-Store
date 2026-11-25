import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, fetchWithAuth } from '../lib/api'
import type { RestaurantVenueDetail } from './useRestaurantVenues'

export interface AuthorRestaurantReview {
  id: string
  venueId: string
  status: 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REJECTED' | 'ARCHIVED' | 'REMOVED'
  rating: number
  foodRating: number | null
  serviceRating: number | null
  atmosphereRating: number | null
  valueRating: number | null
  title: string | null
  body: string | null
  photos: string[]
  companions: string[]
  visitedAt: string | null
  source: string
  proofMethod: string | null
  verified: boolean
  helpfulCount: number
  createdAt: string
}

export interface RestaurantReviewInput {
  rating: number
  foodRating?: number
  serviceRating?: number
  atmosphereRating?: number
  valueRating?: number
  title?: string
  body: string
  photos?: string[]
  companions?: string[]
  proofToken?: string
  visitedAt?: string
}

export type RestaurantReviewUpdate = Omit<RestaurantReviewInput, 'proofToken' | 'visitedAt'>

export interface RestaurantClaim {
  id: string
  venueId: string
  userId: string
  brand: string
  businessName: string | null
  role: string | null
  contactEmail: string
  phone: string | null
  message: string | null
  evidenceUrl: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewNote: string | null
  createdAt: string
  updatedAt: string
}

export interface RestaurantClaimStatus {
  claim: RestaurantClaim | null
  membership: { id: string; role: 'OWNER' | 'MANAGER'; status: string } | null
  venue: { id: string; slug: string; name: string; city: string | null }
}

export interface RestaurantClaimInput {
  businessName?: string
  role?: string
  contactEmail?: string
  phone?: string
  message: string
  evidenceUrl?: string
}

export interface OwnRestaurantVenue {
  membership: { id: string; role: 'OWNER' | 'MANAGER'; status: string }
  venue: RestaurantVenueDetail
}

export interface RestaurantVenueUpdate {
  description?: string
  phone?: string
  website?: string
  cuisines?: string[]
  dietary?: string[]
  amenities?: string[]
  hours?: Record<string, unknown>
  photos?: string[]
  coverPhoto?: string | null
}

function writeOptions(method: 'POST' | 'PATCH', body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function reviewsPath(slugOrId: string): string {
  return `/v1/restaurant-venues/${encodeURIComponent(slugOrId)}/reviews?brand=ghana`
}

function authorReviewPath(slugOrId: string, reviewId: string): string {
  return `/v1/restaurant-venues/${encodeURIComponent(slugOrId)}/reviews/${encodeURIComponent(reviewId)}?brand=ghana`
}

function claimPath(slugOrId: string): string {
  return `/v1/restaurant-venues/${encodeURIComponent(slugOrId)}/claim?brand=ghana`
}

function claimsPath(slugOrId: string): string {
  return `/v1/restaurant-venues/${encodeURIComponent(slugOrId)}/claims?brand=ghana`
}

function venuePath(slugOrId: string): string {
  return `/v1/restaurant-venues/${encodeURIComponent(slugOrId)}?brand=ghana`
}

function photoPath(slugOrId: string): string {
  return `/v1/restaurant-venues/${encodeURIComponent(slugOrId)}/review-photos?brand=ghana`
}

function reportPath(slugOrId: string, reviewId: string): string {
  return `/v1/restaurant-venues/${encodeURIComponent(slugOrId)}/reviews/${encodeURIComponent(reviewId)}/report?brand=ghana`
}

function withoutEmpty<T extends object>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== '' && value !== undefined),
  ) as T
}

export function useMyRestaurantReview(
  slugOrId: string | undefined,
  reviewId: string | undefined,
  enabled = true,
) {
  return useQuery<{ review: AuthorRestaurantReview }, Error>({
    queryKey: ['restaurant-venue-my-review', slugOrId, reviewId],
    queryFn: () => apiFetch(authorReviewPath(slugOrId!, reviewId!)),
    enabled: enabled && Boolean(slugOrId && reviewId),
    staleTime: 0,
  })
}

export function useUploadRestaurantReviewPhotos(slugOrId: string) {
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData()
      files.forEach((file) => form.append('photos', file))
      const response = await fetchWithAuth(photoPath(slugOrId), { method: 'POST', body: form })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.message || `Upload failed (${response.status})`)
      }
      return (payload.data ?? payload) as { photos: string[] }
    },
  })
}

export function useCreateRestaurantReview(slugOrId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RestaurantReviewInput) =>
      apiFetch<{ review: AuthorRestaurantReview }>(
        reviewsPath(slugOrId),
        writeOptions('POST', withoutEmpty(input)),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurant-venue', slugOrId] })
      void queryClient.invalidateQueries({ queryKey: ['restaurant-venue-reviews', slugOrId] })
      void queryClient.invalidateQueries({ queryKey: ['restaurant-venue-my-review', slugOrId] })
    },
  })
}

export function useReplaceRestaurantReview(slugOrId: string, reviewId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RestaurantReviewUpdate) =>
      apiFetch<{ review: AuthorRestaurantReview }>(
        authorReviewPath(slugOrId, reviewId),
        writeOptions('PATCH', withoutEmpty(input)),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurant-venue', slugOrId] })
      void queryClient.invalidateQueries({ queryKey: ['restaurant-venue-reviews', slugOrId] })
      void queryClient.invalidateQueries({ queryKey: ['restaurant-venue-my-review', slugOrId] })
    },
  })
}

export function useReportRestaurantReview(slugOrId: string) {
  return useMutation({
    mutationFn: (input: { reviewId: string; reason: string; detail?: string }) =>
      apiFetch<{ report: { id: string; status: string } }>(
        reportPath(slugOrId, input.reviewId),
        writeOptions('POST', withoutEmpty({ reason: input.reason, detail: input.detail })),
      ),
  })
}

export function useMyRestaurantClaim(slugOrId: string | undefined, enabled = true) {
  return useQuery<RestaurantClaimStatus, Error>({
    queryKey: ['restaurant-venue-my-claim', slugOrId],
    queryFn: () => apiFetch<RestaurantClaimStatus>(claimPath(slugOrId!)),
    enabled: enabled && Boolean(slugOrId),
    staleTime: 30_000,
  })
}

export function useSubmitRestaurantClaim(slugOrId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RestaurantClaimInput) =>
      apiFetch<{ claim: RestaurantClaim }>(
        claimsPath(slugOrId),
        writeOptions('POST', withoutEmpty(input)),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurant-venue-my-claim', slugOrId] })
    },
  })
}

export function useMyRestaurantVenues(enabled = true) {
  return useQuery<{ venues: OwnRestaurantVenue[] }, Error>({
    queryKey: ['restaurant-venue-my-venues'],
    queryFn: () => apiFetch<{ venues: OwnRestaurantVenue[] }>('/v1/restaurant-venues/my-venues'),
    enabled,
    staleTime: 30_000,
  })
}

export function useUpdateOwnRestaurantVenue(slugOrId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RestaurantVenueUpdate) =>
      apiFetch<{ venue: RestaurantVenueDetail }>(
        venuePath(slugOrId),
        writeOptions('PATCH', withoutEmpty(input)),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurant-venue', slugOrId] })
      void queryClient.invalidateQueries({ queryKey: ['restaurant-venue-my-venues'] })
    },
  })
}
