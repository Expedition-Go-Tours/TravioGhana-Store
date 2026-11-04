import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The install prompt only fires when the manifest satisfies Chrome's
 * installability criteria. A renamed icon or a dropped `start_url` silently
 * kills it — there is no error to see, the button simply never appears. These
 * assertions hold the manifest to the criteria the browser actually checks.
 */

const ROOT = resolve(__dirname, '..', '..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')

type ManifestIcon = { src?: string; sizes?: string; purpose?: string }

const manifest = JSON.parse(read('public/site.webmanifest')) as {
  name?: string
  short_name?: string
  start_url?: string
  scope?: string
  display?: string
  theme_color?: string
  prefer_related_applications?: boolean
  icons?: ManifestIcon[]
}

describe('site.webmanifest keeps the app installable', () => {
  it('names the app and declares a standalone display', () => {
    expect(manifest.name || manifest.short_name).toBeTruthy()
    expect(['fullscreen', 'standalone', 'minimal-ui', 'window-controls-overlay']).toContain(
      manifest.display,
    )
  })

  it('pins start_url and scope to the site root', () => {
    // Without these an installed shortcut opens whatever page the visitor
    // happened to be on when they installed.
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
  })

  it('has a 192px and a 512px icon, which installability requires', () => {
    const sizes = new Set((manifest.icons ?? []).map((i) => i.sizes))
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  it('ships every icon it declares, non-empty', () => {
    for (const icon of manifest.icons ?? []) {
      const file = resolve(ROOT, 'public', String(icon.src).replace(/^\//, ''))
      expect(existsSync(file), `missing ${icon.src}`).toBe(true)
      expect(statSync(file).size).toBeGreaterThan(0)
    }
  })

  it('never defers install to an app store', () => {
    expect(manifest.prefer_related_applications ?? false).toBe(false)
  })

  it('is the manifest index.html links to', () => {
    expect(read('index.html')).toContain('rel="manifest"')
    expect(read('index.html')).toContain('/site.webmanifest')
  })
})

/**
 * A service worker's fetch is governed by `connect-src`, not `img-src`. The
 * worker caches Cloudinary images, so the CSP has to let the *worker* reach
 * them — without that every cached photo fails with net::ERR_FAILED and the
 * page renders blank (this shipped once; these assertions are the net).
 */
describe('CSP lets the service worker fetch what it caches', () => {
  const csp = (read('vercel.json').match(/"value":\s*"(default-src[^"]+)"/) ?? [])[1] ?? ''
  const directive = (name: string) =>
    (csp.match(new RegExp(`${name}([^;]*)`)) ?? [])[1] ?? ''

  it('reads a Content-Security-Policy out of vercel.json', () => {
    expect(csp).toContain('default-src')
  })

  it('allows the image CDN in connect-src', () => {
    expect(directive('connect-src')).toContain('res.cloudinary.com')
    expect(directive('connect-src')).toContain('*.cloudinary.com')
  })

  it('still shows those same images in the page (img-src)', () => {
    expect(directive('img-src')).toContain('res.cloudinary.com')
  })

  it('allows the worker itself', () => {
    expect(directive('worker-src')).toContain("'self'")
  })
})
