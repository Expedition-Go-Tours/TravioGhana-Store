/// <reference types="node" />
/**
 * `declareTourTitles` is the last thing that happens to a product before the
 * backend matches it, and the backend's match is what ends up in the Product
 * schema's `aggregateRating`.
 *
 * The bug it pins: the scraper config names each listing by its original URL
 * slug, and the platform rotates slugs without telling anyone. The listing
 * `t834942` was pushed as `From Accra: The Cape Coast Day Tour Guided
 * Experience`, so the backend's `matchTourForTitle` scored it against 32 tours
 * and chose `Transport form Accra to Cape Coast` at 0.8750 over the Cape Coast
 * castles tour it really is at 0.7222 — a short title out-scores a long one on
 * Dice, so the generic shared token `accra` carried the vote. The homepage then
 * published 4.8 / 799 on a transfer, and the castles tour was left 211 short.
 *
 * With the slug corrected to our own wording the match is exact, exact scores 1,
 * and 1 wins. So the claim under test is simply: every listing that carries
 * reviews reaches the backend named as a tour of ours.
 *
 * Reads the committed payload rather than a fixture — a fixture would have no
 * stale slugs in it, and stale slugs are the entire reason this exists.
 */
import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { declareTourTitles, withMappedTourTitles, pushToBackend } = require('../../scripts/sync-reviews.cjs')

const declaredTours = require('../../src/data/reviewListingTours.json') as Record<string, string>

const payload = JSON.parse(
  readFileSync(resolve(__dirname, '..', '..', 'public/data/externalReviews.json'), 'utf8'),
) as { products: Array<{ id: string; tourTitle: string; reviewCount: number | null }> }

const isDeclared = (id: string): boolean =>
  Object.prototype.hasOwnProperty.call(declaredTours, id)

describe('declareTourTitles', () => {
  it('names every listing the payload carries as the tour it is', () => {
    const retitle = new Map(
      declareTourTitles(payload.products).map((product: { id: string; tourTitle: string }) => [
        product.id,
        product.tourTitle,
      ]),
    )
    let retitled = 0
    for (const [id, title] of Object.entries(declaredTours)) {
      if (id === '_comment') continue
      expect(retitle.get(id), `payload lost ${id}`).toBe(title)
      const original = payload.products.find((product) => product.id === id)?.tourTitle
      if (original !== title) retitled += 1
    }
    // A no-op transform would satisfy the assertion above, so make sure the
    // platform's stale wording really is being overridden — this is the fix,
    // not just a description of the desired end state.
    expect(retitled).toBeGreaterThan(0)
  })

  /** The concrete case: 211 reviews that were being handed to a transfer. */
  it('corrects the Cape Coast listing that used to lose to a transfer', () => {
    const [product] = declareTourTitles([
      payload.products.find((candidate) => candidate.id === 'getyourguide-from-accra-the-cape-coast-day-tour-guided-experience-t834942')!,
    ])
    expect(product.tourTitle).toBe('Cape Coast Castle, Elmina Castle & Kakum National Park Tour')
    expect(product.tourTitle).not.toBe('Transport form Accra to Cape Coast')
    expect(product.tourTitle).not.toBe('From Accra: The Cape Coast Day Tour Guided Experience')
  })

  /** Whatever the backend matches on has to be a tour of ours, exactly. */
  it('sends only tour titles the site actually publishes', () => {
    const ours = new Set(Object.values(declaredTours))
    for (const product of declareTourTitles(payload.products)) {
      if (!product.reviewCount) continue
      expect(ours.has(product.tourTitle), `${product.id} would be pushed as "${product.tourTitle}"`).toBe(true)
    }
  })

  /**
   * A listing nobody has declared keeps its own wording and is judged on that
   * by `sameTourTitle` — the payload is not quietly rewritten, and nothing in
   * the array is edited in place.
   */
  it('leaves undeclared listings untouched without mutating its input', () => {
    const before = payload.products.map((product) => ({ ...product }))
    const after = declareTourTitles(payload.products)
    for (const product of payload.products) {
      const original = before.find((candidate) => candidate.id === product.id)!
      expect(product.tourTitle).toBe(original.tourTitle)
      if (isDeclared(product.id)) continue
      const result = after.find(
        (candidate: { id: string; tourTitle: string }) => candidate.id === product.id,
      )!
      expect(result.tourTitle).toBe(original.tourTitle)
    }
    expect(after.length).toBe(payload.products.length)
  })
})

/**
 * The transform above only matters if it is actually what goes over the wire —
 * `declareTourTitles` being correct while `pushToBackend` sent the raw array
 * would leave the backend matching stale slugs exactly as before, and the whole
 * fix would be a test that passed against code the server never runs.
 *
 * The nightly Action is the only other place this is exercised, and it reports
 * success by looking at HTTP status, not at which titles were sent.
 */
describe('pushToBackend', () => {
  it('posts the corrected tour titles, not the platform slugs', async () => {
    const bodies: Array<{ products: Array<{ id: string; tourTitle: string }> }> = []
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body))
      return { ok: true, json: async () => ({ data: { matched: 1, tours: 1, unmatched: [] } }) }
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const url = process.env.EXTERNAL_REVIEWS_SYNC_URL
    const token = process.env.EXTERNAL_REVIEWS_SYNC_TOKEN
    process.env.EXTERNAL_REVIEWS_SYNC_URL = 'https://example.invalid/external-reviews/sync'
    process.env.EXTERNAL_REVIEWS_SYNC_TOKEN = 'test-token'
    try {
      await pushToBackend(payload.products)
    } finally {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
      if (url === undefined) delete process.env.EXTERNAL_REVIEWS_SYNC_URL
      else process.env.EXTERNAL_REVIEWS_SYNC_URL = url
      if (token === undefined) delete process.env.EXTERNAL_REVIEWS_SYNC_TOKEN
      else process.env.EXTERNAL_REVIEWS_SYNC_TOKEN = token
    }

    expect(bodies).toHaveLength(1)
    const sent = new Map(bodies[0].products.map((product) => [product.id, product.tourTitle]))
    expect(sent.get('getyourguide-from-accra-the-cape-coast-day-tour-guided-experience-t834942')).toBe(
      'Cape Coast Castle, Elmina Castle & Kakum National Park Tour',
    )
    expect(sent.get('getyourguide-boti-falls-umbrella-rock-aburi-gardens-cocoa-farm-tour-t866545')).toBe(
      'From Accra : Waterfalls, Aburi Gardens & Cocoa Farm Tour',
    )
    expect(sent.size).toBe(payload.products.length)
  })

  it('says nothing to the backend when no sync is configured', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const url = process.env.EXTERNAL_REVIEWS_SYNC_URL
    const token = process.env.EXTERNAL_REVIEWS_SYNC_TOKEN
    delete process.env.EXTERNAL_REVIEWS_SYNC_URL
    delete process.env.EXTERNAL_REVIEWS_SYNC_TOKEN
    vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await pushToBackend(payload.products)
    } finally {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
      if (url !== undefined) process.env.EXTERNAL_REVIEWS_SYNC_URL = url
      if (token !== undefined) process.env.EXTERNAL_REVIEWS_SYNC_TOKEN = token
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

/**
 * `tourTitle` is what the site displays — the platform's own wording.
 * `mappedTourTitle` is what the backend matches on.
 *
 * The backend has no copy of this repo's map, so a caller that posts the raw
 * dataset (its `backfill-external-review-stats.js`, a hand-rolled POST) had no
 * way to attribute correctly and the fuzzy matcher chose
 * `Transport form Accra to Cape Coast` for the 211-review Cape Coast listing.
 * Stamping the answer into the dataset makes the file self-describing, so the
 * identity travels with the data instead of living in one repo.
 */
describe('withMappedTourTitles', () => {
  type Product = { id: string; tourTitle: string; mappedTourTitle?: string }

  it('stamps the curated tour onto every listing the map declares', () => {
    const stamped = withMappedTourTitles(payload.products) as Product[]
    for (const product of stamped) {
      if (!isDeclared(product.id)) continue
      expect(product.mappedTourTitle).toBe(declaredTours[product.id])
    }
  })

  it('leaves the displayed wording exactly as the platform wrote it', () => {
    // Display and identity are separate fields: rewriting tourTitle here would
    // change what the storefront renders, which is the whole reason the map
    // lives apart from the title.
    const before = payload.products.map((p) => p.tourTitle)
    const stamped = withMappedTourTitles(payload.products) as Product[]
    expect(stamped.map((p) => p.tourTitle)).toEqual(before)
  })

  it('adds nothing to a listing the map does not declare', () => {
    const undeclared: Product[] = [
      { id: 'some-listing-not-in-the-map', tourTitle: 'A Platform Title' },
    ]
    const [stamped] = withMappedTourTitles(undeclared)
    expect(stamped).toEqual(undeclared[0])
    expect(stamped.mappedTourTitle).toBeUndefined()
  })

  it('agrees with declareTourTitles, so the two paths cannot drift', () => {
    const declared = new Map(
      declareTourTitles(payload.products).map((p: Product) => [p.id, p.tourTitle]),
    )
    const stamped = withMappedTourTitles(payload.products) as Product[]

    // Guard against passing vacuously: with no field at all the comparison
    // loop below never runs and this test would pass with the feature broken.
    expect(stamped.some((p) => p.mappedTourTitle)).toBe(true)

    let compared = 0
    for (const product of stamped) {
      if (!product.mappedTourTitle) continue
      expect(product.mappedTourTitle).toBe(declared.get(product.id))
      compared += 1
    }
    expect(compared).toBeGreaterThan(0)
  })

  it('does not mutate its input', () => {
    const before = JSON.stringify(payload.products)
    withMappedTourTitles(payload.products)
    expect(JSON.stringify(payload.products)).toBe(before)
  })
})
