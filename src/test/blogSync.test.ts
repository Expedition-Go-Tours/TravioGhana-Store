import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BLOG_API_BASE,
  fetchArticleBySlug,
  fetchPublishedArticles,
  fetchRelatedArticles,
  resolveBlogApiBase,
  type BlogArticleSummary,
} from '../lib/blogApi'
import { ApiError } from '../lib/api'
import { articleToCard, mapApiCategories } from '../pages/BlogPage'

const jsonResponse = (payload: unknown, { ok = true, status = 200 } = {}) =>
  ({ ok, status, json: async () => payload }) as Response

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('blog API base', () => {
  it('never puts blog routes under the brand prefix', () => {
    expect(resolveBlogApiBase('https://apiv1.travioafrica.com/api/travioghana')).toBe(
      'https://apiv1.travioafrica.com/api',
    )
    expect(resolveBlogApiBase('https://apiv1.travioafrica.com/api/travioghana/')).toBe(
      'https://apiv1.travioafrica.com/api',
    )
  })

  it('leaves a plain API base alone', () => {
    expect(resolveBlogApiBase('https://apiv1.travioafrica.com/api')).toBe(
      'https://apiv1.travioafrica.com/api',
    )
    expect(BLOG_API_BASE.endsWith('/travioghana')).toBe(false)
  })
})

describe('fetchPublishedArticles', () => {
  it('unwraps the list envelope and hits the shared /blog/articles route', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ status: 'success', data: { articles: [] } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchPublishedArticles()).resolves.toEqual([])
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('/blog/articles?')
    expect(url).not.toContain('/travioghana/blog')
  })

  it('surfaces API failures as ApiError with the status attached', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse({ message: 'boom' }, { ok: false, status: 500 }))

    await expect(fetchPublishedArticles()).rejects.toThrowError(ApiError)
    await expect(fetchPublishedArticles()).rejects.toMatchObject({ status: 500 })
  })
})

describe('fetchArticleBySlug', () => {
  const article = { id: 'a1', slug: 'hello-ghana', title: 'Hello Ghana' }

  it('returns the detail article', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse({ status: 'success', data: { article } }))

    await expect(fetchArticleBySlug('hello-ghana')).resolves.toEqual(article)
  })

  it('treats a 404 as a not-found ApiError', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse({ message: 'Article not found' }, { ok: false, status: 404 }))

    await expect(fetchArticleBySlug('nope')).rejects.toMatchObject({ status: 404 })
  })

  it('treats a successful-but-empty payload as not found (never renders a blank page)', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse({ status: 'success', data: {} }))

    await expect(fetchArticleBySlug('nope')).rejects.toMatchObject({ status: 404 })
  })
})

describe('fetchRelatedArticles', () => {
  it('reads the related list endpoint and tolerates a missing list', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ status: 'success', data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchRelatedArticles('a1')).resolves.toEqual([])
    expect(String(fetchMock.mock.calls[0][0])).toContain('/blog/articles/a1/related?')
  })
})

const summary = (overrides: Partial<BlogArticleSummary> = {}): BlogArticleSummary => ({
  id: 'a1',
  title: 'Morning at Kakum',
  slug: 'morning-at-kakum',
  excerpt: 'Walking the canopy before the crowds arrive.',
  featuredImage: 'https://res.cloudinary.com/demo/kakum.jpg',
  category: null,
  tags: [],
  author: null,
  status: 'PUBLISHED',
  publishedAt: '2026-06-12T10:00:00.000Z',
  readTime: null,
  locale: 'en',
  viewCount: 0,
  createdAt: '2026-06-10T10:00:00.000Z',
  ...overrides,
})

describe('mapApiCategories', () => {
  it('passes curated slugs through as-is', () => {
    expect(mapApiCategories(summary({ category: { id: 'c', name: 'Nature', slug: 'nature' } }))).toEqual({
      categories: ['nature'],
      label: 'Nature',
    })
  })

  it('maps free-form admin slugs onto the filter keys', () => {
    expect(
      mapApiCategories(summary({ category: { id: 'c', name: 'Adventure Travel', slug: 'adventure-travel' } })).categories,
    ).toEqual(['adventure'])
    expect(
      mapApiCategories(summary({ category: { id: 'c', name: 'Cultural Tours', slug: 'cultural-tours' } })).categories,
    ).toEqual(['culture'])
  })

  it('keeps an unmapped topic honest: listed under All, claiming nothing', () => {
    expect(mapApiCategories(summary({ category: { id: 'c', name: 'Destinations', slug: 'destinations' } }))).toEqual({
      categories: [],
      label: 'Destinations',
    })
  })

  it('falls back to tags when the article has no category', () => {
    const result = mapApiCategories(
      summary({ tags: [{ id: 't', name: 'Wildlife Safari', slug: 'wildlife-safari' }] }),
    )
    expect(result.categories).toContain('nature')
    expect(result.label).toBeNull()
  })
})

describe('articleToCard', () => {
  it('links to the /blog detail route and brands an admin-authored card', () => {
    const card = articleToCard(summary({ category: { id: 'c', name: 'Food', slug: 'food' } }))

    expect(card.href).toBe('/blog/morning-at-kakum')
    expect(card.key).toBe('article:morning-at-kakum')
    expect(card.image).toBe('https://res.cloudinary.com/demo/kakum.jpg')
    expect(card.date).toBe('June 12, 2026')
    expect(card.author).toBe('Travio Ghana Team')
    expect(card.readTime).toBe(4)
    expect(card.categoryLabel).toBe('Food')
  })

  it('falls back to the branded placeholder when no featured image is set', () => {
    const card = articleToCard(summary({ featuredImage: null }))
    expect(card.image).toBe('/og-default.png')
  })
})
