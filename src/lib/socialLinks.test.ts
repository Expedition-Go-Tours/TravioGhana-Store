import { describe, expect, it } from 'vitest'

import {
  addedSocialPlatforms,
  buildSocialUrl,
  extractHandle,
  platformForStoreKey,
  sanitizeSocialLinks,
  SOCIAL_PLATFORMS,
} from './socialLinks'

describe('social links', () => {
  it('exposes the same platforms/keys the supplier platform settings screen stores', () => {
    expect(SOCIAL_PLATFORMS.map((platform) => platform.storeKey)).toEqual([
      'twitter',
      'instagram',
      'facebook',
      'tiktok',
      'youtube',
      'linkedin',
      'whatsapp',
      'pinterest',
    ])
    expect(platformForStoreKey('twitter')?.name).toBe('X')
    expect(platformForStoreKey('instagram')?.prefix).toBe('https://instagram.com/')
    expect(platformForStoreKey('nope')).toBeUndefined()
  })

  it('round-trips a handle through the URL helpers', () => {
    const instagram = platformForStoreKey('instagram')!
    expect(buildSocialUrl(instagram, '@expeditiongo')).toBe('https://instagram.com/expeditiongo')
    expect(extractHandle(instagram, 'https://instagram.com/expeditiongo/')).toBe('expeditiongo')
    expect(extractHandle(instagram, undefined)).toBe('')
  })

  it('sanitizes drafts/payloads down to known platform keys', () => {
    expect(
      sanitizeSocialLinks({
        instagram: ' https://instagram.com/expeditiongo ',
        twitter: '',
        evil: 'https://example.com',
        facebook: 42,
      })
    ).toEqual({ instagram: 'https://instagram.com/expeditiongo' })
    expect(sanitizeSocialLinks(null)).toEqual({})
    expect(sanitizeSocialLinks('nope')).toEqual({})
  })

  it('lists added platforms in display order', () => {
    expect(
      addedSocialPlatforms({ twitter: 'https://x.com/a', youtube: 'https://youtube.com/@b' }).map((p) => p.name)
    ).toEqual(['X', 'YouTube'])
    expect(addedSocialPlatforms(undefined)).toEqual([])
  })
})
