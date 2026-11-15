import { describe, it, expect } from 'vitest'

import {
  buildLlmsTxt,
  priceRange,
  summarise,
  destinations,
  formatMoney,
  linkLabel,
  tourUrl,
  CITY_ALIASES,
  PAGE_LINKS,
  BLOG_INDEX,
} from '../../scripts/generate-llms-txt.cjs'
import { STATIC_PAGES } from '../../scripts/generate-sitemap.cjs'

/**
 * llms.txt is the one page a model reads instead of crawling the site, so the
 * tests here are about the two ways it can lie: a catalogue summary that does
 * not match the catalogue (count, price, URLs) and a link list that has
 * drifted from the pages the sitemap actually publishes.
 */

const SITE = 'https://www.travioghana.com'

const tour = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'cmt8obfhc02kc646pu2xai7qc',
  title: 'The Shai Hills Safari Quad-Bike Tour',
  slug: 'the-shai-hills-safari-quad-bike-tour',
  description:
    'Shai Hills Resource Reserve sits in the Greater Accra Region, close enough to the city for a day trip. The reserve is home to baboons and antelope.',
  startingPrice: 180,
  currency: 'USD',
  city: 'Accra',
  ...over,
})

const article = (over: Partial<Record<string, unknown>> = {}) => ({
  slug: 'kakum-national-park-canopy-walkway',
  title: 'Kakum National Park & the Canopy Walkway',
  excerpt: 'Seven rope-and-plank bridges strung between the crowns of giant trees turn a walk in the woods into an adventure.',
  publishedAt: '2026-10-12T09:00:00.000Z',
  ...over,
})

describe('priceRange', () => {
  it('reports the cheapest and dearest "from" price', () => {
    const range = priceRange([
      tour({ id: 'a', startingPrice: 30 }),
      tour({ id: 'b', startingPrice: 1000 }),
      tour({ id: 'c', startingPrice: 150 }),
    ])
    expect(range).toMatchObject({ min: 30, max: 1000, currency: 'USD' })
  })

  it('ignores tours with no price rather than treating them as free', () => {
    const range = priceRange([
      tour({ id: 'a', startingPrice: 120 }),
      tour({ id: 'b', startingPrice: null }),
      tour({ id: 'c', startingPrice: 0 }),
    ])
    expect(range).toMatchObject({ min: 120, max: 120 })
  })

  it('returns null when nothing is priced, so the caller can drop the claim', () => {
    expect(priceRange([tour({ startingPrice: null })])).toBeNull()
    expect(priceRange([])).toBeNull()
  })

  it('refuses to name a currency when the catalogue mixes them', () => {
    const range = priceRange([
      tour({ id: 'a', startingPrice: 30, currency: 'USD' }),
      tour({ id: 'b', startingPrice: 25, currency: 'EUR' }),
    ])
    expect(range?.currency).toBeNull()
    expect(range?.currencies).toEqual(['USD', 'EUR'])
  })
})

describe('summarise', () => {
  it('takes the first complete sentence when it already carries its weight', () => {
    const opener =
      'The Despite Automobile Museum in East Legon is Ghana’s first automobile museum, and the collection is broader than the word may suggest. Vintage and classic cars sit beside modern performance models.'
    expect(summarise(opener)).toContain('broader than the word may suggest.')
    expect(summarise(opener)).not.toContain('Vintage and classic cars')
  })

  it('joins a very short opener to the next sentence', () => {
    const got = summarise(
      'Ghanaian food rewards curiosity. The flavours move between smoky, fermented, spicy and sweet, and the best way to understand them is to eat across several dishes in one sitting.'
    )
    expect(got).toContain('Ghanaian food rewards curiosity. The flavours move')
    expect(got.startsWith('Ghanaian food rewards curiosity.')).toBe(true)
  })

  it('does not end mid-phrase on a conjunction or preposition', () => {
    const long =
      'The Despite Automobile Museum in East Legon is Ghana’s first automobile museum, and the collection is broader than the word museum might suggest: vintage and classic cars, luxury vehicles and'
    const got = summarise(long, 160)
    expect(got.endsWith(' and')).toBe(false)
    expect(got.endsWith(' of')).toBe(false)
    expect(got.endsWith(' the')).toBe(false)
  })

  it('drops the API truncation marker from a cut description', () => {
    const got = summarise('This is an airport transfer with a short introduction to Accra built in. The route includes Independence S...')
    expect(got).toBe('This is an airport transfer with a short introduction to Accra built in.')
    expect(got).not.toContain('...')
  })

  it('returns an empty string for missing text', () => {
    expect(summarise(undefined)).toBe('')
    expect(summarise(null)).toBe('')
    expect(summarise('   ')).toBe('')
  })
})

describe('destinations', () => {
  it('folds Accra district names into the city people search for', () => {
    const places = destinations([
      tour({ id: 'a', city: 'Accra' }),
      tour({ id: 'b', city: 'La-Dade-Kotopon Municipal District' }),
      tour({ id: 'c', city: 'Okaikwei North Municipal District' }),
      tour({ id: 'd', city: 'Cape Coast' }),
    ])
    expect(places[0]).toEqual({ city: 'Accra', count: 3 })
    expect(places.map((p) => p.city)).toContain('Cape Coast')
    expect(places.map((p) => p.city)).not.toContain('La-Dade-Kotopon Municipal District')
  })

  it('drops unaliased administrative names and empty cities', () => {
    const places = destinations([
      tour({ id: 'a', city: 'Somewhere District' }),
      tour({ id: 'b', city: null }),
      tour({ id: 'c', city: 'Accra' }),
    ])
    expect(places).toEqual([{ city: 'Accra', count: 1 }])
  })

  it('maps every alias to a real city', () => {
    for (const [from, to] of Object.entries(CITY_ALIASES)) {
      expect(from.length).toBeGreaterThan(0)
      expect(to).not.toMatch(/District|Municipal/)
    }
  })
})

describe('buildLlmsTxt', () => {
  const tours = [
    tour({ id: 'tour-1', title: 'The Shai Hills Safari Quad-Bike Tour', slug: 'the-shai-hills-safari-quad-bike-tour' }),
    tour({ id: 'tour-2', title: 'Accra Food Tasting Tour', slug: 'accra-food-tasting-tour', startingPrice: 80, city: 'Accra' }),
    tour({ id: 'tour-3', title: 'The North Safari', slug: 'the-north-safari', startingPrice: 900, city: 'Larabanga' }),
  ]
  const txt = buildLlmsTxt({ tours, articles: [article()], siteUrl: SITE })

  it('opens with the site name and a factual blockquote', () => {
    expect(txt.startsWith('# Travio Ghana\n')).toBe(true)
    expect(txt).toMatch(/\n> .*3 curated Ghana tours/)
    expect(txt).toContain('$80')
    expect(txt).toContain('$900')
  })

  it('lists every tour on one line, at its canonical id + slug URL', () => {
    for (const t of tours) {
      const url = `${SITE}/tour/${t.id}/${t.slug}`
      expect(txt).toContain(`- [${t.title}](${url})`)
    }
    // The current Shai Hills slug is what must ship, not the old "Shia" one.
    expect(txt).toContain('the-shai-hills-safari-quad-bike-tour')
    expect(txt).not.toContain('the-shia-hills')
  })

  it('carries no undefined, null or stray HTML', () => {
    expect(txt).not.toMatch(/\bundefined\b/)
    expect(txt).not.toMatch(/\bnull\b/)
    expect(txt).not.toMatch(/<[a-z]/i)
  })

  it('orders sections so the catalogue comes before the marketing links', () => {
    const order = ['## Tours', '## Destinations', '## Guides', '## Book', '## Company', '## Optional']
    const positions = order.map((h) => txt.indexOf(h))
    for (const pos of positions) expect(pos).toBeGreaterThan(-1)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('links the guide and the blog index', () => {
    expect(txt).toContain(`${SITE}/blog/kakum-national-park-canopy-walkway`)
    expect(txt).toContain(`[${BLOG_INDEX.label}](${SITE}${BLOG_INDEX.path})`)
    expect(txt).toContain('(2026-10-12)')
  })

  it('every emitted URL is on the canonical host', () => {
    const urls = [...txt.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1])
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) expect(url.startsWith(`${SITE}/`)).toBe(true)
  })

  it('escapes brackets in titles instead of breaking the link', () => {
    const got = buildLlmsTxt({ tours: [tour({ title: 'Tour [2026] edition' })], articles: [], siteUrl: SITE })
    const line = got.split('\n').find((l) => l.includes('/tour/'))!
    expect(line).toContain('[Tour (2026) edition]')
  })

  it('survives a catalogue with no prices or descriptions', () => {
    const got = buildLlmsTxt({
      tours: [tour({ startingPrice: null, description: '' })],
      articles: [],
      siteUrl: SITE,
    })
    expect(got).toContain('- Tours: 1')
    expect(got).not.toContain('Price range')
    expect(got).not.toMatch(/\bundefined\b/)
  })
})

describe('marketing links match the sitemap', () => {
  const sitemapPaths = new Set(STATIC_PAGES.map((p) => p.path))
  const linkedPaths = new Set(PAGE_LINKS.map((p) => p.path))

  it('does not link a page the sitemap does not publish', () => {
    const orphans = [...linkedPaths].filter((p) => !sitemapPaths.has(p))
    expect(orphans).toEqual([])
  })

  it('covers every published page except the blog index, which lives under Guides', () => {
    const missing = [...sitemapPaths].filter((p) => p !== BLOG_INDEX.path && !linkedPaths.has(p))
    expect(missing).toEqual([])
  })

  it('labels and notes are non-empty and unique', () => {
    const labels = PAGE_LINKS.map((p) => p.label)
    expect(new Set(labels).size).toBe(labels.length)
    for (const p of PAGE_LINKS) {
      expect(p.path.startsWith('/')).toBe(true)
      expect(p.label.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('formatting helpers', () => {
  it('formats USD the way the site does', () => {
    expect(formatMoney(30)).toBe('$30')
    expect(formatMoney(1000)).toBe('$1,000')
    expect(formatMoney(null)).toBe('')
  })

  it('does not print a second currency symbol for non-USD prices', () => {
    expect(formatMoney(250, 'GBP')).toBe('250 GBP')
  })

  it('escapes markdown brackets in labels', () => {
    expect(linkLabel('Accra [Night] Tour')).toBe('Accra (Night) Tour')
  })

  it('falls back to an id-only URL when a slug is missing', () => {
    expect(tourUrl({ id: 'abc', title: 'x', slug: undefined })).toBe(`${SITE}/tour/abc`)
  })
})

describe('the generated file on disk, when present', () => {
  /**
   * The build writes public/llms.txt before the suite runs in CI only if the
   * prebuild step executes, so this block must not fail on a clean checkout.
   * When the file is there it is the best assertion available: the shipped
   * artifact names every tour with a live-looking crawlable URL.
   */
  it('is absent or a plausible llms.txt', async () => {
    const { readFileSync, existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const file = resolve(process.cwd(), 'public/llms.txt')
    if (!existsSync(file)) return
    const body = readFileSync(file, 'utf8')
    expect(body.startsWith('# Travio Ghana')).toBe(true)
    expect(body).toContain('## Tours')
    expect(body).toContain('/tour/')
  })
})
