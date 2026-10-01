import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_IMAGE_SIZES,
  OPTIMIZED_QUALITY,
  OPTIMIZED_WIDTHS,
  optimizedLocalSrcSet,
} from '@/lib/image'

const ROOT = resolve(__dirname, '..', '..')
const BUNDLED = '/assets/hero-2-b6UGMurk.webp'

const candidatesOf = (srcSet: string) => srcSet.split(', ')
const widthsOf = (srcSet: string) =>
  candidatesOf(srcSet).map((c) => parseInt(c.split(' ')[1], 10))

describe('optimizedLocalSrcSet', () => {
  it('offers every configured width the source can fill', () => {
    const srcSet = optimizedLocalSrcSet(BUNDLED, 1920)!
    const candidates = candidatesOf(srcSet)

    expect(widthsOf(srcSet)).toEqual([...OPTIMIZED_WIDTHS])
    expect(candidates).toHaveLength(3)
    expect(candidates.every((c) => c.includes(`q=${OPTIMIZED_QUALITY}`))).toBe(true)
    expect(candidates.every((c) => c.startsWith('/_vercel/image?'))).toBe(true)
    expect(candidates.map((c) => c.split(' ')[1])).toEqual(['640w', '1080w', '1600w'])
  })

  it('never offers a width wider than the source (it would upscale)', () => {
    // 1350×900 hero-2: 1600w would upscale by 19% — more bytes, no more detail.
    expect(widthsOf(optimizedLocalSrcSet(BUNDLED, 1350)!)).toEqual([640, 1080])
    expect(widthsOf(optimizedLocalSrcSet(BUNDLED, 720)!)).toEqual([640])
    expect(widthsOf(optimizedLocalSrcSet(BUNDLED, 640)!)).toEqual([640])
  })

  it('gives up on sources too small to be worth transforming', () => {
    // Vercel advises against spending transformation quota on small images, and
    // a transform below the smallest width would be a no-op resize.
    expect(optimizedLocalSrcSet(BUNDLED, 600)).toBeNull()
    expect(optimizedLocalSrcSet(BUNDLED, 307)).toBeNull()
    expect(optimizedLocalSrcSet(BUNDLED, 0)).toBeNull()
    expect(optimizedLocalSrcSet(BUNDLED, -1)).toBeNull()
  })

  it('gives up rather than guess when the intrinsic width is unknown', () => {
    expect(optimizedLocalSrcSet(BUNDLED)).toBeNull()
    expect(optimizedLocalSrcSet(BUNDLED, undefined)).toBeNull()
    expect(optimizedLocalSrcSet(BUNDLED, null)).toBeNull()
    expect(optimizedLocalSrcSet(BUNDLED, 'not-a-number')).toBeNull()
  })

  it('accepts width as a string, since JSX attributes arrive both ways', () => {
    expect(widthsOf(optimizedLocalSrcSet(BUNDLED, '1920')!)).toEqual([...OPTIMIZED_WIDTHS])
    expect(optimizedLocalSrcSet(BUNDLED, '600')).toBeNull()
  })

  it('percent-encodes the source path so the query string survives', () => {
    const srcSet = optimizedLocalSrcSet('/assets/hero 2+weird-abc.webp', 1920)!
    // Each candidate is "<url> <descriptor>". The URL half must carry no raw
    // space or `+` — either would corrupt the `url=` parameter on the wire.
    const candidates = candidatesOf(srcSet)
    expect(candidates).toHaveLength(OPTIMIZED_WIDTHS.length)
    for (const candidate of candidates) {
      const [url] = candidate.split(' ')
      expect(url).not.toContain(' ')
      expect(url).toContain(encodeURIComponent('/assets/hero 2+weird-abc.webp'))
      expect(url).toContain('%20')
      expect(url).toContain('%2B')
    }
  })

  it('refuses SVG (Vercel rejects it unless dangerouslyAllowSVG is set)', () => {
    // TravioGhana_Logo.svg lives under /assets/ like everything else.
    expect(optimizedLocalSrcSet('/assets/TravioGhana_Logo-kn-0zcNZ.svg', 1920)).toBeNull()
    expect(optimizedLocalSrcSet('/assets/icon.SVG?foo=1', 1920)).toBeNull()
  })

  it('stays silent outside production, where /_vercel/image does not exist', () => {
    // `vite dev` and `vite preview` serve the SPA shell for any unrecognised
    // path. A srcset candidate resolving to HTML doesn't degrade the image, it
    // breaks it: once a candidate is selected the browser will not fall back to
    // `src`. So dev must render the original file instead.
    expect(optimizedLocalSrcSet(BUNDLED, 1920, false)).toBeNull()
    expect(optimizedLocalSrcSet(BUNDLED, 600, false)).toBeNull()
    // Default is enabled, so tests and production builds opt in by doing nothing.
    expect(optimizedLocalSrcSet(BUNDLED, 1920)).not.toBeNull()
    expect(optimizedLocalSrcSet(BUNDLED, 1920, true)).not.toBeNull()
  })

  it('leaves remote hosts alone — they have their own transform', () => {
    expect(optimizedLocalSrcSet('https://res.cloudinary.com/x/y/upload/v1/z.jpg', 1920)).toBeNull()
    expect(optimizedLocalSrcSet('https://theroyalsenchi.com/x.jpg', 1920)).toBeNull()
    // A relative path outside /assets/ (public/ files) is not hashed, and is
    // already small; leave it as-is too.
    expect(optimizedLocalSrcSet('/images/office.webp', 1920)).toBeNull()
  })

  it('returns null for empty input so callers fall back to a plain <img>', () => {
    expect(optimizedLocalSrcSet(null, 1920)).toBeNull()
    expect(optimizedLocalSrcSet(undefined, 1920)).toBeNull()
    expect(optimizedLocalSrcSet('', 1920)).toBeNull()
  })

  it('advertises a sizes descriptor for the default layout', () => {
    expect(DEFAULT_IMAGE_SIZES).toContain('100vw')
    expect(DEFAULT_IMAGE_SIZES).toContain('768px')
  })
})

describe('optimization config stays in step with vercel.json', () => {
  const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8'))

  it('declares the images API at all', () => {
    // Without this block `/_vercel/image` falls through to the SPA shell.
    expect(vercel.images).toBeDefined()
    expect(vercel.images.localPatterns).toEqual([{ pathname: '^/assets/.*$', search: '' }])
  })

  it('offers exactly the widths the client asks for', () => {
    // A width in code but not config makes /_vercel/image error instead of
    // serving; a width in config but not code is dead quota.
    expect(vercel.images.sizes).toEqual([...OPTIMIZED_WIDTHS])
  })

  it('offers exactly the quality the client asks for', () => {
    expect(vercel.images.qualities).toEqual([OPTIMIZED_QUALITY])
  })

  it('caches transforms for as long as the hashed source is immutable', () => {
    expect(vercel.images.minimumCacheTTL).toBeGreaterThanOrEqual(31536000)
  })

  it('does not open up remote origins we have not audited', () => {
    expect(vercel.images.domains).toEqual([])
  })
})
