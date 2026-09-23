import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useComingSoon } from '../hooks/useComingSoon'
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

function storyCategories(story: TravelStory): StoryCategory[] {
  return (story.categories ?? []).filter((key): key is StoryCategory =>
    CATEGORY_KEYS.includes(key as CategoryKey) && key !== 'all'
  )
}

function storyLink(story: TravelStory) {
  return `/stories/${storySlug(story.title)}`
}

function StoryMeta({ story }: { story: TravelStory }) {
  const { t } = useTranslation()
  return (
    <>
      <span>
        <User size={12} aria-hidden="true" />
        {story.author}
      </span>
      <span>
        <Clock size={12} aria-hidden="true" />
        {t('blog.readTime', { count: story.readTime ?? 4 })}
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
  const comingSoon = useComingSoon()

  const filteredStories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return travelStories.filter((story) => {
      const matchesCategory =
        activeCategory === 'all' || storyCategories(story).includes(activeCategory)
      if (!matchesCategory) return false
      if (!query) return true
      return (
        story.title.toLowerCase().includes(query) ||
        story.excerpt.toLowerCase().includes(query) ||
        story.author.toLowerCase().includes(query)
      )
    })
  }, [searchQuery, activeCategory])

  const isFiltering = activeCategory !== 'all' || searchQuery.trim().length > 0
  const featured = travelStories[0]
  const sideStories = travelStories.slice(1, 3)
  const gridStories = isFiltering ? filteredStories : filteredStories.slice(1)

  const heroPrimary = travelStories[0]
  const heroSecondary =
    travelStories.find((story) => storyCategories(story).includes('food')) ?? travelStories[2]

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
              travelStories.map((story) => ({
                name: story.title,
                url: `https://www.travioghana.com${storyLink(story)}`,
                image: story.image,
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
                  {t('blog.heroStories', { count: travelStories.length })}
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
                  <Link to={storyLink(featured)} className="blog-feature">
                    <OptimizedImage src={featured.image} alt={featured.title} width={1200} />
                    <div className="blog-feature-body">
                      <span className="blog-feature-tag">
                        {t('blog.featured')} · {t(CATEGORY_LABELS[storyCategories(featured)[0] ?? 'culture'])}
                      </span>
                      <h3 className="blog-feature-title">{featured.title}</h3>
                      <div className="blog-feature-meta">
                        <StoryMeta story={featured} />
                      </div>
                      <span className="blog-feature-read">
                        {t('blog.readGuide')}
                        <ArrowRight size={16} aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                </motion.div>

                <div className="blog-side">
                  {sideStories.map((story) => {
                    const [primaryCategory = 'culture'] = storyCategories(story)
                    const Icon = CATEGORY_ICONS[primaryCategory]
                    return (
                      <motion.div key={story.title} className="blog-side-item" variants={staggerItem}>
                        <Link to={storyLink(story)} className="blog-side-card">
                          <div>
                            <span className="blog-side-icon" aria-hidden="true">
                              <Icon size={22} />
                            </span>
                            <h3>{story.title}</h3>
                            <p>{story.excerpt}</p>
                          </div>
                          <div className="blog-side-foot">
                            <span>
                              {t(CATEGORY_LABELS[primaryCategory])} · {t('blog.readTime', { count: story.readTime ?? 4 })}
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
                {t('blog.guidesCount', { count: gridStories.length })}
              </motion.span>
            </motion.div>

            {gridStories.length > 0 && (
              <motion.div
                className="blog-grid"
                initial="hidden"
                whileInView="visible"
                viewport={revealViewport}
                variants={stagger}
              >
                {gridStories.map((story) => {
                  const [primaryCategory = 'culture'] = storyCategories(story)
                  return (
                    <motion.article key={story.title} className="blog-card-wrap" variants={staggerItem}>
                      <Link to={storyLink(story)} className="blog-card">
                        <div className="blog-card-media">
                          <OptimizedImage src={story.image} alt={story.title} width={600} />
                          <span className="blog-card-tag">{t(CATEGORY_LABELS[primaryCategory])}</span>
                        </div>
                        <div className="blog-card-body">
                          <div className="blog-card-meta">
                            <StoryMeta story={story} />
                          </div>
                          <h3>{story.title}</h3>
                          <p>{story.excerpt}</p>
                          <span className="blog-card-read">
                            {t('blog.readMore')}
                            <ArrowRight size={15} aria-hidden="true" />
                          </span>
                        </div>
                      </Link>
                    </motion.article>
                  )
                })}
              </motion.div>
            )}

            {filteredStories.length === 0 && (
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
                <button type="submit" className="blog-newsletter-btn is-coming-soon" {...comingSoon}>
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
