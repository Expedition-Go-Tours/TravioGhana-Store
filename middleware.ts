export const config = { runtime: 'nodejs' }

const BOT_AGENTS = [
  // Search crawlers
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
  'yandexbot', 'sogou', 'duckassist',
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
  '/partnerships', '/faq', '/help-centre', '/contact-us', '/transport',
  '/content-creators', '/hotels', '/transport-providers', '/travel-agents',
  '/refund-policy', '/privacy-policy', '/cookies-policy',
  '/terms-and-conditions', '/supplier-terms',
])

const STATIC_EXTS = [
  '.xml', '.txt', '.json', '.png', '.jpg', '.jpeg', '.svg', '.gif',
  '.webp', '.ico', '.css', '.js', '.woff', '.woff2', '.ttf', '.eot',
]

function isBot(ua) {
  if (!ua) return false
  const lower = ua.toLowerCase()
  return BOT_AGENTS.some((b) => lower.includes(b))
}

function shouldSkip(pathname) {
  return SKIP_PATHS.some((p) => pathname.startsWith(p))
}

function isStatic(pathname) {
  return STATIC_EXTS.some((ext) => pathname.endsWith(ext))
}

export default function middleware(request) {
  const url = new URL(request.url)
  const pathname = url.pathname
  const ua = request.headers.get('user-agent') || ''

  // Let static files pass through
  if (isStatic(pathname)) return

  // Bot detection: rewrite to prerender endpoint
  if (request.method === 'GET' && isBot(ua) && !shouldSkip(pathname)) {
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
  if (request.method === 'GET' && !pathname.includes('.')) {
    const indexUrl = new URL('/index.html', request.url)
    return new Response(null, {
      status: 200,
      headers: {
        'x-middleware-rewrite': indexUrl.toString(),
      },
    })
  }
}
