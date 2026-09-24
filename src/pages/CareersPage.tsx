import { useTranslation } from 'react-i18next'
import partner1 from '@/assets/partners/partners1.avif'
import partner3 from '@/assets/partners/partners3.avif'
import partner4 from '@/assets/partners/partners4.avif'
import { MotionConfig, motion } from 'framer-motion'
import {
  Route,
  Map,
  Headset,
  Megaphone,
  Mail,
  CheckCircle,
  Users,
  Globe,
  TrendingUp,
  Shield,
  Brain,
  Heart,
  Award,
  ChevronRight,
} from 'lucide-react'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema } from '../components/SEO'
import {
  fadeUp,
  revealViewport,
  stagger,
  staggerItem,
} from '../components/support/motion'
import './SupportPages.css'
import './CareersPage.css'

const CAREERS_EMAIL = 'careers@expedition-go.com'

const PROOF_ITEMS = [
  { icon: CheckCircle, text: 'Real responsibility' },
  { icon: Users, text: 'Cross-team learning' },
  { icon: Globe, text: 'Ghana-focused work' },
  { icon: TrendingUp, text: 'Room to grow' },
]

const STORY_CARDS = [
  {
    title: 'Own meaningful work',
    text: 'Take responsibility for work that directly shapes the traveller, supplier or team experience.',
  },
  {
    title: 'Stay close to the journey',
    text: 'See how your decisions work in practice and learn from the people using what you build.',
  },
  {
    title: 'Grow across the business',
    text: 'Work alongside operations, technology, customer care and marketing — not inside a narrow lane.',
  },
]

const DEPARTMENTS = [
  {
    num: '01 / FIELD & QUALITY',
    Icon: Route,
    title: 'careers.dept1Title',
    text: 'careers.dept1Text',
  },
  {
    num: '02 / PRODUCT & PLATFORM',
    Icon: Map,
    title: 'careers.dept2Title',
    text: 'careers.dept2Text',
  },
  {
    num: '03 / TRAVELLER CARE',
    Icon: Headset,
    title: 'careers.dept3Title',
    text: 'careers.dept3Text',
  },
  {
    num: '04 / BRAND & GROWTH',
    Icon: Megaphone,
    title: 'careers.dept4Title',
    text: 'careers.dept4Text',
  },
]

const VALUES = [
  { Icon: Shield, title: 'Take ownership', text: 'Follow through and care about the outcome.' },
  { Icon: Heart, title: 'Think traveller-first', text: 'Keep real customer needs close to every decision.' },
  { Icon: Users, title: 'Help the team', text: 'Share context, solve together and make others stronger.' },
  { Icon: Brain, title: 'Keep learning', text: 'Stay curious and improve the way the work gets done.' },
  { Icon: Award, title: 'Protect quality', text: 'Pay attention to the details people remember.' },
]

const PROMISE_STEPS = [
  'Share your CV',
  'Tell us what you do best',
  'Include your portfolio',
  'Name the team that fits you',
]

const GALLERY_IMAGES = [
  {
    src: partner1,
    alt: 'Travio Ghana colleague welcoming travellers',
    label: 'Operations',
  },
  {
    src: partner3,
    alt: 'Travio Ghana colleagues planning together',
    label: 'Technology',
  },
  {
    src: partner4,
    alt: 'Tourism professionals collaborating',
    label: 'Teamwork',
  },
]

const GALLERY_IMAGES_2 = [
  {
    src: partner4,
    alt: 'Travio Ghana team supporting travel partners',
    label: 'Customer care',
  },
  {
    src: partner1,
    alt: 'Welcoming guests to Ghana',
    label: 'On the road',
  },
  {
    src: partner3,
    alt: 'Creating travel ideas together',
    label: 'Marketing',
  },
]

function GalleryLane({ images }: { images: typeof GALLERY_IMAGES }) {
  return (
    <div className="cr-lane">
      <div className="cr-strip">
        <div className="cr-set">
          {images.map((img) => (
            <figure key={img.label} className="cr-photo">
              <img src={img.src} alt={img.alt} loading="lazy" />
              <span>{img.label}</span>
            </figure>
          ))}
        </div>
        <div className="cr-set" aria-hidden="true">
          {images.map((img) => (
            <figure key={`dup-${img.label}`} className="cr-photo">
              <img src={img.src} alt="" loading="lazy" />
              <span>{img.label}</span>
            </figure>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CareersPage() {
  const { t } = useTranslation()

  return (
    <MotionConfig reducedMotion="user">
      <div className="support-page">
        <SEO
          title="Careers at Travio Ghana - Join Our Ghana Travel Team"
          description="Join Travio Ghana and help shape the future of Ghana tourism. Explore career opportunities in operations, marketing, technology, and customer support."
          keywords="Travio Ghana careers, Ghana tourism jobs, travel industry careers, work in Ghana, Travio Ghana hiring"
          jsonLd={buildBreadcrumbSchema([
            { name: 'Home', url: 'https://travioghana.com/' },
            { name: 'Careers', url: 'https://travioghana.com/careers' },
          ])}
        />

        {/* ============================================================ */}
        {/* 1. Hero                                                       */}
        {/* ============================================================ */}
        <section className="cr-hero">
          <div className="support-container cr-hero-grid">
            <motion.div
              className="cr-hero-copy"
              initial="hidden"
              animate="visible"
              variants={stagger}
            >
              <motion.div className="cr-kicker" variants={staggerItem}>
                <span className="cr-kicker-dot" />
                Careers at Travio Ghana
              </motion.div>
              <motion.h1 variants={staggerItem}>
                Your next <em>journey</em> starts here.
              </motion.h1>
              <motion.p variants={staggerItem}>
                Join a small, ambitious team helping travellers discover and book
                remarkable experiences across Ghana.
              </motion.p>
              <motion.div className="cr-actions" variants={staggerItem}>
                <a href="#teams" className="cr-btn cr-btn--primary">
                  Explore our teams
                  <ChevronRight size={18} />
                </a>
                <a
                  href={`mailto:${CAREERS_EMAIL}?subject=Career%20opportunity`}
                  className="cr-btn cr-btn--secondary"
                >
                  Send your CV
                </a>
              </motion.div>
              <motion.div className="cr-micro" variants={staggerItem}>
                Accra-based &middot; Ghana-focused &middot; Traveller-first
              </motion.div>
            </motion.div>

            <motion.div
              className="cr-gallery"
              aria-label="Moving gallery of careers at Travio Ghana"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
            >
              <GalleryLane images={GALLERY_IMAGES} />
              <GalleryLane images={GALLERY_IMAGES_2} />
              <div className="cr-gallery-badge">
                <i />
                Good people build great journeys.
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 2. Proof strip                                                */}
        {/* ============================================================ */}
        <div className="cr-proof">
          <div className="support-container cr-proof-inner">
            {PROOF_ITEMS.map((item) => (
              <div key={item.text} className="cr-proof-item">
                <item.icon size={22} />
                {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. Story / Culture                                           */}
        {/* ============================================================ */}
        <section className="cr-story" id="culture">
          <div className="support-container cr-story-grid">
            <motion.div
              className="cr-story-side"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <span className="cr-label">Working here</span>
              <h2 className="cr-title">Small enough to make a difference.</h2>
              <p className="cr-lead">
                We are building a stronger way for travellers to experience
                Ghana — and every team member has a visible part in that journey.
              </p>
              <div className="cr-quote">
                "The best travel experiences begin with people who care about the
                details."
              </div>
            </motion.div>

            <div className="cr-story-content">
              {STORY_CARDS.map((card, i) => (
                <motion.article
                  key={card.title}
                  className="cr-story-card"
                  initial="hidden"
                  whileInView="visible"
                  viewport={revealViewport}
                  variants={fadeUp}
                >
                  <span className="cr-step">{`0${i + 1}`}</span>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 4. Departments (dark section)                                */}
        {/* ============================================================ */}
        <section className="cr-departments" id="teams">
          <div className="support-container">
            <motion.div
              className="cr-section-head"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <div>
                <span className="cr-label" style={{ color: '#baf0cb' }}>
                  Where you could fit in
                </span>
                <h2 className="cr-title">Different strengths. One connected team.</h2>
              </div>
              <p>
                Every department helps make travel easier to discover, book and
                enjoy.
              </p>
            </motion.div>

            <div className="cr-category-grid">
              {DEPARTMENTS.map((dept) => (
                <motion.article
                  key={dept.num}
                  className="cr-category"
                  initial="hidden"
                  whileInView="visible"
                  viewport={revealViewport}
                  variants={fadeUp}
                >
                  <span className="cr-cat-num">{dept.num}</span>
                  <div>
                    <div className="cr-cat-icon">
                      <dept.Icon size={25} />
                    </div>
                    <h3>{t(dept.title)}</h3>
                    <p>{t(dept.text)}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 5. Values                                                    */}
        {/* ============================================================ */}
        <section className="cr-values" id="values">
          <div className="support-container">
            <motion.div
              className="cr-values-head"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <span className="cr-label">What we value</span>
              <h2 className="cr-title">How we show up matters.</h2>
              <p className="cr-lead">
                The qualities that help a growing travel team do thoughtful,
                dependable work.
              </p>
            </motion.div>

            <div className="cr-value-grid">
              {VALUES.map((val) => (
                <motion.article
                  key={val.title}
                  className="cr-value"
                  initial="hidden"
                  whileInView="visible"
                  viewport={revealViewport}
                  variants={fadeUp}
                >
                  <div className="cr-value-icon">
                    <val.Icon size={22} />
                  </div>
                  <h3>{val.title}</h3>
                  <p>{val.text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 6. No vacancies notice                                       */}
        {/* ============================================================ */}
        <section className="cr-platforms">
          <motion.div
            className="support-container"
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={fadeUp}
          >
            <h2>There are no listed vacancies right now.</h2>
            <p>
              But we are always interested in hearing from talented people who
              share our passion for travel and technology.
            </p>
            <div className="cr-logos">
              <span className="cr-logo-tag">Operations</span>
              <span className="cr-logo-tag">Technology</span>
              <span className="cr-logo-tag">Customer Support</span>
              <span className="cr-logo-tag">Marketing</span>
            </div>
          </motion.div>
        </section>

        {/* ============================================================ */}
        {/* 7. Promise CTA                                               */}
        {/* ============================================================ */}
        <section className="cr-promise" id="opportunities">
          <div className="support-container">
            <motion.div
              className="cr-promise-shell"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <div>
                <span className="cr-label">Stay on our radar</span>
                <h2 className="cr-title">The right person is always worth meeting.</h2>
              </div>
              <div className="cr-promise-list">
                {PROMISE_STEPS.map((step, i) => (
                  <div key={step} className="cr-promise-item">
                    <span>{`0${i + 1}`}</span>
                    {step}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 8. Bottom CTA                                                */}
        {/* ============================================================ */}
        <section className="cr-cta">
          <div className="support-container">
            <motion.div
              className="cr-cta-inner"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <div>
                <h2>Could your next chapter be with Travio Ghana?</h2>
                <p>
                  Introduce yourself and tell us where you believe you could make
                  a difference.
                </p>
              </div>
              <a
                href={`mailto:${CAREERS_EMAIL}?subject=Career%20opportunity`}
                className="cr-btn"
              >
                <Mail size={16} />
                Send your CV
              </a>
            </motion.div>
          </div>
        </section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
