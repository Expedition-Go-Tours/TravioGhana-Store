/**
 * Social media platforms for a supplier's public business profile.
 *
 * Ported from the supplier platform settings screen
 * (`TravioGhana-Supplier/src/features/settings/components/socialPlatforms.js`)
 * so the registration form stores the same keys in `businessInfo`:
 * each platform keeps a full URL under `storeKey`, and the "X" platform keeps
 * the legacy `twitter` key so previously-saved profiles and the public site
 * keep working.
 */

export interface SocialPlatform {
  /** `businessInfo` key the full URL is stored under. */
  storeKey: string
  name: string
  prefix: string
  /** Brand colour for the icon tile. */
  color: string
  /** Placeholder/validation hint for the handle part. */
  hint: string
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { storeKey: 'twitter', name: 'X', prefix: 'https://x.com/', color: '#000000', hint: 'your username' },
  { storeKey: 'instagram', name: 'Instagram', prefix: 'https://instagram.com/', color: '#E4405F', hint: 'your username' },
  { storeKey: 'facebook', name: 'Facebook', prefix: 'https://facebook.com/', color: '#1877F2', hint: 'your page or username' },
  { storeKey: 'tiktok', name: 'TikTok', prefix: 'https://www.tiktok.com/@', color: '#000000', hint: 'your @username' },
  { storeKey: 'youtube', name: 'YouTube', prefix: 'https://youtube.com/@', color: '#FF0000', hint: 'your channel handle' },
  { storeKey: 'linkedin', name: 'LinkedIn', prefix: 'https://www.linkedin.com/in/', color: '#0A66C2', hint: 'your profile slug' },
  { storeKey: 'whatsapp', name: 'WhatsApp', prefix: 'https://wa.me/', color: '#25D366', hint: 'international number, e.g. 233241234567' },
  { storeKey: 'pinterest', name: 'Pinterest', prefix: 'https://www.pinterest.com/', color: '#BD081C', hint: 'your username' },
]

export type SocialLinks = Record<string, string>

export function platformForStoreKey(storeKey: string): SocialPlatform | undefined {
  return SOCIAL_PLATFORMS.find((platform) => platform.storeKey === storeKey)
}

/** Extract the handle part from a stored URL for a given platform. */
export function extractHandle(platform: SocialPlatform, url?: string): string {
  if (!url) return ''
  return url.replace(platform.prefix, '').replace(/\/+$/, '')
}

/** Build the full URL from a platform prefix + handle. */
export function buildSocialUrl(platform: SocialPlatform, handle: string): string {
  return `${platform.prefix}${handle.trim().replace(/^@/, '')}`
}

/** Platforms that currently have a link, in the canonical display order. */
export function addedSocialPlatforms(links: SocialLinks | undefined): SocialPlatform[] {
  if (!links) return []
  return SOCIAL_PLATFORMS.filter((platform) => Boolean(links[platform.storeKey]))
}

/**
 * Keep only known platform keys with non-empty string values — drafts and the
 * submission payload never carry anything else.
 */
export function sanitizeSocialLinks(links: unknown): SocialLinks {
  if (!links || typeof links !== 'object') return {}
  const source = links as Record<string, unknown>
  const out: SocialLinks = {}
  for (const platform of SOCIAL_PLATFORMS) {
    const value = source[platform.storeKey]
    if (typeof value === 'string' && value.trim()) out[platform.storeKey] = value.trim()
  }
  return out
}
