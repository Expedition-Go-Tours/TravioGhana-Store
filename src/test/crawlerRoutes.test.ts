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
