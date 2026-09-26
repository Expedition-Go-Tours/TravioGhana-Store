/**
 * Hover/focus route-chunk warmup for footer navigation.
 *
 * Footer links are same-tab SPA navigations; warming the destination chunk on
 * pointer-over/focus means the route renders without a Suspense flash. Each
 * path is fetched at most once and failures are swallowed — a warmup must never
 * affect navigation.
 */

const routePrefetchers: Record<string, () => Promise<unknown>> = {
  '/help-centre': () => import('../pages/HelpCentrePage'),
  '/contact-us': () => import('../pages/ContactUsPage'),
  '/faq': () => import('../pages/FAQPage'),
  '/about-us': () => import('../pages/AboutUsPage'),
  '/careers': () => import('../pages/CareersPage'),
  '/partnerships': () => import('../pages/PartnershipsPage'),
  '/foundation': () => import('../pages/FoundationPage'),
  '/supplier-terms': () => import('../pages/SupplierTermsPage'),
  '/content-creators': () => import('../pages/ContentCreatorsPage'),
  '/supplier/list-experience': () => import('../pages/supplier/ListExperiencePage'),
  '/supplier/register': () => import('../pages/supplier/SupplierRegisterPage'),
  '/hotels': () => import('../pages/HotelsProviderPage'),
  '/travel-agents': () => import('../pages/TravelAgentsPage'),
  '/transport-providers': () => import('../pages/TransportProviderPage'),
  '/tours': () => import('../pages/AllToursPage'),
  '/blog': () => import('../pages/BlogPage'),
  '/terms-and-conditions': () => import('../pages/TermsAndConditionsPage'),
  '/privacy-policy': () => import('../pages/PrivacyPolicyPage'),
  '/refund-policy': () => import('../pages/RefundPolicyPage'),
  '/cookies-policy': () => import('../pages/CookiesPolicyPage'),
}

const warmed = new Set<string>()

export function prefetchRouteChunk(path: string): void {
  if (warmed.has(path)) return
  const load = routePrefetchers[path]
  if (!load) return
  warmed.add(path)
  load().catch(() => {
    /* best-effort warmup — ignore failures */
  })
}
