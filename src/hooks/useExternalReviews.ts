import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { matchTourForTitle, type MatchableTour } from '../lib/reviewTourLink'
import { isScrapedReviewSupplier } from '../lib/supplierIdentity'

export interface ExternalReview {
  id: string
  source: 'TRIPADVISOR' | 'GETYOURGUIDE' | 'GOOGLE'
  reviewerName: string
  reviewerAvatar: string | null
  rating: number
  title: string | null
  text: string
  textTruncated: string | null
  tourTitle: string
  tourThumbnail: string | null
  tourUrl: string
  tourLink: string
  coverPhoto: string | null
  originalDate: string | null
  /** Product the row belongs to (null for business-level Google rows). */
  productId?: string | null
  /** Official product rating scraped from the listing header. */
  productRating?: number | null
  /** Official product review count scraped from the listing header. */
  productReviewCount?: number | null
}

export interface ExternalReviewProduct {
  id: string
  source: 'TRIPADVISOR' | 'GETYOURGUIDE'
  tourTitle: string
  tourUrl: string
  /** Official rating from the product page header (e.g. 4.9). */
  rating: number | null
  /** Official review total from the product page header (e.g. 595). */
  reviewCount: number | null
  /** Star → count breakdown when the listing exposes it. */
  distribution?: Record<string, number> | null
}

export interface ExternalReviewStats {
  totalReviews: number
  averageRating: number | null
  platforms: {
    source: string
    reviewCount: number
    averageRating: number
  }[]
}

export interface ExternalReviewData {
  generatedAt?: string
  stats?: ExternalReviewStats
  products: ExternalReviewProduct[]
  reviews: ExternalReview[]
}

const DATA_URL = `${import.meta.env.BASE_URL}data/externalReviews.json`
const STATS_URL = `${import.meta.env.BASE_URL}data/externalReviewStats.json`

async function fetchExternalReviewData(): Promise<ExternalReviewData> {
  const res = await fetch(DATA_URL, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Failed to load external reviews (${res.status})`)
  const payload = await res.json().catch(() => ({}))
  return {
    generatedAt: payload.generatedAt,
    stats: payload.stats,
    products: Array.isArray(payload.products) ? payload.products : [],
    reviews: Array.isArray(payload.reviews) ? payload.reviews : [],
  }
}

/** Product record from the slim stats file, with the resolved (official or
 * sampled-scaled) star distribution used for review histograms. */
export interface ExternalReviewStatsProduct extends ExternalReviewProduct {
  resolvedDistribution: Record<number, number> | null
  /** Whether the product carried an official review total. */
  official: boolean
}

export interface ExternalReviewStatsData {
  generatedAt?: string
  stats: ExternalReviewStats
  products: ExternalReviewStatsProduct[]
  productAggregates: Record<string, { count: number; sum: number }>
  /** Small deterministic slice for the homepage rail (no row dataset needed). */
  featuredReviews: ExternalReview[]
}

async function fetchExternalReviewStatsData(): Promise<ExternalReviewStatsData> {
  const res = await fetch(STATS_URL, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Failed to load external review stats (${res.status})`)
  const payload = await res.json().catch(() => ({}))
  return {
    generatedAt: payload.generatedAt,
    stats: payload.stats ?? { totalReviews: 0, averageRating: null, platforms: [] },
    products: Array.isArray(payload.products) ? payload.products : [],
    productAggregates: payload.productAggregates ?? {},
    featuredReviews: Array.isArray(payload.featuredReviews) ? payload.featuredReviews : [],
  }
}

/**
 * Full scraped row dataset (1.6 MB) — only fetch this when the rows are really
 * about to be rendered (review rails/sections), never from tour cards.
 * `enabled` lets viewport-aware callers defer the request.
 */
export function useExternalReviewData(enabled = true) {
  return useQuery({
    queryKey: ['external-reviews-data'],
    queryFn: fetchExternalReviewData,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    enabled,
  })
}

/** Slim (~7 KB) derived dataset: headline stats, product totals + aggregates. */
export function useExternalReviewStatsData() {
  return useQuery({
    queryKey: ['external-review-stats'],
    queryFn: fetchExternalReviewStatsData,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
}

// Fisher-Yates shuffle for deterministic randomization
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Social-proof policy:
 * - Google reviews at 3 stars or below are never shown.
 * - TripAdvisor / GetYourGuide 1★ reviews are never shown.
 * Enforced here in addition to the scraper (`scripts/sync-reviews.cjs`) so a
 * stale or hand-regenerated JSON can never surface them.
 */
const MIN_GOOGLE_RATING = 4
const MIN_SCRAPED_RATING = 2
/** Marker the scraper used to write for rating-only reviews. */
const PLACEHOLDER_REVIEW_TEXT = /^\(no review text\)$/i

function hasReviewText(review: ExternalReview): boolean {
  const text = review.text?.trim()
  return !!text && !PLACEHOLDER_REVIEW_TEXT.test(text)
}

/** Whether a scraped review may be shown/counted under the policy above. */
export function isVisibleExternalReview(review: ExternalReview): boolean {
  if (!hasReviewText(review)) return false
  return review.source === 'GOOGLE'
    ? review.rating >= MIN_GOOGLE_RATING
    : review.rating >= MIN_SCRAPED_RATING
}

function visibleReviews(reviews: ExternalReview[]): ExternalReview[] {
  return reviews.filter(isVisibleExternalReview)
}

export function useExternalReviews(limit = 100, enabled = true) {
  const query = useExternalReviewData(enabled)
  const reviews = useMemo(
    () => (query.data ? shuffle(visibleReviews(query.data.reviews)).slice(0, limit) : undefined),
    [query.data, limit],
  )
  return { ...query, data: reviews }
}

export function useAllExternalReviews(enabled = true) {
  const query = useExternalReviewData(enabled)
  const reviews = useMemo(() => (query.data ? visibleReviews(query.data.reviews) : undefined), [query.data])
  return { ...query, data: reviews }
}

/**
 * Sources whose scraped reviews make up the headline stats bar. Google rows
 * are business-level (they carry the Google Maps listing as their "tour"), so
 * they are listed in the UI but never counted in the headline numbers.
 */
export const COUNTED_SOURCES: ExternalReview['source'][] = ['TRIPADVISOR', 'GETYOURGUIDE']

/**
 * Stats derived from the reviews actually present in the dataset — never from
 * the platform-wide totals scraped off the listing headers (those count every
 * product on the platform and made the bar read "1204+" for 143 rows).
 */
export function computeExternalReviewStats(reviews: ExternalReview[]): ExternalReviewStats {
  const platforms = new Map<string, { count: number; sum: number }>()
  let totalReviews = 0
  let countedSum = 0

  for (const review of reviews) {
    const entry = platforms.get(review.source) ?? { count: 0, sum: 0 }
    entry.count++
    entry.sum += review.rating
    platforms.set(review.source, entry)

    if (COUNTED_SOURCES.includes(review.source)) {
      totalReviews++
      countedSum += review.rating
    }
  }

  return {
    totalReviews,
    averageRating: totalReviews > 0 ? Math.round((countedSum / totalReviews) * 10) / 10 : null,
    platforms: [...platforms.entries()].map(([source, { count, sum }]) => ({
      source,
      reviewCount: count,
      averageRating: Math.round((sum / count) * 10) / 10,
    })),
  }
}

/** Headline stats, served from the slim stats file (no row dataset needed). */
export function useExternalReviewStats() {
  const query = useExternalReviewStatsData()
  return { ...query, data: query.data?.stats }
}

/**
 * Homepage rail reviews — a small precomputed slice in the stats file, so the
 * rail never downloads or parses the 1.6 MB row dataset. The full dataset
 * remains for /reviews and the tour-detail reviews tab.
 */
export function useFeaturedExternalReviews() {
  const query = useExternalReviewStatsData()
  return { ...query, data: query.data?.featuredReviews }
}

// ─── Matching (tour ↔ scraped product) ───────────────────────────────────────

interface ProductIndex {
  data: ExternalReviewData
  rowsByProductId: Map<string, ExternalReview[]>
}

const indexCache = new WeakMap<ExternalReviewData, ProductIndex>()

function getIndex(data: ExternalReviewData): ProductIndex {
  const cached = indexCache.get(data)
  if (cached) return cached
  const rowsByProductId = new Map<string, ExternalReview[]>()
  for (const row of data.reviews) {
    if (!row.productId) continue
    const list = rowsByProductId.get(row.productId)
    if (list) list.push(row)
    else rowsByProductId.set(row.productId, [row])
  }
  const index: ProductIndex = { data, rowsByProductId }
  indexCache.set(data, index)
  return index
}

interface MatchedTourReviews {
  index: ProductIndex
  products: ExternalReviewProduct[]
  rows: ExternalReview[]
}

const matchCache = new Map<string, MatchedTourReviews>()

function matchKey(tour: MatchableTour): string {
  return `${tour.title}|${tour.location ?? ''}|${tour.supplierName ?? ''}`
}

function sortReviews(reviews: ExternalReview[]): ExternalReview[] {
  return [...reviews].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating
    const da = a.originalDate ? new Date(a.originalDate).getTime() : 0
    const db = b.originalDate ? new Date(b.originalDate).getTime() : 0
    return db - da
  })
}

/**
 * Scraped products matched to a tour.
 *
 * Returns nothing for any tour not operated by the scraped supplier — that is
 * what stops one operator's TripAdvisor / GetYourGuide totals appearing on
 * another operator's identically-titled tour. Fails closed when the supplier is
 * unknown, and title matching itself stays unchanged.
 */
export function selectMatchedProducts<T extends { tourTitle: string }>(
  products: T[],
  tour: MatchableTour | null | undefined,
): T[] {
  if (!tour?.title) return []
  if (!isScrapedReviewSupplier(tour.supplierName)) return []
  return products.filter((product) => matchTourForTitle(product.tourTitle, [tour]) !== null)
}

/** Scraped products (with official totals) + review rows matched to a tour. */
export function getMatchedTourReviews(
  data: ExternalReviewData | undefined,
  tour: MatchableTour | null | undefined,
): { products: ExternalReviewProduct[]; rows: ExternalReview[] } {
  if (!data || !tour?.title) return { products: [], rows: [] }
  const index = getIndex(data)
  const key = matchKey(tour)
  const cached = matchCache.get(key)
  if (cached && cached.index === index) return cached

  const products = selectMatchedProducts(data.products, tour)
  const productIds = new Set(products.map((product) => product.id))

  const rows = data.reviews.filter((review) => {
    if (!isVisibleExternalReview(review)) return false
    if (review.productId) return productIds.has(review.productId)
    // Legacy rows without a productId fall back to per-title matching.
    return matchTourForTitle(review.tourTitle, [tour]) !== null
  })

  const matched: MatchedTourReviews = { index, products, rows: sortReviews(rows) }
  matchCache.set(key, matched)
  return matched
}

/**
 * External reviews whose platform product maps to the given tour. Used by the
 * tour detail page so a product shows the TripAdvisor / GetYourGuide reviews
 * scraped for it, not just in-app ones.
 */
export function useTourExternalReviews(tour: MatchableTour | null | undefined, enabled = true) {
  const { data, isLoading } = useExternalReviewData(enabled)
  const title = tour?.title
  const location = tour?.location
  const supplierName = tour?.supplierName

  const reviews = useMemo(() => {
    if (!data || !title) return [] as ExternalReview[]
    return getMatchedTourReviews(data, { title, location, supplierName }).rows
  }, [data, title, location, supplierName])

  return { reviews, isLoading }
}

/**
 * Official product summaries matched to a tour (for counts/histogram). Served
 * from the slim stats file — no need to download the raw review rows.
 */
export function useTourExternalProducts(tour: MatchableTour | null | undefined) {
  const { data, isLoading } = useExternalReviewStatsData()
  const title = tour?.title
  const location = tour?.location
  const supplierName = tour?.supplierName

  const products = useMemo(() => {
    if (!data || !title) return [] as ExternalReviewStatsProduct[]
    return selectMatchedProducts(data.products, { title, location, supplierName })
  }, [data, title, location, supplierName])

  return { products, isLoading }
}

/**
 * Star → count histogram from the pre-resolved per-product distributions.
 * Mirrors `combinedExternalDistribution` for the official-products path;
 * returns null when no matched product carries official totals (callers then
 * count the visible rows).
 */
export function aggregateResolvedDistribution(
  products: ExternalReviewStatsProduct[],
): Record<number, number> | null {
  const totals = emptyDistribution()
  let sawOfficial = false
  for (const product of products) {
    if (!product.official || !product.resolvedDistribution) continue
    sawOfficial = true
    for (const star of STAR_ORDER) {
      totals[star] += Math.max(0, Number(product.resolvedDistribution[star]) || 0)
    }
  }
  return sawOfficial ? totals : null
}

// ─── Combined stats ──────────────────────────────────────────────────────────

export interface CombinedReviewStats {
  /** Weighted average of in-app ratings and counted scraped reviews. */
  rating: number
  /** In-app review count + counted scraped reviews (or official totals). */
  reviewCount: number
  /** External reviews merged in (official total when known). */
  externalCount: number
}

interface ExternalAggregate {
  rating: number
  reviewCount: number
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Weighted aggregate of matched products' OFFICIAL totals (when scraped).
 * Defensively excludes any 1★ bucket still present in a product distribution
 * (the scraper already removes it; this keeps stale datasets honest too).
 */
export function aggregateProducts(products: ExternalReviewProduct[]): ExternalAggregate | null {
  let count = 0
  let sum = 0
  for (const product of products) {
    const productCount = Math.max(0, Number(product.reviewCount) || 0)
    const productRating = Number(product.rating) || 0
    if (productCount <= 0 || productRating <= 0) continue

    const oneStar = Math.max(0, Number(product.distribution?.['1']) || 0)
    let adjustedCount = productCount
    let adjustedSum = productRating * productCount
    if (oneStar > 0) {
      adjustedCount -= oneStar
      adjustedSum -= oneStar
    }
    if (adjustedCount <= 0) continue

    count += adjustedCount
    sum += adjustedSum
  }
  if (count === 0) return null
  return { rating: roundOne(sum / count), reviewCount: count }
}

const STAR_ORDER = [5, 4, 3, 2, 1] as const

function emptyDistribution(): Record<number, number> {
  return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
}

/**
 * Allocate `total` across stars proportionally to `weights` using the
 * largest-remainder method, so the parts always sum to `total` exactly.
 * Used when a platform exposes its review total but not its star breakdown
 * (GetYourGuide): the scraped sample supplies the ratios.
 */
export function scaleDistribution(
  weights: Record<number, number>,
  total: number,
): Record<number, number> {
  const result = emptyDistribution()
  const target = Math.max(0, Math.floor(total))
  if (target === 0) return result

  const safeWeights = STAR_ORDER.map((star) => Math.max(0, Number(weights[star]) || 0))
  const weightSum = safeWeights.reduce((sum, value) => sum + value, 0)
  if (weightSum <= 0) return result

  const exact = safeWeights.map((value) => (value / weightSum) * target)
  const floors = exact.map((value) => Math.floor(value))
  let remainder = target - floors.reduce((sum, value) => sum + value, 0)

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (let i = 0; i < order.length && remainder > 0; i++) {
    floors[order[i].index] += 1
    remainder -= 1
  }

  STAR_ORDER.forEach((star, index) => { result[star] = floors[index] })
  return result
}

/**
 * Star → count breakdown from matched products, guaranteed to sum to the
 * official totals the headline uses. Products with a complete official
 * distribution (TripAdvisor) contribute it as-is; products with an official
 * total but no usable distribution (GetYourGuide) contribute their scraped
 * rows scaled to that total. Returns null when no product carries an official
 * total (callers then count the rows themselves).
 */
export function combinedExternalDistribution(
  products: ExternalReviewProduct[],
  rows: ExternalReview[] = [],
): Record<number, number> | null {
  const totals = emptyDistribution()
  const weightsByProduct = new Map<string, Record<number, number>>()
  for (const row of rows) {
    if (!row.productId || !COUNTED_SOURCES.includes(row.source)) continue
    if (row.rating < 1 || row.rating > 5) continue
    const weights = weightsByProduct.get(row.productId) ?? emptyDistribution()
    weights[row.rating] += 1
    weightsByProduct.set(row.productId, weights)
  }

  let sawOfficial = false
  for (const product of products) {
    const official = Math.max(0, Number(product.reviewCount) || 0)
    if (official <= 0) continue
    sawOfficial = true

    let contribution: Record<number, number> | null = null
    if (product.distribution) {
      const candidate = emptyDistribution()
      let sum = 0
      for (const star of STAR_ORDER) {
        const value = Math.max(0, Number(product.distribution[String(star)]) || 0)
        candidate[star] = value
        sum += value
      }
      if (sum === official) contribution = candidate
    }
    if (!contribution) {
      contribution = scaleDistribution(weightsByProduct.get(product.id) ?? emptyDistribution(), official)
    } else {
      // Never surface the 1★ bucket (mirrors aggregateProducts' adjustment).
      contribution[1] = 0
    }

    for (const star of STAR_ORDER) totals[star] += contribution[star]
  }

  return sawOfficial ? totals : null
}

/**
 * Merge a tour's own (in-app) rating stats with the scraped TripAdvisor /
 * GetYourGuide reviews matched to it.
 *
 * When the scraped product header carried official totals (`aggregate`), those
 * are used as the external contribution — that is what the platforms display
 * (e.g. "4.9 (595 reviews)"). Otherwise the counted scraped rows are summed.
 * Google rows are shown but never counted.
 */
export function combineReviewStats(
  local: { rating?: number | string | null; reviewCount?: number | null },
  external: ExternalReview[],
  aggregate?: ExternalAggregate | null,
): CombinedReviewStats {
  const localCount = Math.max(0, Number(local.reviewCount) || 0)
  const localRating = Number(local.rating) || 0
  let sum = 0
  let count = 0

  if (localCount > 0 && localRating > 0) {
    sum += localRating * localCount
    count += localCount
  }

  let externalCount = 0
  if (aggregate && aggregate.reviewCount > 0 && aggregate.rating > 0) {
    sum += aggregate.rating * aggregate.reviewCount
    count += aggregate.reviewCount
    externalCount = aggregate.reviewCount
  } else {
    for (const review of external) {
      if (!COUNTED_SOURCES.includes(review.source)) continue
      if (!Number.isFinite(review.rating)) continue
      sum += review.rating
      count += 1
      externalCount += 1
    }
  }

  const rating = count > 0 ? Math.min(5, Math.max(0, roundOne(sum / count))) : 0

  return { rating, reviewCount: count, externalCount }
}

/** Tour fields the combined stats helper needs. */
export interface CombinedStatsTour extends MatchableTour {
  rating?: number | string | null
  reviewCount?: number | null
}

/**
 * Combined rating/count for a tour — in-app reviews plus every scraped
 * TripAdvisor/GetYourGuide product matched to it. Used everywhere a tour's
 * review stats are displayed (detail page and cards) so the headline numbers
 * always agree with the review cards on screen.
 */
export function useCombinedTourStats(tour: CombinedStatsTour | null | undefined): CombinedReviewStats {
  const { data } = useExternalReviewStatsData()
  const title = tour?.title
  const location = tour?.location
  const supplierName = tour?.supplierName
  const rating = tour?.rating
  const reviewCount = tour?.reviewCount

  return useMemo(() => {
    if (!data || !title) return combineReviewStats({ rating, reviewCount }, [])
    // Scraped social proof is scoped to the scraped operator's own tours;
    // everyone else shows their in-app numbers only.
    if (!isScrapedReviewSupplier(supplierName)) {
      return combineReviewStats({ rating, reviewCount }, [])
    }
    const matched = selectMatchedProducts(data.products, { title, location, supplierName })
    const aggregate = aggregateProducts(matched)
    if (aggregate) return combineReviewStats({ rating, reviewCount }, [], aggregate)

    // No official totals on any matched product: count the pre-aggregated
    // visible counted rows instead of downloading the raw dataset.
    let count = 0
    let sum = 0
    for (const product of matched) {
      const entry = data.productAggregates[product.id]
      if (!entry) continue
      count += entry.count
      sum += entry.sum
    }
    const fallback = count > 0 ? { rating: roundOne(sum / count), reviewCount: count } : null
    return combineReviewStats({ rating, reviewCount }, [], fallback)
  }, [data, title, location, supplierName, rating, reviewCount])
}

// ─── Supplier-level reviews ──────────────────────────────────────────────────

/** Tour fields the supplier review selector needs. */
export interface SupplierReviewTour extends MatchableTour {
  rating?: number | string | null
  reviews?: number | null
  ratingValue?: number | null
}

export interface SupplierReviewSummary {
  /** Weighted average (official scraped totals first, in-app fallback). */
  rating: number | null
  count: number
  /** Star → count from scraped distributions; null when only in-app data exists. */
  distribution: Record<number, number> | null
}

export interface SupplierReviewData {
  summary: SupplierReviewSummary
  /** Featured review rows belonging to the supplier's matched products. */
  reviews: ExternalReview[]
}

/**
 * Merges the scraped products matched to a supplier's tours into one summary,
 * falling back to the supplier's own in-app rating totals when nothing scraped
 * matches. Runs off the slim stats payload — the 1.6 MB row dataset is never
 * needed for the supplier profile.
 */
export function selectSupplierReviewData(
  data: ExternalReviewStatsData | undefined,
  tours: SupplierReviewTour[],
): SupplierReviewData {
  let localCount = 0
  let localSum = 0
  for (const tour of tours) {
    const count = Math.max(0, Number(tour.reviews) || 0)
    const rating = Number(tour.ratingValue ?? tour.rating) || 0
    if (count > 0 && rating > 0) {
      localCount += count
      localSum += rating * count
    }
  }
  const localSummary: SupplierReviewSummary = localCount > 0
    ? { rating: roundOne(localSum / localCount), count: localCount, distribution: null }
    : { rating: null, count: 0, distribution: null }

  if (!data || tours.length === 0) return { summary: localSummary, reviews: [] }

  const productsById = new Map<string, ExternalReviewStatsProduct>()
  for (const tour of tours) {
    for (const product of selectMatchedProducts(data.products, tour)) {
      productsById.set(product.id, product)
    }
  }
  const products = [...productsById.values()]
  if (products.length === 0) return { summary: localSummary, reviews: [] }

  const aggregate = aggregateProducts(products)
  const summary: SupplierReviewSummary = aggregate
    ? { rating: aggregate.rating, count: aggregate.reviewCount, distribution: aggregateResolvedDistribution(products) }
    : localSummary

  const productIds = new Set(products.map((product) => product.id))
  const reviews = data.featuredReviews.filter(
    (review) =>
      (review.productId != null && productIds.has(review.productId)) ||
      matchTourForTitle(review.tourTitle, tours) !== null,
  )

  return { summary, reviews }
}

/** Supplier profile reviews: summary + featured cards for the homepage-styled rail. */
export function useSupplierReviews(tours: SupplierReviewTour[]) {
  const { data, isLoading } = useExternalReviewStatsData()
  return { ...selectSupplierReviewData(data, tours), isLoading }
}
