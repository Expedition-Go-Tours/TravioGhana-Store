export type HeroVariant = 'tours' | 'restaurants'

/**
 * The storefront shares one hero shell across verticals. The route decides
 * which copy and search behaviour fills it, so a URL stays shareable and the
 * switch never needs local state to remember the active vertical.
 */
export function heroVariantFromPath(pathname: string): HeroVariant {
  return pathname === '/restaurants' || pathname.startsWith('/restaurants/')
    ? 'restaurants'
    : 'tours'
}

/** True for a storefront vertical root or any page inside one. */
export function isVerticalPath(pathname: string): boolean {
  return pathname === '/' || heroVariantFromPath(pathname) === 'restaurants'
}
