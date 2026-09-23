export const config = { runtime: 'nodejs' }

const BOT_AGENTS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
  'yandexbot', 'sogou', 'facebot', 'facebookexternalhit', 'twitterbot',
  'linkedinbot', 'slackbot', 'whatsapp', 'telegrambot', 'applebot',
  'discordbot', 'pinterest', 'redditbot', 'quora', 'viber', 'skype',
  'ia_archiver', 'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot',
  'rogerbot', 'exabot', 'zoominfobot',
]

const SKIP_PATHS = [
  '/dashboard', '/booking', '/auth', '/login', '/api/',
  '/payment-methods', '/supplier/register', '/supplier/list-experience',
]

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
    const prerenderUrl = `https://apiv1.travioafrica.com/api/prerender?url=${encodeURIComponent(target)}`
    return new Response(null, {
      status: 200,
      headers: {
        'x-middleware-rewrite': prerenderUrl,
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
