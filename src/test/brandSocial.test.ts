import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BRAND_SOCIAL_PROFILES, BRAND_SOCIAL_URLS } from '../lib/brandSocial'
import { buildOrganizationSchema } from '../components/SEO'

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
