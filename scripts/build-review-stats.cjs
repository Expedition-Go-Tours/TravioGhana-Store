#!/usr/bin/env node
/**
 * Derives a tiny `externalReviewStats.json` from the full scraped
 * `externalReviews.json` so tour cards can show combined review stats without
 * downloading/parsing the full 1.6 MB row dataset.
 *
 * The generated file contains:
 *   - stats: the headline stats computed with the exact visibility policy used
 *     at runtime (visible = has text, Google >= 4★, others >= 2★; only
 *     TripAdvisor/GetYourGuide counted).
 *   - products: every platform product with its original totals plus a
 *     `resolvedDistribution` (official breakdown when complete, otherwise the
 *     sampled visible counted rows scaled to the official total; products
 *     without official totals keep their sampled distribution and
 *     `official: false`).
 *   - productAggregates: counted visible rows per product (count/sum) so the
 *     card fallback path never needs the raw rows either.
 *   - featuredReviews: a small, deterministic slice of visible reviews for the
 *     homepage rail, so it too never downloads/parses the 1.6 MB row dataset.
 *
 * Run automatically via `npm run prebuild`; can be run standalone with
 * `node scripts/build-review-stats.cjs` after syncing reviews.
 */

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const SOURCE = path.join(ROOT, 'public', 'data', 'externalReviews.json')
const OUT = path.join(ROOT, 'public', 'data', 'externalReviewStats.json')

const COUNTED_SOURCES = ['TRIPADVISOR', 'GETYOURGUIDE']
const MIN_GOOGLE_RATING = 4
const MIN_SCRAPED_RATING = 2
const PLACEHOLDER_REVIEW_TEXT = /^\(no review text\)$/i
const STAR_ORDER = [5, 4, 3, 2, 1]
const FEATURED_REVIEW_LIMIT = 16

/** Only the fields ExternalReviewCard renders — keeps the stats file tiny. */
function toFeaturedReview(review) {
  return {
    id: review.id,
    source: review.source,
    reviewerName: review.reviewerName,
    reviewerAvatar: review.reviewerAvatar ?? null,
    rating: review.rating,
    title: review.title ?? null,
    text: review.text,
    tourTitle: review.tourTitle,
    tourUrl: review.tourUrl,
    originalDate: review.originalDate ?? null,
  }
}

/**
 * Deterministic "best of" selection: reviews with avatars first, then rating,
 * then recency. Mixing sources keeps the rail from reading as a single
 * platform; Google (business-level) rows are excluded because the rail links
 * to tour pages.
 */
function pickFeaturedReviews(reviews) {
  const scored = reviews
    .filter((review) => review.source !== 'GOOGLE')
    .slice()
    .sort((a, b) => {
      const avatarA = a.reviewerAvatar ? 1 : 0
      const avatarB = b.reviewerAvatar ? 1 : 0
      if (avatarA !== avatarB) return avatarB - avatarA
      if (b.rating !== a.rating) return b.rating - a.rating
      const dateA = a.originalDate ? new Date(a.originalDate).getTime() : 0
      const dateB = b.originalDate ? new Date(b.originalDate).getTime() : 0
      return dateB - dateA
    })

  const perSource = { TRIPADVISOR: 0, GETYOURGUIDE: 0 }
  const picked = []
  for (const review of scored) {
    const sourceCount = perSource[review.source] ?? 0
    if (sourceCount >= FEATURED_REVIEW_LIMIT / 2) continue
    perSource[review.source] = sourceCount + 1
    picked.push(review)
    if (picked.length >= FEATURED_REVIEW_LIMIT) break
  }
  return picked.map(toFeaturedReview)
}

function isVisibleReview(review) {
  const text = (review.text || '').trim()
  if (!text || PLACEHOLDER_REVIEW_TEXT.test(text)) return false
  return review.source === 'GOOGLE'
    ? review.rating >= MIN_GOOGLE_RATING
    : review.rating >= MIN_SCRAPED_RATING
}

function emptyDistribution() {
  return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
}

function roundOne(value) {
  return Math.round(value * 10) / 10
}

function scaleDistribution(weights, total) {
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
  for (let i = 0; i < order.length && remainder > 0; i += 1) {
    floors[order[i].index] += 1
    remainder -= 1
  }

  STAR_ORDER.forEach((star, index) => { result[star] = floors[index] })
  return result
}

function computeStats(reviews) {
  const platforms = new Map()
  let totalReviews = 0
  let countedSum = 0

  for (const review of reviews) {
    const entry = platforms.get(review.source) ?? { count: 0, sum: 0 }
    entry.count += 1
    entry.sum += review.rating
    platforms.set(review.source, entry)

    if (COUNTED_SOURCES.includes(review.source)) {
      totalReviews += 1
      countedSum += review.rating
    }
  }

  return {
    totalReviews,
    averageRating: totalReviews > 0 ? roundOne(countedSum / totalReviews) : null,
    platforms: [...platforms.entries()].map(([source, { count, sum }]) => ({
      source,
      reviewCount: count,
      averageRating: roundOne(sum / count),
    })),
  }
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`[review-stats] missing ${path.relative(ROOT, SOURCE)} — skipping`)
    process.exit(0)
  }

  const data = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))
  const reviews = Array.isArray(data.reviews) ? data.reviews : []
  const products = Array.isArray(data.products) ? data.products : []
  const visible = reviews.filter(isVisibleReview)

  const rowsByProduct = new Map()
  for (const review of visible) {
    if (!review.productId) continue
    const list = rowsByProduct.get(review.productId)
    if (list) list.push(review)
    else rowsByProduct.set(review.productId, [review])
  }

  const productAggregates = {}
  const resolvedProducts = products.map((product) => {
    const rows = rowsByProduct.get(product.id) ?? []
    const sampledCounted = emptyDistribution()
    let countedCount = 0
    let countedSum = 0

    for (const row of rows) {
      if (row.rating >= 1 && row.rating <= 5) sampledCounted[row.rating] += 1
      if (!COUNTED_SOURCES.includes(row.source)) continue
      if (!Number.isFinite(row.rating)) continue
      countedCount += 1
      countedSum += row.rating
    }
    productAggregates[product.id] = { count: countedCount, sum: countedSum }

    const official = Math.max(0, Number(product.reviewCount) || 0)
    const officialRating = Number(product.rating) || 0
    if (official > 0 && officialRating > 0) {
      let resolved = null
      if (product.distribution) {
        const candidate = emptyDistribution()
        let sum = 0
        for (const star of STAR_ORDER) {
          const value = Math.max(0, Number(product.distribution[String(star)]) || 0)
          candidate[star] = value
          sum += value
        }
        if (sum === official) resolved = candidate
      }
      if (!resolved) {
        resolved = scaleDistribution(sampledCounted, official)
      } else {
        resolved[1] = 0
      }
      return { ...product, resolvedDistribution: resolved, official: true }
    }

    const hasSample = STAR_ORDER.some((star) => sampledCounted[star] > 0)
    return {
      ...product,
      resolvedDistribution: hasSample ? sampledCounted : null,
      official: false,
    }
  })

  const output = {
    generatedAt: data.generatedAt ?? new Date().toISOString(),
    stats: computeStats(visible),
    products: resolvedProducts,
    productAggregates,
    featuredReviews: pickFeaturedReviews(visible),
  }

  fs.writeFileSync(OUT, JSON.stringify(output))
  const sourceKb = Math.round(fs.statSync(SOURCE).size / 1024)
  const outKb = Math.round(fs.statSync(OUT).size / 1024)
  console.log(`[review-stats] wrote ${path.relative(ROOT, OUT)} (${outKb} KB, from ${sourceKb} KB)`)
}

main()
