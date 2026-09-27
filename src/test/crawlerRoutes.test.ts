import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The three lists that decide what a crawler is served, asserted to agree.
 *
 * SEO here is split across three files that all have to name the same set of
 * routes:
 *
 *   scripts/prerender-static.mjs  ROUTES          — what gets rendered to HTML
 *   middleware.ts                 PRERENDER_ROUTES — what bots are rewritten to
 *   scripts/generate-sitemap.cjs  STATIC_PAGES    — what Google is told to crawl
 *
 * They are kept in step by hand, and nothing at runtime cross-checks them. A
 * route added to one and forgotten in another produces a page that is either
 * invisible to Google or served as a thin shell — the exact failure that kept
 * the site out of the index, and one that is invisible until you go looking.
 * This test is that check.
 */

const ROOT = resolve(__dirname, '..', '..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')

/** Pulls the string literals out of a `const NAME = [ ... ]` or `new Set([ ... ])`. */
function stringArray(source: string, name: string): string[] {
  const start = source.search(new RegExp(`const ${name} = (new Set\\()?\\s*\\[`))
  if (start === -1) throw new Error(`could not find the \`${name}\` array in source`)
  const open = source.indexOf('[', start)
  // Arrays here are written one item per line, so the closing bracket is the
  // first `])` or `\n]` at the start of a line.
  const rest = source.slice(open + 1)
  const end = rest.search(/\n\s*(\]|\]\))/)
  if (end === -1) throw new Error(`unterminated \`${name}\` array`)
  return [...rest.slice(0, end).matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2])
}

const prerenderRoutes = stringArray(read('scripts/prerender-static.mjs'), 'ROUTES')
const middlewareRoutes = stringArray(read('middleware.ts'), 'PRERENDER_ROUTES')

/**
 * Sitemap static pages, minus the two that are served elsewhere on purpose:
 * `/tours` is the backend's (live catalogue, and `?place=` faceting has no
 * static equivalent) and `/stories` is generate-story-pages.cjs's.
 */
const BACKEND_OWNED = new Set(['/tours', '/stories'])
// STATIC_PAGES entries are objects (`{ path, priority, changefreq }`), so pull
// the path field out of each rather than treating it as a flat string array.
const sitemapRoutes = stringArray(read('scripts/generate-sitemap.cjs'), 'STATIC_PAGES')
  .filter((v) => v.startsWith('/'))
  .filter((p) => !BACKEND_OWNED.has(p))

describe('crawler route lists agree', () => {
  it('the prerenderer and the middleware cover exactly the same routes', () => {
    expect(new Set(middlewareRoutes)).toEqual(new Set(prerenderRoutes))
  })

  it('every prerendered route is in the sitemap', () => {
    const sitemapped = new Set(sitemapRoutes)
    // `/` is the homepage: it is linked everywhere and does not need listing.
    const missing = prerenderRoutes.filter((r) => r !== '/' && !sitemapped.has(r))
    expect(missing).toEqual([])
  })

  it('every sitemapped static page is prerendered, so none is a thin shell', () => {
    const prerendered = new Set(prerenderRoutes)
    const missing = sitemapRoutes.filter((r) => !prerendered.has(r))
    expect(missing).toEqual([])
  })

  it('leaves /tours and /stories to the handlers that own their data', () => {
    expect(prerenderRoutes).not.toContain('/tours')
    expect(prerenderRoutes).not.toContain('/stories')
  })

  it('has no duplicates, which would silently shadow a route', () => {
    for (const [label, list] of [
      ['prerender', prerenderRoutes],
      ['middleware', middlewareRoutes],
    ] as const) {
      expect(new Set(list).size, `${label} has duplicate routes`).toBe(list.length)
    }
  })

  it('uses bare paths, so the middleware lookup and the output path agree', () => {
    for (const route of prerenderRoutes) {
      expect(route, 'routes must start with /').toMatch(/^\/[a-z-]*$/)
      // `/` is the homepage and is the one route that legitimately ends in a
      // slash; every other route must be bare or the output path shifts.
      if (route !== '/') {
        expect(route, 'routes must not end with a slash').not.toMatch(/\/$/)
      }
    }
  })
})

/**
 * The destination list in the sitemap is derived from the tour catalogue, so
 * it can only be as complete as the catalogue read behind it.
 *
 * That read was a single `?limit=50` page. Nothing reported a total, so once
 * the catalogue passed 50 the sitemap would have quietly stopped listing every
 * destination that only appears on tours 51+, and those pages would have been
 * discoverable only by crawling. A silent, invisible truncation of the
 * sitemap is precisely the failure that kept this site out of the index.
 */
describe('sitemap catalogue paging', () => {
  const script = read('scripts/generate-sitemap.cjs')

  it('pages through the catalogue instead of reading one fixed page', () => {
    expect(script).toMatch(/MAX_CATALOGUE_PAGES/)
    expect(script).toMatch(/page=\$\{/)
  })

  it('stops on the first short page, so the last page is not a full read', () => {
    expect(script).toMatch(/rows\.length < CATALOGUE_PAGE_SIZE/)
  })

  it('stays within the limit the API accepts', () => {
    // The API rejects limit > 50 outright, which fails the whole fetch.
    const size = Number(/CATALOGUE_PAGE_SIZE = (\d+)/.exec(script)?.[1])
    expect(size).toBeGreaterThan(0)
    expect(size).toBeLessThanOrEqual(50)
  })

  it('warns when it runs out of pages rather than truncating quietly', () => {
    expect(script).toMatch(/incomplete/)
  })

  it('resolves the brand-scoped API base instead of double-prefixing it', () => {
    // The production VITE_API_URL already ends in /api/travioghana; appending
    // the brand again 404'd and froze the sitemap to its last good copy.
    expect(script).toMatch(/function brandApiBase\(\)/)
    expect(script).not.toMatch(/\$\{API_URL\}\/api\/travioghana/)
  })
})

/**
 * Every rewrite in the middleware is gated on the request method.
 *
 * Both gates used to read `request.method === 'GET'`, so a HEAD matched no rule
 * at all and fell through to the static file lookup — which only the homepage
 * can satisfy. Every other path answered 404 to HEAD. Googlebot only uses GET,
 * so indexing was never affected, and that is exactly why it went unnoticed:
 * the site looked correct to every crawler-based check. HEAD is what link
 * checkers, uptime monitors and chat unfurlers use, and to all of them the
 * whole site looked broken.
 */
describe('middleware method gates', () => {
  const middleware = read('middleware.ts')

  it('routes HEAD through the rewrites, not around them', () => {
    expect(middleware).toMatch(/function isReadMethod\(method\)/)
    expect(middleware).toMatch(/method === 'GET' \|\| method === 'HEAD'/)
  })

  it('gates no rewrite on GET alone', () => {
    // The exact string that caused the 404. Any new rewrite must use the
    // helper; this fails if someone reintroduces the bare check.
    expect(middleware).not.toMatch(/request\.method === 'GET'/)
  })

  it('still rewrites bots before the SPA fallback, so a HEAD bot gets content', () => {
    const bot = middleware.indexOf('isReadMethod(request.method) && isBot(ua)')
    const spa = middleware.indexOf('isReadMethod(request.method) && !pathname.includes')
    expect(bot).toBeGreaterThan(-1)
    expect(spa).toBeGreaterThan(-1)
    expect(bot, 'the bot branch must be evaluated first').toBeLessThan(spa)
  })
})
