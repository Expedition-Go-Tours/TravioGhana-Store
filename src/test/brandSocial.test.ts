import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BRAND_SOCIAL_PROFILES, BRAND_SOCIAL_URLS } from '../lib/brandSocial'
import { buildOrganizationSchema, buildProductSchema, buildItemListSchema, withOrganization } from '../components/SEO'

/**
 * A brand's `sameAs` and its footer links are the same claim made twice.
 *
 * They had drifted into naming the Expedition-Go brand's accounts, and into
 * disagreeing with each other and with the backend's brand config as well —
 * three files, three different Instagram handles, all of them someone else's.
 * A crawler reading them is told Travio Ghana is a different company depending
 * on which page it lands on.
 *
 * The test that matters is the first one: the accounts have to be Travio
 * Ghana's. Everything else here stops them drifting again.
 */

const ROOT = resolve(__dirname, '..', '..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')

/** The platform each handle must live on, so one can't be pasted into another. */
const EXPECTED_HOSTS: Record<string, string> = {
  instagram: 'www.instagram.com',
  tiktok: 'www.tiktok.com',
  youtube: 'www.youtube.com',
}

describe('brand social profiles', () => {
  it('points at the real Travio Ghana accounts', () => {
    expect(BRAND_SOCIAL_PROFILES).toEqual({
      instagram: { label: 'Instagram', url: 'https://www.instagram.com/travioghana' },
      tiktok: { label: 'TikTok', url: 'https://www.tiktok.com/@travio.ghana' },
      youtube: { label: 'YouTube', url: 'https://www.youtube.com/@TravioGhana' },
    })
  })

  it('keeps every profile on its own platform, over https', () => {
    for (const [key, profile] of Object.entries(BRAND_SOCIAL_PROFILES)) {
      const url = new URL(profile.url)
      expect(url.protocol, `${key} must be https`).toBe('https:')
      expect(url.host, `${key} is on the wrong network`).toBe(EXPECTED_HOSTS[key])
      // No tracking params or fragments — these get shared and read as links.
      expect(url.search, `${key} carries query params`).toBe('')
      expect(url.hash, `${key} carries a fragment`).toBe('')
    }
  })

  it('names no other brand', () => {
    // The regression this file exists for: every previous value was an
    // Expedition-Go account, and `ExpeditionGoTravelandToursLTD` is easy to
    // paste back in because it looks like ours.
    for (const url of BRAND_SOCIAL_URLS) {
      expect(url, 'brand social URL names another brand').not.toMatch(/expeditiongo/i)
    }
  })

  it('declares no account that does not exist', () => {
    // A placeholder handle in `sameAs` is worse than an absent one: it is a
    // broken link the brand is actively asserting ownership of.
    for (const url of BRAND_SOCIAL_URLS) {
      const { pathname } = new URL(url)
      expect(pathname.replace(/^\//, ''), 'handle looks like a placeholder').not.toBe('')
      expect(url, 'unresolved template placeholder').not.toMatch(/<|>|undefined|\$\{/)
    }
  })
})

describe('sameAs agrees with the brand profiles', () => {
  const sameAs = buildOrganizationSchema().sameAs as string[]

  it('includes every brand profile', () => {
    for (const url of BRAND_SOCIAL_URLS) {
      expect(sameAs, `${url} is missing from sameAs`).toContain(url)
    }
  })

  it('names no other brand', () => {
    for (const url of sameAs) {
      expect(url, 'sameAs still names another brand').not.toMatch(/expeditiongo/i)
    }
  })

  it('has no duplicates, which would waste a slot in the entity', () => {
    expect(new Set(sameAs).size).toBe(sameAs.length)
  })

  it('is a list of absolute https URLs', () => {
    for (const url of sameAs) {
      expect(() => new URL(url)).not.toThrow()
      expect(url.startsWith('https://')).toBe(true)
    }
  })
})

/**
 * A tour page has no top-level Organization, so the nested `brand` (and the
 * offer's `seller`) is the only place the brand is named. Left as a bare name
 * they tied to nothing, and 32 tour pages — the most numerous on the site —
 * carried no social identity at all. Mirrors `brandOrganization` in the
 * backend's prerenderController.
 */
describe('the product schema names the brand', () => {
  const product = buildProductSchema({
    title: 'Kakum Canopy Walk',
    description: 'Walk the canopy.',
    image: 'https://www.travioghana.com/canopy.jpg',
    price: 45,
    currency: 'USD',
    slug: 'kakum-canopy-walk',
  }) as {
    brand: { name: string; sameAs?: string[] }
    offers: { seller: { name: string; sameAs?: string[] } }
  }

  it('gives the product brand the brand profiles', () => {
    expect(product.brand.name).toBe('Travio Ghana')
    expect(product.brand.sameAs).toEqual([...BRAND_SOCIAL_URLS])
  })

  it('gives the offer seller them too, so both references resolve', () => {
    expect(product.offers.seller.name).toBe('Travio Ghana')
    expect(product.offers.seller.sameAs).toEqual([...BRAND_SOCIAL_URLS])
  })

  it('names no other brand', () => {
    const json = JSON.stringify(product)
    expect(json).not.toMatch(/expeditiongo/i)
    expect(json).toContain('travioghana')
  })
})

/**
 * A list of tours has nowhere to carry the brand: `sameAs` exists only on
 * Organization/Person/WebSite. `publisher` is the correct slot — ItemList
 * inherits from CreativeWork, and a publisher is a CreativeWork's Organization.
 * Without it, the storefront's listing pages named no brand at all.
 */
describe('the list schema names its publisher', () => {
  const list = buildItemListSchema([
    { name: 'Accra City Tour', url: 'https://www.travioghana.com/tour/accra-1/accra-city-tour' },
    { name: 'Kwame Nkrumah Tour', url: 'https://www.travioghana.com/tour/accra-2/nkrumah' },
  ]) as unknown as {
    numberOfItems: number
    itemListElement: unknown[]
    publisher: { '@type': string; name: string; sameAs: string[] }
  }

  it('publishes the list under the brand, with its profiles', () => {
    expect(list.publisher['@type']).toBe('Organization')
    expect(list.publisher.name).toBe('Travio Ghana')
    expect(list.publisher.sameAs).toEqual([...BRAND_SOCIAL_URLS])
  })

  it('leaves the count and entries untouched', () => {
    // The publisher must not disturb the count/entries pairing the structured
    // data validator checks.
    expect(list.numberOfItems).toBe(2)
    expect(list.itemListElement).toHaveLength(2)
  })

  it('names no other brand', () => {
    expect(JSON.stringify(list.publisher)).not.toMatch(/expeditiongo/i)
  })
})

/**
 * The Organization is no longer a page's responsibility.
 *
 * It used to be a per-page opt-in: three pages passed `buildOrganizationSchema()`
 * in their `jsonLd`, eighteen did not. So 18 of the 22 static pages in the
 * sitemap — every policy page, /faq, /contact-us, and all six stories — named
 * the brand's logo and nothing else: no `sameAs`, no entity, nothing to connect
 * them to. A page that forgets an optional prop fails silently and invisibly,
 * which is how this keeps happening.
 *
 * These tests cover the injection itself, because that is the only place the
 * guarantee can now live.
 */
describe('every page gets the Organization', () => {
  const organization = () => buildOrganizationSchema()

  it('adds it to a page that passes nothing at all', () => {
    // The policy pages: BreadcrumbList is the only schema most of them emit.
    expect(withOrganization(undefined)).toEqual([organization()])
  })

  it('adds it alongside a single schema', () => {
    const breadcrumb = { '@type': 'BreadcrumbList', itemListElement: [] }
    expect(withOrganization(breadcrumb)).toEqual([organization(), breadcrumb])
  })

  it('adds it alongside an array, keeping order', () => {
    const a = { '@type': 'BreadcrumbList' }
    const b = { '@type': 'FAQPage' }
    expect(withOrganization([a, b])).toEqual([organization(), a, b])
  })

  it('drops a caller-supplied Organization rather than duplicating it', () => {
    // Two identical nodes is noise a validator flags. A page that still opts in
    // gets the same result as one that does not.
    const result = withOrganization([organization(), { '@type': 'BreadcrumbList' }])
    expect(result).toEqual([organization(), { '@type': 'BreadcrumbList' }])
    expect(result.filter((s) => s['@type'] === 'Organization')).toHaveLength(1)
  })

  it('leaves nothing without the brand behind', () => {
    // The single property that makes it an entity, not just a logo.
    for (const schema of withOrganization({ '@type': 'Article' })) {
      if (schema['@type'] === 'Organization') {
        expect(schema.sameAs, 'the injected Organization has no sameAs').toEqual(
          expect.arrayContaining([...BRAND_SOCIAL_URLS]),
        )
      }
    }
  })
})

/**
 * The story pages are generated as standalone HTML by a .cjs build script, so
 * they never reach the React `SEO` component that now injects the Organization
 * everywhere else. They carry their own copies of the brand, which is why they
 * were the last page type asserting a publisher that connected to nothing.
 *
 * A .cjs script cannot import a TypeScript module, so the list is necessarily
 * written twice. These tests are the tie between the two copies.
 */
describe('the story generator agrees with the brand module', () => {
  const generator = read('scripts/generate-story-pages.cjs')

  it('declares the same profiles the shared module does', () => {
    const body = generator.match(/const BRAND_SAME_AS = \[(.*?)\]/s)?.[1] ?? ''
    // Single-quoted, so pull the literals rather than handing them to JSON.
    const list = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(list.length, 'could not read BRAND_SAME_AS out of the generator').toBeGreaterThan(0)
    expect(list, 'the generator\\u2019s sameAs has drifted from brandSocial.ts').toEqual([
      ...BRAND_SOCIAL_URLS,
    ])
  })

  it('gives the Article publisher and the hub ItemList the brand', () => {
    expect(generator).toMatch(/publisher: brandOrganization\(\)/)
    // Once for the Article, once for the /stories hub ItemList.
    expect(generator.match(/brandOrganization\(\)/g)).toHaveLength(3)
  })

  it('no longer hand-rolls a publisher that names no profile', () => {
    const handRolled = generator.match(/'@type': 'Organization',[\s\S]{0,400}?\n\s*\}/g) ?? []
    for (const block of handRolled) {
      expect(block, 'a hand-rolled Organization has no sameAs').toContain('sameAs')
    }
  })
})

describe('footer links agree with the schema', () => {
  const footer = read('src/components/Footer.tsx')

  it('reads its handles from the shared module rather than hardcoding them', () => {
    expect(footer).toMatch(/import \{ BRAND_SOCIAL_PROFILES \} from '\.\.\/lib\/brandSocial'/)
    for (const key of Object.keys(BRAND_SOCIAL_PROFILES)) {
      expect(footer, `${key} href is not wired to the module`).toMatch(
        new RegExp(`href: BRAND_SOCIAL_PROFILES\\.${key}\\.url`),
      )
    }
  })

  it('carries no hardcoded social handle to drift', () => {
    // The literal URLs are what drifted. Only the unconfirmed Facebook page and
    // the Tripadvisor review profile are still allowed to be inline.
    const hardcoded = footer.match(/https?:\/\/(www\.)?(instagram|tiktok|youtube)\.[^'"]*/g) ?? []
    expect(hardcoded, 'a social handle is hardcoded in the footer').toEqual([])
  })

  it('still links every brand profile, so nothing is dropped from the UI', () => {
    for (const key of Object.keys(BRAND_SOCIAL_PROFILES)) {
      expect(footer, `footer lost its ${key} link`).toMatch(
        new RegExp(`key: '${key}'[\\s\\S]{0,120}?href: BRAND_SOCIAL_PROFILES\\.${key}\\.url`),
      )
    }
  })
})
