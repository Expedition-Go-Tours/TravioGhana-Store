/**
 * Travio Ghana's own social profiles — the single source of truth.
 *
 * The footer links and the Organization schema's `sameAs` have to name the same
 * profiles. When they don't, the entity's signals split across two sets and a
 * crawler is told the brand is two different companies. They had drifted three
 * ways, all of them wrong:
 *
 *   footer  instagram.com/expeditiongotours, tiktok.com/@expeditiongotours,
 *           youtube.com/c/ExpeditionGoTravelandToursLTD   ← Expedition-Go's
 *   schema  instagram.com/expeditiongotours, …same as footer
 *   backend instagram.com/travioGhanatours                 ← and a third handle
 *
 * Every one of those was another brand's account. The prerenderer's brand
 * config already states the rule they broke: "Travio Ghana has no X/Twitter
 * profile — omit twitter:site rather than point at another brand's account."
 * `sameAs` was doing exactly that.
 *
 * Only accounts that exist are listed. Travio Ghana has no X profile, so none
 * is declared, and no placeholder is emitted for it — a `sameAs` entry that
 * 404s is worse than an absent one.
 *
 * Facebook is deliberately not here. Its page is shared with the Expedition-Go
 * brand under two different slugs and neither is confirmed, so it stays inline
 * at each call site rather than being blessed in this file. Move it in once
 * there is a Travio Ghana page of its own to point at.
 *
 * Not to be confused with `socialLinks.ts`, which holds *prefix templates* for
 * building a supplier's own URL from a handle.
 */

export const BRAND_SOCIAL_PROFILES = {
  instagram: { label: 'Instagram', url: 'https://www.instagram.com/travioghana' },
  tiktok: { label: 'TikTok', url: 'https://www.tiktok.com/@travio.ghana' },
  youtube: { label: 'YouTube', url: 'https://www.youtube.com/@TravioGhana' },
} as const

export type BrandSocialKey = keyof typeof BRAND_SOCIAL_PROFILES

/** The `sameAs` list, in the order the schema should declare it. */
export const BRAND_SOCIAL_URLS: readonly string[] = Object.values(BRAND_SOCIAL_PROFILES).map(
  (profile) => profile.url,
)
