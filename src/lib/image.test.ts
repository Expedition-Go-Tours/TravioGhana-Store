import { describe, it, expect } from 'vitest'
import { transformImage, getSrcSet, lightboxImageUrls, LIGHTBOX_IMAGE } from './image'

const URL_ = 'https://res.cloudinary.com/demo/image/upload/v1790110559/user-photos/portrait.png'
const PREFIX = 'https://res.cloudinary.com/demo/image/upload/'
const SUFFIX = '/v1790110559/user-photos/portrait.png'

describe('transformImage', () => {
  it('crops at the CDN to an exact box with smart gravity (GYG-style)', () => {
    expect(
      transformImage(URL_, {
        width: 566,
        height: 400,
        fit: 'fill',
        gravity: 'auto',
        quality: 'auto:good',
        format: 'auto',
      }),
    ).toBe(`${PREFIX}c_fill,g_auto,w_566,h_400,q_auto:good,f_auto${SUFFIX}`)
  })

  it('supports c_limit so a viewer never upscales a small original', () => {
    expect(transformImage(URL_, { crop: 'limit', width: 1200 })).toBe(
      `${PREFIX}c_limit,w_1200${SUFFIX}`,
    )
  })
})

describe('getSrcSet', () => {
  it('keeps the crop ratio at every breakpoint', () => {
    const srcSet = getSrcSet(URL_, [566, 1132], { width: 566, height: 400, fit: 'fill' })

    expect(srcSet).toBe(
      [
        `${PREFIX}c_fill,w_566,h_400${SUFFIX} 566w`,
        `${PREFIX}c_fill,w_1132,h_800${SUFFIX} 1132w`,
      ].join(', '),
    )
    // Regression: the 2x candidate must not reuse the 1x height.
    expect(srcSet).not.toContain('w_1132,h_400')
  })

  it('leaves height untouched when no crop box was requested', () => {
    const srcSet = getSrcSet(URL_, [400, 800], {})
    expect(srcSet).toBe([`${PREFIX}w_400${SUFFIX} 400w`, `${PREFIX}w_800${SUFFIX} 800w`].join(', '))
  })

  it('returns an empty string without a url', () => {
    expect(getSrcSet('', [400])).toBe('')
  })
})

describe('lightboxImageUrls', () => {
  it('matches exactly what the viewer requests, so prefetches are cache hits', () => {
    const urls = lightboxImageUrls(URL_)!
    const viewerOpts = {
      width: LIGHTBOX_IMAGE.width * 2,
      crop: LIGHTBOX_IMAGE.crop,
      quality: 'auto:good' as const,
      format: 'auto' as const,
    }

    expect(urls.src).toBe(transformImage(URL_, viewerOpts))
    expect(urls.srcSet).toBe(
      getSrcSet(URL_, [LIGHTBOX_IMAGE.width, LIGHTBOX_IMAGE.width * 2], viewerOpts),
    )
    expect(urls.src).toContain('c_limit')
    expect(urls.src).not.toContain('c_fill')
  })

  it('returns null for a missing url', () => {
    expect(lightboxImageUrls(null)).toBeNull()
    expect(lightboxImageUrls(undefined)).toBeNull()
  })
})
