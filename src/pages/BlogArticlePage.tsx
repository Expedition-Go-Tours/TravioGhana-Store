import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion'
import { ArrowLeft, Calendar, ChevronRight, Clock, Share2, Sparkles } from 'lucide-react'
import { ApiError } from '../lib/api'
import {
  BLOG_PLACEHOLDER_IMAGE,
  fetchArticleBySlug,
  fetchRelatedArticles,
  type BlogArticleDetail,
  type BlogArticleSummary,
} from '../lib/blogApi'
import { travelStories, storySlug } from '../components/data'
import ArticleBody from '../components/ArticleBody'
import Footer from '../components/Footer'
import SEO, { buildArticleSchema, buildBreadcrumbSchema, SITE_URL } from '../components/SEO'
import { tourPath } from '../lib/tourPath'
import OptimizedImage from '@/components/shared/OptimizedImage'
import './StoryDetailPage.css'
import './BlogArticlePage.css'

type Status = 'loading' | 'ready' | 'missing' | 'error'

interface RelatedCard {
  key: string
  title: string
  date: string
  image: string
  href: string
}

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

  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })

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
        // Best effort — only feeds the "more stories" section.
        fetchRelatedArticles(fetched.id, 3)
          .then((items) => {
            if (!cancelled) setRelatedResult({ slug, items })
          })
          .catch(() => {
            /* section falls back to the static stories */
          })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // The static stories predate this route and live at /stories/<slug>;
        // send hand-made/legacy links there instead of a dead end.
        const staticStory = travelStories.find((s) => s.slug === slug || storySlug(s.title) === slug)
        if (staticStory) {
          navigate(`/stories/${staticStory.slug}`, { replace: true })
          return
        }
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

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/blog')
  }

  if (status === 'loading') {
    return (
      <div className="story-detail">
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
      <div className="story-detail">
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
  const alternateLocales = (article.alternateLocales ?? [])
    .filter((a) => a.slug && a.slug !== article.slug)
    .map((a) => ({ lang: a.locale, href: `${SITE_URL}/blog/${a.slug}` }))

  // API-sourced cards first, static stories as the floor so the section is
  // never empty for a fresh article with no siblings yet.
  const relatedCards: RelatedCard[] = [
    ...related.map((r) => ({
      key: `article:${r.slug}`,
      title: r.title,
      date: formatDate(r.publishedAt) || formatDate(r.createdAt),
      image: r.featuredImage || BLOG_PLACEHOLDER_IMAGE,
      href: `/blog/${r.slug}`,
    })),
    ...travelStories
      .filter((s) => storySlug(s.title) !== slug)
      .slice(0, 3)
      .map((s) => ({
        key: `story:${s.slug}`,
        title: s.title,
        date: s.date,
        image: s.image,
        href: `/stories/${storySlug(s.title)}`,
      })),
  ].slice(0, 3)

  return (
    <div className="story-detail">
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

      {/* Reading progress bar */}
      <motion.div className="story-progress" style={{ scaleX: progress }} />

      <AnimatePresence mode="wait">
        <motion.div
          key={article.slug}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {/* Hero */}
          <header className="story-hero">
            <div className="story-hero-bg">
              <OptimizedImage src={heroImage} alt={article.title} width={1200} />
              <div className="story-hero-scrim" />
              <div className="story-hero-glow story-hero-glow-1" />
              <div className="story-hero-glow story-hero-glow-2" />
              <div className="story-hero-grid" />
            </div>

            <div className="story-hero-inner">
              <motion.button
                className="story-back"
                onClick={handleBack}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
              >
                <ArrowLeft size={18} />
                <span>Back</span>
              </motion.button>

              <motion.div
                className="story-hero-content"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
                }}
              >
                <motion.span
                  className="story-chip"
                  variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                >
                  {article.category?.name || 'Blog'}
                </motion.span>

                <motion.h1
                  className="story-hero-title"
                  variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                >
                  {article.title}
                </motion.h1>

                <motion.div
                  className="story-hero-meta"
                  variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                >
                  <span className="story-author">
                    <span className="story-author-avatar">{initials(authorName)}</span>
                    {authorName}
                  </span>
                  <span className="story-meta-dot" />
                  <span className="story-meta-item">
                    <Calendar size={14} />
                    {dateLabel}
                  </span>
                  <span className="story-meta-dot" />
                  <span className="story-meta-item">
                    <Clock size={14} />
                    {readTime} min read
                  </span>
                </motion.div>
              </motion.div>
            </div>
          </header>

          {/* Article */}
          <main className="story-body">
            <article className="story-article">
              <motion.p
                className="story-lead"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5 }}
              >
                {article.excerpt}
              </motion.p>

              <motion.div
                className="article-body"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5 }}
              >
                <ArticleBody value={article.body} />
              </motion.div>

              {article.tags.length > 0 && (
                <div className="article-tags" aria-label="Topics">
                  {article.tags.map((tag) => (
                    <span key={tag.id} className="article-tag">
                      #{tag.name}
                    </span>
                  ))}
                </div>
              )}

              {(article.relatedTours?.length ?? 0) > 0 && (
                <section className="article-tours" aria-label="Related experiences">
                  <h2 className="article-tours-title">Related experiences</h2>
                  <div className="article-tours-grid">
                    {(article.relatedTours ?? []).slice(0, 3).map((tour) => (
                      <Link key={tour.id} to={tourPath(tour.id, tour.slug)} className="article-tour">
                        <div className="article-tour-media">
                          <OptimizedImage
                            src={tour.coverPhoto || BLOG_PLACEHOLDER_IMAGE}
                            alt={tour.title}
                            width={400}
                          />
                        </div>
                        <div className="article-tour-body">
                          <span className="article-tour-title">{tour.title}</span>
                          <span className="article-tour-meta">
                            {[tour.city, tour.country].filter(Boolean).join(', ') || 'Ghana'}
                            {tour.startingPrice ? ` · from $${tour.startingPrice}` : ''}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Author card */}
              <motion.div
                className="story-authorcard"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5 }}
              >
                <div className="story-authorcard-avatar">{initials(authorName)}</div>
                <div className="story-authorcard-info">
                  <span className="story-authorcard-label">Written by</span>
                  <span className="story-authorcard-name">{authorName}</span>
                  <p className="story-authorcard-bio">
                    Sharing the places, people and flavors that make every journey with
                    Travio Ghana unforgettable.
                  </p>
                </div>
                <button className="story-share" onClick={handleShare}>
                  <Share2 size={16} />
                  {copied ? 'Link copied' : 'Share'}
                </button>
              </motion.div>
            </article>
          </main>

          {/* More from the blog */}
          <section className="story-related">
            <div className="story-related-inner">
              <h2 className="story-related-title">More from the blog</h2>
              <div className="story-related-grid">
                {relatedCards.map((card) => (
                  <Link key={card.key} to={card.href} className="story-related-card">
                    <div className="story-related-image">
                      <OptimizedImage src={card.image} alt={card.title} width={400} />
                      <div className="story-related-scrim" />
                    </div>
                    <div className="story-related-body">
                      <span className="story-related-date">{card.date}</span>
                      <h3 className="story-related-heading">{card.title}</h3>
                      <span className="story-related-link">
                        Read story <ChevronRight size={14} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </motion.div>
      </AnimatePresence>

      <Footer />
    </div>
  )
}

export default BlogArticlePage
