import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { Tour, MultiDayTour } from '../components/data'
import { getStoredAuthUser, getAuthUserId, subscribeToAuthState } from '../lib/auth'
import { fetchWithAuth } from '../lib/api'
import { mapRawTourToListing, type SpecialOfferData } from '../hooks/useExpeditionTours'
import { readGated, writeGated } from '../lib/consentGatedStorage'

export interface WishlistItem {
  id: string
  /**
   * Real backend tour ID. Present when the item was added from a tour
   * sourced from the API (any live tour card, or the tour detail page).
   * Absent for legacy/static mock content that has no corresponding
   * database record — those items can only ever be stored locally.
   * Used to sync adds/removes with the account wishlist on the backend.
   */
  tourId?: string
  /** Tour slug — the decorative, readable half of /tour/{id}/{slug}. */
  slug?: string
  title: string
  location: string
  price: number
  duration: string
  /** Product type shown on the card's type chip (Tour / Activity / Transport).
      Absent on items saved before this was captured — the card then omits the
      chip rather than inventing a type. */
  category?: string
  /**
   * Highlight line shown under the card title ("Guide included · Lunch
   * included"). Absent on items saved before this was captured.
   */
  features?: string
  imageUrl: string
  /** All tour photos — the saved card keeps its swipeable image carousel. */
  photos?: string[]
  rating: number
  reviewCount: number
  addedDate: string
  /** Operator of the tour — scopes scraped TripAdvisor / GetYourGuide stats. */
  supplierName?: string | null
  source?: 'expedition-go' | 'travio-africa'
  externalUrl?: string
  /** Card badge fields, captured so a saved tour keeps the badges it had. */
  languages?: string[]
  difficulty?: string
  cancellationPolicy?: string
  pickupIncluded?: boolean
  accommodationIncluded?: boolean
  meetingMode?: 'meeting_point' | 'pickup' | 'none'
  /** Discount badge label shown on the card when it was saved (e.g. "-30%"). */
  discount?: string
  /**
   * Supplier offers as they applied when the tour was saved. Re-checked
   * against their date window on render (expired offers don't discount) and
   * refreshed from the live offers list on the wishlist page.
   */
  specialOffers?: SpecialOfferData[]
}

interface WishlistContextValue {
  wishlist: WishlistItem[]
  addToWishlist: (item: WishlistItem) => void
  removeFromWishlist: (id: string) => void
  isInWishlist: (id: string) => boolean
  wishlistCount: number
  /** True while merging a guest wishlist into the account after login. */
  isSyncing: boolean
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

function generateId(title: string, location: string): string {
  return btoa(`${title}|${location}`).replace(/=/g, '')
}

/**
 * The tour fields `toWishlistItem` snapshots. Beyond the plain `Tour`, live
 * cards carry `priceValue` (authoritative numeric price) and `specialOffers`
 * (the promo state the card is showing).
 */
export type WishlistSource = (Tour | MultiDayTour & { days?: string }) & {
  id?: string
  slug?: string
  priceValue?: number | null
  specialOffers?: SpecialOfferData[]
}

export function toWishlistItem(tour: WishlistSource): WishlistItem {
  const m = tour as MultiDayTour & { days?: string }
  const t = tour as Tour
  const hasDuration = 'duration' in tour && typeof tour.duration === 'string'
  const hasDays = 'days' in m && typeof m.days === 'string'
  const realId = tour.id
  // Features are the card's highlight line. Multi-day cards carry the same
  // information as `highlights`, so fall back to it rather than saving blank.
  const features = 'features' in tour && typeof t.features === 'string'
    ? t.features
    : ('highlights' in m && typeof m.highlights === 'string' ? m.highlights : '')
  // Prefer the authoritative numeric price; only fall back to re-parsing the
  // display string for legacy callers that don't pass priceValue.
  const price = typeof tour.priceValue === 'number' && Number.isFinite(tour.priceValue) && tour.priceValue > 0
    ? tour.priceValue
    : parseInt(String(tour.price ?? '').replace(/[$,]/g, ''), 10) || 0

  return {
    id: realId || generateId(tour.title, tour.location),
    tourId: realId,
    title: tour.title,
    location: tour.location,
    price,
    duration: hasDuration ? tour.duration : (hasDays ? m.days : '1 Day'),
    category: typeof t.category === 'string' ? t.category : undefined,
    features,
    imageUrl: tour.image,
    photos: Array.isArray(t.photos) && t.photos.length > 0 ? t.photos : undefined,
    rating: parseFloat(tour.rating) || 0,
    reviewCount: tour.reviews,
    addedDate: new Date().toISOString(),
    source: tour.source,
    externalUrl: tour.externalUrl,
    slug: tour.slug,
    supplierName: t.supplierName,
    languages: Array.isArray(t.languages) && t.languages.length > 0 ? t.languages : undefined,
    difficulty: t.difficulty || undefined,
    cancellationPolicy: t.cancellationPolicy || undefined,
    pickupIncluded: t.pickupIncluded,
    accommodationIncluded: t.accommodationIncluded,
    meetingMode: t.meetingMode,
    discount: t.discount || undefined,
    specialOffers: Array.isArray(tour.specialOffers) && tour.specialOffers.length > 0 ? tour.specialOffers : undefined,
  }
}

const STORAGE_KEY = 'expedition_go_wishlist'
const PENDING_KEY = 'expedition_go_wishlist_pending'

function loadLocalWishlist(): WishlistItem[] {
  try {
    const stored = readGated(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveLocalWishlist(items: WishlistItem[]) {
  try {
    writeGated(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* ignore (private browsing / storage full) */
  }
}

interface PendingOp {
  userId: string
  tourId: string
  action: 'add' | 'remove'
  ts: number
}

function loadPendingOps(): PendingOp[] {
  try {
    const stored = readGated(PENDING_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function savePendingOps(ops: PendingOp[]) {
  try {
    writeGated(PENDING_KEY, JSON.stringify(ops))
  } catch {
    /* ignore (private browsing / storage full) */
  }
}

/**
 * Enqueue an add/remove that failed to reach the backend. Ops are keyed by
 * user id so they never leak onto another account, and coalesced by
 * (userId, tourId) so the latest intent wins (an 'add' followed by a
 * 'remove' collapses to just 'remove').
 */
function enqueuePending(userId: string, tourId: string, action: 'add' | 'remove') {
  const others = loadPendingOps().filter((o) => !(o.userId === userId && o.tourId === tourId))
  others.push({ userId, tourId, action, ts: Date.now() })
  savePendingOps(others)
}

/**
 * Uses /api/users/wishlist rather than /api/travioghana/wishlist — the
 * latter only returns tours curated onto the homepage (ExpeditionTour
 * table with isActive: true), which would silently drop any tour not
 * yet featured there. The /users/wishlist endpoint works for any active
 * tour by its real database ID.
 *
 * All calls go through fetchWithAuth, which transparently refreshes an
 * expired access token and retries (see lib/api.ts). Access tokens live
 * for 1h, so without that retry any long-lived tab would start failing
 * with "Invalid or expired token" — the original wishlist bug.
 */
async function fetchBackendWishlistItems(): Promise<WishlistItem[]> {
  const res = await fetchWithAuth('/users/wishlist')
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    const err = new Error(payload.message || `Request failed (${res.status})`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const payload = await res.json().catch(() => ({}))
  const tours: any[] = payload.data?.tours ?? []
  return tours.map(mapBackendTourToItem)
}

async function pushWishlistOp(tourId: string, action: 'add' | 'remove'): Promise<void> {
  const res = await fetchWithAuth(`/users/wishlist/${encodeURIComponent(tourId)}`, {
    method: action === 'add' ? 'POST' : 'DELETE',
  })
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    const err = new Error(payload.message || `Request failed (${res.status})`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
}

function mapBackendTourToItem(t: any): WishlistItem {
  // mapRawTourToListing resolves features, photos and date-filtered offers
  // from the raw tour, so a server-synced item carries the same display
  // payload a card captured live would.
  const listing = mapRawTourToListing(t)
  const priceNum = listing.priceValue != null
    ? listing.priceValue
    : parseInt(String(listing.price).replace(/[^0-9.]/g, ''), 10) || 0
  const ratingNum = parseFloat(listing.rating) || 0

  return {
    id: t.id,
    tourId: t.id,
    title: listing.title,
    location: listing.location,
    price: priceNum,
    duration: listing.duration,
    category: listing.category || undefined,
    features: listing.features || undefined,
    imageUrl: listing.image,
    photos: listing.photos,
    rating: ratingNum,
    reviewCount: listing.reviews,
    // The backend WishlistItem row stores a real per-entry addedAt
    // timestamp, which GET /users/wishlist returns on each tour. Fall back
    // to now for anything that somehow lacks one.
    addedDate: t.addedAt || new Date().toISOString(),
    source: listing.source,
    externalUrl: listing.externalUrl,
    slug: listing.slug,
    supplierName: listing.supplierName,
    languages: listing.languages,
    difficulty: listing.difficulty,
    cancellationPolicy: listing.cancellationPolicy,
    pickupIncluded: listing.pickupIncluded,
    accommodationIncluded: listing.accommodationIncluded,
    meetingMode: listing.meetingMode,
    discount: listing.discount,
    specialOffers: listing.specialOffers,
  }
}

/**
 * Display-only fields the wishlist card paints but the backend list endpoint
 * may not project. When a server item replaces a locally captured one for the
 * same tour, the local snapshot fills in any of these the server copy lacks —
 * server values always win when present, so title/price/rating stay
 * authoritative.
 */
const LOCAL_DISPLAY_FIELDS = [
  'features',
  'photos',
  'languages',
  'difficulty',
  'cancellationPolicy',
  'pickupIncluded',
  'accommodationIncluded',
  'meetingMode',
  'discount',
  'specialOffers',
] as const

export function mergeWishlistItem(server: WishlistItem, local?: WishlistItem): WishlistItem {
  if (!local) return server
  const merged = { ...server } as Record<string, unknown>
  for (const key of LOCAL_DISPLAY_FIELDS) {
    const serverValue = server[key]
    const localValue = local[key]
    const serverHasValue = serverValue != null
      && serverValue !== ''
      && !(Array.isArray(serverValue) && serverValue.length === 0)
    const localHasValue = localValue != null
      && localValue !== ''
      && !(Array.isArray(localValue) && localValue.length === 0)
    if (!serverHasValue && localHasValue) merged[key] = localValue
  }
  return merged as unknown as WishlistItem
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlist, setWishlist] = useState<WishlistItem[]>(loadLocalWishlist)
  const [isSyncing, setIsSyncing] = useState(false)

  // Refs mirror state so the long-lived auth subscription and flush
  // handlers (all set up once on mount) always read current values
  // instead of a stale closure.
  const wishlistRef = useRef(wishlist)
  const isLoggedInRef = useRef(!!getAuthUserId(getStoredAuthUser()))
  const userIdRef = useRef<string | null>(getAuthUserId(getStoredAuthUser()))
  const mergedForUserRef = useRef<string | null>(null)

  useEffect(() => {
    wishlistRef.current = wishlist
    saveLocalWishlist(wishlist)
  }, [wishlist])

  /**
   * Re-drive every queued op for the current user against the backend.
   * Keeps retrying in place; ops are only dropped once they succeed or
   * return 404 (the tour no longer exists, so the op can never succeed).
   */
  const flushPendingOps = useCallback(async (userId: string): Promise<void> => {
    const ops = loadPendingOps().filter((o) => o.userId === userId)
    if (ops.length === 0) return

    const remaining: PendingOp[] = []
    for (const op of ops) {
      try {
        await pushWishlistOp(op.tourId, op.action)
      } catch (e) {
        const status = (e as { status?: number })?.status
        if (status === 404) {
          if (op.action === 'add') {
            // Tour is gone — a pending add can never land, so drop the
            // stale item from the local list instead of retrying forever.
            setWishlist((prev) => prev.filter((i) => i.tourId !== op.tourId))
          }
          // A 404 on remove just means it's already gone server-side.
        } else {
          remaining.push(op)
        }
      }
    }

    const others = loadPendingOps().filter((o) => o.userId !== userId)
    savePendingOps([...others, ...remaining])
  }, [])

  /**
   * Runs once a user logs in / on first app boot with a session:
   * pushes guest additions up to the account, replays any ops that
   * previously failed, then pulls the authoritative list. Purely-local
   * items (static content with no backend tourId) are kept alongside.
   */
  const reconcileOnLogin = useCallback(async (uid: string) => {
    setIsSyncing(true)
    try {
      const backendItems = await fetchBackendWishlistItems()
      const serverIds = new Set(backendItems.map((i) => i.tourId).filter(Boolean) as string[])

      // Items added while browsing as a guest (real tourId, not yet on the
      // account) get pushed up so nothing saved before login is lost.
      const guestOnlyItems = wishlistRef.current.filter((i) => i.tourId && !serverIds.has(i.tourId))
      for (const item of guestOnlyItems) {
        try {
          await pushWishlistOp(item.tourId!, 'add')
        } catch (e) {
          const status = (e as { status?: number })?.status
          if (status !== 404) enqueuePending(uid, item.tourId!, 'add')
        }
      }

      // Replay any ops that failed earlier for this user (offline, token
      // expired beyond refresh, etc.).
      await flushPendingOps(uid)

      const finalItems = await fetchBackendWishlistItems()
      const localOnlyItems = wishlistRef.current.filter((i) => !i.tourId)
      // The server item is authoritative, but its endpoint may not project
      // every card field (features, photos, badges, captured offers). Merge
      // the local snapshot's display-only fields back in so a tour saved
      // before login doesn't lose half its card after the sync.
      const localByTourId = new Map(
        wishlistRef.current.filter((i) => i.tourId).map((i) => [i.tourId as string, i]),
      )
      setWishlist([
        ...localOnlyItems,
        ...finalItems.map((item) =>
          mergeWishlistItem(item, item.tourId ? localByTourId.get(item.tourId) : undefined),
        ),
      ])
    } catch (e) {
      console.warn('[Wishlist] sync on login failed, keeping local state:', e)
    } finally {
      setIsSyncing(false)
    }
  }, [flushPendingOps])

  useEffect(() => {
    const syncOnLogin = async (uid: string) => {
      await reconcileOnLogin(uid)
    }

    let unsubscribe: (() => void) | undefined
    subscribeToAuthState((user) => {
      const uid = getAuthUserId(user)
      isLoggedInRef.current = !!uid
      userIdRef.current = uid || null

      if (uid) {
        if (mergedForUserRef.current !== uid) {
          mergedForUserRef.current = uid
          syncOnLogin(uid)
        }
      } else if (mergedForUserRef.current) {
        // Transitioned from logged-in to logged-out — the account's
        // wishlist is already persisted server-side, so clear the local
        // cache rather than risk leaking it to the next guest session.
        // Any ops that never reached the backend stay queued under the
        // previous user and replay on their next login.
        mergedForUserRef.current = null
        setWishlist([])
      }
    }).then((unsub) => { unsubscribe = unsub })

    return () => { unsubscribe?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Retry the pending queue when the tab regains focus, connectivity
  // returns, or on a rolling timer — the original failure (e.g. a token
  // that expired while the tab sat idle) is usually transient.
  useEffect(() => {
    const tryFlush = () => {
      const uid = userIdRef.current
      if (uid && isLoggedInRef.current) flushPendingOps(uid)
    }

    window.addEventListener('focus', tryFlush)
    window.addEventListener('online', tryFlush)
    const interval = setInterval(tryFlush, 120_000)

    return () => {
      window.removeEventListener('focus', tryFlush)
      window.removeEventListener('online', tryFlush)
      clearInterval(interval)
    }
  }, [flushPendingOps])

  const addToWishlist = useCallback((item: WishlistItem) => {
    setWishlist((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev
      return [item, ...prev]
    })

    const uid = isLoggedInRef.current ? userIdRef.current : null
    if (uid && item.tourId) {
      pushWishlistOp(item.tourId, 'add').catch((e) => {
        const status = (e as { status?: number })?.status
        if (status === 404) {
          setWishlist((prev) => prev.filter((i) => i.id !== item.id))
          toast.error('This tour is no longer available.')
          return
        }
        // No rollback: keep the optimistic item and queue the op so it
        // syncs as soon as the session/network recovers.
        enqueuePending(uid, item.tourId!, 'add')
        toast.error("Saved on this device — we'll sync it to your account shortly.")
      })
    }
  }, [])

  const removeFromWishlist = useCallback((id: string) => {
    const item = wishlistRef.current.find((i) => i.id === id)

    setWishlist((prev) => prev.filter((i) => i.id !== id))

    const uid = isLoggedInRef.current ? userIdRef.current : null
    if (uid && item?.tourId) {
      pushWishlistOp(item.tourId, 'remove').catch((e) => {
        const status = (e as { status?: number })?.status
        if (status === 404) return // already gone server-side; nothing to sync
        enqueuePending(uid, item.tourId!, 'remove')
        toast.error("Removed on this device — we'll sync it to your account shortly.")
      })
    }
  }, [])

  // Set-based membership + stable callbacks: every TourCard subscribes, and
  // the previous array scan made a single heart tap O(n) per card.
  const wishlistIds = useMemo(() => new Set(wishlist.map((i) => i.id)), [wishlist])
  const isInWishlist = useCallback((id: string) => wishlistIds.has(id), [wishlistIds])

  const value = useMemo(
    () => ({
      wishlist,
      addToWishlist,
      removeFromWishlist,
      isInWishlist,
      wishlistCount: wishlist.length,
      isSyncing,
    }),
    [wishlist, addToWishlist, removeFromWishlist, isInWishlist, isSyncing],
  )

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider')
  return ctx
}
