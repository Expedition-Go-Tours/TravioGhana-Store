import { describe, it, expect } from 'vitest'
// Typed by scripts/generate-sitemap.d.cts — the script itself is plain .cjs
// and sits outside every tsconfig include.
import {
  STATIC_PAGES,
  SHARED_PAGE_SOURCES,
  CATALOGUE_BACKED_PAGES,
  isoDate,
  latestDate,
  gitLastModified,
  staticPageSources,
  marketingLastmod,
} from '../../scripts/generate-sitemap.cjs'

/**
 * A date later than anything git can produce, so it can only reach an entry
 * through one place: the catalogue-date path. Two tests are built on it —
 * asserting the non-catalogue branch *rejects* it, and that the catalogue branch
 * *accepts* it. That splits the two behaviours without depending on when any
 * particular file was last touched, which no assertion on a real date could do
 * without breaking the moment the file legitimately changes.
 */
const FUTURE = '2099-01-01'
const TODAY = new Date().toISOString().split('T')[0]
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Requires git to answer, which it does in any checkout of this repo. The
 * fallback is covered separately below by an empty source list, which fails
 * before git is ever consulted.
 */
const sources = staticPageSources()

describe('marketing pages take their own date, not the catalogue\'s', () => {
  it('does not let a marketing page inherit the catalogue date', () => {
    // /privacy-policy has never rendered a tour, so it must not claim to change
    // whenever a price does. This is the 21-pages-one-number behaviour.
    const got = marketingLastmod('/privacy-policy', sources, FUTURE)
    expect(got, 'a static page echoed the catalogue date').toBeDefined()
    expect(got).not.toBe(FUTURE)
    expect(got).toMatch(ISO_DATE)
    expect(got! <= TODAY).toBe(true)
  })

  it('lets a catalogue-backed page inherit it, as a floor', () => {
    // /tours, /reviews and the homepage render the catalogue, so they do change
    // when it does and take the later of the two dates.
    for (const route of ['/', '/tours', '/reviews']) {
      expect(CATALOGUE_BACKED_PAGES.has(route), `${route} not marked catalogue-backed`).toBe(true)
      expect(marketingLastmod(route, sources, FUTURE), `${route} ignored the catalogue date`).toBe(FUTURE)
    }
  })

  it('still raises a catalogue-backed page to a newer git date', () => {
    expect(latestDate('2026-09-28', '2026-09-23')).toBe('2026-09-28')
    expect(latestDate('2026-09-23', '2026-09-28')).toBe('2026-09-28')
    expect(latestDate('2026-09-28', FUTURE)).toBe(FUTURE)
  })

  it('falls back to the catalogue date when git cannot answer', () => {
    // A route whose source git has no record of resolves no files, so
    // gitLastModified returns undefined — the path a build container without a
    // .git takes on Vercel. The entry must exist (otherwise the shared-source
    // default below would be what answered, and this would prove nothing).
    expect(gitLastModified([])).toBeUndefined()
    expect(gitLastModified(['src/does-not-exist.tsx'])).toBeUndefined()

    const unresolved = new Map([['/privacy-policy', ['src/does-not-exist.tsx']]])
    expect(marketingLastmod('/privacy-policy', unresolved, FUTURE)).toBe(FUTURE)
  })
})

describe('the route table resolves every static page', () => {
  it('finds a source file for all 21 static pages', () => {
    const missing = STATIC_PAGES.map((p) => p.path).filter((p) => !sources.has(p))
    expect(missing, `no source resolved for: ${missing.join(', ')}`).toEqual([])
    // 21 static pages plus the homepage, which is not in STATIC_PAGES but is
    // still dated through the same path.
    expect(sources.size).toBe(STATIC_PAGES.length + 1)
    expect(sources.has('/')).toBe(true)
  })

  it('resolves them without warning or hand-maintained map', () => {
    // App.tsx is the source of truth for what maps to what; a static map rots
    // when a route is renamed and silently stops dating that page.
    expect(sources.get('/tours')!.some((f) => f.includes('AllToursPage.tsx'))).toBe(true)
    expect(sources.get('/reviews')!.some((f) => f.includes('AllReviewsPage.tsx'))).toBe(true)
  })

  it('treats the shared layout as every page\'s source', () => {
    // HomePage is defined inline in App.tsx, and App.tsx renders the footer
    // into every route — so it changes them all.
    expect(sources.get('/')).toContain('src/App.tsx')
    for (const p of STATIC_PAGES) {
      expect(sources.get(p.path), `${p.path} missing the shared layout`).toContain('src/App.tsx')
    }
  })

  it('treats the shared footer as every page\'s source', () => {
    // The fix that put a footer on /tours and /reviews touched the page files;
    // a change to Footer.tsx itself renders on every marketing page.
    expect(SHARED_PAGE_SOURCES).toContain('src/components/Footer.tsx')
    for (const p of STATIC_PAGES) {
      expect(sources.get(p.path), `${p.path} missing the shared footer`).toContain('src/components/Footer.tsx')
    }
  })

  it('never invents a date for a file git has no record of', () => {
    expect(gitLastModified(['src/does-not-exist.tsx'])).toBeUndefined()
  })
})

describe('date helpers', () => {
  it('isoDate truncates to the day and rejects nonsense', () => {
    expect(isoDate('2026-09-28T10:00:00.000Z')).toBe('2026-09-28')
    expect(isoDate('not a date')).toBeUndefined()
    expect(isoDate(undefined)).toBeUndefined()
    expect(isoDate('')).toBeUndefined()
  })

  it('isoDate does not shift a UTC-instant across the date line', () => {
    // toISOString is UTC; a local mid-evening edit must not roll forward a day
    // and claim the page changed after it did.
    expect(isoDate('2026-09-28T23:59:00.000Z')).toBe('2026-09-28')
  })

  it('latestDate sorts lexicographically, which is chronological for ISO dates', () => {
    expect(latestDate(['2026-01-02', '2026-01-10', '2026-01-03'])).toBe('2026-01-10')
    expect(latestDate([], undefined, null)).toBeUndefined()
    expect(latestDate()).toBeUndefined()
  })
})
