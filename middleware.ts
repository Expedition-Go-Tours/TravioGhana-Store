import { searchGhanaPlaces } from './server/serpApiMaps'

export const config = { runtime: 'nodejs' }

const BOT_AGENTS = [
  // Search crawlers
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
  'yandexbot', 'sogou', 'duckassist',
  // Google's other fetchers. None of them contain the substring "googlebot",
  // so each failed isBot() and was served the SPA shell instead of the
  // prerender. Google-InspectionTool is what Search Console's "Test live URL"
  // uses: the live test was fetching a 5 KB shell with no canonical, no meta
  // robots and a different <title> from the page Google had indexed, while
  // Googlebot itself was served 571 KB of real content. AdsBot-Google decides
  // how ad landing pages are scored, Storebot-Google feeds merchant listings
  // and Mediapartners-Google is AdSense's crawler.
  'google-inspectiontool', 'adsbot-google', 'mediapartners-google',
  'storebot-google', 'apis-google', 'googleother',
  // Social / chat scrapers
  'facebot', 'facebookexternalhit', 'twitterbot', 'linkedinbot',
  'slackbot', 'whatsapp', 'telegrambot', 'discordbot', 'pinterest',
  'redditbot', 'quora', 'viber', 'skype', 'embedly', 'flipboard',
  // Reader / assistant fetchers
  'applebot', 'chatgpt-user', 'oai-searchbot', 'perplexitybot',
  'claudebot', 'anthropic-ai', 'gptbot', 'bytespider', 'ccbot',
  'amazonbot', 'meta-externalagent', 'google-extended', 'cohere-ai',
  // SEO / archive tooling
  'ia_archiver', 'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot',
  'rogerbot', 'exabot', 'zoominfobot', 'screaming frog',
]

const SKIP_PATHS = [
  '/dashboard', '/booking', '/auth', '/login', '/api/',
  '/payment-methods', '/supplier/register', '/supplier/list-experience',
]

/**
 * Routes served to crawlers from the build-time prerender (scripts/prerender-
 * static.mjs) instead of the backend. Those files are the real app, rendered,
 * so their copy cannot drift from what a visitor sees — the backend's
 * hand-maintained fallback for these routes had drifted badly enough to
 * contradict the live pages (it still called the foundation "Expedition-Go
 * Foundation"), and thin body copy is what kept the site out of the index.
 *
 * Anything not in this list falls through to the backend prerenderer, which
 * still owns /tour/<slug> (live prices and availability), /tours and the
 * ?place= destination listings (live catalogue), and the 404.
 *
 * Kept in step with ROUTES in scripts/prerender-static.mjs and STATIC_PAGES in
 * scripts/generate-sitemap.cjs; a unit test asserts the three agree.
 */
const PRERENDER_ROUTES = new Set([
  '/', '/about-us', '/blog', '/reviews', '/foundation', '/careers',
  '/partnerships', '/press', '/partner-resources', '/faq', '/help-centre', '/contact-us',
  '/payments-and-security', '/transport',
  '/content-creators', '/hotels', '/transport-providers', '/travel-agents',
  '/refund-policy', '/privacy-policy', '/cookies-policy',
  '/terms-and-conditions', '/supplier-terms',
])

const STATIC_EXTS = [
  '.xml', '.txt', '.json', '.png', '.jpg', '.jpeg', '.svg', '.gif',
  '.webp', '.ico', '.css', '.js', '.woff', '.woff2', '.ttf', '.eot',
]

export function isBot(ua: string | null | undefined) {
  if (!ua) return false
  const lower = ua.toLowerCase()
  return BOT_AGENTS.some((b) => lower.includes(b))
}

function shouldSkip(pathname: string) {
  return SKIP_PATHS.some((p) => pathname.startsWith(p))
}

function isStatic(pathname: string) {
  return STATIC_EXTS.some((ext) => pathname.endsWith(ext))
}

/**
 * Methods that resolve a request to a file. HEAD asks the same question as GET
 * and differs only in the body, so it must reach the same rewrites.
 *
 * Both branches below used to be `GET`-only, which meant a HEAD fell through
 * every rule and landed on a static lookup that only `/` can satisfy: every
 * other path answered 404. Googlebot only ever uses GET so this never affected
 * indexing, but link checkers, uptime monitors and the Slack/Discord/iMessage
 * unfurlers all probe with HEAD, and each saw a site where every internal link
 * was broken. It has been this way since the infrastructure was adopted, so it
 * is a long-standing bug rather than a regression from the prerender work.
 */
function isReadMethod(method: string) {
  return method === 'GET' || method === 'HEAD'
}

const MAPS_SEARCH_PATH = '/api/maps-search'
const MAX_QUERY_LENGTH = 120

/**
 * Reads the server-side SerpApi key without referencing a Node `process`
 * global by name — this file is also type-checked against DOM typings (the
 * app project pulls it in via its tests), where `process` is not declared.
 *
 * The key is stored under its VITE_-prefixed deployment name (tooling
 * convention), but this is the SERVER runtime: it never reaches the browser.
 * A Vite build guard (`server/noClientSerpKey.ts`) fails the build if any
 * client code references it or the bare `import.meta.env` object.
 * `SERPAPI_API_KEY` is still accepted as a legacy alias.
 */
function getSerpApiKey(): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return env?.VITE_SERP_API_KEY?.trim() || env?.SERPAPI_API_KEY?.trim() || ''
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // SerpApi caches identical searches for one hour (those repeats are
      // free); letting the CDN reuse the response for the same window means
      // repeated searches never even reach the upstream API.
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  })
}

/**
 * `GET /api/maps-search?q=…&lat=…&lng=…` — proxies a Ghana-biased Google
 * Maps place search through SerpApi for the booking pickup picker.
 *
 * SerpApi sends no CORS headers and its key must stay server-side, so this
 * same-origin route is the only place the browser can reach Google Maps
 * search from. Input is validated, the key never leaves the server, and
 * failures map to `{ ok: false, reason }` so the client can fall back to the
 * paste-link / manual-pin options.
 */
export async function handleMapsSearch(request: Request): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ ok: false, reason: 'method' }, 405)

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') || '').trim()
  if (q.length < 3 || q.length > MAX_QUERY_LENGTH) {
    return jsonResponse({ ok: false, reason: 'invalid' }, 400)
  }

  const latRaw = url.searchParams.get('lat')
  const lngRaw = url.searchParams.get('lng')
  let origin: { lat: number; lng: number } | null = null
  if ((latRaw != null) !== (lngRaw != null)) {
    return jsonResponse({ ok: false, reason: 'invalid' }, 400)
  }
  if (latRaw != null && lngRaw != null) {
    const lat = Number(latRaw)
    const lng = Number(lngRaw)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return jsonResponse({ ok: false, reason: 'invalid' }, 400)
    }
    origin = { lat, lng }
  }

  const result = await searchGhanaPlaces(q, origin, getSerpApiKey())
  return jsonResponse(result)
}

export default async function middleware(request: Request) {
  const url = new URL(request.url)
  const pathname = url.pathname
  const ua = request.headers.get('user-agent') || ''

  // SerpApi-backed Google Maps search proxy — handled before every rewrite so
  // it can never be SPA-rewritten or served the bot prerender.
  if (pathname === MAPS_SEARCH_PATH) return handleMapsSearch(request)

  // Vercel's Image Optimization endpoint carries every parameter in the query
  // string, so `/_vercel/image` has no file extension. Without this guard it
  // clears `isStatic()` (no known extension), clears the bot prerouter (no dot
  // at all) and lands on the SPA rewrite at the bottom, which answers with
  // index.html instead of an optimized image — observed on prod as a 5,267-byte
  // text/html response for an image request. Hand it straight to the platform.
  if (pathname.startsWith('/_vercel/')) return

  // Let static files pass through
  if (isStatic(pathname)) return

  // Old links with a trailing slash must reach the same public page. The
  // backend treats /tours/ and /about-us/ as unknown routes and returns 404,
  // while our sitemap and app use the bare path. Consolidate both visitors
  // and crawlers before selecting either the prerender or SPA handler.
  const barePath = pathname.replace(/\/+$/, '') || '/'
  const isPublicPage = PRERENDER_ROUTES.has(barePath)
    || barePath === '/tours'
    || barePath === '/stories'
    || /^\/stories\/[^/]+$/.test(barePath)
    || /^\/tour\/[^/]+(?:\/[^/]+)?$/.test(barePath)
  if (isReadMethod(request.method) && pathname !== barePath && isPublicPage) {
    url.pathname = barePath
    return new Response(null, {
      status: 308,
      headers: { Location: url.toString() },
    })
  }

  // Bot detection: rewrite to prerender endpoint
  if (isReadMethod(request.method) && isBot(ua) && !shouldSkip(pathname)) {
    const target = `${pathname}${url.search}`

    // Stories are client-side data the backend cannot read, so the prerenderer
    // can only answer them with a hub that links to none of them (detail pages
    // with 404/noindex). They are rendered to static HTML at build time
    // (scripts/generate-story-pages.cjs) and served straight from the
    // filesystem instead: /stories for the hub, /stories/<slug> for the page.
    if (pathname === '/stories' || pathname === '/stories/') {
      return new Response(null, {
        status: 200,
        headers: {
          'x-middleware-rewrite': '/stories/index.html',
          'X-Prerender-Bot': 'true',
        },
      })
    }
    const storySlug = pathname.match(/^\/stories\/([^/]+)\/?$/)?.[1]
    // Already-suffixed paths (/stories/x.html) must fall through to the
    // prerenderer, which answers them with a real 404 instead of x.html.html.
    if (storySlug && !storySlug.endsWith('.html')) {
      return new Response(null, {
        status: 200,
        headers: {
          'x-middleware-rewrite': `/stories/${encodeURIComponent(storySlug)}.html`,
          'X-Prerender-Bot': 'true',
        },
      })
    }

    // The real app, rendered at build time. Served only to bots; humans keep
    // the SPA shell. Path shape mirrors what the prerenderer writes
    // (dist/__seo/<route>/index.html, and dist/__seo/index.html for /).
    if (PRERENDER_ROUTES.has(pathname)) {
      const dir = pathname === '/' ? '/__seo' : `/__seo${pathname}`
      return new Response(null, {
        status: 200,
        headers: {
          'x-middleware-rewrite': `${dir}/index.html`,
          'X-Prerender-Bot': 'true',
        },
      })
    }

    // The prerenderer resolves the brand from `host`: without it every
    // travighana.com request falls back to the Expedition-Go Tours brand and
    // ships expeditiongotours.com canonicals. The rewrite targets a shared API
    // host, so the public host must travel in the query string.
    const publicHost = request.headers.get('x-forwarded-host') || url.host
    const prerenderUrl = new URL('https://apiv1.travioafrica.com/api/prerender')
    prerenderUrl.searchParams.set('url', target)
    if (publicHost) prerenderUrl.searchParams.set('host', publicHost)
    return new Response(null, {
      status: 200,
      headers: {
        'x-middleware-rewrite': prerenderUrl.toString(),
        'X-Prerender-Bot': 'true',
      },
    })
  }

  // SPA routing: rewrite non-file requests to index.html
  if (isReadMethod(request.method) && !pathname.includes('.')) {
    const indexUrl = new URL('/index.html', request.url)
    return new Response(null, {
      status: 200,
      headers: {
        'x-middleware-rewrite': indexUrl.toString(),
      },
    })
  }
}
