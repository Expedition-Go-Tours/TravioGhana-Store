/**
 * Preview detection for the Ghana storefront.
 *
 * Staging is a Vercel branch deployment pointed at the production API, so a
 * visitor who lands on a preview must be told that bookings and customer data
 * are real. Three independent triggers, checked in this order:
 *
 *   1. VITE_APP_ENV=staging — explicit, set in Vercel's Preview scope
 *   2. the fixed staging domain — allow-listed once for sign-in providers
 *   3. *.vercel.app — every per-branch preview, recognised with no config
 *
 * The hostname checks matter when the Preview scope is empty, which is the
 * usual way previews silently lose their warning. None of the three match
 * localhost, so local development stays quiet.
 *
 * Kept out of PreviewBanner.tsx because a component file may only export
 * components (react-refresh/only-export-components).
 */

export type PreviewReason = 'app-env' | 'staging-domain' | 'vercel-preview'

/** The one permanent staging address. DNS points at Vercel; claim it there. */
export const STAGING_HOSTNAME = 'store-staging.travioghana.com'

export const PREVIEW_BANNER_TEXT =
  'PREVIEW · connected to production data. Bookings here are real.'

export function detectPreview(hostname?: string): PreviewReason | null {
  const host = hostname !== undefined
    ? hostname.toLowerCase()
    : globalThis.location?.hostname || ''

  if (import.meta.env.VITE_APP_ENV === 'staging') return 'app-env'
  if (host === STAGING_HOSTNAME) return 'staging-domain'
  if (host.endsWith('.vercel.app')) return 'vercel-preview'
  return null
}
