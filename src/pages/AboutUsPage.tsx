import { useTranslation } from 'react-i18next'
import { MotionConfig, motion, type Variants } from 'framer-motion'
import {
  ArrowRight,
  BadgeDollarSign,
  Bus,
  Compass,
  Headset,
  Map as MapIcon,
  Navigation,
  Shield,
  ShieldCheck,
  Star,
  Users,
  Waves,
} from 'lucide-react'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema, buildOrganizationSchema } from '../components/SEO'
import PartnersSection from '../components/PartnersSection'
import DeferredMap from '../components/support/DeferredMap'
import { OFFICE_DIRECTIONS_URL, OFFICE_MAP_EMBED, SUPPORT_EMAIL } from '../lib/support'
import './AboutUsPage.css'

import hero1 from '../assets/about/hero-1.webp'
import hero2 from '../assets/about/hero-2.webp'
import hero3 from '../assets/about/hero-3.webp'
import hero4 from '../assets/about/hero-4.webp'
import story1 from '../assets/about/story-1.webp'
import story3 from '../assets/about/story-3.webp'

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

/*
 * Two moving lanes, six distinct photos. The two lanes deliberately share no
 * images, and each lane only repeats its own set for the seamless CSS loop
 * (the clone is aria-hidden and never doubles up on screen).
 */
const GALLERY_LANES = [
  [
    { src: hero1, label: 'Culture', width: 643, height: 900 },
    { src: hero3, label: 'Discover', width: 1350, height: 900 },
    { src: story1, label: 'Connect', width: 690, height: 785 },
  ],
  [
    { src: hero2, label: 'Explore', width: 1350, height: 900 },
    { src: hero4, label: 'Adventure', width: 600, height: 900 },
    { src: story3, label: 'Local experts', width: 720, height: 479 },
  ],
]

const PROOF_ITEMS = [
  { Icon: ShieldCheck, label: 'Vetted & curated' },
  { Icon: MapIcon, label: 'Ghana expertise' },
  { Icon: Shield, label: 'Secure payments' },
  { Icon: Headset, label: 'Helpful support' },
]

const STORY_CARDS = [
  {
    num: '01',
    title: 'Built around authentic discovery',
    text: 'We help travellers find meaningful experiences beyond the usual search results, all in one trusted place.',
    green: true,
  },
  {
    num: '02',
    title: 'Powered by local knowledge',
    text: 'We work directly with local operators and guides who know their destinations and communities best.',
    green: false,
  },
  {
    num: '03',
    title: 'Curated for confidence',
    text: 'Every experience is reviewed for quality, safety and authenticity before it goes live.',
    green: false,
  },
]

const CATEGORIES = [
  {
    num: '01 / CULTURE',
    Icon: Compass,
    title: 'Tours & experiences',
    text: 'Culture, history, food and the stories that bring Ghana to life.',
  },
  {
    num: '02 / NATURE',
    Icon: MapIcon,
    title: 'Adventure activities',
    text: 'Scenic trails, waterfalls and nature-led moments beyond the ordinary.',
  },
  {
    num: '03 / TRAVEL',
    Icon: Bus,
    title: 'Transport & transfers',
    text: 'Practical, reliable options that make getting around effortless.',
  },
  {
    num: '04 / ESCAPE',
    Icon: Waves,
    title: 'Akosombo & the Volta',
    text: 'River views, green landscapes and relaxing escapes beyond Accra.',
  },
]

const VALUES = [
  {
    Icon: Star,
    title: 'Hand-picked experiences',
    text: 'Reviewed for quality, safety and authenticity.',
  },
  {
    Icon: Users,
    title: 'Local experts',
    text: 'Direct partnerships with people who know Ghana best.',
  },
  {
    Icon: ShieldCheck,
    title: 'Safety first',
    text: 'Clear standards for every supplier and listing.',
  },
  {
    Icon: BadgeDollarSign,
    title: 'Transparent pricing',
    text: 'No hidden fees and no surprises at checkout.',
  },
  {
    Icon: Headset,
    title: 'Dedicated support',
    text: 'Helpful guidance before, during and after the trip.',
  },
]

const PROMISES = [
  { num: '01', text: 'Locally vetted in Ghana' },
  { num: '02', text: 'Secure, flexible payments' },
  { num: '03', text: 'Reviews from real travellers' },
  { num: '04', text: 'Support when you need it' },
]

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const revealViewport = { once: true, margin: '-80px' } as const

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
}

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
}

const cardFade: Variants = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AboutUsPage() {
  const { t } = useTranslation()

  return (
    <MotionConfig reducedMotion="user">
      <div className="about-page">
        <SEO
          title={t('about.pageTitle')}
          description="Learn about Travio Ghana — Ghana's premier tour platform. We connect travellers with authentic local experiences and partner with the world's leading travel brands. Meet our team, mission and why travellers book with us."
          keywords="Travio Ghana, about us, Ghana tour company, Ghana travel platform, local tours Ghana, authentic experiences Ghana, Ghana tourism company, trusted travel partners Ghana, why book with us"
          jsonLd={[
            buildBreadcrumbSchema([
              { name: 'Home', url: 'https://www.travioghana.com/' },
              { name: 'About Us', url: 'https://www.travioghana.com/about-us' },
            ]),
            buildOrganizationSchema(),
          ]}
        />

        {/* ================================================================
            1. HERO — copy + tilted moving gallery
            ================================================================ */}
        <section className="about-hero" aria-label="About Travio Ghana">
          <div className="about-container about-hero-grid">
            <motion.div
              className="about-hero-copy"
              initial="hidden"
              animate="visible"
              variants={stagger}
            >
              <motion.p className="about-kicker" variants={cardFade}>
                <span aria-hidden="true" />
                Discover who we are
              </motion.p>
              <motion.h1 className="about-hero-title" variants={cardFade}>
                Ghana feels <em>different</em> with a local.
              </motion.h1>
              <motion.p className="about-hero-lead" variants={cardFade}>
                Travio Ghana connects travellers with authentic, hand-picked
                experiences across Ghana — while giving trusted local operators the
                platform they deserve.
              </motion.p>
              <motion.div className="about-hero-actions" variants={cardFade}>
                <a href="#story" className="about-btn about-btn--primary">
                  Our story
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
                <a href="#values" className="about-btn about-btn--secondary">
                  What guides us
                </a>
              </motion.div>
              <motion.p className="about-hero-micro" variants={cardFade}>
                Locally vetted &middot; Secure booking &middot; Dedicated support
              </motion.p>
            </motion.div>

            <div className="about-gallery" aria-label="Moving gallery of Ghana experiences">
              {GALLERY_LANES.map((lane, laneIndex) => (
                <div
                  key={laneIndex}
                  className={`about-gallery-lane about-gallery-lane--${laneIndex + 1}`}
                >
                  <div className="about-gallery-strip">
                    {[0, 1].map((set) => (
                      <div
                        key={set}
                        className="about-gallery-set"
                        aria-hidden={set === 1 || undefined}
                      >
                        {lane.map((img) => (
                          <figure key={`${set}-${img.label}`} className="about-gallery-photo">
                            <img
                              src={img.src}
                              alt=""
                              width={img.width}
                              height={img.height}
                              loading={laneIndex === 0 && set === 0 ? 'eager' : 'lazy'}
                              fetchPriority={laneIndex === 0 && set === 0 ? 'high' : undefined}
                              decoding="async"
                            />
                            <figcaption>{img.label}</figcaption>
                          </figure>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="about-gallery-badge">
                <i aria-hidden="true" />
                Real Ghana. Real moments.
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            2. PROOF BAR — overlaps the hero
            ================================================================ */}
        <motion.section
          className="about-proof"
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={fadeUp}
          aria-label="Why travellers trust us"
        >
          <div className="about-container">
            <div className="about-proof-grid">
              {PROOF_ITEMS.map((item) => (
                <div key={item.label} className="about-proof-item">
                  <item.Icon size={22} aria-hidden="true" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ================================================================
            3. STORY — sticky intro + three cards
            ================================================================ */}
        <motion.section
          id="story"
          className="about-story"
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={stagger}
          aria-label="Our story"
        >
          <div className="about-container about-story-grid">
            <motion.div className="about-story-side" variants={fadeUp}>
              <p className="about-label">Our story</p>
              <h2 className="about-title">It started with one simple idea.</h2>
              <p className="about-lead">
                Make discovering Ghana easier for travellers — and create a stronger
                digital platform for the people who know it best.
              </p>
              <blockquote className="about-quote">
                &ldquo;Authentic travel should feel personal, trustworthy and
                connected to the place itself.&rdquo;
              </blockquote>
            </motion.div>

            <div className="about-story-cards">
              {STORY_CARDS.map((card) => (
                <motion.article
                  key={card.num}
                  className={`about-story-card${card.green ? ' about-story-card--green' : ''}`}
                  variants={cardFade}
                >
                  <span className="about-story-step">{card.num}</span>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ================================================================
            4. CATEGORIES — dark full-bleed section
            ================================================================ */}
        <section className="about-categories" aria-label="What travellers can discover">
          <motion.div
            className="about-container"
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={stagger}
          >
            <motion.div className="about-section-head" variants={fadeUp}>
              <div>
                <p className="about-label about-label--dark">What travellers can discover</p>
                <h2 className="about-title about-title--dark">
                  One platform. Many ways to experience Ghana.
                </h2>
              </div>
              <p>
                From cultural encounters to outdoor adventures and easy transfers,
                we bring trusted local experiences together.
              </p>
            </motion.div>

            <div className="about-category-grid">
              {CATEGORIES.map((cat) => (
                <motion.article key={cat.num} className="about-category-card" variants={cardFade}>
                  <span className="about-category-num">{cat.num}</span>
                  <div className="about-category-body">
                    <span className="about-category-icon" aria-hidden="true">
                      <cat.Icon size={24} />
                    </span>
                    <h3>{cat.title}</h3>
                    <p>{cat.text}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ================================================================
            5. VALUES
            ================================================================ */}
        <motion.section
          id="values"
          className="about-values"
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={stagger}
          aria-label="What we stand for"
        >
          <div className="about-container">
            <motion.div className="about-values-head" variants={fadeUp}>
              <p className="about-label">What we stand for</p>
              <h2 className="about-title">Trust is part of the experience.</h2>
              <p className="about-lead">
                These principles guide how we select experiences, support travellers
                and work with local partners.
              </p>
            </motion.div>

            <div className="about-value-grid">
              {VALUES.map((value, index) => (
                <motion.article
                  key={value.title}
                  className={`about-value-card${index === 2 ? ' about-value-card--highlight' : ''}`}
                  variants={cardFade}
                >
                  <span className="about-value-icon" aria-hidden="true">
                    <value.Icon size={22} />
                  </span>
                  <h3>{value.title}</h3>
                  <p>{value.text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ================================================================
            6. PARTNERS — moving logo cards
            ================================================================ */}
        <motion.div
          className="about-partners"
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={fadeUp}
        >
          <PartnersSection />
        </motion.div>

        {/* ================================================================
            7. PROMISE — acid shell
            ================================================================ */}
        <motion.section
          className="about-promise"
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={stagger}
          aria-label="The Travio Ghana difference"
        >
          <div className="about-container">
            <div className="about-promise-shell">
              <motion.div className="about-promise-left" variants={fadeUp}>
                <p className="about-label">The Travio Ghana difference</p>
                <h2 className="about-promise-title">
                  Local insight, with OTA-level confidence.
                </h2>
              </motion.div>

              <div className="about-promise-list">
                {PROMISES.map((item) => (
                  <motion.div key={item.num} className="about-promise-item" variants={cardFade}>
                    <span>{item.num}</span>
                    {item.text}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ================================================================
            8. VISIT US — office location on Google Maps
            ================================================================ */}
        <motion.section
          className="about-visit"
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={fadeUp}
          aria-label="Visit us"
        >
          <div className="about-container">
            <div className="about-visit-card">
              <div className="about-visit-info">
                <p className="about-label">Visit us</p>
                <h2 className="about-visit-title">{t('help.companyName')}</h2>
                <p className="about-visit-address">
                  {t('help.addressLine1')}
                  <br />
                  {t('help.addressLine2')}
                </p>
                <a
                  href={OFFICE_DIRECTIONS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="about-btn about-btn--primary"
                >
                  <Navigation size={16} aria-hidden="true" />
                  {t('help.getDirections')}
                </a>
              </div>
              <DeferredMap
                className="about-visit-map"
                title={`${t('help.companyName')} — ${t('help.addressLine1')}, ${t('help.addressLine2')}`}
                src={OFFICE_MAP_EMBED}
              />
            </div>
          </div>
        </motion.section>

        {/* ================================================================
            9. CTA
            ================================================================ */}
        <motion.section
          className="about-cta"
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={fadeUp}
          aria-label="Contact us"
        >
          <div className="about-container">
            <div className="about-cta-inner">
              <div>
                <h2>Want to know more about Travio Ghana?</h2>
                <p>Our team is ready to help you discover Ghana with confidence.</p>
              </div>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="about-cta-btn">
                Email our team
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            </div>
          </div>
        </motion.section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
