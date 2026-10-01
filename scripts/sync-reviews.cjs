/**
 * sync-reviews.cjs — Standalone scraper for TripAdvisor + GetYourGuide reviews.
 *
 *   node scripts/sync-reviews.cjs
 *
 * Writes public/data/externalReviews.json consumed by the frontend at runtime.
 * The file also carries a `products` summary with each product's OFFICIAL
 * rating/review count (e.g. TripAdvisor's "4.9 (595 reviews)") so the storefront
 * can show the true totals even when a deep scrape is incomplete.
 *
 * Requires puppeteer (`npm install puppeteer`).
 */

const fs = require('fs')
const path = require('path')
const {
  buildTripAdvisorPageUrl,
  buildGetYourGuidePageUrl,
  dedupeReviews,
  parseTripAdvisorProductHeader,
  parseGetYourGuideProductHeader,
  excludeOneStarReviews,
  excludeOneStarFromProductHeader,
  productIdFrom,
} = require('./review-scrape-utils.cjs')

// ─── Configuration ───────────────────────────────────────────────────────────

const TRIPADVISOR_TOURS = [
  {
    url: 'https://www.tripadvisor.com/AttractionProductReview-g293797-d24189724-Cape_Coast_Castle_Elmina_Castle_Kakum_National_Park_Day_Tour-Accra_Greater_Accra.html',
    title: 'Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour',
  },
  {
    url: 'https://www.tripadvisor.com/AttractionProductReview-g293797-d25225851-From_Accra_Waterfalls_Aburi_Gardens_Cocoa_Farm_Day_Tour-Accra_Greater_Accra.html',
    title: 'From Accra: Waterfalls, Aburi Gardens & Cocoa Farm Day Tour',
  },
  {
    url: 'https://www.tripadvisor.com/AttractionProductReview-g293797-d25217516-Accra_Guided_City_Tour_Cultural_and_Historical_Experience-Accra_Greater_Accra.html',
    title: 'Accra Guided City Tour: Cultural and Historical Experience',
  },
  {
    url: 'https://www.tripadvisor.com/AttractionProductReview-g293797-d25275033-Shia_Hills_Safari_Akosombo_Boat_Cruise_Day_Tour-Accra_Greater_Accra.html',
    title: 'Shai Hills Safari & Akosombo Boat Cruise Day Tour',
  },
  {
    url: 'https://www.tripadvisor.com/AttractionProductReview-g293797-d25225556-From_Accra_Private_Airport_Transfer_Pickup_Drop_off_Services-Accra_Greater_Accra.html',
    title: 'From Accra: Private Airport Transfer Pickup & Drop off Services',
  },
  {
    url: 'https://www.tripadvisor.com/AttractionProductReview-g293797-d25225555-The_Kumasi_Cultural_and_Heritage_Day_Tour-Accra_Greater_Accra.html',
    title: 'The Kumasi Cultural and Heritage Day Tour',
  },
  {
    url: 'https://www.tripadvisor.com/AttractionProductReview-g293797-d34552807-Ghanaian_Cultural_Art_Tour_and_Scented_Candle_Making_Experience-Accra_Greater_Accr.html',
    title: 'Ghanaian Cultural Art Tour and Scented Candle Making Experience',
  },
  {
    url: 'https://www.tripadvisor.com/AttractionProductReview-g293797-d34552809-Waterfalls_Massage_with_Aburi_Gardens_and_Cocoa_Farm_Tour-Accra_Greater_Accra.html',
    title: 'Waterfalls Massage with Aburi Gardens and Cocoa Farm Tour',
  },
]

const GETYOURGUIDE_TOURS = [
  {
    url: 'https://www.getyourguide.com/accra-l506/from-accra-the-cape-coast-day-tour-guided-experience-t834942/',
    title: 'From Accra: The Cape Coast Day Tour Guided Experience',
  },
  {
    url: 'https://www.getyourguide.com/accra-l506/accra-guided-city-tour-experience-t839108/',
    title: 'Accra Guided City Tour Experience',
  },
  {
    url: 'https://www.getyourguide.com/accra-l506/boti-falls-umbrella-rock-aburi-gardens-cocoa-farm-tour-t866545/',
    title: 'Boti Falls, Umbrella Rock, Aburi Gardens & Cocoa Farm Tour',
  },
  {
    url: 'https://www.getyourguide.com/ghana-eastern-region-l147826/accra-mini-safari-rock-climbing-museum-boat-cruise-tour-t1170966/',
    title: 'Accra Mini Safari, Rock Climbing, Museum & Boat Cruise Tour',
  },
  {
    url: 'https://www.getyourguide.com/accra-l506/kotoka-domestic-airport-transfer-with-mini-accra-city-tour-t1243777/',
    title: 'Kotoka Domestic Airport Transfer with Mini Accra City Tour',
  },
  {
    url: 'https://www.getyourguide.com/accra-l506/accra-sankofa-gallery-art-tour-candle-making-workshop-t1404702/',
    title: 'Accra Sankofa Gallery Art Tour & Candle Making Workshop',
  },
]

const GOOGLE_LISTING_URL = 'https://www.google.com/maps/place/Travio Ghana+Tours+LTD'
const GOOGLE_REVIEWS_TOURS = [
  'Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour',
  'Accra Guided City Tour: Cultural and Historical Experience',
  'Accra Guided City Tour Experience',
  'From Accra: Waterfalls, Aburi Gardens & Cocoa Farm Day Tour',
  'From Accra: The Cape Coast Day Tour Guided Experience',
  'Shai Hills Safari & Akosombo Boat Cruise Day Tour',
  'Boti Falls, Umbrella Rock, Aburi Gardens & Cocoa Farm Tour',
  'Accra Sankofa Gallery Art Tour & Candle Making Workshop',
  'Kotoka Domestic Airport Transfer with Mini Accra City Tour',
  'Accra Mini Safari, Rock Climbing, Museum & Boat Cruise Tour',
]

// Deep pagination: TripAdvisor allows ~578 text reviews for the biggest
// product, GetYourGuide far fewer. Pages this high are effectively "until the
// reviews run out" — pagination stops as soon as a page yields no new ids.
const PAGES_TO_SCRAPE = 100
const DELAY_BETWEEN_PAGES_MS = 4000
const DELAY_BETWEEN_TOURS_MS = 3000

// TripAdvisor serves a bot wall to headless browsers; run headed locally with
// REVIEWS_HEADLESS=0 (a browser window opens while the scrape runs).
const HEADLESS = process.env.REVIEWS_HEADLESS !== '0'

// Optional proxy. TripAdvisor returns 403 to datacenter IPs — GitHub runners and
// cloud servers alike — so a residential proxy is the only reliable way to keep
// its reviews. GetYourGuide works without one.
const PROXY_SERVER = process.env.REVIEWS_PROXY_SERVER || ''
const PROXY_USERNAME = process.env.REVIEWS_PROXY_USERNAME || ''
const PROXY_PASSWORD = process.env.REVIEWS_PROXY_PASSWORD || ''

// Optional scoping for validation runs: REVIEWS_ONLY=ta|gyg|google runs just
// that source. Pair with REVIEWS_OUTPUT=<path> + REVIEWS_MIN_EXPECTED=1 so a
// partial run never touches the committed dataset.
const ONLY = (process.env.REVIEWS_ONLY || '').toLowerCase()

// A healthy deep run yields well over a thousand reviews; below this the
// scrape is treated as failed (bot wall / DOM change) and must never overwrite
// the committed file. Override with REVIEWS_MIN_EXPECTED=<n> if needed.
const MIN_EXPECTED_REVIEWS = Number(process.env.REVIEWS_MIN_EXPECTED || 1000)

const OUTPUT_PATH =
  process.env.REVIEWS_OUTPUT || path.join(__dirname, '..', 'public', 'data', 'externalReviews.json')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function hashString(str) {
  const crypto = require('crypto')
  return crypto.createHash('md5').update(str).digest('hex').slice(0, 12)
}

function clampRating(rating) {
  const r = parseInt(rating)
  if (isNaN(r)) return 5
  return Math.max(1, Math.min(5, r))
}

function normalizeDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

/** Previous dataset (reviews + products), or empty when there is none yet. */
function loadPreviousDataset() {
  try {
    if (!fs.existsSync(OUTPUT_PATH)) return { reviews: [], products: [] }
    const previous = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'))
    return {
      reviews: Array.isArray(previous.reviews) ? previous.reviews : [],
      products: Array.isArray(previous.products) ? previous.products : [],
    }
  } catch {
    return { reviews: [], products: [] }
  }
}

/**
 * Keep a LISTING's previous rows when this run produced none for it.
 *
 * Scoped to a listing rather than a whole platform, because a platform fails
 * PARTIALLY. The source-level rule this replaces asked one binary question —
 * did the platform yield exactly zero rows — so any platform that yielded
 * anything at all had its entire previous body discarded. GetYourGuide yielded
 * 182 of its 311 stored rows, all 311 were dropped, and the dataset read 1,114
 * against a floor of 1,118: the run failed over 4 rows while the honest total
 * was 1,241. One blocked listing (Cape Coast, 127 rows) was the entire
 * difference.
 *
 * Same guarantee as before — "blocked means preserved, not deleted" — applied
 * one level down, which is the granularity mergeProducts already uses for the
 * official totals 60 lines below.
 *
 * Keyed by productId, which embeds the source. Google's business-level rows
 * carry no productId and fall back to tourUrl; a row with neither degrades to
 * the old source-level grouping instead of being dropped, so no row is worse
 * off than it was.
 */
function keepPreviousForListings(newRows, previousRows) {
  const listingKey = (row) =>
    `${row?.source || 'UNKNOWN'}:${row?.productId || row?.tourUrl || 'UNIDENTIFIED'}`

  const scraped = new Set(newRows.map(listingKey))
  const out = [...newRows]

  const staleByKey = new Map()
  for (const row of previousRows) {
    const key = listingKey(row)
    if (scraped.has(key)) continue
    if (!staleByKey.has(key)) staleByKey.set(key, [])
    staleByKey.get(key).push(row)
  }

  let listings = 0
  let kept = 0
  for (const stale of staleByKey.values()) {
    out.push(...stale)
    listings += 1
    kept += stale.length
  }
  if (listings > 0) {
    console.log(
      `    scrape produced no rows for ${listings} listing(s) — keeping ${kept} rows from the previous dataset`
    )
  }
  return out
}

/**
 * Keep previous per-product totals for products this run did not re-scrape, and
 * for products whose header this run FAILED to read.
 *
 * The second case is the one that bit us. The product header is scraped from a
 * platform's own summary badge; when the platform blocks the request, changes
 * its markup, or renders the badge late, the read returns nulls while the
 * per-review rows still scrape fine (they come from the review cards, not the
 * badge). A product re-scraped in that state was previously overwritten with
 * rating: null / reviewCount: null, silently deleting a good number that the
 * previous run had — and because `buildProductSchema` only emits
 * aggregateRating when BOTH values are truthy, the page then published no
 * review markup at all. Rows kept accumulating (1,125 -> 1,243) while every
 * TripAdvisor total sat at null, so nothing looked wrong except the SEO.
 *
 * A null header means "we did not learn it this run", not "it is zero". Keep
 * the last known value, and only ever let a fresh non-null value win.
 */
function mergeProducts(newProducts, previousProducts) {
  const previousByKey = new Map(previousProducts.map((p) => [`${p.source}:${p.id}`, p]))
  const seen = new Set()

  const out = newProducts.map((p) => {
    const key = `${p.source}:${p.id}`
    seen.add(key)
    const previous = previousByKey.get(key)
    if (!previous) return p

    // Only carry forward the header fields this run could not read. Any field
    // the new run DID read wins, so a genuine rating correction still lands.
    const recovered = { ...p }
    const carried = []
    for (const field of ['rating', 'reviewCount', 'distribution']) {
      if (recovered[field] != null) continue
      if (previous[field] == null) continue
      recovered[field] = previous[field]
      carried.push(field)
    }
    if (carried.length > 0) {
      console.log(
        `    ${key}: header unavailable this run — keeping previous ${carried.join(', ')}`
      )
    }
    return recovered
  })

  for (const p of previousProducts) {
    if (!seen.has(`${p.source}:${p.id}`)) out.push(p)
  }
  return out
}

const EMPTY_HEADER = { rating: null, reviewCount: null, distribution: null }

/**
 * Read the product header (rating / official review count / distribution).
 *
 * The badge is the platform's own summary element and it is frequently the
 * LAST thing on the page to render, while the review cards the rest of the
 * scrape depends on appear early. Reading it once, on the same tick as the
 * navigation resolving, therefore returns an empty string on a slow render and
 * the whole header silently degrades to nulls even though every individual
 * review below it scraped fine. So: read, and if we got nothing usable, wait
 * for it to appear and read again before giving up.
 *
 * `document.body.innerText` is kept as a secondary source because the badge
 * markup is renamed far more often than the human-readable summary text is.
 */
async function readProductHeader(page, source) {
  const parse = (texts) => {
    const merged = `${texts.badge}\n${texts.body}`
    const header = source === 'TRIPADVISOR'
      ? parseTripAdvisorProductHeader(merged)
      : parseGetYourGuideProductHeader(merged)
    return header
  }

  const read = () => page.evaluate(() => {
    const badge = document.querySelector('[data-automation="apr-review-rating-badge"]')
    return {
      badge: badge ? (badge.innerText || '').trim() : '',
      body: document.body.innerText || '',
    }
  }).catch(() => ({ badge: '', body: '' }))

  const first = parse(await read())
  if (first.reviewCount != null || first.rating != null) return first

  // Nothing usable yet. Give the badge a bounded window to show up rather than
  // recording a null that will be carried forward by mergeProducts.
  try {
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-automation="apr-review-rating-badge"]')
        return Boolean(el && (el.innerText || '').trim())
      },
      { timeout: 8000 }
    )
  } catch {
    // Never appeared; fall through and take the second read regardless.
  }
  const second = parse(await read())
  return second.reviewCount != null || second.rating != null ? second : first
}

// ─── TripAdvisor Scraper ─────────────────────────────────────────────────────

async function scrapeTripAdvisorTour(page, tour, pagesToScrape) {
  const reviews = []
  const seenIds = new Set()
  let header = { rating: null, reviewCount: null, distribution: null }
  const productId = productIdFrom('TRIPADVISOR', tour.url)

  for (let pageNum = 1; pageNum <= pagesToScrape; pageNum++) {
    const pageUrl = buildTripAdvisorPageUrl(tour.url, pageNum)
    console.log(`  [TA] Page ${pageNum}/${pagesToScrape}: ${tour.title}`)

    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 })
      await page.waitForSelector('[data-test-target="HR_CC_CARD"]', { timeout: 10000 }).catch(() => {})

      if (pageNum === 1) {
        header = excludeOneStarFromProductHeader(await readProductHeader(page, 'TRIPADVISOR'))
        console.log(`    Product header: ${header.rating ?? '?'}★ (${header.reviewCount ?? '?'} reviews, 1★ excluded)`)
      }

      const pageReviews = await page.evaluate(() => {
        const cards = document.querySelectorAll('[data-test-target="HR_CC_CARD"]')

        return Array.from(cards).map((card) => {
          const ratingEl = card.querySelector('[data-automation="bubbleRatingImage"] title')
          const ratingText =
            ratingEl?.textContent ||
            card.querySelector('[aria-label*="bubbles"]')?.getAttribute('aria-label') ||
            ''
          const ratingMatch = ratingText.match(/(\d+)/)
          const rating = ratingMatch ? parseInt(ratingMatch[1]) : 5

          const nameEl = card.querySelector('a[href*="/Profile/"] span')
          const reviewerName = nameEl?.textContent?.trim() || ''

          const titleEl = card.querySelector('[data-test-target="review-title"]')
          const title = titleEl?.textContent?.trim() || ''

          const textEl = card.querySelector('.JguWG') || card.querySelector('.fIrGe')
          const text = textEl?.innerText?.trim() || ''

          const headerText = card.querySelector('.ZRBpD')?.innerText || ''
          const dateMatch = headerText.match(/wrote a review\s+([^\n]+)/i)
          const date = dateMatch ? dateMatch[1].trim() : ''

          const reviewLink = card.querySelector('a[href*="/ShowUserReviews"]')?.getAttribute('href') || ''
          const idMatch = reviewLink.match(/-r(\d+)-/)
          const reviewId = idMatch ? `ta-${idMatch[1]}` : null

          // Reviewer avatars are deliberately NOT stored: they are hosted on the
        // platform's CDN (e.g. dynamic-media-cdn.tripadvisor.com), whose
        // robots.txt blocks Googlebot — embedding them got flagged in Search
        // Console as a resource it could not load, and hotlinking a third
        // party's media is theirs to control. The UI shows an initial instead.
        

          return { externalId: reviewId, reviewerName, rating, title, text, date, reviewerAvatar: null }
        }).filter((r) => r.reviewerName || r.text)
      })

      const fresh = pageReviews.filter((r) => {
        const id = r.externalId || `ta_${hashString(r.reviewerName + r.title + r.text.slice(0, 100))}`
        return !seenIds.has(id)
      })

      if (fresh.length === 0 && pageNum > 1) {
        console.log(`    No new reviews — stopping pagination for this tour`)
        break
      }

      for (const r of fresh) {
        const id = r.externalId || `ta_${hashString(r.reviewerName + r.title + r.text.slice(0, 100))}`
        seenIds.add(id)
        // Storefront policy: 1★ reviews are never stored for TripAdvisor.
        if (clampRating(r.rating) <= 1) continue
        // Rating-only reviews (no text) would render a "(No review text)" card.
        if (!r.text || !r.text.trim()) continue
        reviews.push({
          id,
          source: 'TRIPADVISOR',
          reviewerName: r.reviewerName,
          reviewerAvatar: r.reviewerAvatar,
          rating: clampRating(r.rating),
          title: r.title || null,
          text: r.text || '(No review text)',
          textTruncated: r.text.length > 200 ? r.text.slice(0, 197) + '...' : r.text,
          tourTitle: tour.title,
          tourThumbnail: null,
          tourUrl: tour.url,
          tourLink: tour.url,
          coverPhoto: null,
          originalDate: normalizeDate(r.date),
          productId,
          productRating: header.rating,
          productReviewCount: header.reviewCount,
        })
      }
      console.log(`    Found ${fresh.length} new reviews (total ${reviews.length})`)
    } catch (err) {
      console.warn(`    Failed: ${err.message}`)
    }

    if (pageNum < pagesToScrape) await sleep(DELAY_BETWEEN_PAGES_MS)
  }

  return { reviews, product: { ...header, productId } }
}

// ─── GetYourGuide Scraper ────────────────────────────────────────────────────

/**
 * GetYourGuide no longer paginates with ?page=N — reviews load in batches via
 * a "See more reviews" button on the activity page. Click it until the list
 * stops growing (or the button disappears).
 */
async function scrapeGetYourGuideTour(page, tour, maxBatches) {
  const reviews = []
  const seenIds = new Set()
  let header = { rating: null, reviewCount: null, distribution: null }
  const productId = productIdFrom('GETYOURGUIDE', tour.url)

  console.log(`  [GYG] ${tour.title}`)

  try {
    await page.goto(tour.url, { waitUntil: 'networkidle2', timeout: 30000 })
    await page.waitForSelector('.review-card', { timeout: 15000 }).catch(() => {})

    header = await readProductHeader(page, 'GETYOURGUIDE')
    console.log(`    Product header: ${header.rating ?? '?'}★ (${header.reviewCount ?? '?'} reviews)`)

    // Safety cap only: the loop normally ends when the official count is
    // reached or the list stops growing (two consecutive stalled batches).
    // GYG progressively loads ~3 new cards per click after the first batch,
    // so a count/10 cap would strand most reviews.
    let stableRounds = 0
    let reloadedOnce = false
    for (let round = 0; round < maxBatches && stableRounds < 2; round++) {
      const pageReviews = await page.evaluate(() => {
        const cards = document.querySelectorAll('.review-card')
        return Array.from(cards).map((card) => {
          const ratingText = card.querySelector('.rating-star__label')?.textContent?.trim() || ''
          const ratingMatch = ratingText.match(/(\d+)/)
          const nameEl = card.querySelector('.review-card__author-details-name')
          const dateEl = card.querySelector('.review-card__author-details-name-legend')
          const textEl = card.querySelector('.review-card__description-group .toggle-content__content')

          return {
            reviewerName: nameEl?.textContent?.trim() || 'Anonymous',
            reviewerAvatar: null, // see the note above: third-party CDN avatars are not embedded
            rating: ratingMatch ? parseInt(ratingMatch[1]) : 5,
            text: textEl?.innerText?.trim() || '',
            date: (dateEl?.textContent || '').replace(/\s*-\s*Verified booking.*$/i, '').trim(),
          }
        })
      })

      let added = 0
      for (const r of pageReviews) {
        const id = `gyg_${hashString(r.reviewerName + r.date + r.text.slice(0, 100))}`
        if (seenIds.has(id)) continue
        seenIds.add(id)
        // Storefront policy: 1★ reviews are never stored for GetYourGuide.
        if (clampRating(r.rating) <= 1) continue
        // Rating-only reviews (no text) would render a "(No review text)" card.
        if (!r.text || !r.text.trim()) continue
        reviews.push({
          id,
          source: 'GETYOURGUIDE',
          reviewerName: r.reviewerName,
          reviewerAvatar: r.reviewerAvatar,
          rating: clampRating(r.rating),
          title: null,
          text: r.text || '(No review text)',
          textTruncated: r.text.length > 200 ? r.text.slice(0, 197) + '...' : r.text,
          tourTitle: tour.title,
          tourThumbnail: null,
          tourUrl: tour.url,
          tourLink: tour.url,
          coverPhoto: null,
          originalDate: normalizeDate(r.date),
          productId,
          productRating: header.rating,
          productReviewCount: header.reviewCount,
        })
        added++
      }

      const cardCountBefore = await page.evaluate(() => document.querySelectorAll('.review-card').length)
      const clicked = await page.evaluate(() => {
        // Only visible controls: the page renders duplicate mobile/desktop
        // buttons, and clicking a hidden duplicate does nothing.
        const visible = (el) => {
          const rect = el.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        }
        const candidates = [...document.querySelectorAll('button, [role="button"], a')].filter(visible)
        // Prefer the exact review-pagination control: the page also has many
        // "See more" toggles for descriptions, which must not be clicked.
        const reviewButtons = candidates.filter((b) =>
          /see more reviews|show more reviews|load more reviews/i.test((b.textContent || '').trim()),
        )
        const genericButtons = candidates.filter((b) =>
          /^\s*(see|show|load) more\s*$/i.test((b.textContent || '').trim()),
        )
        const button = reviewButtons[reviewButtons.length - 1] || genericButtons[genericButtons.length - 1]
        if (!button) return false
        button.scrollIntoView({ block: 'center' })
        button.click()
        return true
      })

      if (!clicked) {
        console.log(`    Batch ${round + 1}: +${added} new (total ${reviews.length}) — no more button`)
        break
      }

      // Poll for the list to grow (network + render can take several seconds;
      // GYG throttles, so give it up to 20s).
      let grew = false
      const deadline = Date.now() + 20000
      while (Date.now() < deadline) {
        await sleep(600)
        const cardCount = await page.evaluate(() => document.querySelectorAll('.review-card').length)
        if (cardCount > cardCountBefore) {
          grew = true
          break
        }
      }

      console.log(`    Batch ${round + 1}: +${added} new (total ${reviews.length})${grew ? '' : ' — no growth'}`)

      if (header.reviewCount && reviews.length >= header.reviewCount) {
        console.log(`    Reached the official total (${header.reviewCount})`)
        break
      }

      if (!grew && stableRounds + 1 >= 2 && !reloadedOnce && (!header.reviewCount || reviews.length < header.reviewCount)) {
        // A stalled loader is usually transient; reload once and resume.
        reloadedOnce = true
        stableRounds = 0
        console.log('    Loader stalled — reloading the page to resume...')
        await page.reload({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
        await page.waitForSelector('.review-card', { timeout: 15000 }).catch(() => {})
        await sleep(2000)
        continue
      }

      stableRounds = grew ? 0 : stableRounds + 1
    }
  } catch (err) {
    console.warn(`    Failed: ${err.message}`)
  }

  return { reviews, product: { ...header, productId } }
}

// ─── Google Maps Scraper ─────────────────────────────────────────────────────

async function scrapeGoogleReviews(page) {
  console.log(`  [Google] Scraping reviews from Google Maps...`)

  try {
    await page.goto(GOOGLE_LISTING_URL, { waitUntil: 'networkidle2', timeout: 30000 })
    await sleep(3000)

    const reviewsTab = await page.$('[data-tab-id="reviews"], [role="tab"][aria-label*="Reviews"], button[jsaction*="reviews"]')
    if (reviewsTab) {
      await reviewsTab.click()
      await sleep(3000)
    }

    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => {
        const scrollable = document.querySelector('[class*="m6QErb"][class*="DxyBCb"], .section-scrollbox, [role="main"]')
        if (scrollable) scrollable.scrollTop = scrollable.scrollHeight
      })
      await sleep(2000)
    }

    const pageReviews = await page.evaluate(() => {
      const reviewEls = document.querySelectorAll('.jftiEf, .review-container, [class*="review-item"], [data-review-id]')
      return Array.from(reviewEls).map((el) => {
        const nameEl = el.querySelector('.d4r55, .reviewer-name, [class*="userName"], span[class*="fontBodyMedium"] span:first-child')
        const ratingEl = el.querySelector('[role="img"][aria-label*="star"], .kvMYJc, [class*="rating"]')
        const textEl = el.querySelector('.wiI7pd, .review-text, [class*="reviewText"], span[class*="fontBodyMedium"]')
        const dateEl = el.querySelector('.rsqaWe, .review-date, [class*="date"]')

        let rating = 5
        if (ratingEl) {
          const ariaLabel = ratingEl.getAttribute('aria-label') || ''
          const ratingMatch = ariaLabel.match(/(\d+)/)
          if (ratingMatch) rating = parseInt(ratingMatch[1])
        }

        return {
          reviewerName: nameEl?.textContent?.trim() || '',
          rating,
          text: textEl?.textContent?.trim() || '',
          date: dateEl?.textContent?.trim() || '',
        }
      }).filter((r) => r.reviewerName && r.text)
    })

    // Only publish Google reviews above 3 stars — 3★ and below are excluded
    // from the storefront (and from the committed stats).
    const visibleReviews = pageReviews.filter((r) => clampRating(r.rating) > 3)
    console.log(`    Found ${pageReviews.length} reviews (${visibleReviews.length} kept, >3 stars)`)

    return visibleReviews.map((r, i) => ({
      id: `goog_${hashString(r.reviewerName + r.text.slice(0, 100))}`,
      source: 'GOOGLE',
      reviewerName: r.reviewerName,
      reviewerAvatar: null,
      rating: clampRating(r.rating),
      title: null,
      text: r.text || '(No review text)',
      textTruncated: r.text.length > 200 ? r.text.slice(0, 197) + '...' : r.text,
      tourTitle: GOOGLE_REVIEWS_TOURS[i % GOOGLE_REVIEWS_TOURS.length],
      tourThumbnail: null,
      tourUrl: GOOGLE_LISTING_URL,
      tourLink: GOOGLE_LISTING_URL,
      coverPhoto: null,
      originalDate: normalizeDate(r.date),
      productId: null,
      productRating: null,
      productReviewCount: null,
    }))
  } catch (err) {
    console.warn(`    Failed: ${err.message}`)
    return []
  }
}

// ─── Stats Computation ───────────────────────────────────────────────────────

// Sources whose scraped reviews make up the headline stats. Google rows are
// business-level (their "tour" is the Maps listing), so they are listed in the
// UI but excluded from the headline count/average.
const COUNTED_SOURCES = ['TRIPADVISOR', 'GETYOURGUIDE']

function computeStats(reviews) {
  let totalReviews = 0
  let countedSum = 0
  const platforms = {}

  for (const r of reviews) {
    if (!platforms[r.source]) platforms[r.source] = { count: 0, sum: 0 }
    platforms[r.source].count++
    platforms[r.source].sum += r.rating

    if (COUNTED_SOURCES.includes(r.source)) {
      totalReviews++
      countedSum += r.rating
    }
  }

  const averageRating = totalReviews > 0
    ? Math.round((countedSum / totalReviews) * 10) / 10
    : 0

  return {
    totalReviews,
    averageRating,
    platforms: Object.entries(platforms).map(([source, { count, sum }]) => ({
      source,
      reviewCount: count,
      averageRating: Math.round((sum / count) * 10) / 10,
    })),
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

/**
 * Push the official per-product totals to the backend so homepage ranking can
 * count external reviews alongside in-app ones.
 *
 * Best-effort: a backend hiccup must never stop the storefront dataset from
 * being written and committed (the display reads the JSON), but it is logged
 * loudly so the failure is visible in the Action run.
 */
/**
 * Re-title every listing to the tour it actually is, before the backend sees it.
 *
 * The config `title` above is the listing's original URL slug, which the
 * platform renames whenever it rotates one — so `From Accra: The Cape Coast Day
 * Tour Guided Experience` (211 reviews) was matched against `Transport form
 * Accra to Cape Coast` and won, because a short title out-scores a long one on
 * Dice. The curated map (src/data/reviewListingTours.json) is the authority on
 * which tour a listing is, and an exact title wins `matchTourForTitle` outright
 * at score 1.
 *
 * Applied here rather than to the file written below: the storefront keeps
 * showing the platform's own wording, while the backend's per-tour totals —
 * which feed the structured data — get attributed correctly. The storefront
 * reads the same map (src/lib/reviewTourIdentity) for its own matching.
 *
 * Pure, and exported, so the test in src/lib/reviewListingTours.test.ts can pin
 * the behaviour without performing a scrape.
 */
function declareTourTitles(products) {
  const LISTING_TOURS = require('../src/data/reviewListingTours.json')
  return products.map((product) => {
    const tourTitle = LISTING_TOURS[product.id]
    return typeof tourTitle === 'string' && tourTitle ? { ...product, tourTitle } : product
  })
}

async function pushToBackend(products) {
  const url = process.env.EXTERNAL_REVIEWS_SYNC_URL
  const token = process.env.EXTERNAL_REVIEWS_SYNC_TOKEN
  if (!url || !token) {
    console.log('Backend sync skipped (EXTERNAL_REVIEWS_SYNC_URL / EXTERNAL_REVIEWS_SYNC_TOKEN not set)')
    return
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ products: declareTourTitles(products) }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body?.message || `HTTP ${res.status}`)

    const data = body?.data || {}
    console.log(`Backend sync OK: matched=${data.matched} tours=${data.tours} unmatched=${(data.unmatched || []).length}`)
    for (const item of data.unmatched || []) {
      console.log(`  unmatched [${item.source}] ${item.title} (${item.reason})`)
    }
  } catch (err) {
    console.warn(`Backend sync FAILED (dataset still written): ${err.message}`)
  }
}

async function main() {
  let puppeteer
  try {
    const mod = await import('puppeteer')
    puppeteer = mod.default ?? mod
  } catch {
    console.error('puppeteer not installed. Run: npm install puppeteer')
    process.exit(1)
  }

  console.log(`Launching browser... (${HEADLESS ? 'headless' : 'headed'}${PROXY_SERVER ? ', via proxy' : ''})`)
  const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage']
  if (PROXY_SERVER) launchArgs.push(`--proxy-server=${PROXY_SERVER}`)
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    args: launchArgs,
  })

  try {
    const page = await browser.newPage()
    if (PROXY_SERVER && PROXY_USERNAME && PROXY_PASSWORD) {
      await page.authenticate({ username: PROXY_USERNAME, password: PROXY_PASSWORD })
    }
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.setViewport({ width: 1920, height: 1080 })
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
    })

    const allReviews = []
    const products = []

    const runTripAdvisor = !ONLY || ONLY === 'ta' || ONLY === 'tripadvisor'
    const runGetYourGuide = !ONLY || ONLY === 'gyg' || ONLY === 'getyourguide'
    const runGoogle = !ONLY || ONLY === 'google'

    // TripAdvisor
    if (runTripAdvisor) {
      console.log(`\nScraping ${TRIPADVISOR_TOURS.length} TripAdvisor tours...`)
      for (let i = 0; i < TRIPADVISOR_TOURS.length; i++) {
        const tour = TRIPADVISOR_TOURS[i]
        const { reviews, product } = await scrapeTripAdvisorTour(page, tour, PAGES_TO_SCRAPE)
        allReviews.push(...reviews)
        products.push({
          id: product.productId,
          source: 'TRIPADVISOR',
          tourTitle: tour.title,
          tourUrl: tour.url,
          rating: product.rating,
          reviewCount: product.reviewCount,
          distribution: product.distribution,
        })
        if (i < TRIPADVISOR_TOURS.length - 1) await sleep(DELAY_BETWEEN_TOURS_MS)
      }
    }

    // GetYourGuide
    if (runGetYourGuide) {
      console.log(`\nScraping ${GETYOURGUIDE_TOURS.length} GetYourGuide tours...`)
      for (let i = 0; i < GETYOURGUIDE_TOURS.length; i++) {
        const tour = GETYOURGUIDE_TOURS[i]
        const { reviews, product } = await scrapeGetYourGuideTour(page, tour, PAGES_TO_SCRAPE)
        allReviews.push(...reviews)
        products.push({
          id: product.productId,
          source: 'GETYOURGUIDE',
          tourTitle: tour.title,
          tourUrl: tour.url,
          rating: product.rating,
          reviewCount: product.reviewCount,
          distribution: product.distribution,
        })
        if (i < GETYOURGUIDE_TOURS.length - 1) await sleep(DELAY_BETWEEN_TOURS_MS)
      }
    }

    // Google Maps
    if (runGoogle) {
      console.log(`\nScraping Google Maps reviews...`)
      const googleReviews = await scrapeGoogleReviews(page)
      allReviews.push(...googleReviews)
    }

    // Merge with the previous dataset so a blocked source keeps its rows.
    const previous = loadPreviousDataset()
    const mergedReviews = keepPreviousForListings(allReviews, previous.reviews)
    const mergedProducts = mergeProducts(products, previous.products)

    // Push the official per-product totals FIRST: homepage ranking must keep
    // counting external reviews even when a blocked deep scrape means the
    // storefront file below is never overwritten.
    await pushToBackend(mergedProducts)

    const deduped = dedupeReviews(excludeOneStarReviews(mergedReviews))

    // Never shrink the committed dataset by more than ~10%: a bot-blocked or
    // DOM-changed run must fail loudly instead of wiping the storefront's
    // social proof. With no previous dataset, fall back to the absolute floor.
    const previousCount = previous.reviews.length
    const floor = previousCount > 0
      ? Math.max(1, Math.floor(previousCount * 0.9))
      : MIN_EXPECTED_REVIEWS
    if (deduped.length < floor) {
      throw new Error(
        `Only ${deduped.length} reviews after merge (floor ${floor}, previous ${previousCount}) — refusing to overwrite ${OUTPUT_PATH}`
      )
    }

    const stats = computeStats(deduped)
    const output = {
      generatedAt: new Date().toISOString(),
      stats,
      products: mergedProducts,
      reviews: deduped,
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))

    console.log(`\nDone! Wrote ${deduped.length} reviews to ${OUTPUT_PATH}`)
    console.log('Per-product totals:')
    for (const p of mergedProducts) {
      console.log(`  ${p.source}: ${p.tourTitle} → ${p.rating ?? '?'}★ (${p.reviewCount ?? '?'} official)`)
    }
    console.log(`Stats: ${stats.averageRating}★ from ${stats.totalReviews} reviews`)
  } finally {
    await browser.close()
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}

module.exports = {
  loadPreviousDataset,
  keepPreviousForListings,
  mergeProducts,
  computeStats,
  declareTourTitles,
  pushToBackend,
}
