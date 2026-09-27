#!/usr/bin/env node
/**
 * Renders the BUILT app to static HTML, one file per marketing/legal route,
 * for crawlers.
 *
 * Why this exists
 * ---------------
 * The storefront is a client-rendered SPA. Crawlers that skip the render pass
 * (and every non-Google crawler) were served the same empty shell for every
 * URL, and the backend prerenderer's fallback copy for these routes was a bare
 * title + one meta-description paragraph — around 20 words of page body. That
 * is thin content, and because it disagreed with what a visitor actually sees
 * (different <h1>, different description), the two versions undercut each
 * other. Result: crawled, not indexed.
 *
 * Why a headless browser rather than more template strings
 * -------------------------------------------------------
 * Because the copy is *rendered from the app itself*, it cannot drift from the
 * page a visitor sees. The previous approach — a hand-maintained copy table in
 * the backend — had already drifted: the crawler copy still said "Expedition-Go
 * Foundation" for a page whose <h1> reads "Every journey can make a
 * difference.". Titles, descriptions, canonicals, robots and JSON-LD all come
 * from src/components/SEO.tsx, so there is exactly one source of truth.
 *
 * Output layout
 * -------------
 *   dist/__seo/index.html              for /
 *   dist/__seo/about-us/index.html     for /about-us
 *   ...
 *
 * middleware.ts serves these to bots at the real URL. The /__seo/ prefix is
 * never linked and is Disallowed in robots.txt, so it is not itself an indexable
 * duplicate. Users keep the fast SPA shell.
 *
 * Tour detail and listing pages are deliberately NOT prerendered here: their
 * prices, availability and ratings are live data, and the backend already
 * renders them from the API per request, which is fresher than any build-time
 * snapshot.
 *
 * Fails soft. A Chromium crash or an API outage must never fail a deploy —
 * the backend prerenderer remains the fallback for every route.
 *
 * Run via `npm run build` (after `vite build`). Override the list with
 * PRERENDER_ROUTES (comma-separated) when debugging.
 */

import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const require = createRequire(import.meta.url)
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DIST = join(ROOT, 'dist')
const OUT_ROOT = join(DIST, '__seo')

/**
 * Fixed marketing + legal routes. Must stay in step with the prerender route
 * list in middleware.ts and with STATIC_PAGES in generate-sitemap.cjs;
 * `npm test` asserts all three agree.
 *
 * /stories and /stories/<slug> are absent on purpose — scripts/generate-story-
 * pages.cjs already writes real static HTML for them from travelStories.json,
 * and the React /stories route only adds client-side filtering on top.
 */
const ROUTES = [
  '/',
  '/about-us',
  '/blog',
  '/reviews',
  '/foundation',
  '/careers',
  '/partnerships',
  '/faq',
  '/help-centre',
  '/contact-us',
  '/transport',
  '/content-creators',
  '/hotels',
  '/transport-providers',
  '/travel-agents',
  '/refund-policy',
  '/privacy-policy',
  '/cookies-policy',
  '/terms-and-conditions',
  '/supplier-terms',
]

/** A page with less than this many body words is a failed render, not a page. */
const MIN_WORDS = 120

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
}

/**
 * Serves dist/ the way Vercel will: real files win, extensionless paths fall
 * back to the SPA shell. The app has to boot for React to render, so the MIME
 * types matter as much as the routing.
 */
function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    let pathname = decodeURIComponent(url.pathname)
    if (pathname.includes('..')) {
      res.writeHead(400).end('bad path')
      return
    }

    const isFile = (p) => {
      try {
        return statSync(p).isFile()
      } catch {
        return false
      }
    }

    // Real files win; extensionless paths fall back to the SPA shell.
    let file = join(DIST, pathname)
    if (!isFile(file)) {
      const asIndex = join(file, 'index.html')
      file = isFile(asIndex) ? asIndex : join(DIST, 'index.html')
    }
    if (!isFile(file)) {
      res.writeHead(404).end('not found')
      return
    }

    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(readFileSync(file))
  })

  return new Promise((ok, fail) => {
    server.on('error', fail)
    server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port }))
  })
}

/**
 * Reads the rendered page. Counts words from the app's own content area (the
 * chrome is stripped so the number reflects the page, not the nav) and pulls
 * the tags that decide whether the page can be indexed.
 *
 * This is a real function, not a source string: Puppeteer evaluates a string
 * argument as an *expression*, so an arrow function passed as text comes back
 * as a non-serialisable function object (an empty result) rather than the
 * audit it was meant to be.
 */
function audit() {
  const text = (node) => {
    const clone = node.cloneNode(true)
    clone.querySelectorAll('script,style,noscript,template').forEach((n) => n.remove())
    Array.from(clone.querySelectorAll('nav,header,footer')).forEach((n) => {
      if (!n.querySelector('h1,h2,h3,p')) n.remove()
    })
    return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim()
  }
  const main = document.querySelector('main') || document.querySelector('#root')
  const meta = (sel, attr) => {
    const el = document.querySelector(sel)
    return el ? (el.getAttribute(attr) || '').trim() : ''
  }
  return {
    words: text(main).split(' ').filter((w) => /[a-z0-9]/i.test(w)).length,
    title: (document.title || '').trim(),
    description: meta('meta[name="description"]', 'content'),
    canonical: meta('link[rel="canonical"]', 'href'),
    robots: meta('meta[name="robots"]', 'content'),
    h1: Array.from(document.querySelectorAll('h1')).map((h) => (h.innerText || '').replace(/\s+/g, ' ').trim()),
    jsonLd: document.querySelectorAll('script[type="application/ld+json"]').length,
    html: '<!doctype html>\n' + document.documentElement.outerHTML,
  }
}

async function renderRoute(browser, origin, route) {
  const page = await browser.newPage()
  try {
    // Desktop viewport: the widest layout is the one that exercises every
    // breakpoint's content, and it is what a crawler is judged on.
    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(`${origin}${route}`, { waitUntil: 'networkidle2', timeout: 60_000 })

    // Lazy routes resolve behind <Suspense>, and content that arrives from the
    // API arrives after first paint. Wait for real text, then let the page
    // settle so late-arriving nodes are in the dump.
    await page.waitForFunction(
      () => {
        const main = document.querySelector('main') || document.querySelector('#root')
        return !!main && (main.innerText || '').trim().length > 200
      },
      { timeout: 30_000 }
    )
    await new Promise((r) => setTimeout(r, 1200))

    // Walk the page so loading="lazy" images have their real src before the
    // HTML is captured, then return to the top.
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.8)
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 120))
      }
      window.scrollTo(0, 0)
    })
    await new Promise((r) => setTimeout(r, 400))

    return await page.evaluate(audit)
  } finally {
    await page.close()
  }
}

function writeRoute(route, html) {
  const dir = route === '/' ? OUT_ROOT : join(OUT_ROOT, route.replace(/^\//, ''))
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'index.html')
  writeFileSync(file, html, 'utf8')
  return file
}

const LAUNCH_ARGS = ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']

/**
 * Raised when no browser could be obtained at all — the one prerender failure
 * that must not be silent. See ensureBrowser().
 */
class BrowserUnavailableError extends Error {}

function launch() {
  return puppeteer.launch({ headless: true, args: LAUNCH_ARGS })
}

/** Path to puppeteer's own CLI, taken from its declared bin so it survives moves. */
function puppeteerCli() {
  const pkgPath = require.resolve('puppeteer/package.json')
  const pkg = require('puppeteer/package.json')
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.puppeteer
  return join(dirname(pkgPath), bin)
}

/**
 * Get a usable browser, or fail loudly.
 *
 * npm 11 gates lifecycle scripts behind `allowScripts` and prints
 *   npm warn install-scripts   puppeteer@25.11.0 (postinstall: node install.mjs)
 * without running them. That postinstall is the step that downloads Chromium,
 * so on a clean Vercel build puppeteer is installed but has no browser to
 * launch. The first version of this script launched once and let the error
 * escape to a catch-all that warned and returned 0 — so the build went green
 * and shipped with dist/__seo/ empty, silently reintroducing the exact
 * thin-content bug the prerender exists to fix. Nobody would have seen it
 * except by reading the live word count.
 *
 * So: try, and on failure install the browser explicitly via the CLI (an
 * explicit invocation is not gated by allowScripts), then retry. If there is
 * still no browser, throw — a deploy that cannot prerender must say so rather
 * than pretend it did.
 */
async function ensureBrowser() {
  try {
    return await launch()
  } catch (firstErr) {
    console.warn(`[prerender] no browser available (${firstErr.message.split('\n')[0]}) — installing one`)
  }

  try {
    console.log('[prerender] running: puppeteer browsers install chrome')
    execFileSync(process.execPath, [puppeteerCli(), 'browsers', 'install', 'chrome'], {
      stdio: 'inherit',
      env: process.env,
    })
  } catch (err) {
    throw new BrowserUnavailableError(
      `could not download a browser: ${err.message.split('\n')[0]}`
    )
  }

  try {
    return await launch()
  } catch (err) {
    throw new BrowserUnavailableError(`still cannot launch after install: ${err.message.split('\n')[0]}`)
  }
}

async function main() {
  if (process.env.PRERENDER_SKIP === '1') {
    console.warn('[prerender] PRERENDER_SKIP=1 — skipped on purpose. Bots get the backend fallback.')
    return
  }
  if (!existsSync(join(DIST, 'index.html'))) {
    console.warn('[prerender] dist/index.html not found — run `vite build` first. Skipping.')
    return
  }
  const routes = process.env.PRERENDER_ROUTES
    ? process.env.PRERENDER_ROUTES.split(',').map((r) => r.trim()).filter(Boolean)
    : ROUTES

  // Clear a previous run so a removed route cannot survive as a stale file.
  if (existsSync(OUT_ROOT)) {
    for (const entry of readdirSync(OUT_ROOT)) {
      rmSync(join(OUT_ROOT, entry), { recursive: true, force: true })
    }
  }

  const { server, port } = await startServer()
  const origin = `http://127.0.0.1:${port}`
  const browser = await ensureBrowser()

  const results = []
  let failures = 0

  try {
    for (const route of routes) {
      const label = route === '/' ? '/' : route
      try {
        const audit = await renderRoute(browser, origin, route)
        const problems = []
        if (audit.words < MIN_WORDS) problems.push(`thin (${audit.words} words < ${MIN_WORDS})`)
        if (!audit.h1.length) problems.push('no <h1>')
        if (!audit.canonical) problems.push('no canonical')
        if (!audit.description) problems.push('no meta description')
        if (/noindex/i.test(audit.robots)) problems.push(`robots=${audit.robots}`)

        if (problems.length) {
          failures++
          console.warn(`[prerender] SKIP ${label} — ${problems.join('; ')}`)
        } else {
          writeRoute(route, audit.html)
          results.push({ route: label, words: audit.words, title: audit.title, jsonLd: audit.jsonLd })
        }
      } catch (err) {
        failures++
        console.warn(`[prerender] SKIP ${label} — ${String(err.message || err).split('\n')[0]}`)
      }
    }
  } finally {
    await browser.close()
    server.close()
  }

  for (const r of results) {
    console.log(`[prerender] ${String(r.words).padStart(5)}w  ld:${r.jsonLd}  ${r.route}  — ${r.title}`)
  }
  mkdirSync(OUT_ROOT, { recursive: true })
  writeFileSync(
    join(OUT_ROOT, 'manifest.json'),
    JSON.stringify({ generatedFor: routes.length, written: results.length, skipped: failures, routes: results }, null, 2),
    'utf8'
  )
  console.log(
    `[prerender] wrote ${results.length}/${routes.length} routes to dist/__seo/` +
      (failures ? ` (${failures} skipped — the backend prerenderer still covers them)` : '')
  )
  if (results.length === 0) {
    console.warn(
      '[prerender] WARNING — every route was rejected. If this is not an API\n' +
      '             outage, the pages have genuinely gone thin and the site has\n' +
      '             lost the content this prerender exists to give crawlers.'
    )
  }
}

main().catch((err) => {
  if (err instanceof BrowserUnavailableError) {
    // Every other failure stays soft, because the backend prerenderer remains
    // a correct fallback for each route. This one is different: no browser
    // means no route is prerendered at all, and shipping that quietly is the
    // failure mode that hid this in the first place. A red build is better
    // than a green one that reverted the fix.
    console.error(
      [
        '',
        '[prerender] FAILED — no browser, so zero routes were prerendered.',
        `  ${err.message}`,
        '  dist/__seo/ is empty: every bot will be served the thin fallback and',
        '  this deploy will undo the fix. Fix the browser, or set',
        '  PRERENDER_SKIP=1 to opt out knowingly (the backend still prerenders).',
        '',
      ].join('\n')
    )
    process.exit(1)
  }
  // A single bad route must not block a release: the backend still covers it.
  console.warn(`[prerender] aborted, continuing without static prerender: ${err.message}`)
})
