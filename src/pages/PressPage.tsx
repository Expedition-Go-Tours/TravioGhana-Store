import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema } from '../components/SEO'
import FeaturedIn from '../components/FeaturedIn'
import CopyButton from '../components/shared/CopyButton'
import { SUPPORT_EMAIL } from '../lib/support'
import './PressPage.css'

/**
 * Press & Media Kit — /press
 *
 * The page journalists, editors and partners are pointed at from outreach.
 * Every claim on it has to stay verifiable elsewhere on the site: the legal
 * entity and GTA registration mirror the supplier pages, the 2% commitment
 * mirrors the Foundation page, and the assets are the same files the site
 * itself renders.
 *
 * The download URLs under /press/ are press-stable on purpose — the root
 * /logo.png is referenced by structured data and should not be handed out as
 * the canonical media asset, so the kit carries standardised copies.
 */

const PRESS_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Press enquiry')}`

const FACTS: { label: string; value: string }[] = [
  { label: 'Brand', value: 'Travio Ghana' },
  { label: 'Legal entity', value: 'Expedition-Go Tours Ltd' },
  {
    label: 'Registration',
    value: 'Registered and regulated with the Ghana Tourism Authority (GTA)',
  },
  { label: 'Based in', value: 'Accra, Greater Accra, Ghana' },
  {
    label: 'What it is',
    value: 'An online marketplace for tours, safaris and cultural experiences across Ghana',
  },
  {
    label: 'Where it operates',
    value: 'Accra, Cape Coast, Kumasi, the Volta Region, Mole National Park and beyond',
  },
  {
    label: 'Travellers',
    value:
      'Independent travellers, families, groups and diaspora visitors, booking online with secure card and wallet payments',
  },
  {
    label: 'Impact',
    value: '2% of every booking revenue supports the Travio Ghana Foundation',
  },
  { label: 'Press contact', value: SUPPORT_EMAIL },
]

const ASSETS = [
  {
    name: 'Primary logo — wordmark',
    file: '/press/travio-ghana-wordmark.png',
    meta: 'PNG · 1600 × 347 · transparent background',
    alt: 'Travio Ghana wordmark reading “An Expedition-Go Tours Company”',
  },
  {
    name: 'Logo mark',
    file: '/press/travio-ghana-mark-512.png',
    meta: 'PNG · 512 × 512 · transparent background',
    alt: 'Travio Ghana circular logo mark',
  },
  {
    name: 'Social card',
    file: '/press/travio-ghana-social-card.png',
    meta: 'PNG · 1200 × 630 · article headers and social posts',
    alt: 'Travio Ghana social sharing card',
  },
]

const GUIDELINES_USE = [
  'Write the name as “Travio Ghana”. On first mention, “Travio Ghana, operated by Expedition-Go Tours Ltd” is welcome.',
  'Use the supplied files unmodified, on backgrounds with clear contrast.',
  'Keep clear space around the mark — roughly the height of the letters in “TG”.',
  'Link to travioghana.com whenever you reference the platform or a specific experience.',
]

const GUIDELINES_AVOID = [
  'Don’t recolour, stretch, rotate or add effects to the logo.',
  'Don’t use our marks to imply a sponsorship, endorsement or partnership that doesn’t exist.',
  'Don’t present the Expedition-Go Tours logo as Travio Ghana’s, or the reverse — they are different brands.',
  'Don’t republish screenshots showing prices or availability; link to the live page instead.',
]

const SHORT_BOILERPLATE =
  'Travio Ghana is a Ghana-based travel marketplace for tours and experiences, operated by Expedition-Go Tours Ltd, a Ghana Tourism Authority-registered tour operator based in Accra.'

const LONG_BOILERPLATE =
  'Travio Ghana is the online marketplace where travellers discover and book tours, safaris and cultural experiences across Ghana. Operated by Expedition-Go Tours Ltd — a Ghana Tourism Authority-registered operator based in Accra — the platform works with vetted local suppliers to offer everything from Cape Coast Castle heritage tours and Kakum canopy walks to Mole National Park safaris and food tours in Accra. Every booking supports the Travio Ghana Foundation, which directs 2% of booking revenue to community projects across the country.'

export default function PressPage() {
  return (
    <div className="press-page">
      <SEO
        title="Press & Media Kit"
        description="Press and media resources for Travio Ghana: approved brand assets, verified company facts, boilerplate copy and a direct press contact for journalists and editors."
        keywords="Travio Ghana press, Travio Ghana media kit, Ghana travel marketplace press, Expedition-Go Tours press, Ghana tourism media resources"
        jsonLd={[
          buildBreadcrumbSchema([
            { name: 'Home', url: 'https://www.travioghana.com/' },
            { name: 'Press', url: 'https://www.travioghana.com/press' },
          ]),
        ]}
      />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="press-hero">
          <div className="press-wrap">
            <div className="press-kicker">
              <span />
              For journalists &amp; editors
            </div>
            <h1>
              Press &amp; media <em>kit.</em>
            </h1>
            <p className="press-lead">
              Approved brand assets, verified company facts and a direct press contact — everything you need to
              write about Travio Ghana with confidence. Looking for bookable experiences? Everything is on{' '}
              <Link to="/tours">travioghana.com</Link>.
            </p>
            <div className="press-actions">
              <a className="press-btn press-btn--primary" href={PRESS_MAILTO}>
                Email the press team
              </a>
              <a className="press-btn press-btn--secondary" href="#brand-assets">
                Download brand assets
              </a>
            </div>
          </div>
        </section>

        {/* ── Fast facts ───────────────────────────────────────────────── */}
        <section className="press-section" id="facts">
          <div className="press-wrap">
            <div className="press-section-head">
              <span className="press-label">The short version</span>
              <h2>Fast facts</h2>
              <p>
                Sourced from the business itself — keep these numbers and names as written, or verify anything
                against the contact at the bottom of this page.
              </p>
            </div>
            <dl className="press-facts">
              {FACTS.map((fact) => (
                <div className="press-fact" key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Boilerplate ──────────────────────────────────────────────── */}
        <section className="press-section press-section--tint" id="boilerplate">
          <div className="press-wrap">
            <div className="press-section-head">
              <span className="press-label">Ready to publish</span>
              <h2>Boilerplate copy</h2>
              <p>
                Two pre-written descriptions of the company. Copy one as-is, or use it as the factual base for your
                own words.
              </p>
            </div>
            <div className="press-boilerplates">
              <article className="press-boilerplate">
                <h3>One sentence</h3>
                <p>{SHORT_BOILERPLATE}</p>
                <CopyButton value={SHORT_BOILERPLATE} label="Copy short version" className="press-copy-btn" />
              </article>
              <article className="press-boilerplate">
                <h3>Full paragraph</h3>
                <p>{LONG_BOILERPLATE}</p>
                <CopyButton value={LONG_BOILERPLATE} label="Copy full paragraph" className="press-copy-btn" />
              </article>
            </div>
          </div>
        </section>

        {/* ── Brand assets ─────────────────────────────────────────────── */}
        <section className="press-section" id="brand-assets">
          <div className="press-wrap">
            <div className="press-section-head">
              <span className="press-label">Downloads</span>
              <h2>Brand assets</h2>
              <p>
                High-resolution files, free to use in editorial coverage. Please follow the usage notes directly
                below the downloads.
              </p>
            </div>
            <div className="press-assets">
              {ASSETS.map((asset) => (
                <article className="press-asset" key={asset.file}>
                  <div className="press-asset-preview">
                    <img src={asset.file} alt={asset.alt} loading="lazy" decoding="async" />
                  </div>
                  <div className="press-asset-body">
                    <h3>{asset.name}</h3>
                    <p className="press-asset-meta">{asset.meta}</p>
                    <a className="press-asset-download" href={asset.file} download>
                      Download PNG
                    </a>
                  </div>
                </article>
              ))}
            </div>

            {/* ── Usage guidelines ──────────────────────────────────────── */}
            <div className="press-guidelines" id="guidelines">
              <div className="press-guidelines-col press-guidelines-col--use">
                <h3>Using the brand</h3>
                <ul>
                  {GUIDELINES_USE.map((item) => (
                    <li key={item}>
                      <i aria-hidden="true">✓</i>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="press-guidelines-col press-guidelines-col--avoid">
                <h3>Please avoid</h3>
                <ul>
                  {GUIDELINES_AVOID.map((item) => (
                    <li key={item}>
                      <i aria-hidden="true">✕</i>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Selected coverage (empty until mentions exist) ───────────── */}
        <FeaturedIn />

        {/* ── Press contact ────────────────────────────────────────────── */}
        <section className="press-contact" id="contact">
          <div className="press-wrap press-contact-inner">
            <div>
              <span className="press-label press-label--light">Press contact</span>
              <h2>Writing something? Talk to us first.</h2>
              <p>
                We can confirm figures, arrange interviews with the founding team in Accra, or help you find the
                right supplier to comment on a story.
              </p>
            </div>
            <div className="press-contact-actions">
              <a className="press-btn press-btn--light" href={PRESS_MAILTO}>
                {SUPPORT_EMAIL}
              </a>
              <Link className="press-contact-secondary" to="/contact-us">
                Non-press enquiries → Help Centre
              </Link>
            </div>
          </div>
        </section>

        {/* ── Partner cross-link ───────────────────────────────────────── */}
        <section className="press-partner-note">
          <div className="press-wrap">
            <p>
              Linking to us from your own site? Badges, embed snippets and campaign links live on the{' '}
              <Link to="/partner-resources">partner resources</Link> page.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
