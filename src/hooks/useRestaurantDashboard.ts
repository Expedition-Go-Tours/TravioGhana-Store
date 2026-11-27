import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, fetchWithAuth } from '../lib/api'

/**
 * Typed client for the owner dashboard.
 *
 * Every response is shaped by the backend's `data` envelope, and every write
 * invalidates the dashboard queries it can affect. Nothing here invents data:
 * endpoints that have no real source (views, competitors) simply do not exist.
 */

export type VenueRole = 'OWNER' | 'MANAGER'
export type Permission =
  | 'venue.edit'
  | 'reviews.reply'
  | 'reviews.report'
  | 'photos.manage'
  | 'menu.manage'
  | 'team.view'
  | 'team.manage'
  | 'integrations.manage'
  | 'venue.transfer'
  | 'venue.delete'

export interface DashboardSession {
  venue: {
    id: string
    slug: string
    name: string
    city: string | null
    region: string | null
    status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED'
    timezone: string | null
    coverPhoto: string | null
    rating: number | null
    reviewCount: number
    rank: { position: number; of: number | null } | null
    details: {
      description: string | null
      phone: string | null
      website: string | null
      menuUrl: string | null
      hours: Record<string, unknown> | null
      cuisines: string[]
      dietary: string[]
      amenities: string[]
      mealTypes: string[]
      photos: string[]
      coverPhoto: string | null
    }
  }
  membership: { id: string; role: VenueRole }
  permissions: Permission[]
  badges?: { reviews: number; photos: number; pendingReplies: number }
}

export interface AttentionItem {
  key: string
  tone: 'warn' | 'info'
  title: string
  detail: string
  action: { label: string; to: string; filter?: string }
}

export interface CompletenessCheck {
  key: string
  label: string
  done: boolean
}

export interface OverviewReview {
  id: string
  rating: number
  title: string | null
  body: string | null
  photos: string[]
  createdAt: string
  verified: boolean
  author: { name: string; photo: string | null } | null
  response: {
    id: string
    body: string
    status: 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'REMOVED'
    authorRole: VenueRole
    authorName: string | null
    createdAt: string
    flagReason: string | null
  } | null
  answered: boolean
}

export interface ActivityItem {
  id: string
  action: string
  category: string
  actor: { id: string; name: string | null } | null
  target: string | null
  details: Record<string, unknown>
  createdAt: string
}

export interface MenuItem {
  id: string
  name: string
  description: string | null
  priceMinor: number | null
  currency: string
  dietary: string[]
  isAvailable: boolean
  position: number
  photoUrl: string | null
}

export interface MenuSection {
  id: string
  title: string
  description: string | null
  position: number
  items: MenuItem[]
}

export interface DashboardMenu {
  id: string
  name: string
  description: string | null
  status: 'DRAFT' | 'PUBLISHED'
  currency: string
  position: number
  publishedAt: string | null
  updatedAt: string
  sections: MenuSection[]
}

export interface DashboardOverview {
  session: DashboardSession
  overview: {
    attention: AttentionItem[]
    stats: {
      rating: number | null
      reviewCount: number
      verifiedReviewCount: number
      rank: { position: number; of: number | null } | null
      responseRate: number | null
      unansweredReviews: number
      pendingReplies: number
      totalReviews: number
      lastReviewAt: string | null
      publishedPhotos: number
      pendingPhotos: number
      totalPhotos: number
      publishedMenus: number
      teamMembers: number
      pendingInvites: number
    }
    completeness: {
      score: number
      completed: number
      total: number
      checks: CompletenessCheck[]
    }
    recentReviews: OverviewReview[]
    recentActivity: ActivityItem[]
    menus: DashboardMenu[]
  }
}

export interface OwnerReview extends OverviewReview {
  foodRating: number | null
  serviceRating: number | null
  atmosphereRating: number | null
  valueRating: number | null
  visitedAt: string | null
  source: string
  companions: string[]
}

export interface OwnerReviews {
  reviews: OwnerReview[]
  counts: { total: number; unanswered: number; negative: number; pending: number }
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null }
}

export type PhotoStatus = 'PENDING' | 'PUBLISHED' | 'REJECTED'

export interface VenuePhoto {
  id: string
  url: string
  caption: string | null
  position: number
  status: PhotoStatus
  source: 'OWNER' | 'REVIEW' | 'TERRA'
  createdAt: string
  moderatedAt: string | null
  flagReason: string | null
}

export interface VenuePhotos {
  photos: VenuePhoto[]
  counts: { total: number; published: number; pending: number; rejected: number }
  coverPhoto: string | null
  limit: number
}

export interface VenueMenus {
  menus: DashboardMenu[]
  menuUrl: string | null
  limit: number
}

export interface TeamMember {
  id: string
  role: VenueRole
  status: string
  createdAt: string
  user: {
    id: string
    name: string
    email: string
    photo: string | null
    lastLoginAt: string | null
  } | null
}

export interface TeamInvite {
  id: string
  email: string
  role: VenueRole
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
  expiresAt: string
  createdAt: string
  acceptedAt: string | null
  revokedAt: string | null
}

export interface VenueTeam {
  members: TeamMember[]
  invites: TeamInvite[]
  canManage: boolean
  ownerCount: number
}

export interface Insights {
  period: {
    days: number
    start: string
    end: string
    comparisonStart: string
    comparisonEnd: string
  }
  current: {
    count: number
    averageRating: number | null
    negative: number
    verified: number
    distribution: Record<string, number>
    replies: number
    responseRate: number | null
    publishedPhotos: number
  }
  previous: {
    count: number
    averageRating: number | null
    negative: number
    verified: number
    distribution: Record<string, number>
    replies: number
    responseRate: number | null
  }
  deltas: { reviews: number; rating: number | null; responseRate: number | null }
  series: Array<{
    key: string
    label: string
    reviews: number
    averageRating: number | null
    negative: number
  }>
  publishedMenus: number
  hasData: boolean
}

export interface ActivityFeed {
  activity: ActivityItem[]
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null }
}

export interface MenuDocumentInput {
  id?: string
  name?: string
  description?: string | null
  currency?: string
  sections: Array<{
    title: string
    description?: string | null
    items: Array<{
      name: string
      description?: string | null
      priceMinor?: number | null
      dietary?: string[]
      isAvailable?: boolean
      photoUrl?: string | null
    }>
  }>
}

function base(slugOrId: string): string {
  return `/v1/restaurant-venues/${encodeURIComponent(slugOrId)}/dashboard`
}

function withBrand(path: string, query?: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  params.set('brand', 'ghana')
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return `${path}?${params.toString()}`
}

function json(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}

function keys(slug: string) {
  return {
    all: ['restaurant-dashboard', slug] as const,
    session: ['restaurant-dashboard', slug, 'session'] as const,
    overview: ['restaurant-dashboard', slug, 'overview'] as const,
    reviews: ['restaurant-dashboard', slug, 'reviews'] as const,
    photos: ['restaurant-dashboard', slug, 'photos'] as const,
    menus: ['restaurant-dashboard', slug, 'menus'] as const,
    team: ['restaurant-dashboard', slug, 'team'] as const,
    insights: ['restaurant-dashboard', slug, 'insights'] as const,
    activity: ['restaurant-dashboard', slug, 'activity'] as const,
  }
}

export function useDashboardSession(slug: string | undefined, enabled = true) {
  return useQuery<DashboardSession, Error>({
    queryKey: ['restaurant-dashboard', slug, 'session'],
    queryFn: () => apiFetch<DashboardSession>(withBrand(`${base(slug!)}/session`)),
    enabled: enabled && Boolean(slug),
    staleTime: 30_000,
  })
}

export function useDashboardOverview(slug: string | undefined, enabled = true) {
  return useQuery<DashboardOverview, Error>({
    queryKey: ['restaurant-dashboard', slug, 'overview'],
    queryFn: () => apiFetch<DashboardOverview>(withBrand(base(slug!))),
    enabled: enabled && Boolean(slug),
    staleTime: 30_000,
  })
}

export function useOwnerReviews(
  slug: string | undefined,
  query: {
    filter?: string
    rating?: number
    sort?: string
    cursor?: string
  } = {},
  enabled = true,
) {
  return useQuery<OwnerReviews, Error>({
    queryKey: ['restaurant-dashboard', slug, 'reviews', query],
    queryFn: () =>
      apiFetch<OwnerReviews>(withBrand(`${base(slug!)}/reviews`, { ...query, limit: 20 })),
    enabled: enabled && Boolean(slug),
    staleTime: 15_000,
  })
}

export function useVenuePhotos(slug: string | undefined, enabled = true) {
  return useQuery<VenuePhotos, Error>({
    queryKey: ['restaurant-dashboard', slug, 'photos'],
    queryFn: () => apiFetch<VenuePhotos>(withBrand(`${base(slug!)}/photos`)),
    enabled: enabled && Boolean(slug),
    staleTime: 15_000,
  })
}

export function useVenueMenus(slug: string | undefined, enabled = true) {
  return useQuery<VenueMenus, Error>({
    queryKey: ['restaurant-dashboard', slug, 'menus'],
    queryFn: () => apiFetch<VenueMenus>(withBrand(`${base(slug!)}/menu`)),
    enabled: enabled && Boolean(slug),
    staleTime: 15_000,
  })
}

export function useVenueTeam(slug: string | undefined, enabled = true) {
  return useQuery<VenueTeam, Error>({
    queryKey: ['restaurant-dashboard', slug, 'team'],
    queryFn: () => apiFetch<VenueTeam>(withBrand(`${base(slug!)}/team`)),
    enabled: enabled && Boolean(slug),
    staleTime: 15_000,
  })
}

export function useDashboardInsights(
  slug: string | undefined,
  days: 7 | 30 | 90 | 365 = 30,
  enabled = true,
) {
  return useQuery<Insights, Error>({
    queryKey: ['restaurant-dashboard', slug, 'insights', days],
    queryFn: () => apiFetch<Insights>(withBrand(`${base(slug!)}/insights`, { days })),
    enabled: enabled && Boolean(slug),
    staleTime: 60_000,
  })
}

export function useDashboardActivity(
  slug: string | undefined,
  query: { type?: string; cursor?: string } = {},
  enabled = true,
) {
  return useQuery<ActivityFeed, Error>({
    queryKey: ['restaurant-dashboard', slug, 'activity', query],
    queryFn: () =>
      apiFetch<ActivityFeed>(withBrand(`${base(slug!)}/activity`, { ...query, limit: 20 })),
    enabled: enabled && Boolean(slug),
    staleTime: 15_000,
  })
}

/** Invalidate everything a write could have changed, including the shell badge. */
export function useDashboardInvalidator(slug: string) {
  const client = useQueryClient()
  return () => {
    const k = keys(slug)
    return Promise.all([
      client.invalidateQueries({ queryKey: k.all }),
      client.invalidateQueries({ queryKey: ['restaurant-venue', slug] }),
      client.invalidateQueries({ queryKey: ['restaurant-venue-my-venues'] }),
    ])
  }
}

export function useCreateReviewResponse(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (input: { reviewId: string; body: string }) =>
      apiFetch<{ response: OwnerReview['response'] }>(
        withBrand(`${base(slug)}/reviews/${encodeURIComponent(input.reviewId)}/responses`),
        json('POST', { body: input.body }),
      ),
    onSuccess: () => void invalidate(),
  })
}

export function useDeleteReviewResponse(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (responseId: string) =>
      apiFetch(withBrand(`${base(slug)}/responses/${encodeURIComponent(responseId)}`), json('DELETE')),
    onSuccess: () => void invalidate(),
  })
}

export function useUploadVenuePhotos(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData()
      files.forEach((file) => form.append('photos', file))
      const response = await fetchWithAuth(withBrand(`${base(slug)}/photos`), {
        method: 'POST',
        body: form,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.message || `Upload failed (${response.status})`)
      }
      return (payload.data ?? payload) as { photos: VenuePhoto[] }
    },
    onSuccess: () => void invalidate(),
  })
}

export function useUpdateVenuePhoto(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (input: { photoId: string; caption?: string | null; position?: number }) =>
      apiFetch(
        withBrand(`${base(slug)}/photos/${encodeURIComponent(input.photoId)}`),
        json('PATCH', { caption: input.caption, position: input.position }),
      ),
    onSuccess: () => void invalidate(),
  })
}

export function useDeleteVenuePhoto(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (photoId: string) =>
      apiFetch(withBrand(`${base(slug)}/photos/${encodeURIComponent(photoId)}`), json('DELETE')),
    onSuccess: () => void invalidate(),
  })
}

export function useReorderVenuePhotos(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (photoIds: string[]) =>
      apiFetch(withBrand(`${base(slug)}/photos/order`), json('PUT', { photoIds })),
    onSuccess: () => void invalidate(),
  })
}

export function useSetVenueCoverPhoto(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (photoId: string) =>
      apiFetch(withBrand(`${base(slug)}/photos/cover`), json('PUT', { photoId })),
    onSuccess: () => void invalidate(),
  })
}

export function useSaveVenueMenu(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (input: MenuDocumentInput) =>
      apiFetch<{ menu: DashboardMenu }>(withBrand(`${base(slug)}/menu`), json('PUT', input)),
    onSuccess: () => void invalidate(),
  })
}

export function usePublishVenueMenu(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (menuId: string) =>
      apiFetch(withBrand(`${base(slug)}/menu/${encodeURIComponent(menuId)}/publish`), json('POST')),
    onSuccess: () => void invalidate(),
  })
}

export function useUnpublishVenueMenu(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (menuId: string) =>
      apiFetch(withBrand(`${base(slug)}/menu/${encodeURIComponent(menuId)}/unpublish`), json('POST')),
    onSuccess: () => void invalidate(),
  })
}

export function useDeleteVenueMenu(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (menuId: string) =>
      apiFetch(withBrand(`${base(slug)}/menu/${encodeURIComponent(menuId)}`), json('DELETE')),
    onSuccess: () => void invalidate(),
  })
}

export function useInviteTeamMember(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (input: { email: string; role?: 'MANAGER'; expiresInDays?: number }) =>
      apiFetch<{ invite: TeamInvite }>(withBrand(`${base(slug)}/team/invites`), json('POST', input)),
    onSuccess: () => void invalidate(),
  })
}

export function useRevokeTeamInvite(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch(withBrand(`${base(slug)}/team/invites/${encodeURIComponent(inviteId)}`), json('DELETE')),
    onSuccess: () => void invalidate(),
  })
}

export function useUpdateTeamMemberRole(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (input: { memberId: string; role: VenueRole }) =>
      apiFetch(
        withBrand(`${base(slug)}/team/members/${encodeURIComponent(input.memberId)}`),
        json('PATCH', { role: input.role }),
      ),
    onSuccess: () => void invalidate(),
  })
}

export function useRemoveTeamMember(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch(withBrand(`${base(slug)}/team/members/${encodeURIComponent(memberId)}`), json('DELETE')),
    onSuccess: () => void invalidate(),
  })
}

export function useTransferVenueOwnership(slug: string) {
  const invalidate = useDashboardInvalidator(slug)
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch(
        withBrand(`${base(slug)}/team/members/${encodeURIComponent(memberId)}/transfer`),
        json('POST'),
      ),
    onSuccess: () => void invalidate(),
  })
}

export function useAcceptTeamInvite() {
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ venue: { id: string; slug: string; name: string } }>(
        '/v1/restaurant-venues/team/invites/accept',
        json('POST', { token }),
      ),
  })
}

export function dashboardError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
