import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The resource pages promise downloads. A renamed asset turns a "Download PNG"
 * button into a 404, which is invisible until a journalist clicks it — the same
 * class of quiet failure the sitemap and prerender tests exist to prevent.
 *
 * These assertions read the page sources and check every `/press/…` and
 * `/badges/…` reference against the filesystem.
 */

const ROOT = resolve(__dirname, '..', '..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')

/** Every `/press/…` or `/badges/…` string literal referenced by a page. */
function assetRefs(source: string): string[] {
  const out = new Set<string>()
  for (const match of source.matchAll(/['"`](\/(?:press|badges)\/[^'"`\s]+)['"`]/g)) {
    out.add(match[1])
  }
  return [...out]
}

describe('resource pages ship the files they advertise', () => {
  const pages = ['src/pages/PressPage.tsx', 'src/pages/PartnerResourcesPage.tsx']

  it.each(pages)('%s references at least one shipped asset', (page) => {
    expect(assetRefs(read(page)).length).toBeGreaterThan(0)
  })

  it.each(pages)('%s: every referenced asset exists in public/ and is not empty', (page) => {
    const missing = assetRefs(read(page)).filter((ref) => {
      const file = resolve(ROOT, 'public', ref.replace(/^\//, ''))
      return !existsSync(file) || statSync(file).size === 0
    })
    expect(missing, `missing or empty assets: ${missing.join(', ')}`).toEqual([])
  })
})

describe('badge SVGs are self-describing', () => {
  const badges = [
    'book-on-travioghana-green',
    'book-on-travioghana-dark',
    'book-on-travioghana-outline',
    'official-booking-partner',
  ]

  it.each(badges)('public/badges/%s.svg has a viewBox, role and title', (name) => {
    const svg = read(`public/badges/${name}.svg`)
    expect(svg).toContain('viewBox=')
    expect(svg).toContain('role="img"')
    expect(svg).toContain('<title>')
  })
})

describe('the two resource pages link to each other', () => {
  it('/press links to the partner toolkit', () => {
    expect(read('src/pages/PressPage.tsx')).toMatch(/to="\/partner-resources"/)
  })

  it('/partner-resources links to the press kit', () => {
    expect(read('src/pages/PartnerResourcesPage.tsx')).toMatch(/to="\/press"/)
  })
})
