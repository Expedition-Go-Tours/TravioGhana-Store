import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import middleware from '../../middleware'

const ROOT = resolve(__dirname, '..', '..')
const origin = 'https://www.travioghana.com'

describe('public URL normalization', () => {
  for (const agent of ['Googlebot', 'Google-InspectionTool', 'Mozilla/5.0']) {
    for (const method of ['GET', 'HEAD']) {
      it(`preserves public links for ${agent} ${method}`, async () => {
        for (const path of [
          '/about-us/', '/tours/?place=Cape%20Coast&utm_source=old-link',
          '/stories/', '/stories/ghana-guide/', '/tour/tour-id/tour-slug/',
          '/tour/old-slug/', '/privacy-policy//',
        ]) {
          const request = new Request(`${origin}${path}`, {
            method, headers: { 'user-agent': agent },
          })
          const result = await middleware(request)
          const target = new URL(request.url)
          target.pathname = target.pathname.replace(/\/+$/, '')
          expect(result?.status).toBe(308)
          expect(result?.headers.get('Location')).toBe(target.toString())
        }
      })
    }
  }

  it('keeps canonical public paths on their existing crawler handlers', async () => {
    const response = async (path: string) => middleware(new Request(`${origin}${path}`, {
      headers: { 'user-agent': 'Google-InspectionTool' },
    }))
    expect((await response('/about-us'))?.headers.get('x-middleware-rewrite'))
      .toBe('/__seo/about-us/index.html')
    expect((await response('/'))?.headers.get('x-middleware-rewrite')).toBe('/__seo/index.html')
    const target = new URL((await response('/tours?place=Accra'))!.headers.get('x-middleware-rewrite')!)
    expect(target.searchParams.get('url')).toBe('/tours?place=Accra')
    expect(target.searchParams.get('host')).toBe('www.travioghana.com')
  })

  it('does not redirect private routes, assets, unknown pages or POST requests', async () => {
    for (const path of ['/dashboard/', '/booking/', '/api/', '/unknown/', '/assets/icon.svg']) {
      expect((await middleware(new Request(`${origin}${path}`)))?.status).not.toBe(308)
    }
    expect(await middleware(new Request(`${origin}/about-us/`, { method: 'POST' }))).toBeUndefined()
  })
})

describe('crawler exclusions apply to every user agent', () => {
  it('publishes a single wildcard group, so named crawlers cannot override exclusions', () => {
    const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf8')
    expect(robots.match(/^User-agent:.*$/gm)).toEqual(['User-agent: *'])
    for (const path of ['/__seo/', '/booking/', '/dashboard/', '/search', '/api/']) {
      expect(robots).toContain(`Disallow: ${path}`)
    }
    expect(robots).toContain(`Sitemap: ${origin}/sitemap.xml`)
  })

  it('the build preserves the same robots rules', () => {
    const script = readFileSync(resolve(ROOT, 'scripts/generate-sitemap.cjs'), 'utf8')
    const template = script.match(/const robots = `([\s\S]*?)`;/)![1]
    expect(template.replace('${SITE_URL}', origin).trim())
      .toBe(readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf8').trim())
  })
})
