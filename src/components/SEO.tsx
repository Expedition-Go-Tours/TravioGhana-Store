import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'
import { BRAND_SOCIAL_URLS } from '../lib/brandSocial'
import { returnPolicyNode, shippingDetailsNode } from '../lib/seo/returnPolicy'
import { tourPath } from '../lib/tourPath'

const SITE_NAME = 'Travio Ghana'
// The incorporated company behind the brand — deliberately not a second copy of
// SITE_NAME. `schema.org/legalName` asks for the name the business is
// *registered* under, not the trading name it trades under, so both belong here
// side by side.
//
// Google's guidance for sites that don't surface for their own brand is that
// when other brands or sellers share a similar name, it may lean on the full
// legal company name to confirm which site is the real one — and that stating it
// on the about/contact pages helps. This site already printed it in the footer
// and on every legal page since launch ("© … Travio Ghana by Expedition-Go Tours
// Ltd"); what was missing was the structured form of the same claim, which is
// the form a knowledge panel acts on.
//
// The literal is also repeated ~140 times across `src/` (every policy page,
// bookingTour.ts, the supplier forms) with no shared constant behind them. This
// is the copy the schema reads, not yet the single source for all of them.
const LEGAL_NAME = 'Expedition-Go Tours Ltd'
const HOMEPAGE_TITLE = 'Ghana Tours & Activities | Discover Experiences | Book & Explore'
const DEFAULT_TITLE = 'Ghana Tours & Experiences | Book Authentic African Adventures'
const DEFAULT_DESCRIPTION = 'Discover authentic Ghana tours and experiences. Book cultural tours, wildlife safaris, food tours, and adventure activities across Accra, Cape Coast, Volta Region, and more. Free cancellation, best prices guaranteed.'
// Canonical host. MUST match the domain the site actually serves (the other
// host must redirect to this one). Configurable via VITE_SITE_URL so switching
// hosts is an env change, not a code change.
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://www.travioghana.com').replace(/\/+$/, '')
// Default social card. Must be a real, crawlable asset at the fixed size the
// prerender advertises (og:image:width/height) — the old Cloudinary hero had
// been deleted upstream, so every share card fell back to a broken image.
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`

interface SEOProps {
  title?: string
  description?: string
  keywords?: string
  image?: string
  url?: string
  type?: 'website' | 'product' | 'article'
  canonical?: string
  robots?: string
  /** Product-specific */
  price?: { amount: string; currency: string }
  /** Article-specific */
  publishedTime?: string
  modifiedTime?: string
  author?: string
  /**
   * JSON-LD structured data (raw object or array of objects).
   *
   * The Organization is added to this automatically — it is not this prop's
   * job, and never was a page's job to remember. See `withOrganization`.
   */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
  /** Alternate language URLs for hreflang */
  alternateLocales?: { lang: string; href: string }[]
  /**
   * Optional page hero to preload (`<link rel="preload" as="image">`). Pass
   * the hashed asset URL of the page's LCP image so the browser starts it at
   * head-parse time instead of discovering it further down the body.
   */
  preloadImage?: string
}

/**
 * The Organization node, on every page.
 *
 * It used to be a per-page opt-in: three pages passed `buildOrganizationSchema()`
 * in their `jsonLd` and the other eighteen did not, so 18 of the 22 static
 * pages in the sitemap named the brand's logo and nothing else — no `sameAs`,
 * no entity. A page that forgets an optional prop is invisible, which is
 * exactly how the three-competing-Instagram-handles drift got started.
 *
 * So it is no longer optional. Pages describe what is *on* them; this describes
 * who publishes all of it.
 *
 * A caller-supplied Organization is dropped rather than duplicated: two
 * identical nodes in one array is noise a validator flags and a reader has to
 * reconcile.
 */
export function withOrganization(
  jsonLd?: Record<string, unknown> | Record<string, unknown>[],
): Record<string, unknown>[] {
  const rest = (Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : []).filter(
    (schema) => schema['@type'] !== 'Organization',
  )
  return [buildOrganizationSchema(), ...rest]
}

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  canonical,
  robots = 'index, follow',
  price,
  publishedTime,
  modifiedTime,
  author,
  jsonLd,
  alternateLocales,
  preloadImage,
}: SEOProps) {
  const location = useLocation()

  const isDefaultHomepage = location.pathname === '/' && !title
  const fullTitle = isDefaultHomepage
    ? HOMEPAGE_TITLE
    : title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | ${DEFAULT_TITLE}`
  // `place` is the only query parameter that names a real page: /tours?place=Accra
  // is its own destination and its own sitemap entry, and the prerendered copy
  // self-canonicalises to it. Every other parameter (filters, sort, tracking) is
  // a view of the same list and collapses to the bare path. Dropping `place` here
  // meant the hydrated head and the served HTML disagreed about the canonical of
  // every destination URL — the same URL claiming two different owners.
  const place = new URLSearchParams(location.search).get('place')
  const indexableSearch = place ? `?place=${encodeURIComponent(place)}` : ''
  const currentUrl = url || `${SITE_URL}${location.pathname}${indexableSearch}`
  const canonicalUrl = canonical || `${SITE_URL}${location.pathname}${indexableSearch}`
  const ogImage = image?.startsWith('http') ? image : `${SITE_URL}${image}`

  return (
    <Helmet>
      {/* Primary */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonicalUrl} />
      <meta name="robots" content={robots} />
      {/* Discovered at head-parse time rather than when the <img> mounts. */}
      {preloadImage && <link rel="preload" as="image" href={preloadImage} fetchPriority="high" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Product-specific OG */}
      {price && (
        <>
          <meta property="og:price:amount" content={price.amount} />
          <meta property="og:price:currency" content={price.currency} />
        </>
      )}

      {/* Article-specific */}
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      {author && <meta property="article:author" content={author} />}

      {/* Hreflang */}
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
      <link rel="alternate" hrefLang="en" href={canonicalUrl} />
      {alternateLocales?.map(({ lang, href }) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={href} />
      ))}

      {/* JSON-LD Structured Data. The Organization is injected, not optional. */}
      {withOrganization(jsonLd).map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  )
}

// ── Reusable JSON-LD builders ────────────────────────────────────────

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    // Distinct from `name`: the registered entity rather than the trading brand.
    // Same claim the footer prints in words.
    legalName: LEGAL_NAME,
    url: SITE_URL,
    // Must resolve: /src/... paths never survive the build (404 for Google).
    // ImageObject with the intrinsic size, matching what the prerender serves.
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/logo.png`,
      width: 512,
      height: 512,
    },
    // Same profile list the footer renders and the prerender publishes — a
    // schema that names a different set than the crawler-facing one splits the
    // entity's signals. These were three accounts belonging to the
    // Expedition-Go brand; see `lib/brandSocial` for the full account of it.
    sameAs: [
      // No Facebook, and the absence is deliberate.
      //
      // This brand has no Facebook page of its own. The URL that used to be
      // here was not a near-miss — it was the parent company's page, which
      // `sameAs` rendered as "Travio Ghana and Expedition Go Tours LTD are the
      // same entity". Facebook's /p/ form is `name-slug-<numeric page id>`: the
      // id is authoritative, the name is cosmetic, and both slugs in
      // circulation carried id 61567042001418 and served the same page, titled
      // "Expedition Go Tours LTD | Accra".
      //
      // A wrong sameAs is worse than a missing one. An absent profile is an
      // absence; a wrong one is a falsehood in the field a knowledge panel acts
      // on. The footer still links the page, which is honest — linking somewhere
      // the business controls is not claiming to own it.
      //
      // To restore this, create a real Travio Ghana page and add it to
      // `lib/brandSocial.ts` and to the backend's BRANDS config. One list or
      // the other drifts, which is how this happened.
      ...BRAND_SOCIAL_URLS,
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['English', 'French', 'Spanish', 'German', 'Dutch'],
    },
  }
}

export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/tours?place={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * The brand entity for a product, with the social profiles that connect it to
 * the brand. A tour page has no top-level Organization of its own, so this
 * nested node is the only place a crawler learns who sells the tour — and a
 * bare name ties to nothing. Mirrors `brandOrganization` in the backend's
 * prerenderController; the two must agree.
 */
function brandOrganization(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    name: SITE_NAME,
    sameAs: [...BRAND_SOCIAL_URLS],
  }
}

/**
 * `Product.brand` is typed `Brand | Organization` in schema.org, but Google's
 * merchant-listing report validates the field against `Brand` and returns
 * "Invalid object type for field 'brand'" for an Organization — which is what
 * every tour page was sending. The offer's `seller` and a CreativeWork's
 * `publisher` are genuinely Organization slots, so only this one node changes
 * type. `sameAs` stays: `Brand` inherits it from `Thing`, and dropping it would
 * cost the tour pages their only link back to the brand's profiles.
 */
function brandNode(): Record<string, unknown> {
  return {
    '@type': 'Brand',
    name: SITE_NAME,
    sameAs: [...BRAND_SOCIAL_URLS],
  }
}

export function buildProductSchema(tour: {
  title: string
  description: string
  image: string
  price: number
  currency: string
  ratingValue?: number
  reviewCount?: number
  slug: string
  id?: string
  city?: string
  region?: string
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: tour.title,
    description: tour.description?.slice(0, 500),
    image: tour.image,
    url: tour.id
      ? `${SITE_URL}/tour/${encodeURIComponent(tour.id)}/${encodeURIComponent(tour.slug)}`
      : `${SITE_URL}/tour/${tour.slug}`,
    brand: brandNode(),
    offers: {
      '@type': 'Offer',
      price: tour.price,
      priceCurrency: tour.currency || 'USD',
      availability: 'https://schema.org/InStock',
      seller: brandOrganization(),
      // These two MUST stay identical to what the backend prerenderer emits for
      // the same URL (`prerenderController.js` → `returnPolicyNode` /
      // `shippingDetailsNode`). Tour pages are served to crawlers as
      // prerendered HTML carrying the backend's copy, and this block is what
      // takes over on hydration — so if the two disagree, the same page
      // advertises two different refund policies depending on whether the
      // visitor runs JavaScript. See `src/lib/seo/returnPolicy.ts` for the
      // canonical values and why they are what they are.
      hasMerchantReturnPolicy: returnPolicyNode(),
      shippingDetails: shippingDetailsNode(),
    },
  }

  if (tour.ratingValue && tour.reviewCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: tour.ratingValue,
      reviewCount: tour.reviewCount,
      bestRating: 5,
      worstRating: 1,
    }
  }

  return schema
}

export function buildArticleSchema(article: {
  title: string
  description: string
  image: string
  url: string
  publishedTime: string
  modifiedTime?: string
  author?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description?.slice(0, 500),
    image: article.image,
    url: article.url,
    datePublished: article.publishedTime,
    dateModified: article.modifiedTime || article.publishedTime,
    author: { '@type': 'Person', name: article.author || SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME },
  }
}

export function buildItemListSchema(items: { name: string; url: string; image?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    // `sameAs` exists only on Organization/Person/WebSite, so the brand's
    // profiles have no slot on a list. ItemList inherits from CreativeWork,
    // whose `publisher` takes an Organization — the only place a listing page
    // can name the brand it is publishing. Mirrors the backend's
    // buildItemListSchema equivalent in prerenderController.
    publisher: brandOrganization(),
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: item.url,
      ...(item.image && { image: item.image }),
    })),
  }
}

/**
 * The homepage's catalogue, as structured data.
 *
 * The homepage is the landing page for the brand query, and it was publishing
 * 51 cards, 130 price elements and 33 crawlable tour links with only
 * Organization and WebSite in its JSON-LD. Every rating the visitor can read was
 * absent from the structured data, so the page could not qualify for a rating
 * treatment even with the reviews it carries.
 *
 * Items are `Product` rather than bare `ListItem`s, because a `ListItem` with
 * only a name and URL tells a crawler nothing it did not already get from the
 * HTML. `Product` carries the offer and the rating, which is the part that is
 * worth stating twice.
 *
 * The same tour can appear in several homepage sections (top-rated and
 * sell-out routinely overlap), so entries are de-duplicated by id and the
 * richest copy kept — otherwise one tour would be listed two or three times at
 * different positions.
 */
export function buildHomepageItemListSchema(
  tours: {
    id: string
    title: string
    slug: string
    coverPhoto?: string | null
    averageRating?: number | null
    reviewCount?: number
    startingPrice?: number | null
    currency?: string
    city?: string | null
  }[]
) {
  const seen = new Map<string, (typeof tours)[number]>()
  for (const tour of tours) {
    if (!tour?.id || !tour.title) continue
    const existing = seen.get(tour.id)
    // Keep whichever copy carries more: a section that projects price and
    // rating beats one that does not.
    if (!existing || score(tour) > score(existing)) seen.set(tour.id, tour)
  }

  const items = [...seen.values()]
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Ghana tours and experiences',
    numberOfItems: items.length,
    publisher: brandOrganization(),
    itemListElement: items.map((tour, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: tour.title,
        url: `${SITE_URL}${tourPath(tour.id, tour.slug)}`,
        // Every tour here is a Travio Ghana tour, so the brand is never in
        // doubt — leaving it off is what got 23 of these Products flagged as
        // having no brand at all, since a Product with no brand cannot be
        // attributed to the merchant whose refund policy the offer below
        // declares.
        brand: brandNode(),
        ...(tour.coverPhoto && { image: tour.coverPhoto }),
        ...(tour.city && { description: `${tour.title} in ${tour.city}, Ghana` }),
        offers: {
          '@type': 'Offer',
          // No price means no Offer. A zero would be a false claim that the
          // tour is free, and a wrong currency is worse than no offer at all.
          ...(tour.startingPrice ? { price: tour.startingPrice, priceCurrency: tour.currency || 'USD' } : {}),
          availability: 'https://schema.org/InStock',
          url: `${SITE_URL}${tourPath(tour.id, tour.slug)}`,
          seller: brandOrganization(),
          // The same policy the tour detail pages publish, from the same
          // builders. These Offers are otherwise a strict subset of what
          // `buildProductSchema` emits, and a homepage entry must not promise
          // a weaker refund policy than the page it links to.
          hasMerchantReturnPolicy: returnPolicyNode(),
          shippingDetails: shippingDetailsNode(),
        },
        // `averageRating && reviewCount` rather than either alone: a rating with
        // no count, or a count of zero, is not an AggregateRating and Google
        // treats a malformed one as a manual-action risk. Mirrors the gate in
        // buildProductSchema.
        ...(tour.averageRating && tour.reviewCount
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: tour.averageRating,
                reviewCount: tour.reviewCount,
                bestRating: 5,
                worstRating: 1,
              },
            }
          : {}),
      },
    })),
  }
}

const score = (tour: { averageRating?: number | null; reviewCount?: number; startingPrice?: number | null }) =>
  (tour.startingPrice ? 1 : 0) + (tour.averageRating && tour.reviewCount ? 1 : 0)

export function buildFAQSchema(questions: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  }
}
