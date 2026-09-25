import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'

const SITE_NAME = 'Travio Ghana'
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
  /** JSON-LD structured data (raw object or array of objects) */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
  /** Alternate language URLs for hreflang */
  alternateLocales?: { lang: string; href: string }[]
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
}: SEOProps) {
  const location = useLocation()

  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${DEFAULT_TITLE} | ${SITE_NAME}`
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

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title || DEFAULT_TITLE} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title || DEFAULT_TITLE} />
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

      {/* JSON-LD Structured Data */}
      {jsonLd && (
        Array.isArray(jsonLd) ? jsonLd : [jsonLd]
      ).map((schema, i) => (
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
    url: SITE_URL,
    // Must resolve: /src/... paths never survive the build (404 for Google).
    // ImageObject with the intrinsic size, matching what the prerender serves.
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/logo.png`,
      width: 512,
      height: 512,
    },
    // Same profile list the prerender publishes — a schema that names a
    // different set than the crawler-facing one splits the entity's signals.
    sameAs: [
      'https://www.facebook.com/p/Travio%20Ghana-Tours-LTD-61567042001418/',
      'https://www.instagram.com/travioGhanatours',
      'https://www.tiktok.com/@expeditiongotours',
      'https://www.youtube.com/c/ExpeditionGoTravelandToursLTD',
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
    brand: { '@type': 'Organization', name: SITE_NAME },
    offers: {
      '@type': 'Offer',
      price: tour.price,
      priceCurrency: tour.currency || 'USD',
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: SITE_NAME },
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
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: item.url,
      ...(item.image && { image: item.image }),
    })),
  }
}

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
