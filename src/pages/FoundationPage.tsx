import { useTranslation } from 'react-i18next'
import { MotionConfig, motion } from 'framer-motion'
import {
  Heart,
  Users,
  Folder,
  Handshake,
  Check,
  ChevronRight,
  ArrowRight,
} from 'lucide-react'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema, buildOrganizationSchema } from '../components/SEO'
import {
  fadeUp,
  revealViewport,
  stagger,
  staggerItem,
} from '../components/support/motion'
import help1 from '../assets/foundation/help1.avif'
import help2 from '../assets/foundation/help2.avif'
import help3 from '../assets/foundation/help3.avif'
import help4 from '../assets/foundation/help4.avif'
import help5 from '../assets/foundation/help5.avif'
import help6 from '../assets/foundation/help6.avif'
import help7 from '../assets/foundation/help7.avif'
import help8 from '../assets/foundation/help8.avif'
import help9 from '../assets/foundation/help9.avif'
import './SupportPages.css'
import './FoundationPage.css'

const GALLERY_LANE_1 = [
  { src: help1, alt: 'Travio Ghana Foundation community activity', label: 'Community' },
  { src: help3, alt: 'People taking part in a Foundation initiative', label: 'Support' },
  { src: help5, alt: 'Local impact supported by Travio Ghana', label: 'Opportunity' },
]

const GALLERY_LANE_2 = [
  { src: help2, alt: 'Foundation volunteers in Ghana', label: 'Together' },
  { src: help4, alt: 'Community-led Foundation work', label: 'Local action' },
  { src: help6, alt: 'Making a positive impact', label: 'Impact' },
]

const MISSION_CARDS = [
  {
    titleKey: 'foundation.missionTitle',
    desc: 'We commit 2% of every booking revenue generated through the Travio Ghana platform to the Foundation.',
  },
  {
    title: 'Local needs guide the work',
    desc: 'We listen to individuals, community leaders, schools and organisations to understand where support can be most useful.',
  },
  {
    title: 'Support creates opportunity',
    desc: 'From urgent personal needs to education, conservation and local development, the goal is practical, positive impact.',
  },
]

const FOCUS_AREAS = [
  {
    num: '01 / PEOPLE',
    Icon: Heart,
    titleKey: 'foundation.area1Title',
    descKey: 'foundation.area1Desc',
  },
  {
    num: '02 / PLACES',
    Icon: Users,
    titleKey: 'foundation.area2Title',
    descKey: 'foundation.area2Desc',
  },
  {
    num: '03 / PROGRESS',
    Icon: Folder,
    titleKey: 'foundation.area3Title',
    descKey: 'foundation.area3Desc',
  },
  {
    num: '04 / TOGETHER',
    Icon: Handshake,
    titleKey: 'foundation.area4Title',
    descKey: 'foundation.area4Desc',
  },
]

const IMPACT_SHOTS = [
  { src: help6, alt: 'Travio Ghana Foundation making an impact', caption: 'Making an impact' },
  { src: help7, alt: 'Foundation individual support', caption: 'Supporting people' },
  { src: help8, alt: 'Foundation community support', caption: 'Strengthening communities' },
  { src: help9, alt: 'Foundation volunteers', caption: 'Moving together' },
]

function GalleryLane({ images }: { images: typeof GALLERY_LANE_1 }) {
  return (
    <div className="fn-lane">
      <div className="fn-strip">
        <div className="fn-set">
          {images.map((img) => (
            <figure key={img.label} className="fn-photo">
              <img src={img.src} alt={img.alt} loading="lazy" />
              <span>{img.label}</span>
            </figure>
          ))}
        </div>
        <div className="fn-set" aria-hidden="true">
          {images.map((img) => (
            <figure key={`dup-${img.label}`} className="fn-photo">
              <img src={img.src} alt="" loading="lazy" />
              <span>{img.label}</span>
            </figure>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function FoundationPage() {
  const { t } = useTranslation()

  return (
    <MotionConfig reducedMotion="user">
      <div className="support-page">
        <SEO
          title={t('foundation.pageTitle')}
          description="The Travio Ghana Foundation turns every booking into positive impact for individuals, communities and community-led projects across Ghana."
          keywords="Travio Ghana Foundation, Ghana community support, sustainable tourism Ghana, travel foundation Ghana, community impact Ghana"
          jsonLd={[
            buildBreadcrumbSchema([
              { name: 'Home', url: 'https://www.travioghana.com/' },
              { name: 'Foundation', url: 'https://www.travioghana.com/foundation' },
            ]),
            buildOrganizationSchema(),
          ]}
        />

        {/* ============================================================ */}
        {/* 1. Hero                                                       */}
        {/* ============================================================ */}
        <section className="fn-hero">
          <div className="support-container fn-hero-grid">
            <motion.div
              className="fn-hero-copy"
              initial="hidden"
              animate="visible"
              variants={stagger}
            >
              <motion.div className="fn-kicker" variants={staggerItem}>
                <span className="fn-kicker-dot" />
                {t('foundation.heroLabel')}
              </motion.div>
              <motion.h1 variants={staggerItem}>
                Every journey can make a <em>difference.</em>
              </motion.h1>
              <motion.p variants={staggerItem}>
                We believe tourism should do more than create memorable
                experiences. It should help build stronger communities, support
                people in need and open new possibilities across Ghana.
              </motion.p>
              <motion.div className="fn-actions" variants={staggerItem}>
                <a href="#impact" className="fn-btn fn-btn--primary">
                  See how we help
                  <ChevronRight size={18} />
                </a>
                <a href="#get-involved" className="fn-btn fn-btn--secondary">
                  Get involved
                </a>
              </motion.div>
              <motion.div className="fn-micro" variants={staggerItem}>
                Every booking contributes &middot; Locally led support &middot; Shared impact
              </motion.div>
            </motion.div>

            <motion.div
              className="fn-gallery"
              aria-label="Moving gallery of the Travio Ghana Foundation's community work"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
            >
              <GalleryLane images={GALLERY_LANE_1} />
              <GalleryLane images={GALLERY_LANE_2} />
              <div className="fn-gallery-badge">
                <i />
                Travel that gives back.
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 2. Proof strip                                                */}
        {/* ============================================================ */}
        <div className="fn-proof">
          <div className="support-container fn-proof-inner">
            <div className="fn-proof-item">
              <strong>2%</strong> of every booking revenue
            </div>
            <div className="fn-proof-item">
              <span className="fn-proof-mark">01</span>
              Individual support
            </div>
            <div className="fn-proof-item">
              <span className="fn-proof-mark">02</span>
              Community action
            </div>
            <div className="fn-proof-item">
              <span className="fn-proof-mark">03</span>
              Local projects
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. Mission / Impact                                          */}
        {/* ============================================================ */}
        <section className="fn-mission" id="impact">
          <div className="support-container fn-mission-grid">
            <motion.div
              className="fn-mission-side"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <span className="fn-label">Making a difference through travel</span>
              <h2 className="fn-title">Travel should leave more behind than memories.</h2>
              <p className="fn-lead">
                A portion of each journey booked through Travio Ghana helps
                support individuals, strengthen communities and move important
                local projects forward.
              </p>
              <div className="fn-note">
                <strong>Your journey becomes part of theirs.</strong>
                When you travel with Travio Ghana, you are helping create
                a better journey for someone else.
              </div>
            </motion.div>

            <div className="fn-mission-content">
              {MISSION_CARDS.map((card, i) => (
                <motion.article
                  key={i}
                  className="fn-mission-card"
                  initial="hidden"
                  whileInView="visible"
                  viewport={revealViewport}
                  variants={fadeUp}
                >
                  <span className="fn-step">{`0${i + 1}`}</span>
                  <h3>{card.titleKey ? t(card.titleKey) : card.title}</h3>
                  <p>{card.desc}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 4. Focus areas (dark section)                                */}
        {/* ============================================================ */}
        <section className="fn-focus" id="focus">
          <div className="support-container">
            <motion.div
              className="fn-section-head"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <div>
                <span className="fn-label" style={{ color: '#baf0cb' }}>
                  {t('foundation.howWeHelp')}
                </span>
                <h2 className="fn-title">Four ways we help change the journey.</h2>
              </div>
              <p>
                Impact starts by listening. We work with people and partners to
                direct support where it can genuinely make a difference.
              </p>
            </motion.div>

            <div className="fn-focus-grid">
              {FOCUS_AREAS.map((area) => (
                <motion.article
                  key={area.num}
                  className="fn-focus-card"
                  initial="hidden"
                  whileInView="visible"
                  viewport={revealViewport}
                  variants={fadeUp}
                >
                  <span className="fn-focus-num">{area.num}</span>
                  <div>
                    <div className="fn-focus-icon">
                      <area.Icon size={25} />
                    </div>
                    <h3>{t(area.titleKey)}</h3>
                    <p>{t(area.descKey)}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 5. Commitment shell                                           */}
        {/* ============================================================ */}
        <section className="fn-commitment">
          <div className="support-container">
            <motion.div
              className="fn-commitment-shell"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <div className="fn-percent">
                2%
                <small>of every booking revenue</small>
              </div>
              <div className="fn-commitment-copy">
                <span className="fn-label">One simple commitment</span>
                <h2 className="fn-title">Your trip helps another journey begin.</h2>
                <p>
                  Every qualifying booking on the Travio Ghana platform
                  contributes to the Foundation. It is a simple way to connect
                  travel with real support — without asking travellers to add
                  anything extra.
                </p>
                <div className="fn-rule">
                  <span className="fn-rule-icon">
                    <Check size={18} />
                  </span>
                  Book an experience. Explore Ghana. Help create impact.
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 6. Help / Request support                                     */}
        {/* ============================================================ */}
        <section className="fn-help" id="request-help">
          <div className="support-container">
            <motion.div
              className="fn-help-head"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <div>
                <span className="fn-label">{t('foundation.needSupport')}</span>
                <h2 className="fn-title">Tell us where help is needed.</h2>
              </div>
              <p>
                Whether you are reaching out for yourself or on behalf of a
                community, the Foundation is ready to listen.
              </p>
            </motion.div>

            <div className="fn-help-grid">
              <motion.article
                className="fn-help-card"
                initial="hidden"
                whileInView="visible"
                viewport={revealViewport}
                variants={fadeUp}
              >
                <img src={help7} alt="Individual support through the Travio Ghana Foundation" loading="lazy" />
                <div className="fn-help-copy">
                  <span className="fn-help-tag">{t('foundation.forIndividuals')}</span>
                  <h3>Share your situation.</h3>
                  <p>
                    If you or someone you know needs support, start by telling
                    the Foundation what is happening and how help could make a
                    difference.
                  </p>
                  <a href="/contact-us" className="fn-btn">
                    {t('foundation.requestHelpBtn')}
                    <ArrowRight size={16} />
                  </a>
                </div>
              </motion.article>

              <motion.article
                className="fn-help-card"
                initial="hidden"
                whileInView="visible"
                viewport={revealViewport}
                variants={fadeUp}
              >
                <img src={help8} alt="Community support through the Travio Ghana Foundation" loading="lazy" />
                <div className="fn-help-copy">
                  <span className="fn-help-tag">{t('foundation.forCommunities')}</span>
                  <h3>Bring a local need forward.</h3>
                  <p>
                    Community leaders, schools and organisations can share an
                    initiative or need for the Foundation to consider.
                  </p>
                  <a href="/contact-us" className="fn-btn">
                    {t('foundation.getSupport')}
                    <ArrowRight size={16} />
                  </a>
                </div>
              </motion.article>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 7. Gallery section                                            */}
        {/* ============================================================ */}
        <section className="fn-gallery-section">
          <div className="support-container">
            <motion.div
              className="fn-gallery-head"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <span className="fn-label">{t('foundation.ourImpact')}</span>
              <h2 className="fn-title">Impact is built side by side.</h2>
              <p className="fn-lead">
                People, communities, travellers and partners all have a part to
                play in making tourism a force for good.
              </p>
            </motion.div>

            <div className="fn-impact-track">
              {IMPACT_SHOTS.map((shot) => (
                <motion.figure
                  key={shot.caption}
                  className="fn-impact-shot"
                  initial="hidden"
                  whileInView="visible"
                  viewport={revealViewport}
                  variants={fadeUp}
                >
                  <img src={shot.src} alt={shot.alt} loading="lazy" />
                  <figcaption>{shot.caption}</figcaption>
                </motion.figure>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 8. Volunteer                                                  */}
        {/* ============================================================ */}
        <section className="fn-volunteer" id="get-involved">
          <div className="support-container">
            <motion.div
              className="fn-volunteer-shell"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <div className="fn-volunteer-photo">
                <img src={help9} alt="Volunteer with the Travio Ghana Foundation" loading="lazy" />
              </div>
              <div className="fn-volunteer-copy">
                <span className="fn-label">{t('foundation.getInvolved')}</span>
                <h2 className="fn-title">Give your time. Make a difference.</h2>
                <p>
                  Meaningful change takes people who are ready to show up. Join
                  the Foundation's work and help turn care, experience and
                  practical skills into local action.
                </p>
                <ul className="fn-volunteer-points">
                  <li>
                    <span className="fn-check"><Check size={14} /></span>
                    Support community-led activities
                  </li>
                  <li>
                    <span className="fn-check"><Check size={14} /></span>
                    Contribute skills and experience
                  </li>
                  <li>
                    <span className="fn-check"><Check size={14} /></span>
                    Help meaningful projects move forward
                  </li>
                </ul>
                <a href="/contact-us" className="fn-btn fn-btn--primary">
                  {t('foundation.volunteerBtn')}
                  <ArrowRight size={17} />
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 9. CTA                                                        */}
        {/* ============================================================ */}
        <section className="fn-cta">
          <div className="support-container">
            <motion.div
              className="fn-cta-inner"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <div>
                <h2>{t('foundation.ctaTitle')}</h2>
                <p>{t('foundation.ctaText')}</p>
              </div>
              <a href="/contact-us" className="fn-btn">
                {t('foundation.ctaGetInvolved')}
              </a>
            </motion.div>
          </div>
        </section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
