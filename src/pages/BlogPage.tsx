import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Clock,
  Compass,
  Landmark,
  Mail,
  Mountain,
  Search,
  Sparkles,
  User,
  UtensilsCrossed,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import { travelStories, storySlug } from '../components/data'
import type { TravelStory } from '../components/data'
import { BLOG_PLACEHOLDER_IMAGE, fetchPublishedArticles, type BlogArticleSummary } from '../lib/blogApi'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema, buildItemListSchema } from '../components/SEO'
import OptimizedImage from '@/components/shared/OptimizedImage'
import { fadeUp, revealViewport, stagger, staggerItem } from '../components/support/motion'
import './BlogPage.css'

const CATEGORY_KEYS = ['all', 'nature', 'culture', 'food', 'adventure', 'heritage'] as const

type CategoryKey = (typeof CATEGORY_KEYS)[number]
type StoryCategory = Exclude<CategoryKey, 'all'>

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  all: 'blog.categoryAll',
  nature: 'blog.categoryNature',
  culture: 'blog.categoryCulture',
  food: 'blog.categoryFood',
  adventure: 'blog.categoryAdventure',
  heritage: 'blog.categoryHeritage',
}

const CATEGORY_ICONS: Record<StoryCategory, LucideIcon> = {
  nature: Mountain,
  culture: Compass,
  food: UtensilsCrossed,
  adventure: Waves,
  heritage: Landmark,
}

const INTERESTS = [
  { num: '01', kickerKey: 'blog.interestRoots', labelKey: 'blog.interestHeritage', category: 'heritage' },
  { num: '02', kickerKey: 'blog.interestOutdoors', labelKey: 'blog.interestNature', category: 'nature' },
  { num: '03', kickerKey: 'blog.interestTaste', labelKey: 'blog.interestFood', category: 'food' },
  { num: '04', kickerKey: 'blog.interestExplore', labelKey: 'blog.interestAdventure', category: 'adventure' },
] as const

const EXPERIENCES = [
  { titleKey: 'blog.exp1Title', descKey: 'blog.exp1Desc' },
  { titleKey: 'blog.exp2Title', descKey: 'blog.exp2Desc' },
  { titleKey: 'blog.exp3Title', descKey: 'blog.exp3Desc' },
]

/**
 * One card, two sources: admin-published articles (the live feed) and the
 * static travel stories (the evergreen floor, so the hub is never empty and
 * every /stories/* link keeps resolving when the API is down).
 */
interface BlogCard {
  key: string
  title: string
  excerpt: string
  image: string
  author: string
  date: string
  dateISO?: string
  categories: StoryCategory[]
  /** Admin-authored category name — shown verbatim when there is one. */
  categoryLabel?: string
  readTime: number
  href: string
}

/**
 * Admin categories are free-form slugs ("adventure-travel", "cultural-tours",
 * …); the filter rail speaks the five curated keys. Map what matches — an
 * article whose topic maps nowhere still lists (under "All"), it just doesn't
 * claim a topic it isn't.
 */
const CATEGORY_MATCHERS: [StoryCategory, RegExp][] = [
  ['nature', /nature|wildlife|park|safari|outdoor|eco/i],
  ['adventure', /adventure|hik|trek|kayak|climb|raft/i],
  ['food', /food|culin|cuisine|gastron|kitchen/i],
  ['heritage', /heritage|histor|castle|fort|unesco|traditional/i],
  ['culture', /culture|cultural|art|museu|music|festival/i],
]

export function mapApiCategories(article: BlogArticleSummary): {
  categories: StoryCategory[]
  label: string | null
} {
  const label = article.category?.name ?? null
  const slug = article.category?.slug ?? ''
  if (slug !== 'all' && (CATEGORY_KEYS as readonly string[]).includes(slug)) {
    return { categories: [slug as StoryCategory], label }
  }
  const haystack = [slug, label ?? '', ...article.tags.map((tag) => `${tag.name} ${tag.slug}`)].join(' ')
  const categories = CATEGORY_MATCHERS.filter(([, pattern]) => pattern.test(haystack)).map(([key]) => key)
  return { categories: [...new Set(categories)], label }
}

function formatArticleDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function articleToCard(article: BlogArticleSummary): BlogCard {
  const { categories, label } = mapApiCategories(article)
  return {
    key: `article:${article.slug}`,
    title: article.title,
    excerpt: article.excerpt,
    image: article.featuredImage || BLOG_PLACEHOLDER_IMAGE,
    author: article.author?.name || 'Travio Ghana Team',
    date: formatArticleDate(article.publishedAt) || formatArticleDate(article.createdAt),
    dateISO: article.publishedAt || article.createdAt,
    categories,
    categoryLabel: label ?? undefined,
    readTime: article.readTime ?? 4,
    href: `/blog/${article.slug}`,
  }
}

function storyToCard(story: TravelStory): BlogCard {
  const slug = storySlug(story.title)
  return {
    key: `story:${slug}`,
    title: story.title,
    excerpt: story.excerpt,
    image: story.image,
    author: story.author,
    date: story.date,
    dateISO: story.dateISO,
    categories: storyCategories(story),
    readTime: story.readTime ?? 4,
    href: `/stories/${slug}`,
  }
}

function storyCategories(story: TravelStory): StoryCategory[] {
  return (story.categories ?? []).filter((key): key is StoryCategory =>
    CATEGORY_KEYS.includes(key as CategoryKey) && key !== 'all'
  )
}

function StoryMeta({ card }: { card: BlogCard }) {
  const { t } = useTranslation()
  return (
    <>
      <span>
        <User size={12} aria-hidden="true" />
        {card.author}
      </span>
      <span>
        <Clock size={12} aria-hidden="true" />
        {t('blog.readTime', { count: card.readTime })}
      </span>
    </>
  )
}

export default function BlogPage() {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all')
  const [email, setEmail] = useState('')

  // Admin-published articles arrive from the backend; the static stories stay
  // as the floor beneath them (null → still loading → static only).
  const [liveArticles, setLiveArticles] = useState<BlogArticleSummary[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchPublishedArticles()
      .then((articles) => {
        if (!cancelled) setLiveArticles(articles)
      })
      .catch(() => {
        if (!cancelled) setLiveArticles([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const cards = useMemo<BlogCard[]>(
    () => [...(liveArticles ?? []).map(articleToCard), ...travelStories.map(storyToCard)],
    [liveArticles],
  )

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return cards.filter((card) => {
      const matchesCategory = activeCategory === 'all' || card.categories.includes(activeCategory)
      if (!matchesCategory) return false
      if (!query) return true
      return (
        card.title.toLowerCase().includes(query) ||
        card.excerpt.toLowerCase().includes(query) ||
        card.author.toLowerCase().includes(query)
      )
    })
  }, [cards, searchQuery, activeCategory])

  const isFiltering = activeCategory !== 'all' || searchQuery.trim().length > 0
  const featured = cards[0]
  const sideStories = cards.slice(1, 3)
  const gridCards = isFiltering ? filteredCards : filteredCards.slice(1)

  const heroPrimary = cards[0]
  const heroSecondary =
    cards.find((card) => card.categories.includes('food')) ?? cards[2] ?? cards[0]

  /** Chip label: the admin's category name, else the translated filter label. */
  const tagLabel = (card: BlogCard) =>
    card.categoryLabel ?? t(CATEGORY_LABELS[card.categories[0] ?? 'culture'])

  const scrollToGuides = () => {
    document.getElementById('allGuides')?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault()
    setActiveCategory('all')
    scrollToGuides()
  }

  const handleCategoryClick = (category: CategoryKey) => {
    setActiveCategory(category)
    setSearchQuery('')
  }

  const handleInterestClick = (category: StoryCategory) => {
    setActiveCategory(category)
    setSearchQuery('')
    scrollToGuides()
  }

  // The mailing-list API is not wired up yet: the button is marked
  // "coming soon" and submission is deliberately a no-op.
  // Mailing-list API not wired yet — submitting is a no-op. Deliberately not
  // marked `.is-coming-soon` (that dims the button and reads as broken).
  const handleSubscribe = (event: FormEvent) => {
    event.preventDefault()
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="blog-page">
        <SEO
          title={t('blog.pageTitle')}
          description="Read inspiring travel stories from Ghana. Discover hidden gems, local culture, food experiences, wildlife adventures, and travel tips for your Ghana vacation."
          keywords="Ghana travel blog, Ghana travel stories, Ghana travel guide, things to do in Ghana, Ghana experiences, Ghana food, Ghana culture, Ghana wildlife, West Africa travel"
          jsonLd={[
            buildBreadcrumbSchema([
              { name: 'Home', url: 'https://www.travioghana.com/' },
              { name: 'Blog', url: 'https://www.travioghana.com/blog' },
            ]),
            buildItemListSchema(
              cards.map((card) => ({
                name: card.title,
                url: `https://www.travioghana.com${card.href}`,
                image: card.image,
              }))
            ),
          ]}
        />

        {/* Hero — dark green, glass search, tilted story cards */}
        <header className="blog-hero">
          <div className="blog-container blog-hero-grid">
            <motion.div
              className="blog-hero-copy"
              initial="hidden"
              animate="visible"
              variants={stagger}
            >
              <motion.p className="blog-kicker" variants={staggerItem}>
                {t('blog.heroKicker')}
              </motion.p>
              <motion.h1 className="blog-hero-title" variants={staggerItem}>
                {t('blog.heroTitle')}
                <em>{t('blog.heroTitleAccent')}</em>
              </motion.h1>
              <motion.p className="blog-hero-lead" variants={staggerItem}>
                {t('blog.heroSubtitle')}
              </motion.p>
              <motion.form
                className="blog-search"
                onSubmit={handleSearchSubmit}
                role="search"
                variants={staggerItem}
              >
                <Search size={18} className="blog-search-icon" aria-hidden="true" />
                <input
                  type="search"
                  className="blog-search-input"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('blog.searchPlaceholder')}
                  aria-label={t('blog.searchPlaceholder')}
                />
                <button type="submit" className="blog-search-btn">
                  {t('blog.searchButton')}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </motion.form>
              <motion.ul className="blog-hero-meta" variants={staggerItem}>
                <li>
                  <BookOpen size={15} aria-hidden="true" />
                  {t('blog.heroStories', { count: cards.length })}
                </li>
                <li>
                  <Sparkles size={15} aria-hidden="true" />
                  {t('blog.heroMicro')}
                </li>
              </motion.ul>
            </motion.div>

            <div className="blog-hero-side" aria-hidden="true">
              <div className="blog-hero-card blog-hero-card--one">
                <OptimizedImage src={heroPrimary.image} alt="" width={800} priority />
              </div>
              <div className="blog-hero-card blog-hero-card--two">
                <OptimizedImage src={heroSecondary.image} alt="" width={600} />
              </div>
              <span className="blog-hero-badge">
                <Sparkles size={14} aria-hidden="true" />
                {t('blog.heroBadgeLabel')}
              </span>
            </div>
          </div>
        </header>

        {/* Topic filter rail */}
        <nav className="blog-topics" aria-label={t('blog.topicsLabel')}>
          <div className="blog-container">
            <div className="blog-topics-row">
              {CATEGORY_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`blog-topic${activeCategory === key ? ' blog-topic--active' : ''}`}
                  aria-pressed={activeCategory === key}
                  onClick={() => handleCategoryClick(key)}
                >
                  {t(CATEGORY_LABELS[key])}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Featured story + side picks */}
        {featured && (
          <section className="blog-featured" aria-label={t('blog.featured')}>
            <div className="blog-container">
              <motion.div
                className="blog-section-head"
                initial="hidden"
                whileInView="visible"
                viewport={revealViewport}
                variants={stagger}
              >
                <motion.div className="blog-section-head-copy" variants={fadeUp}>
                  <p className="blog-label">{t('blog.featuredKicker')}</p>
                  <h2 className="blog-title">{t('blog.featuredTitle')}</h2>
                </motion.div>
                <motion.p variants={fadeUp}>{t('blog.featuredIntro')}</motion.p>
              </motion.div>

              <motion.div
                className="blog-featured-grid"
                initial="hidden"
                whileInView="visible"
                viewport={revealViewport}
                variants={stagger}
              >
                <motion.div className="blog-feature-wrap" variants={staggerItem}>
                  <Link to={featured.href} className="blog-feature">
                    <OptimizedImage src={featured.image} alt={featured.title} width={1200} />
                    <div className="blog-feature-body">
                      <span className="blog-feature-tag">
                        {t('blog.featured')} · {tagLabel(featured)}
                      </span>
                      <h3 className="blog-feature-title">{featured.title}</h3>
                      <div className="blog-feature-meta">
                        <StoryMeta card={featured} />
                      </div>
                      <span className="blog-feature-read">
                        {t('blog.readGuide')}
                        <ArrowRight size={16} aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                </motion.div>

                <div className="blog-side">
                  {sideStories.map((card) => {
                    const [primaryCategory = 'culture'] = card.categories
                    const Icon = CATEGORY_ICONS[primaryCategory]
                    return (
                      <motion.div key={card.key} className="blog-side-item" variants={staggerItem}>
                        <Link to={card.href} className="blog-side-card">
                          <div>
                            <span className="blog-side-icon" aria-hidden="true">
                              <Icon size={22} />
                            </span>
                            <h3>{card.title}</h3>
                            <p>{card.excerpt}</p>
                          </div>
                          <div className="blog-side-foot">
                            <span>
                              {tagLabel(card)} · {t('blog.readTime', { count: card.readTime })}
                            </span>
                            <span className="blog-side-arrow" aria-hidden="true">
                              <ArrowUpRight size={16} />
                            </span>
                          </div>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* All guides */}
        <section className="blog-grid-section" id="allGuides" aria-label={t('blog.exploreKicker')}>
          <div className="blog-container">
            <motion.div
              className="blog-section-head"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={stagger}
            >
              <motion.div className="blog-section-head-copy" variants={fadeUp}>
                <p className="blog-label">{t('blog.exploreKicker')}</p>
                <h2 className="blog-title">{t('blog.exploreTitle')}</h2>
              </motion.div>
              <motion.span className="blog-count" variants={fadeUp}>
                <BookOpen size={15} aria-hidden="true" />
                {t('blog.guidesCount', { count: gridCards.length })}
              </motion.span>
            </motion.div>

            {gridCards.length > 0 && (
              <motion.div
                className="blog-grid"
                initial="hidden"
                whileInView="visible"
                viewport={revealViewport}
                variants={stagger}
              >
                {gridCards.map((card) => (
                  <motion.article key={card.key} className="blog-card-wrap" variants={staggerItem}>
                    <Link to={card.href} className="blog-card">
                      <div className="blog-card-media">
                        <OptimizedImage src={card.image} alt={card.title} width={600} />
                        <span className="blog-card-tag">{tagLabel(card)}</span>
                      </div>
                      <div className="blog-card-body">
                        <div className="blog-card-meta">
                          <StoryMeta card={card} />
                        </div>
                        <h3>{card.title}</h3>
                        <p>{card.excerpt}</p>
                        <span className="blog-card-read">
                          {t('blog.readMore')}
                          <ArrowRight size={15} aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  </motion.article>
                ))}
              </motion.div>
            )}

            {filteredCards.length === 0 && (
              <div className="blog-empty" role="status">
                <Compass size={26} aria-hidden="true" />
                <p>{t('blog.emptyText')}</p>
              </div>
            )}
          </div>
        </section>

        {/* Plan by interest */}
        <section className="blog-interest-wrap" aria-label={t('blog.interestKicker')}>
          <div className="blog-container">
            <motion.div
              className="blog-interest"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={stagger}
            >
              <div className="blog-interest-grid">
                <motion.div className="blog-interest-copy" variants={fadeUp}>
                  <p className="blog-label blog-label--onDark">{t('blog.interestKicker')}</p>
                  <h2 className="blog-title blog-title--onDark">{t('blog.interestTitle')}</h2>
                  <p>{t('blog.interestIntro')}</p>
                </motion.div>

                <div className="blog-quick-grid">
                  {INTERESTS.map((item) => (
                    <motion.button
                      key={item.num}
                      type="button"
                      className="blog-quick"
                      variants={staggerItem}
                      onClick={() => handleInterestClick(item.category)}
                    >
                      <small>
                        {item.num} · {t(item.kickerKey)}
                      </small>
                      <span className="blog-quick-row">
                        <b>{t(item.labelKey)}</b>
                        <ArrowUpRight size={17} aria-hidden="true" />
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA — inspiration to booking */}
        <section className="blog-cta-wrap" aria-label={t('blog.ctaKicker')}>
          <div className="blog-container">
            <motion.div
              className="blog-cta"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={stagger}
            >
              <motion.div className="blog-cta-copy" variants={fadeUp}>
                <p className="blog-label">{t('blog.ctaKicker')}</p>
                <h2 className="blog-title">{t('blog.ctaTitle')}</h2>
                <p>{t('blog.ctaText')}</p>
                <Link to="/tours" className="blog-cta-btn">
                  {t('blog.ctaButton')}
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </motion.div>

              <div className="blog-exp-list">
                {EXPERIENCES.map((exp) => (
                  <motion.div key={exp.titleKey} className="blog-exp-item" variants={staggerItem}>
                    <Link to="/tours" className="blog-exp">
                      <span>
                        <b>{t(exp.titleKey)}</b>
                        <small>{t(exp.descKey)}</small>
                      </span>
                      <ArrowUpRight size={17} aria-hidden="true" />
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Newsletter */}
        <section className="blog-newsletter" aria-label={t('blog.newsletterTitle')}>
          <div className="blog-container">
            <motion.div
              className="blog-newsletter-card"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={stagger}
            >
              <motion.div className="blog-newsletter-copy" variants={fadeUp}>
                <p className="blog-label blog-label--onDark">{t('blog.stayInLoop')}</p>
                <h2 className="blog-newsletter-title">{t('blog.newsletterTitle')}</h2>
                <p>{t('blog.newsletterDesc')}</p>
              </motion.div>

              <motion.form className="blog-newsletter-form" variants={fadeUp} onSubmit={handleSubscribe}>
                <input
                  type="email"
                  className="blog-newsletter-input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t('blog.emailPlaceholder')}
                  aria-label={t('blog.emailPlaceholder')}
                />
                <button type="submit" className="blog-newsletter-btn">
                  <Mail size={16} aria-hidden="true" />
                  {t('blog.subscribe')}
                </button>
              </motion.form>
            </motion.div>
          </div>
        </section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
