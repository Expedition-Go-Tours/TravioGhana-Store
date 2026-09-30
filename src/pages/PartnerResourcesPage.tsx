import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema } from '../components/SEO'
import CopyButton from '../components/shared/CopyButton'
import { SUPPORT_EMAIL } from '../lib/support'
import './PartnerResourcesPage.css'

/**
 * Partner Resources — /partner-resources
 *
 * The page that exists to make linking back effortless: badges, copy-paste
 * snippets and campaign-link conventions for suppliers, hotels, transport
 * partners, travel agents and creators.
 *
 * Every snippet points at the canonical host (www.travioghana.com) so partner
 * sites never link to a non-canonical variant. `PARTNER` in the UTM examples is
 * deliberately left as a token to replace — a copied link with a hardcoded
 * partner slug would attribute someone else's traffic.
 */

const SITE = 'https://www.travioghana.com'
const PARTNER_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Partner resources')}`

const AUDIENCES = [
  { label: 'Suppliers & tour operators', to: '/supplier/list-experience' },
  { label: 'Hotels & stays', to: '/hotels' },
  { label: 'Transport providers', to: '/transport-providers' },
  { label: 'Travel agents', to: '/travel-agents' },
  { label: 'Content creators', to: '/content-creators' },
]

const BADGES = [
  {
    name: 'Green',
    file: '/badges/book-on-travioghana-green.svg',
    desc: 'The default. Sits on light backgrounds and pale photography.',
  },
  {
    name: 'Dark',
    file: '/badges/book-on-travioghana-dark.svg',
    desc: 'For white or very light pages where the green badge feels heavy.',
  },
  {
    name: 'Outline',
    file: '/badges/book-on-travioghana-outline.svg',
    desc: 'For busy or coloured backgrounds where filled badges get lost.',
  },
  {
    name: 'Official booking partner',
    file: '/badges/official-booking-partner.svg',
    desc: 'For hotels, agents and transport partners taking bookings through Travio Ghana.',
  },
]

const badgeSnippet = (file: string) =>
  `<a href="${SITE}/?utm_source=PARTNER&utm_medium=referral" target="_blank" rel="noopener">\n  <img src="${SITE}${file}" alt="Book on Travio Ghana" width="232" height="64" />\n</a>`

const LINK_EXAMPLES = [
  {
    title: 'The homepage',
    body: 'Use this in a partners section, a footer link or a blog roll.',
    code: `<a href="${SITE}/?utm_source=PARTNER&utm_medium=referral">Ghana tours & experiences — Travio Ghana</a>`,
  },
  {
    title: 'A destination',
    body: 'Destination pages list every experience in a city or region, live from the catalogue.',
    code: `<a href="${SITE}/tours?place=Accra&utm_source=PARTNER&utm_medium=referral">Tours and experiences in Accra</a>`,
  },
  {
    title: 'Your own listing',
    body: 'Link straight to a specific tour or your supplier profile so guests land in the right place. Replace the example path with yours.',
    code: `<a href="${SITE}/tour/TOUR-ID/tour-slug?utm_source=PARTNER&utm_medium=referral">Book this experience on Travio Ghana</a>`,
  },
]

const ATTRIBUTION_EXAMPLE = `${SITE}/tours?place=Cape%20Coast&utm_source=your-partner-slug&utm_medium=referral&utm_campaign=newsletter`

const SUGGESTED_WORDING =
  'Find verified Ghana tours, safaris and cultural experiences on Travio Ghana — from Accra city tours to Cape Coast heritage days and Mole National Park safaris.'

export default function PartnerResourcesPage() {
  return (
    <div className="pr-page">
      <SEO
        title="Partner Resources — Badges & Link Snippets"
        description="Badges, copy-paste link snippets and campaign-link conventions for Travio Ghana partners: suppliers, hotels, transport providers, travel agents and content creators."
        keywords="Travio Ghana partner resources, link to Travio Ghana, Travio Ghana badge, Ghana partner link, book on Travio Ghana"
        jsonLd={[
          buildBreadcrumbSchema([
            { name: 'Home', url: 'https://www.travioghana.com/' },
            { name: 'Partner Resources', url: 'https://www.travioghana.com/partner-resources' },
          ]),
        ]}
      />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="pr-hero">
          <div className="pr-wrap">
            <div className="pr-kicker">
              <span />
              Partner resources
            </div>
            <h1>
              Link to Travio Ghana <em>from your site.</em>
            </h1>
            <p className="pr-lead">
              Badges, copy-paste snippets and campaign-link conventions — everything a supplier, hotel, transport
              partner, agent or creator needs to send guests straight to the right experience. No sign-in required.
            </p>
            <div className="pr-actions">
              <a className="pr-btn pr-btn--primary" href="#badges">
                Get the badges
              </a>
              <a className="pr-btn pr-btn--secondary" href="#links">
                Copy link snippets
              </a>
            </div>
            <div className="pr-audiences" aria-label="Who these resources are for">
              {AUDIENCES.map((audience) => (
                <Link key={audience.to} to={audience.to}>
                  {audience.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Badges ───────────────────────────────────────────────────── */}
        <section className="pr-section" id="badges">
          <div className="pr-wrap">
            <div className="pr-section-head">
              <span className="pr-label">Badges</span>
              <h2>Put our badge on your page.</h2>
              <p>
                All badges are SVGs — they stay sharp at any size. Download one, or copy the embed code and paste it
                straight into your site. Both include your referral parameters automatically.
              </p>
            </div>
            <div className="pr-badges">
              {BADGES.map((badge) => (
                <article className="pr-badge" key={badge.file}>
                  <div className="pr-badge-preview">
                    <img src={badge.file} alt={`Book on Travio Ghana badge — ${badge.name.toLowerCase()} style`} loading="lazy" />
                  </div>
                  <div className="pr-badge-body">
                    <h3>{badge.name}</h3>
                    <p>{badge.desc}</p>
                    <div className="pr-badge-actions">
                      <a className="pr-download" href={badge.file} download>
                        Download SVG
                      </a>
                      <CopyButton
                        value={badgeSnippet(badge.file)}
                        label="Copy embed code"
                        className="pr-copy-btn pr-copy-btn--ghost"
                      />
                    </div>
                    <pre className="pr-code">
                      <code>{badgeSnippet(badge.file)}</code>
                    </pre>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Link snippets ────────────────────────────────────────────── */}
        <section className="pr-section pr-section--tint" id="links">
          <div className="pr-wrap">
            <div className="pr-section-head">
              <span className="pr-label">Link snippets</span>
              <h2>Link to a page, not just the homepage.</h2>
              <p>
                Replace <code>PARTNER</code> in each snippet with your own short partner slug, then paste the HTML
                into your site. Prefer plain text? The same URLs work as ordinary links — the{' '}
                <code>utm_</code> parameters are optional but helpful.
              </p>
            </div>
            <div className="pr-links">
              {LINK_EXAMPLES.map((example) => (
                <article className="pr-link-card" key={example.title}>
                  <h3>{example.title}</h3>
                  <p>{example.body}</p>
                  <pre className="pr-code">
                    <code>{example.code}</code>
                  </pre>
                  <CopyButton value={example.code} label="Copy snippet" className="pr-copy-btn" />
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Attribution ──────────────────────────────────────────────── */}
        <section className="pr-section" id="attribution">
          <div className="pr-wrap">
            <div className="pr-section-head">
              <span className="pr-label">Attribution</span>
              <h2>Getting credit for the visitors you send.</h2>
              <p>
                Travio Ghana records campaign parameters when a visitor arrives, so the team can see which partner
                sent them. The convention is simple:
              </p>
            </div>
            <div className="pr-utm">
              <ul className="pr-utm-list">
                <li>
                  <code>utm_source</code> — your partner slug, e.g. <code>your-partner-slug</code>
                </li>
                <li>
                  <code>utm_medium</code> — use <code>referral</code> for links on your own site
                </li>
                <li>
                  <code>utm_campaign</code> — optional; name the campaign, e.g. <code>newsletter</code>
                </li>
              </ul>
              <div className="pr-utm-example">
                <span>Full example</span>
                <pre className="pr-code pr-code--dark">
                  <code>{ATTRIBUTION_EXAMPLE}</code>
                </pre>
                <CopyButton value={ATTRIBUTION_EXAMPLE} label="Copy example link" className="pr-copy-btn" />
              </div>
            </div>

            {/* ── Suggested wording ─────────────────────────────────────── */}
            <div className="pr-wording">
              <div>
                <h3>Need the words too?</h3>
                <p>
                  A neutral sentence you can use next to any link or badge. Anchors like{' '}
                  <strong>“Travio Ghana”</strong> or <strong>“Ghana tours and experiences”</strong> are the most
                  natural.
                </p>
              </div>
              <div className="pr-wording-copy">
                <p className="pr-wording-block">{SUGGESTED_WORDING}</p>
                <CopyButton value={SUGGESTED_WORDING} label="Copy sentence" className="pr-copy-btn" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Contact ──────────────────────────────────────────────────── */}
        <section className="pr-contact" id="contact">
          <div className="pr-wrap pr-contact-inner">
            <div>
              <span className="pr-label pr-label--light">Questions</span>
              <h2>Need a custom asset or a co-branded link?</h2>
              <p>
                Tell us what you are building — a landing page, a newsletter footer, an itinerary PDF — and we will
                put together what you need.
              </p>
            </div>
            <div className="pr-contact-actions">
              <a className="pr-btn pr-btn--light" href={PARTNER_MAILTO}>
                {SUPPORT_EMAIL}
              </a>
              <Link className="pr-contact-secondary" to="/press">
                Writing about us? Visit the press kit →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
