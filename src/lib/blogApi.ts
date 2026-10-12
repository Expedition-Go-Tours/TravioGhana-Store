import { ApiError } from './api'
import { getApiBaseUrl } from './auth'

/**
 * Public blog API — the admin's publish flow, served by the shared backend.
 *
 * Blog routes live at `/api/blog/...`, NOT under the brand prefix the rest of
 * the storefront calls use (`/api/travioghana/...`): articles are shared
 * content, which is why the admin's axios client leaves `/blog/*` unprefixed
 * too. Deriving the base here (instead of reusing `apiFetch`) keeps that
 * distinction in one place — `apiFetch('/blog/articles')` would 404 against
 * `/api/travioghana/blog/articles`.
 *
 * Plain fetch on purpose: these are public reads, so no Bearer token (which
 * would turn them into CORS preflights) and no 401 refresh dance.
 */
export function resolveBlogApiBase(apiBase: string): string {
  return apiBase.replace(/\/+$/, '').replace(/\/travioghana$/, '')
}

export const BLOG_API_BASE = resolveBlogApiBase(getApiBaseUrl())

/**
 * Stand-in for articles published without a featured image, so cards never
 * render a broken <img>. Branded social card (1200×630) — deliberately
 * generic rather than borrowing a stock photo from an unrelated story.
 */
export const BLOG_PLACEHOLDER_IMAGE = '/og-default.png'

export interface BlogCategory {
  id: string
  name: string
  slug: string
}

export interface BlogAuthor {
  id: string
  name: string
  photoURL: string | null
}

export interface BlogTag {
  id: string
  name: string
  slug: string
}

/** List-shape article (`transformArticle` — no body). */
export interface BlogArticleSummary {
  id: string
  title: string
  slug: string
  excerpt: string
  featuredImage: string | null
  category: BlogCategory | null
  tags: BlogTag[]
  author: BlogAuthor | null
  status: string
  publishedAt: string | null
  readTime: number | null
  locale: string
  viewCount: number
  createdAt: string
}

export interface BlogRelatedTour {
  id: string
  title: string
  slug: string
  coverPhoto: string | null
  category: string | null
  city: string | null
  country: string | null
  startingPrice: number | null
  currency: string | null
  averageRating: number | null
  reviewCount: number
}

export interface BlogArticleAlternateLocale {
  locale: string
  slug: string
}

/** Detail-shape article (`transformArticleDetail` + SEO fields). */
export interface BlogArticleDetail extends BlogArticleSummary {
  body: unknown
  images: string[]
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  relatedTours?: BlogRelatedTour[]
  alternateLocales?: BlogArticleAlternateLocale[]
}

interface ListEnvelope {
  data?: { articles?: BlogArticleSummary[] }
  pagination?: { currentPage?: number; totalPages?: number; totalCount?: number; limit?: number }
}

interface DetailEnvelope {
  data?: { article?: BlogArticleDetail }
}

/** Abort hung API calls so the detail page can't spin forever. */
function requestSignal(): AbortSignal | undefined {
  try {
    return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(10_000)
      : undefined
  } catch {
    return undefined
  }
}

async function blogFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${BLOG_API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
    signal: requestSignal(),
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    // Non-JSON error body (proxy page, truncated response) — status decides.
  }

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message
    throw new ApiError(message || `Blog request failed (${response.status})`, response.status)
  }

  return payload as T
}

/**
 * Published articles, newest first. Deliberately unfiltered by `locale`:
 * the backend matches locale exactly, so asking for `fr` while every article
 * is `en` would empty the feed — better to show all published articles than
 * to silently drop the live section per language.
 */
export async function fetchPublishedArticles(limit = 50): Promise<BlogArticleSummary[]> {
  const page = new URLSearchParams({ page: '1', limit: String(Math.max(1, Math.min(limit, 50))) })
  const payload = await blogFetch<ListEnvelope>(`/blog/articles?${page}`)
  return payload?.data?.articles ?? []
}

export async function fetchArticleBySlug(slug: string): Promise<BlogArticleDetail> {
  const payload = await blogFetch<DetailEnvelope>(`/blog/articles/${encodeURIComponent(slug)}`)
  const article = payload?.data?.article
  if (!article?.slug) {
    throw new ApiError('Article not found', 404)
  }
  return article
}

/** Best-effort: only feeds an extra "more stories" section. */
export async function fetchRelatedArticles(id: string, limit = 3): Promise<BlogArticleSummary[]> {
  const page = new URLSearchParams({ limit: String(Math.max(1, Math.min(limit, 10))) })
  const payload = await blogFetch<ListEnvelope>(`/blog/articles/${encodeURIComponent(id)}/related?${page}`)
  return payload?.data?.articles ?? []
}
