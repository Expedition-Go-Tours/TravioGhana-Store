import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Calendar, ChevronRight, Clock, Share2, Sparkles, Star } from 'lucide-react'
import { ApiError } from '../lib/api'
import {
  BLOG_PLACEHOLDER_IMAGE,
  fetchArticleBySlug,
  fetchRelatedArticles,
  type BlogArticleDetail,
  type BlogArticleSummary,
} from '../lib/blogApi'
import { extractArticleHeadings, headingId } from '../lib/articleHeadings'
import ArticleBody from '../components/ArticleBody'
import Footer from '../components/Footer'
import SEO, { buildArticleSchema, buildBreadcrumbSchema, SITE_URL } from '../components/SEO'
import { tourPath } from '../lib/tourPath'
import OptimizedImage from '@/components/shared/OptimizedImage'
import './articleDetail.css'
import './BlogArticlePage.css'

type Status = 'loading' | 'ready' | 'missing' | 'error'

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  // Results are keyed by the slug they belong to, so `slug` changing derives
  // a fresh "loading" without a synchronous setState inside the effect (the
  // reset happens implicitly until the new fetch lands).
  const [result, setResult] = useState<{ slug: string; article: BlogArticleDetail } | null>(null)
  const [failure, setFailure] = useState<{ slug: string; kind: 'missing' | 'error' } | null>(null)
  const [relatedResult, setRelatedResult] = useState<{ slug: string; items: BlogArticleSummary[] } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const proseRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [slug])

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    fetchArticleBySlug(slug)
      .then((fetched) => {
        if (cancelled) return
        setResult({ slug, article: fetched })
        setFailure(null)
        // Best effort — only feeds the "more stories" rail and footer grid.
        fetchRelatedArticles(fetched.id, 3)
          .then((items) => {
            if (!cancelled) setRelatedResult({ slug, items })
          })
          .catch(() => {
            /* the related section just stays hidden */
          })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setFailure({ slug, kind: err instanceof ApiError && err.status === 404 ? 'missing' : 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [slug, navigate, reloadKey])

  const article = result && result.slug === slug ? result.article : null
  const failed = failure && failure.slug === slug ? failure.kind : null
  const status: Status = article ? 'ready' : failed ?? 'loading'
  const related = relatedResult && relatedResult.slug === slug ? relatedResult.items : []

  // Same extraction as ArticleBody's renderer: all three body shapes produce
  // their H2s in this order, so the TOC ids can be assigned to the DOM below.
  const headings = useMemo(() => (article ? extractArticleHeadings(article.body) : []), [article])

  useEffect(() => {
    const root = proseRef.current
    if (!root) return
    root.querySelectorAll('h2').forEach((heading, index) => {
      heading.id = headings[index]?.id || headingId(heading.textContent || '', index)
    })
  }, [headings])

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: article?.title, url: window.location.href })
      } else {
        await navigator.clipboard?.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* user dismissed share sheet */
    }
  }

  const jumpToHeading = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const heading = document.getElementById(id)
    if (!heading) return
    event.preventDefault()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    heading.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  if (status === 'loading') {
    return (
      <div className="story-detail explorer-article">
        <div className="story-notfound" role="status" aria-live="polite">
          <div className="article-loading" aria-hidden="true" />
          <p>Loading article&hellip;</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (status !== 'ready' || !article) {
    const failed = status === 'error'
    return (
      <div className="story-detail explorer-article">
        <SEO
          title={failed ? 'Article unavailable' : 'Story not found'}
          description="Travel stories and guides from Travio Ghana."
          robots="noindex, follow"
        />
        <div className="story-notfound">
          <Sparkles size={40} />
          <h1>{failed ? 'Something went wrong' : 'Story not found'}</h1>
          <p>
            {failed
              ? 'We couldn’t load this article right now. Please try again.'
              : 'The article you’re looking for doesn’t exist or has moved.'}
          </p>
          <div className="story-notfound-actions">
            {failed && (
              <button
                className="story-notfound-btn"
                onClick={() => {
                  setFailure(null)
                  setReloadKey((k) => k + 1)
                }}
              >
                Try again
              </button>
            )}
            <button className="story-notfound-btn" onClick={() => navigate('/blog')}>
              Back to the blog
            </button>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  const heroImage = article.featuredImage || BLOG_PLACEHOLDER_IMAGE
  const dateLabel = formatDate(article.publishedAt) || formatDate(article.createdAt)
  const readTime = article.readTime ?? 4
  const authorName = article.author?.name || 'Travio Ghana Team'
  const canonicalUrl = article.canonicalUrl || `${SITE_URL}/blog/${article.slug}`
  const categoryLabel = article.category?.name || 'Travel inspiration'
  const alternateLocales = (article.alternateLocales ?? [])
    .filter((a) => a.slug && a.slug !== article.slug)
    .map((a) => ({ lang: a.locale, href: `${SITE_URL}/blog/${a.slug}` }))
  const relatedTours = (article.relatedTours ?? []).slice(0, 3)

  return (
    <div className="story-detail explorer-article">
      <SEO
        title={article.metaTitle || article.title}
        description={article.metaDescription || article.excerpt}
        keywords={article.tags.map((t) => t.name).join(', ')}
        image={heroImage}
        type="article"
        publishedTime={article.publishedAt || article.createdAt}
        author={authorName}
        canonical={canonicalUrl}
        alternateLocales={alternateLocales.length ? alternateLocales : undefined}
        jsonLd={[
          buildArticleSchema({
            title: article.title,
            description: article.metaDescription || article.excerpt,
            image: heroImage,
            url: canonicalUrl,
            publishedTime: article.publishedAt || article.createdAt,
            author: authorName,
          }),
          buildBreadcrumbSchema([
            { name: 'Home', url: `${SITE_URL}/` },
            { name: 'Blog', url: `${SITE_URL}/blog` },
            { name: article.title, url: canonicalUrl },
          ]),
        ]}
      />

      <nav className="explorer-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link to="/blog">Blog</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{categoryLabel}</span>
      </nav>

      <header className="explorer-header">
        <span className="explorer-kicker">{categoryLabel}</span>
        <h1 className="explorer-title">{article.title}</h1>
        <p className="explorer-subtitle">{article.excerpt}</p>
        <div className="explorer-byline">
          <span>By {authorName}</span>
          <span className="explorer-byline-dot" aria-hidden="true" />
          {dateLabel && (
            <>
              <span className="explorer-byline-date">
                <Calendar size={14} aria-hidden="true" />
                {dateLabel}
              </span>
              <span className="explorer-byline-dot" aria-hidden="true" />
            </>
          )}
          <span>
            <Clock size={14} aria-hidden="true" />
            {readTime} min read
          </span>
        </div>
      </header>

      <div className="explorer-hero">
        <OptimizedImage
          src={heroImage}
          alt={article.title}
          width={1256}
          height={707}
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1400px) calc(100vw - 72px), 1256px"
        />
      </div>

      <main className="explorer-layout">
        <article className="explorer-article">
          <div className="article-body explorer-prose" ref={proseRef}>
            <ArticleBody value={article.body} />
          </div>

          {article.tags.length > 0 && (
            <div className="explorer-tags" aria-label="Topics">
              {article.tags.map((tag) => (
                <span key={tag.id} className="explorer-tag">
                  #{tag.name}
                </span>
              ))}
            </div>
          )}

          {relatedTours.length > 0 && (
            <section className="explorer-tours" aria-label="Related experiences">
              <h2>Related experiences</h2>
              <div className="explorer-tours-grid">
                {relatedTours.map((tour) => (
                  <Link key={tour.id} to={tourPath(tour.id, tour.slug)} className="explorer-tour">
                    <div className="explorer-tour-media">
                      <OptimizedImage
                        src={tour.coverPhoto || BLOG_PLACEHOLDER_IMAGE}
                        alt={tour.title}
                        width={400}
                        sizes="(max-width: 768px) 50vw, 254px"
                      />
                    </div>
                    <span className="explorer-tour-title">{tour.title}</span>
                    <span className="explorer-tour-meta">
                      {[tour.city, tour.country].filter(Boolean).join(', ') || 'Ghana'}
                    </span>
                    {typeof tour.averageRating === 'number' && (
                      <span className="explorer-tour-rating">
                        <Star size={13} fill="currentColor" aria-hidden="true" />
                        {tour.averageRating.toFixed(1)}
                        {tour.reviewCount > 0 && ` (${tour.reviewCount})`}
                      </span>
                    )}
                    {tour.startingPrice != null && (
                      <span className="explorer-tour-price">
                        From {tour.currency || 'GHS'} {tour.startingPrice.toLocaleString()}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="explorer-author">
            <div className="explorer-author-avatar" aria-hidden="true">{initials(authorName)}</div>
            <div className="explorer-author-info">
              <span className="explorer-author-label">Written by</span>
              <span className="explorer-author-name">{authorName}</span>
              <p className="explorer-author-bio">
                Sharing the places, people and flavors that make every journey with
                Travio Ghana unforgettable.
              </p>
            </div>
            <button className="explorer-share" onClick={handleShare}>
              <Share2 size={16} aria-hidden="true" />
              {copied ? 'Link copied' : 'Share this story'}
            </button>
          </div>
        </article>

        <aside className="explorer-rail" aria-label="On this page">
          {headings.length > 0 && (
            <nav className="explorer-toc" aria-label="In this article">
              <h2 className="explorer-toc-title">In this article:</h2>
              <ol>
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <a href={`#${heading.id}`} onClick={(event) => jumpToHeading(event, heading.id)}>
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {related.length > 0 && (
            <div className="explorer-more">
              <h2>More from the blog</h2>
              {related.map((item) => {
                const itemDate = formatDate(item.publishedAt) || formatDate(item.createdAt)
                return (
                  <Link key={item.id} to={`/blog/${item.slug}`} className="explorer-more-card">
                    <div className="explorer-more-media">
                      <OptimizedImage
                        src={item.featuredImage || BLOG_PLACEHOLDER_IMAGE}
                        alt=""
                        width={100}
                        sizes="100px"
                      />
                    </div>
                    <div className="explorer-more-copy">
                      {itemDate && <span className="explorer-more-date">{itemDate}</span>}
                      <span className="explorer-more-title">{item.title}</span>
                      {item.author?.name && <span className="explorer-more-author">by {item.author.name}</span>}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </aside>
      </main>

      {related.length > 0 && (
        <section className="explorer-related">
          <div className="explorer-related-inner">
            <h2>More from the blog</h2>
            <div className="explorer-related-grid">
              {related.map((item) => (
                <Link key={item.id} to={`/blog/${item.slug}`} className="explorer-related-card">
                  <div className="explorer-related-media">
                    <OptimizedImage
                      src={item.featuredImage || BLOG_PLACEHOLDER_IMAGE}
                      alt={item.title}
                      width={400}
                      sizes="(max-width: 768px) 100vw, 400px"
                    />
                  </div>
                  <div className="explorer-related-copy">
                    <span className="explorer-related-date">
                      {formatDate(item.publishedAt) || formatDate(item.createdAt)}
                    </span>
                    <h3>{item.title}</h3>
                    <span className="explorer-related-link">
                      Read story <ChevronRight size={14} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  )
}

export default BlogArticlePage
