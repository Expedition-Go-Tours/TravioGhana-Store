import { describe, it, expect, vi } from 'vitest'
import type { Page } from 'puppeteer'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// Typed by scripts/prerender-static.d.mts — the build script itself is plain .mjs
// and sits outside every tsconfig include.
import {
  dedupeTitle,
  relativizeOrigin,
  installApiProxy,
  isInventoryRoute,
  isApiRequest,
  toOrigin,
  resolveApiOrigins,
  prerenderApiOrigins,
  DEFAULT_API_ORIGIN,
  readDotEnvValue,
  routeProblems,
} from '../../scripts/prerender-static.mjs'

/**
 * A stand-in for a Puppeteer page: records the interception flag, keeps the
 * request handler so a test can drive it, and logs which requests were passed
 * through untouched. Lets the proxy be tested as behaviour rather than as a
 * regex over its own source.
 */
function fakePage(respond: RespondSpy) {
  const continued: string[] = []
  let handler: ((request: unknown) => void) | null = null
  const page = {
    interception: false,
    continued,
    async setRequestInterception(value: boolean) {
      this.interception = value
    },
    on(event: string, fn: (request: unknown) => void) {
      if (event === 'request') handler = fn
    },
    async fire(url: string) {
      handler?.({
        url: () => url,
        headers: () => ({ accept: 'application/json' }),
        continue: async () => {
          continued.push(url)
        },
        respond,
      })
      // The handler is async; flush its microtask chain before asserting.
      await new Promise((r) => setTimeout(r, 0))
    },
  }
  return page
}

/** What installApiProxy hands to request.respond(), plus the recorded call. */
interface ProxyResponse {
  status: number
  headers?: Record<string, string>
  contentType?: string
  body?: Buffer | string
}
type RespondSpy = ReturnType<typeof vi.fn<(r: ProxyResponse) => Promise<void>>>

/** The double satisfies the two Page members the proxy touches, and no more. */
const asPage = (page: ReturnType<typeof fakePage>) => page as unknown as Page

/**
 * Guards the one prerender failure that must never be silent.
 *
 * The prerender runs during `npm run build`. It originally caught every error
 * — including "no browser" — warned, and exited 0, on the reasoning that the
 * backend prerenderer would cover the gap. That reasoning is sound for a single
 * thin or broken route, and wrong for the browser itself: with no browser,
 * *every* route is skipped, dist/__seo/ is empty, and the deploy silently
 * reinstates the thin-content bug the prerender exists to remove.
 *
 * It did in fact go green that way in production, and was caught only by
 * reading the live word count. A build that cannot prerender has to be red.
 *
 * These assertions read the source rather than launching a browser, so they
 * stay fast and deterministic; the behaviour itself was verified by running the
 * script against an empty browser cache and against an unlaunchable binary.
 */
const ROOT = resolve(__dirname, '..', '..')
const source = readFileSync(resolve(ROOT, 'scripts/prerender-static.mjs'), 'utf8')

describe('prerender browser failure handling', () => {
  it('exits non-zero when no browser strategy works', () => {
    // The top-level catch must special-case the browser failure and exit 1,
    // rather than falling through to the warn-and-continue branch.
    expect(source).toMatch(/instanceof BrowserUnavailableError/)
    expect(source).toMatch(/process\.exit\(1\)/)
  })

  it('still fails soft for everything else, since the backend is the fallback', () => {
    // A per-route problem (thin page, API blip) must not block a release.
    expect(source).toMatch(/continuing without static prerender/)
    expect(source).not.toMatch(/process\.exit\(1\)[^\n]*\n\s*\}\)\n\s*process\.exit/)
  })

  it('installs a browser when none is present, independent of npm install scripts', () => {
    // npm 11 blocks puppeteer's postinstall (the Chrome download) behind
    // allowScripts, so the build must be able to fetch a browser itself.
    expect(source).toMatch(/browsers', 'install'/)
  })

  it('installs the shared libraries a slim CI image lacks', () => {
    // A downloaded Chrome exits 127 on Vercel's image without libnss3/atk/gbm.
    expect(source).toMatch(/installSystemDeps/)
    expect(source).toMatch(/libnss3|libnss/)
    expect(source).toMatch(/libgbm1|mesa-libgbm/)
  })

  it('offers an explicit opt-out rather than failing by accident', () => {
    expect(source).toMatch(/PRERENDER_SKIP/)
  })
})

/**
 * index.html ships a static fallback <title>, and Helmet adds the real one
 * without removing it, so the serialised head carried two. Crawlers were being
 * handed a generic second title for pages whose whole point is their snippet.
 */
describe('dedupeTitle', () => {
  const FALLBACK = 'Ghana Tours &amp; Activities | Discover Experiences'
  const head = (inner: string) => `<html><head>${inner}</head><body></body></html>`

  it('preserves comment boundaries and leaves the real page visible', () => {
    const shell = readFileSync(resolve('index.html'), 'utf8')
    const input = shell.replace('<div id="root"></div>', '<div id="root"><h1>Book Ghana tours</h1></div>')
      .replace('</head>', '<title>Second title</title></head>')
    const output = dedupeTitle(input, 'Travio Ghana')
    const page = new DOMParser().parseFromString(output, 'text/html')
    expect(page.querySelectorAll('title')).toHaveLength(1)
    expect(page.title).toBe('Travio Ghana')
    expect(page.querySelector('h1')?.textContent).toBe('Book Ghana tours')
    expect(page.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe('/icons/v2/favicon.ico')
  })

  it('keeps only the first title, the one document.title reported', () => {
    const out = dedupeTitle(
      head(`<title>Real Page Title</title><title>${FALLBACK}</title>`),
      'Real Page Title'
    )
    expect(out.match(/<title>/g)).toHaveLength(1)
    expect(out).toContain('<title>Real Page Title</title>')
    expect(out).not.toContain(FALLBACK)
  })

  it('drops every extra title when more than two are present', () => {
    const out = dedupeTitle(
      head(`<title>One</title><title>Two</title><title>${FALLBACK}</title>`),
      'One'
    )
    expect(out.match(/<title>/g)).toHaveLength(1)
  })

  it('is a no-op when the page has a single title', () => {
    const input = head('<title>Only One</title>')
    expect(dedupeTitle(input, 'Only One')).toBe(input)
  })

  it('does not let a title break out of its own tag', () => {
    const out = dedupeTitle(head('<title>a</title>'), '</title><script>x</script>')
    expect(out).toContain('&lt;/title&gt;')
    expect(out).not.toContain('<script>')
  })
})

/**
 * The homepage was being published with zero tour cards.
 *
 * Root cause: the content API's CORS allowlist is an exact match on the two
 * production domains. The prerender serves from `http://127.0.0.1:<port>`, so
 * every tour request came back 200 and was then withheld from JavaScript for
 * lack of an `Access-Control-Allow-Origin`. Sections mounted, showed skeletons,
 * resolved to nothing. The reviews section rendered anyway from bundled JSON,
 * which is why the capture cleared the 120-word gate and looked healthy.
 *
 * These cover the gate and the proxy's origin matching, which are the two parts
 * that can silently rot back into the same failure.
 */
/**
 * Vite's runtime-injected module preloads and stylesheets are built from the
 * document's current origin, which during the prerender is the ephemeral
 * `http://127.0.0.1:<port>`. The published HTML therefore carried dead asset
 * URLs: 38 on the homepage, ten of them stylesheets.
 */
describe('relativizeOrigin', () => {
  const ORIGIN = 'http://127.0.0.1:52362'

  it('strips the preview origin from injected asset links', () => {
    const out = relativizeOrigin(
      `<link rel="stylesheet" href="${ORIGIN}/assets/index-BwLbjj3P.css">` +
        `<link rel="modulepreload" href="${ORIGIN}/assets/api-DPqydpem.js">`,
      ORIGIN
    )
    expect(out).toContain('href="/assets/index-BwLbjj3P.css"')
    expect(out).toContain('href="/assets/api-DPqydpem.js"')
    expect(out).not.toContain('127.0.0.1')
  })

  it('rewrites every occurrence, not just the first', () => {
    // The homepage had 38; a single-replace implementation fixes one.
    const html = Array.from({ length: 38 }, (_, i) => `<link href="${ORIGIN}/assets/c${i}.js">`).join('')
    const out = relativizeOrigin(html, ORIGIN)
    expect(out).not.toContain('127.0.0.1')
    expect(out.match(/href="\/assets\//g)).toHaveLength(38)
  })

  it('leaves the canonical, og:url and hreflang alone', () => {
    // These name the production origin and are correct as written. Swapping the
    // host would be far worse than the bug being fixed.
    const out = relativizeOrigin(
      '<link rel="canonical" href="https://www.travioghana.com/">' +
        '<meta property="og:url" content="https://www.travioghana.com/">' +
        '<link rel="alternate" hreflang="en" href="https://www.travioghana.com/">',
      ORIGIN
    )
    expect(out).toContain('<link rel="canonical" href="https://www.travioghana.com/">')
    expect(out).toContain('content="https://www.travioghana.com/"')
    expect(out).toContain('hreflang="en" href="https://www.travioghana.com/"')
  })

  it('leaves third-party absolute URLs on other hosts untouched', () => {
    const out = relativizeOrigin(
      '<img src="https://images.example.com/a.jpg"><script src="https://cdn.example.com/b.js"></script>',
      ORIGIN
    )
    expect(out).toContain('https://images.example.com/a.jpg')
    expect(out).toContain('https://cdn.example.com/b.js')
  })

  it('does not match a different port on the same host', () => {
    // The port is ephemeral, so a stale file may carry a previous build's port.
    // Rewriting on the host alone would mangle an unrelated absolute URL.
    const out = relativizeOrigin('<img src="http://127.0.0.1:1111/x.jpg">', ORIGIN)
    expect(out).toContain('http://127.0.0.1:1111/x.jpg')
  })

  it('is a no-op for a page with no injected links', () => {
    const input = '<html><head><title>T</title></head><body></body></html>'
    expect(relativizeOrigin(input, ORIGIN)).toBe(input)
  })

  it('runs on the written HTML, in that order with the title fix', () => {
    // Both are post-processing on the same string; relativizeOrigin must not
    // undo dedupeTitle, and neither may be dropped from the chain.
    const route = source.slice(source.indexOf('async function renderRoute'), source.indexOf('function writeRoute'))
    expect(route).toMatch(/relativizeOrigin\(dedupeTitle\(result\.html, result\.title\), origin\)/)
  })
})

describe('prerender inventory gate', () => {
  const HEALTHY = {
    words: 1200,
    h1: ['Ghana Tours'],
    canonical: 'https://www.travioghana.com/',
    description: 'desc',
    robots: 'index, follow',
    cards: 24,
    tourLinks: 24,
  }

  it('only holds the homepage to an inventory requirement', () => {
    // The other 21 routes are marketing/legal pages with no tours on them;
    // holding them to a card count would skip the entire prerender.
    expect(isInventoryRoute('/')).toBe(true)
    for (const route of ['/about-us', '/faq', '/privacy-policy', '/careers']) {
      expect(isInventoryRoute(route)).toBe(false)
    }
  })

  it('passes a homepage that captured real product cards', () => {
    expect(routeProblems('/', HEALTHY)).toEqual([])
  })

  it('rejects a homepage whose words are fine but whose inventory is empty', () => {
    // The exact production state: 1,062 words from nav, footer and 1,199
    // bundled reviews, and not one tour.
    const problems = routeProblems('/', { ...HEALTHY, words: 1062, cards: 0, tourLinks: 0 })
    expect(problems).toContain('no product cards captured')
  })

  it('does not require cards on a route that has none to show', () => {
    expect(routeProblems('/about-us', { ...HEALTHY, cards: 0, tourLinks: 0 })).toEqual([])
  })

  it('still applies the pre-existing checks', () => {
    expect(routeProblems('/', { ...HEALTHY, words: 10 })).toContain('thin (10 words < 120)')
    expect(routeProblems('/', { ...HEALTHY, h1: [] })).toContain('no <h1>')
    expect(routeProblems('/', { ...HEALTHY, canonical: '' })).toContain('no canonical')
    expect(routeProblems('/', { ...HEALTHY, description: '' })).toContain('no meta description')
    expect(routeProblems('/', { ...HEALTHY, robots: 'noindex, follow' })).toContain('robots=noindex, follow')
  })

  it('fails the build when an inventory route is skipped', () => {
    // Skipping the file alone would just restore the thin backend fallback and
    // go green again — the failure mode this gate exists to end.
    // Scoped to the tail from the check itself: a bare source-wide process.exit
    // assertion is satisfied by the unrelated no-browser exit, and the failure
    // message would be satisfied by the comment explaining this bug.
    const tail = source.slice(source.indexOf('const emptyInventory'))
    expect(tail).toMatch(/if \(emptyInventory\.length\)/)
    expect(tail).toMatch(/process\.exit\(1\)/)
  })

  it('waits for real product cards before capturing an inventory route', () => {
    // The fixed 1,200ms settle was the original bug: the carousels mount on
    // scroll and then need another round trip, so a capture taken on a timer
    // catches them empty.
    const route = source.slice(source.indexOf('async function renderRoute'), source.indexOf('function writeRoute'))
    expect(route).toMatch(/if \(requireCards\)/)
    expect(route).toMatch(/waitForFunction[\s\S]{0,200}\.tour-card/)
  })

  it('installs the API proxy before it navigates', () => {
    // After goto() the page has already made its API calls, and interception
    // would arrive too late to matter.
    const route = source.slice(source.indexOf('async function renderRoute'), source.indexOf('function writeRoute'))
    expect(route.indexOf('installApiProxy(')).toBeGreaterThan(-1)
    expect(route.indexOf('installApiProxy(')).toBeLessThan(route.indexOf('page.goto('))
  })

  it('passes the gate and the origins from main into the render', () => {
    expect(source).toMatch(/apiOrigins,\s*\n\s*requireCards: isInventoryRoute\(route\),/)
  })
})

describe('prerender API proxy', () => {
  it('matches the API origin from a base URL that carries a path', () => {
    // VITE_API_URL is a base with /api/travioghana on the end, not a bare host.
    const origins = resolveApiOrigins(['https://apiv1.travioafrica.com/api/travioghana'])
    expect([...origins]).toEqual(['https://apiv1.travioafrica.com'])
    expect(isApiRequest('https://apiv1.travioafrica.com/api/travioghana/tours', origins)).toBe(true)
  })

  it('proxies only the API, so fonts and CDNs keep loading normally', () => {
    const origins = resolveApiOrigins(['https://apiv1.travioafrica.com'])
    expect(isApiRequest('https://fonts.gstatic.com/s/x.woff2', origins)).toBe(false)
    expect(isApiRequest('https://www.googletagmanager.com/gtm.js', origins)).toBe(false)
  })

  it('treats a same-path request on another host as not the API', () => {
    // Host is the whole of CORS origin, so the path must not carry the match.
    const origins = resolveApiOrigins(['https://apiv1.travioafrica.com'])
    expect(isApiRequest('https://evil.example.com/api/travioghana/tours', origins)).toBe(false)
  })

  it('does not proxy a lookalike host that merely contains the API host', () => {
    // The failure a substring match invites: proxying a request addressed to a
    // host that only looks like ours, and answering it with our allow-origin.
    const origins = resolveApiOrigins(['https://apiv1.travioafrica.com'])
    expect(isApiRequest('https://apiv1.travioafrica.com.attacker.test/tours', origins)).toBe(false)
    expect(isApiRequest('https://notapiv1.travioafrica.com.example/tours', origins)).toBe(false)
  })

  it('reads the API base out of a .env file, quoted or not', () => {
    const text = [
      'VITE_AUTH_PROVIDER=',
      '# Travio Ghana API',
      'VITE_API_URL="https://apiv1.travioafrica.com/api/travioghana"',
      'VITE_MAPBOX_ACCESS_TOKEN=pk.abc',
    ].join('\n')
    expect(readDotEnvValue(text, 'VITE_API_URL')).toBe('https://apiv1.travioafrica.com/api/travioghana')
    expect(readDotEnvValue(text, 'VITE_MAPBOX_ACCESS_TOKEN')).toBe('pk.abc')
    expect(readDotEnvValue(text, 'VITE_MISSING')).toBeUndefined()
    expect(readDotEnvValue(text, 'VITE_AUTH_PROVIDER')).toBeUndefined()
  })

  it('answers a failed proxy fetch with 502, never with a plausible empty body', () => {
    // Falling back to request.continue() would let the browser redo the
    // CORS-blocked fetch and reproduce the original silent failure.
    const proxy = source.slice(source.indexOf('async function installApiProxy'), source.indexOf('function audit'))
    // Comments stripped: the explanation of this very bug names continue(),
    // and a source-text assertion must not be satisfied or tripped by prose.
    const code = proxy
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
      .join('\n')
    expect(code).toMatch(/status: 502/)
    // The only continue() allowed is the pass-through for non-API requests.
    // One inside a .catch() would be the silent-fallback bug.
    expect(code.replace(/request\.continue\(\)\.catch\(\(\) => \{\}\)/g, '')).not.toMatch(/request\.continue\(\)/)
  })

  it('re-labels the local origin on the response it proxies', () => {
    expect(source).toMatch(/\['access-control-allow-origin'\] = pageOrigin/)
  })

  it('proxies an API request with the real body and a local allow-origin', async () => {
    // Behavioural, not a source match: a fake page captures the handler, then
    // drives it. This is what proves the proxy is actually wired up, which a
    // regex over the source cannot.
    const realFetch = globalThis.fetch
    globalThis.fetch = async () =>
      new Response('{"tours":[{"id":"t1"}]}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    try {
      const respond = vi.fn<(r: ProxyResponse) => Promise<void>>(async () => {})
      const page = fakePage(respond)
      const origins = resolveApiOrigins(['https://apiv1.travioafrica.com/api/travioghana'])
      await installApiProxy(asPage(page), origins, 'http://127.0.0.1:41999')

      expect(page.interception).toBe(true)
      await page.fire('https://apiv1.travioafrica.com/api/travioghana/tours')

      expect(respond).toHaveBeenCalledTimes(1)
      const arg = respond.mock.calls[0]![0]
      expect(arg.status).toBe(200)
      expect(arg.headers!['access-control-allow-origin']).toBe('http://127.0.0.1:41999')
      expect(arg.body!.toString()).toBe('{"tours":[{"id":"t1"}]}')
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('lets non-API requests through untouched', async () => {
    const respond = vi.fn<(r: ProxyResponse) => Promise<void>>(async () => {})
    const page = fakePage(respond)
    const origins = resolveApiOrigins(['https://apiv1.travioafrica.com'])
    await installApiProxy(asPage(page), origins, 'http://127.0.0.1:41999')

    await page.fire('https://fonts.gstatic.com/s/x.woff2')

    expect(respond).not.toHaveBeenCalled()
    expect(page.continued).toEqual(['https://fonts.gstatic.com/s/x.woff2'])
  })

  it('answers 502 when the API itself is unreachable', async () => {
    const realFetch = globalThis.fetch
    globalThis.fetch = async () => {
      throw new Error('ECONNREFUSED')
    }
    try {
      const respond = vi.fn<(r: ProxyResponse) => Promise<void>>(async () => {})
      const page = fakePage(respond)
      const origins = resolveApiOrigins(['https://apiv1.travioafrica.com'])
      await installApiProxy(asPage(page), origins, 'http://127.0.0.1:41999')

      await page.fire('https://apiv1.travioafrica.com/api/travioghana/tours')

      expect(respond).toHaveBeenCalledTimes(1)
      expect(respond.mock.calls[0]![0].status).toBe(502)
      expect(page.continued).toEqual([])
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('does not claim a local allow-origin on an API error response', async () => {
    // An error status must stay error-shaped. Adding the allow-origin to a 404
    // body would turn a failed request into a parsed-but-empty catalogue.
    const realFetch = globalThis.fetch
    globalThis.fetch = async () => new Response('nope', { status: 404 })
    try {
      const respond = vi.fn<(r: ProxyResponse) => Promise<void>>(async () => {})
      const page = fakePage(respond)
      await installApiProxy(asPage(page), resolveApiOrigins(['https://apiv1.travioafrica.com']), 'http://127.0.0.1:41999')

      await page.fire('https://apiv1.travioafrica.com/api/travioghana/tours')

      expect(respond.mock.calls[0]![0].status).toBe(404)
      expect(respond.mock.calls[0]![0].headers?.['access-control-allow-origin']).toBeUndefined()
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('ignores junk origins instead of failing the build on them', () => {
    expect([...resolveApiOrigins([undefined, '', 'not a url', '   '])]).toEqual([])
    expect(toOrigin('not a url')).toBeNull()
    expect(toOrigin(undefined)).toBeNull()
  })
})

/**
 * The homepage prerender failed on Vercel because the script resolved no API
 * origin at all: no .env (gitignored, so absent on a build machine) and
 * VITE_API_URL never set as a project env var. With no origin the proxy could
 * not forward the product calls, the page captured zero cards, and the
 * inventory gate failed the build.
 *
 * These are written as the CI condition rather than as a general property,
 * because the general property is what made the bug invisible in the first
 * place: reading env from inside the function would have been untestable.
 */
describe('picking the API origin in a build environment', () => {
  const CI = { env: {}, dotEnv: '' }

  it('still resolves the production API when nothing at all is set', () => {
    // The exact state of a Vercel build machine before the fallback existed.
    expect([...prerenderApiOrigins(CI)]).toEqual([DEFAULT_API_ORIGIN])
  })

  it('resolves something that is a usable origin, not just any string', () => {
    const [origin] = [...prerenderApiOrigins(CI)]
    expect(toOrigin(origin)).toBe(DEFAULT_API_ORIGIN)
  })

  it('prefers an explicit PRERENDER_API_ORIGIN over the default', () => {
    const origins = prerenderApiOrigins({
      env: { PRERENDER_API_ORIGIN: 'https://staging.example.com' },
      dotEnv: '',
    })
    expect(origins.has('https://staging.example.com')).toBe(true)
    expect(origins.has(DEFAULT_API_ORIGIN)).toBe(true)
  })

  it('prefers VITE_API_URL over the default', () => {
    const origins = prerenderApiOrigins({
      env: { VITE_API_URL: 'https://api.example.com/api/travioghana' },
      dotEnv: '',
    })
    expect(origins.has('https://api.example.com')).toBe(true)
  })

  it('reads a local .env when the environment says nothing', () => {
    const dotEnv = 'VITE_API_URL="https://local.example.com/api/travioghana"\n'
    const origins = prerenderApiOrigins({ env: {}, dotEnv })
    expect(origins.has('https://local.example.com')).toBe(true)
  })

  it('keeps the default when .env holds junk instead of a URL', () => {
    const origins = prerenderApiOrigins({ env: {}, dotEnv: 'VITE_API_URL=not a url\n' })
    expect([...origins]).toEqual([DEFAULT_API_ORIGIN])
  })

  it('agrees with the sitemap script, whose step kept passing on Vercel', () => {
    // generate-sitemap.cjs fell back to this same host. If the two drift, the
    // sitemap can advertise tours the prerender never captured, and the gate
    // stays green about it.
    const sitemap = readFileSync(
      resolve(__dirname, '..', '..', 'scripts', 'generate-sitemap.cjs'),
      'utf8',
    )
    expect(sitemap).toContain(DEFAULT_API_ORIGIN)
  })
})
