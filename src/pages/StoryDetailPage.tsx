import { useMemo, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion'
import { ArrowLeft, Calendar, Clock, Share2, ChevronRight, Sparkles } from 'lucide-react'
import { travelStories, storySlug } from '../components/data'
import Footer from '../components/Footer'
import SEO, { buildArticleSchema, buildBreadcrumbSchema } from '../components/SEO'
import './StoryDetailPage.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function StoryDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const story = useMemo(
    () => travelStories.find((s) => storySlug(s.title) === slug),
    [slug]
  )

  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [slug])

  // The body ships in travelStories.json — the same object the static
  // /stories/<slug>.html prerenderer reads, so both render identically.
  const content = story?.content ?? null

  const readTime = useMemo(() => {
    if (!content || !story) return 3
    const words =
      story.excerpt.split(/\s+/).length +
      content.sections.reduce((n, s) => n + s.body.split(/\s+/).length, 0)
    return Math.max(2, Math.round(words / 200))
  }, [content, story])

  const related = useMemo(
    () => travelStories.filter((s) => storySlug(s.title) !== slug).slice(0, 3),
    [slug]
  )

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: story?.title, url: window.location.href })
      } else {
        await navigator.clipboard?.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* user dismissed share sheet */
    }
  }

  if (!story || !content) {
    return (
      <div className="story-detail">
        <div className="story-notfound">
          <Sparkles size={40} />
          <h1>Story not found</h1>
          <p>The story you&apos;re looking for doesn&apos;t exist or has moved.</p>
          <button className="story-notfound-btn" onClick={() => navigate('/stories')}>
            Browse all stories
          </button>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="story-detail">
      <SEO
        title={story.title}
        description={`${story.title} - ${content.category} travel story from Ghana. Discover authentic experiences, local insights, and travel tips for your Ghana adventure.`}
        keywords={`${story.title}, Ghana travel story, ${content.category.toLowerCase()} Ghana, Ghana travel guide, things to do in Ghana, Ghana experiences`}
        image={story.image}
        type="article"
        publishedTime={story.dateISO || story.date}
        jsonLd={[
          buildArticleSchema({
            title: story.title,
            description: `${story.title} - ${content.category} travel story from Ghana.`,
            image: story.image,
            url: `https://www.travioghana.com/stories/${storySlug(story.title)}`,
            publishedTime: story.dateISO || story.date,
            modifiedTime: story.dateISO || story.date,
            author: 'Travio Ghana',
          }),
          buildBreadcrumbSchema([
            { name: 'Home', url: 'https://www.travioghana.com/' },
            { name: 'Stories', url: 'https://www.travioghana.com/stories' },
            { name: story.title, url: `https://www.travioghana.com/stories/${storySlug(story.title)}` },
          ]),
        ]}
      />
      {/* Reading progress bar */}
      <motion.div className="story-progress" style={{ scaleX: progress }} />


      <AnimatePresence mode="wait">
        <motion.div
          key={slug}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
      {/* Hero */}
      <header className="story-hero">
        <div className="story-hero-bg">
          <OptimizedImage src={story.image} alt={story.title} width={1200} />
          <div className="story-hero-scrim" />
          <div className="story-hero-glow story-hero-glow-1" />
          <div className="story-hero-glow story-hero-glow-2" />
          <div className="story-hero-grid" />
        </div>

        <div className="story-hero-inner">
          <motion.button
            className="story-back"
            onClick={() => navigate(-1)}
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
              {content.category}
            </motion.span>

            <motion.h1
              className="story-hero-title"
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            >
              {story.title}
            </motion.h1>

            <motion.div
              className="story-hero-meta"
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
            >
              <span className="story-author">
                <span className="story-author-avatar">{initials(story.author)}</span>
                {story.author}
              </span>
              <span className="story-meta-dot" />
              <span className="story-meta-item">
                <Calendar size={14} />
                {story.date}
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
            {story.excerpt}
          </motion.p>

          {content.sections.map((section, i) => (
            <motion.section
              key={section.heading}
              className="story-section"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="story-section-heading">{section.heading}</h2>
              <p className="story-section-body">{section.body}</p>

              {/* Insert highlights card after the first section */}
              {i === 0 && (
                <div className="story-highlights">
                  <div className="story-highlights-glow" />
                  <h3 className="story-highlights-title">
                    Highlights
                  </h3>
                  <ul>
                    {content.highlights.map((h) => (
                      <li key={h}>
                        <ChevronRight size={15} />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Insert pull quote after the second section */}
              {i === 1 && (
                <blockquote className="story-quote">
                  <span className="story-quote-mark">&ldquo;</span>
                  <p>{content.quote}</p>
                </blockquote>
              )}
            </motion.section>
          ))}

          {/* Author card */}
          <motion.div
            className="story-authorcard"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
          >
            <div className="story-authorcard-avatar">{initials(story.author)}</div>
            <div className="story-authorcard-info">
              <span className="story-authorcard-label">Written by</span>
              <span className="story-authorcard-name">{story.author}</span>
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

      {/* Related stories */}
      <section className="story-related">
        <div className="story-related-inner">
          <h2 className="story-related-title">More travel stories</h2>
          <div className="story-related-grid">
            {related.map((r) => (
              <Link
                key={r.title}
                to={`/stories/${storySlug(r.title)}`}
                className="story-related-card"
              >
                <div className="story-related-image">
                  <OptimizedImage src={r.image} alt={r.title} width={400} />
                  <div className="story-related-scrim" />
                </div>
                <div className="story-related-body">
                  <span className="story-related-date">{r.date}</span>
                  <h3 className="story-related-heading">{r.title}</h3>
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

export default StoryDetailPage
