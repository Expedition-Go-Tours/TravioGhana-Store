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
// Resolved lazily rather than at module scope: the test suite imports this file
// for its exported helpers, and vitest's transform gives import.meta a URL that
// fileURLToPath rejects. Nothing here needs the filesystem until a build runs.
let cachedRoot = null
const ROOT_DIR = () => (cachedRoot ??= resolve(fileURLToPath(new URL('..', import.meta.url))))
const DIST = () => join(ROOT_DIR(), 'dist')
const OUT_ROOT = () => join(DIST(), '__seo')

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
  '/press',
  '/partner-resources',
  '/faq',
  '/help-centre',
  '/contact-us',
  '/payments-and-security',
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

/** How long an inventory route waits for real product cards before giving up. */
const CARD_TIMEOUT_MS = 15_000

/**
 * Routes whose whole job is to present the product inventory.
 *
 * Only the homepage does. The other twenty-one are marketing, legal and editorial
 * pages with no tours on them, so zero cards is the correct result there and
 * must not trip the gate.
 */
const INVENTORY_ROUTES = new Set(['/'])

/**
 * Where the API lives when nothing says otherwise.
 *
 * The same fallback generate-sitemap.cjs has carried all along, and for the
 * same reason: a build machine has no .env, so a value that is only ever read
 * from .env is a value CI does not have. Without this the homepage captured
 * zero cards on Vercel and the inventory gate failed the deploy.
 */
export const DEFAULT_API_ORIGIN = 'https://apiv1.travioafrica.com'

export function isInventoryRoute(route) {
  return INVENTORY_ROUTES.has(route)
}

/** Bare origin from a base URL, or null if it is not a URL at all. */
export function toOrigin(value) {
  try {
    return new URL(String(value).trim()).origin
  } catch {
    return null
  }
}

/**
 * Origins the prerender proxies through Node, from the values it was given in
 * order — so an explicit process env beats the .env file. Accepts a comma- or
 * whitespace-separated list, and tolerates a base URL that carries a path
 * (`https://api.example.com/api/travioghana`), which is the shape VITE_API_URL
 * has.
 */
export function resolveApiOrigins(values) {
  const out = new Set()
  for (const value of values) {
    for (const part of String(value ?? '').split(/[,\s]+/)) {
      const origin = toOrigin(part)
      if (origin) out.add(origin)
    }
  }
  return out
}

/**
 * The API origins a real prerender run proxies, from the sources it actually
 * has, most specific first: PRERENDER_API_ORIGIN, then the build-time
 * VITE_API_URL, then .env for a local run, then DEFAULT_API_ORIGIN.
 *
 * The default is not a convenience — it is what makes CI work. A build machine
 * has no .env (it is gitignored) and VITE_API_URL was never set as a Vercel
 * project env var, so with only the first three sources the script resolved
 * nothing, captured zero product cards, and the inventory gate failed the
 * deploy. generate-sitemap.cjs has carried the same fallback all along, which
 * is why its step kept passing while this one did not.
 *
 * Taking env and dotEnv as arguments rather than reading them here is what
 * makes the CI case — everything absent — a thing a test can state.
 */
export function prerenderApiOrigins({ env, dotEnv }) {
  return resolveApiOrigins([
    env.PRERENDER_API_ORIGIN,
    env.VITE_API_URL,
    readDotEnvValue(dotEnv, 'VITE_API_URL'),
    DEFAULT_API_ORIGIN,
  ])
}

/**
 * One key out of a .env file. Not a parser and not trying to be: quotes and
 * trailing blanks are the only real-world variation, and a dependency here
 * would be a dependency in the build path of every deploy.
 */
export function readDotEnvValue(text, key) {
  // [ \t] rather than \s: \s matches newlines, so a leading \s* lets the pattern
  // start on a previous line and swallow a comment or the line above as the
  // value. With /m, `^\s*KEY=` on this file returned "# Travio Ghana API".
  const match = new RegExp(`^[ \\t]*${key}[ \\t]*=[ \\t]*(.*)$`, 'm').exec(String(text ?? ''))
  if (!match) return undefined
  return match[1].trim().replace(/^["']|["']$/g, '') || undefined
}

export function isApiRequest(url, origins) {
  const origin = toOrigin(url)
  return origin !== null && origins.has(origin)
}

/**
 * Everything that disqualifies a capture from being published.
 *
 * The product-card check is the one `words` cannot make. A page clears 120
 * words easily on nav, footer and 1,199 bundled reviews while carrying no
 * product at all — and it did, which is how a homepage with no catalogue, no
 * prices and no links to any tour page shipped green and got crawled that way.
 * The word count measures text; only the card count measures inventory.
 */
export function routeProblems(route, audit) {
  const problems = []
  if (audit.words < MIN_WORDS) problems.push(`thin (${audit.words} words < ${MIN_WORDS})`)
  if (!audit.h1.length) problems.push('no <h1>')
  if (!audit.canonical) problems.push('no canonical')
  if (!audit.description) problems.push('no meta description')
  if (/noindex/i.test(audit.robots)) problems.push(`robots=${audit.robots}`)
  if (isInventoryRoute(route) && audit.cards === 0) {
    problems.push('no product cards captured')
  }
  return problems
}

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
    let file = join(DIST(), pathname)
    if (!isFile(file)) {
      const asIndex = join(file, 'index.html')
      file = isFile(asIndex) ? asIndex : join(DIST(), 'index.html')
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
 * Serves API requests to the page from Node, bypassing the CORS check.
 *
 * Why this is needed
 * ------------------
 * The content API's CORS policy is an exact-match allowlist of the two
 * production domains. Asked with `Origin: https://www.travioghana.com` it
 * answers with a matching `Access-Control-Allow-Origin`; asked with any other
 * origin — including the `http://127.0.0.1:<port>` this script serves from — it
 * answers 200 with the full body and *no* CORS header, and the browser then
 * withholds that body from JavaScript. The request looks successful in the
 * network log and delivers nothing to the app.
 *
 * That is exactly what was happening. All five homepage carousels mounted,
 * showed skeletons, and resolved to empty; the capture held zero tour cards and
 * zero links to any tour page. The reviews section rendered regardless, because
 * it reads a bundled JSON file and never touches the network — which is why the
 * page looked healthy and cleared a 120-word check while holding no catalogue.
 *
 * Node sends no Origin and so is subject to no CORS check: the same URL fetched
 * from here returns the real body. Re-emitting it to the page with an
 * allow-origin of the local origin completes the handshake the API declined to
 * perform. Side benefit: the capture no longer races the API.
 */
export async function installApiProxy(page, apiOrigins, pageOrigin) {
  if (apiOrigins.size === 0) return
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    if (!isApiRequest(request.url(), apiOrigins)) {
      request.continue().catch(() => {})
      return
    }
    fetch(request.url(), { headers: { accept: request.headers().accept || 'application/json' } })
      .then(async (res) => {
        const body = Buffer.from(await res.arrayBuffer())
        const headers = { 'content-type': res.headers.get('content-type') || 'application/json' }
        if (res.ok) headers['access-control-allow-origin'] = pageOrigin
        await request.respond({ status: res.status, headers, body })
      })
      .catch(async (err) => {
        // Answer 502 rather than a plausible empty payload. A silent fallback to
        // `request.continue()` here would let the browser do the CORS-blocked
        // fetch again, reproducing the original silent failure exactly.
        await request
          .respond({ status: 502, contentType: 'text/plain', body: String(err?.message || err) })
          .catch(() => {})
      })
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
    // Product inventory, counted separately from `words` on purpose. A route can
    // clear MIN_WORDS on nav, footer and reviews alone while carrying no
    // product at all, so the word count cannot tell you the inventory made it
    // into the capture. `tourLinks` is the number that matters for crawling:
    // TourCard emits exactly one crawlable <a href="/tour/{id}/{slug}"> per
    // card, so it is the count of product pages this HTML can actually reach.
    cards: document.querySelectorAll('.tour-card').length,
    skeletons: document.querySelectorAll('.tour-card-skeleton').length,
    tourLinks: document.querySelectorAll('a[href^="/tour/"]').length,
    html: '<!doctype html>\n' + document.documentElement.outerHTML,
  }
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Leave exactly one <title>, holding the page's real one.
 *
 * index.html ships a static fallback title, and Helmet adds its own on top
 * rather than replacing it — so the serialised head came out with two. On the
 * client that is invisible, because `document.title` reads the first element
 * and the fallback is never displayed. In the prerendered HTML it is very
 * visible: crawlers are handed a second, generic title for the page, which is
 * how you end up with duplicate-title warnings in Search Console and a
 * watered-down snippet on the one page you most wanted indexed.
 *
 * The first element is the Helmet one (that is what `document.title` returned,
 * hence the value passed in), so keep that position and drop the rest.
 */
export function dedupeTitle(html, title) {
  let kept = false
  return html.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, () => {
    if (kept) return ''
    kept = true
    return `<title>${escapeHtml(title)}</title>`
  })
}

async function renderRoute(browser, origin, route, { apiOrigins = new Set(), requireCards = false } = {}) {
  const page = await browser.newPage()
  try {
    // Before any navigation: with interception on, every request must be
    // continued or answered explicitly, or the page stalls outright.
    await installApiProxy(page, apiOrigins, origin)
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
    //
    // The positions are jumped to, not animated to. Any page that sets
    // `scroll-behavior: smooth` — /payments-and-security does, so its jump nav
    // animates anchor links — makes `scrollTo` queue an animation instead of
    // moving, so this walk fell behind its own targets: each 120ms step issued
    // the next one before the last had arrived, and the walk ended partway down
    // the page. Anything gated on being scrolled into view never triggered, so
    // the published HTML captured those sections still mid-animation at
    // `opacity: 0`. Forcing `auto` for the duration of the walk keeps the dwell
    // time (and so the lazy-loading behaviour) exactly as it was while making
    // the walk actually reach the bottom.
    await page.evaluate(async () => {
      const root = document.documentElement
      const previous = root.style.scrollBehavior
      root.style.scrollBehavior = 'auto'
      try {
        const step = Math.round(window.innerHeight * 0.8)
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 120))
        }
        window.scrollTo(0, 0)
      } finally {
        root.style.scrollBehavior = previous
      }
    })
    await new Promise((r) => setTimeout(r, 400))

    // Wait for the inventory itself, where the page is supposed to have some.
    // The fixed settle above is a guess, and the guess was wrong: the carousels
    // are behind MountOnView, so they mount only when the scroll reaches them,
    // and then need another round trip to render their cards. Timed out rather
    // than thrown, because a missing API should still produce an auditable
    // capture that routeProblems() rejects by card count — not an exception
    // that reads as a browser crash.
    if (requireCards) {
      await page
        .waitForFunction(() => document.querySelectorAll('.tour-card').length > 0, {
          timeout: CARD_TIMEOUT_MS,
        })
        .catch(() => {})
    }

    // Diagnostic: sample the product inventory over time, so a run tells us
    // whether the capture is merely early (counts climb, then plateau) or the
    // API genuinely returns nothing (counts pinned at 0 the whole way). That
    // distinction decides whether the fix is "wait for real content" or
    // "the tour data never arrives at build time" — the two look identical
    // from a single snapshot. Off unless PRERENDER_DIAG=1, since it costs
    // ~DIAG_MS of wall clock per route.
    if (process.env.PRERENDER_DIAG === '1') {
      const budget = Number(process.env.PRERENDER_DIAG_MS || 24_000)
      const step = 750
      for (let waited = 0; waited <= budget; waited += step) {
        const snap = await page.evaluate(() => ({
          cards: document.querySelectorAll('.tour-card').length,
          skeletons: document.querySelectorAll('.tour-card-skeleton').length,
          tourLinks: document.querySelectorAll('a[href^="/tour/"]').length,
        }))
        console.log(
          `[prerender][diag] ${route.padEnd(16)} +${String(waited).padStart(6)}ms  ` +
            `cards=${String(snap.cards).padStart(3)}  skeletons=${String(snap.skeletons).padStart(3)}  tourLinks=${snap.tourLinks}`
        )
        if (snap.cards > 0) break
        await new Promise((r) => setTimeout(r, step))
      }
    }

    const result = await page.evaluate(audit)
    // Applied here rather than inside evaluate(): this runs in Node, while
    // evaluate()'s body runs in the browser and cannot reach module scope.
    result.html = relativizeOrigin(dedupeTitle(result.html, result.title), origin)
    return result
  } finally {
    await page.close()
  }
}

/**
 * Strip the preview server's own origin out of the serialised HTML.
 *
 * index.html ships its asset links root-relative (`/assets/index-*.js`), and
 * those survive the round trip untouched because the markup was already
 * relative in the source. Vite's runtime-injected links are not: the module
 * preload and stylesheet tags it adds while the page boots are built from the
 * document's current origin, which during the prerender is the ephemeral
 * `http://127.0.0.1:<port>` this script listens on.
 *
 * So the published file carried URLs pointing at a port that no longer exists
 * by the time anyone reads it. On the homepage that was 38 dead references —
 * ten stylesheets that never load and every JS chunk the deferred sections
 * need — so crawlers were handed a page that renders unstyled and cannot
 * execute, and the served HTML advertised build infrastructure. The port
 * differed per build (52362 locally, 38753 in production, 42863 in the copy
 * Search Console had cached), which is what pinned it as a build-time
 * artefact rather than a one-off.
 *
 * Only this server's own origin is rewritten. Any other absolute URL in the
 * page — a real CDN, an image on a supplier's domain, the canonical, an
 * hreflang sibling — is correct as written and must survive: replacing one
 * host with another would be worse than the bug.
 */
export function relativizeOrigin(html, origin) {
  // Defensive, and not provable by a test: `split(undefined).join('')` happens
  // to be the identity on a string, so removing this guard changes no
  // observable behaviour. It stays because it documents the intent — an empty
  // origin must not be treated as a match-everything needle.
  if (!origin) return html
  return html.split(origin).join('')
}

function writeRoute(route, html) {
  const dir = route === '/' ? OUT_ROOT() : join(OUT_ROOT(), route.replace(/^\//, ''))
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'index.html')
  writeFileSync(file, html, 'utf8')
  return file
}

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
]

/**
 * Raised when no browser could be obtained at all — the one prerender failure
 * that must not be silent. See ensureBrowser().
 */
class BrowserUnavailableError extends Error {}

const firstLine = (err) => String(err?.message || err).split('\n')[0]

/** Path to puppeteer's own CLI, taken from its declared bin so it survives moves. */
function puppeteerCli() {
  const pkgPath = require.resolve('puppeteer/package.json')
  const pkg = require('puppeteer/package.json')
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.puppeteer
  return join(dirname(pkgPath), bin)
}

/** Try one launch. Returns the browser, or null with the reason logged. */
async function attempt(overrides, label) {
  try {
    const browser = await puppeteer.launch({ headless: true, args: LAUNCH_ARGS, ...overrides })
    console.log(`[prerender] browser ready via ${label}`)
    return browser
  } catch (err) {
    console.warn(`[prerender] ${label}: ${firstLine(err)}`)
    return null
  }
}

/**
 * Shared libraries Chrome links against but a slim CI image does not ship.
 * These are the lists from puppeteertroubleshooting.com, which Vercel's
 * Amazon Linux build image needs almost in full.
 */
const RPM_DEPS = [
  'nss', 'atk', 'at-spi2-atk', 'at-spi2-core', 'cups-libs', 'libdrm', 'libxkbcommon',
  'libXcomposite', 'libXdamage', 'libXext', 'libXfixes', 'libXrandr', 'libXi', 'libXtst',
  'libX11', 'libxshmfence', 'mesa-libgbm', 'alsa-lib', 'pango', 'ca-certificates',
]
const APT_DEPS = [
  'ca-certificates', 'fonts-liberation', 'libasound2', 'libatk-bridge2.0-0', 'libatk1.0-0',
  'libcups2', 'libdbus-1-3', 'libdrm2', 'libgbm1', 'libglib2.0-0', 'libnspr4', 'libnss3',
  'libpango-1.0-0', 'libx11-6', 'libx11-xcb1', 'libxcb1', 'libxcomposite1', 'libxdamage1',
  'libxext6', 'libxfixes3', 'libxkbcommon0', 'libxrandr2', 'libxshmfence1', 'libxtst6',
]

/**
 * Chrome exiting 127 means a shared library is missing, not that the binary is
 * absent. Install them, then let the caller retry. Best-effort by design: if
 * the image has no package manager or no privileges, the caller simply moves
 * on to the next strategy.
 */
function installSystemDeps() {
  const root = typeof process.getuid !== 'function' || process.getuid() === 0
  const run = (cmd, args) =>
    execFileSync(root ? cmd : 'sudo', root ? args : ['-n', cmd, ...args], {
      stdio: 'inherit',
      env: process.env,
    })

  for (const [cmd, deps, prep] of [
    ['dnf', RPM_DEPS, null],
    ['yum', RPM_DEPS, null],
    ['apt-get', APT_DEPS, ['apt-get', 'update']],
  ]) {
    try {
      run('sh', ['-c', `command -v ${cmd} >/dev/null 2>&1`])
    } catch {
      continue // package manager not present — try the next one
    }
    try {
      console.log(`[prerender] installing browser system libraries with ${cmd}`)
      if (prep) run(prep[0], prep.slice(1))
      run(cmd, [...(cmd === 'apt-get' ? ['install', '-y', '--no-install-recommends'] : ['install', '-y']), ...deps])
      return true
    } catch (err) {
      console.warn(`[prerender] ${cmd} install failed: ${firstLine(err)}`)
    }
  }
  return false
}

function installBrowserBinary(product) {
  try {
    console.log(`[prerender] running: puppeteer browsers install ${product}`)
    execFileSync(process.execPath, [puppeteerCli(), 'browsers', 'install', product], {
      stdio: 'inherit',
      env: process.env,
    })
    return true
  } catch (err) {
    console.warn(`[prerender] could not download ${product}: ${firstLine(err)}`)
    return false
  }
}

/** Chrome that a CI image may already provide, deps and all. */
const SYSTEM_CHROME = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]

/**
 * Get a usable browser, or fail loudly.
 *
 * Two separate things have to be true on a Vercel build, and both have already
 * been false in production:
 *
 * 1. A browser exists. npm 11 gates lifecycle scripts behind `allowScripts` and
 *    prints "npm warn install-scripts puppeteer@25.11.0 (postinstall: ...)"
 *    without running them, and that postinstall is the step that downloads
 *    Chromium. So puppeteer can be installed with nothing to launch.
 *
 * 2. That browser can start. Chrome for Testing links against libnss3, atk,
 *    libgbm and friends; a slim CI image has none of them, and the failure
 *    surfaces only as "Failed to launch the browser process: Code: 127".
 *
 * The first version of this script launched once and let the error reach a
 * catch-all that warned and returned 0, so the build went green with
 * dist/__seo/ empty and every bot served the thin fallback — reintroducing the
 * exact bug the prerender exists to fix, invisibly.
 *
 * So each obstacle is handled in turn — cached browser, download, system
 * libraries, the image's own Chrome, and finally the lighter headless shell —
 * and if none work the build fails. Per-route failures stay soft, because the
 * backend prerenderer still covers them; only "no browser at all" is fatal.
 */
async function ensureBrowser() {
  const cached = await attempt({}, 'cached browser')
  if (cached) return cached

  if (installBrowserBinary('chrome')) {
    const fresh = await attempt({}, 'downloaded chrome')
    if (fresh) return fresh

    // Downloaded fine but would not start: that is a missing-library problem.
    if (installSystemDeps()) {
      const withDeps = await attempt({}, 'downloaded chrome + system libraries')
      if (withDeps) return withDeps
    }
  }

  for (const path of SYSTEM_CHROME) {
    if (!existsSync(path)) continue
    const sys = await attempt({ executablePath: path }, `system chrome at ${path}`)
    if (sys) return sys
  }

  // Last resort: the headless shell links against a smaller set of libraries.
  if (installBrowserBinary('chrome-headless-shell')) {
    const shell = await attempt({ headless: 'shell' }, 'chrome-headless-shell')
    if (shell) return shell
  }

  throw new BrowserUnavailableError(
    'no strategy produced a launchable browser (cached, downloaded, system chrome, headless shell)'
  )
}

async function main() {
  if (process.env.PRERENDER_SKIP === '1') {
    console.warn('[prerender] PRERENDER_SKIP=1 — skipped on purpose. Bots get the backend fallback.')
    return
  }
  if (!existsSync(join(DIST(), 'index.html'))) {
    console.warn('[prerender] dist/index.html not found — run `vite build` first. Skipping.')
    return
  }
  const routes = process.env.PRERENDER_ROUTES
    ? process.env.PRERENDER_ROUTES.split(',').map((r) => r.trim()).filter(Boolean)
    : ROUTES

  // Clear a previous run so a removed route cannot survive as a stale file.
  if (existsSync(OUT_ROOT())) {
    for (const entry of readdirSync(OUT_ROOT())) {
      rmSync(join(OUT_ROOT(), entry), { recursive: true, force: true })
    }
  }

  const { server, port } = await startServer()
  const origin = `http://127.0.0.1:${port}`
  const browser = await ensureBrowser()

  let dotEnv = ''
  try {
    dotEnv = readFileSync(join(ROOT_DIR(), '.env'), 'utf8')
  } catch {
    // No .env on disk is the normal case in CI; the env vars and the default
    // below still apply.
  }
  const apiOrigins = prerenderApiOrigins({
    env: process.env,
    dotEnv,
  })
  console.log(`[prerender] proxying API origin(s) via node: ${[...apiOrigins].join(', ')}`)

  const results = []
  const skipped = []
  let failures = 0

  try {
    for (const route of routes) {
      const label = route === '/' ? '/' : route
      try {
        const audit = await renderRoute(browser, origin, route, {
          apiOrigins,
          requireCards: isInventoryRoute(route),
        })
        const problems = routeProblems(route, audit)

        if (problems.length) {
          failures++
          skipped.push({ route: label, problems })
          console.warn(`[prerender] SKIP ${label} — ${problems.join('; ')}`)
        } else {
          writeRoute(route, audit.html)
          results.push({
            route: label,
            words: audit.words,
            title: audit.title,
            jsonLd: audit.jsonLd,
            cards: audit.cards,
            tourLinks: audit.tourLinks,
          })
        }
      } catch (err) {
        failures++
        const reason = String(err.message || err).split('\n')[0]
        skipped.push({ route: label, problems: [reason] })
        console.warn(`[prerender] SKIP ${label} — ${reason}`)
      }
    }
  } finally {
    await browser.close()
    server.close()
  }

  for (const r of results) {
    console.log(
      `[prerender] ${String(r.words).padStart(5)}w  ld:${r.jsonLd}  ` +
        `cards:${String(r.cards).padStart(3)}  links:${String(r.tourLinks).padStart(3)}  ${r.route}  — ${r.title}`
    )
  }
  mkdirSync(OUT_ROOT(), { recursive: true })
  writeFileSync(
    join(OUT_ROOT(), 'manifest.json'),
    JSON.stringify(
      { generatedFor: routes.length, written: results.length, skipped: failures, routes: results, rejected: skipped },
      null,
      2
    ),
    'utf8'
  )
  console.log(
    `[prerender] wrote ${results.length}/${routes.length} routes to dist/__seo/` +
      (failures ? ` (${failures} skipped — the backend prerenderer still covers them)` : '')
  )

  // An inventory route that reached this point has no product cards. Publishing
  // it would hand crawlers a homepage with no catalogue — the exact state this
  // run's gate exists to prevent — so the deploy is failed rather than the
  // empty file. The backend prerenderer still serves the route meanwhile, which
  // is why this is a hard stop and not a crash: the site stays up, but nobody
  // can ship an empty homepage by not looking at the log again.
  const emptyInventory = skipped.filter((s) => isInventoryRoute(s.route))
  if (emptyInventory.length) {
    console.error(
      [
        '',
        `[prerender] FAILED — ${emptyInventory.map((s) => s.route).join(', ')} captured no product cards.`,
        '  The page would be published with no tours, no prices and no links to',
        '  any tour page. Usual causes:',
        '    - the API origin was not resolved (see the warning above)',
        '    - the API rejected the request, or is down',
        '    - a section stopped rendering cards (MountOnView, carousel, skeleton)',
        '  Set PRERENDER_SKIP=1 to bypass knowingly; the backend still prerenders.',
        '',
      ].join('\n')
    )
    process.exit(1)
  }
  if (results.length === 0) {
    console.warn(
      '[prerender] WARNING — every route was rejected. If this is not an API\n' +
      '             outage, the pages have genuinely gone thin and the site has\n' +
      '             lost the content this prerender exists to give crawlers.'
    )
  }
}

// Only prerender when run as a script. Exporting the head helpers lets the
// tests exercise them directly; importing this file must not launch a browser.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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
}
