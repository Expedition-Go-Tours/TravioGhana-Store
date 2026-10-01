/* ============================================================================
   Travel Agents — /travel-agents
   ----------------------------------------------------------------------------
   Port of Travio_Ghana_Travel_Agents_Rates_Mobile.html.

   The template was a standalone document: its .topline strip, .header brand bar
   and .footer are dropped (this route renders the app's global Navbar and
   Footer), its html/body/:root resets live on the `.ta-page` wrapper, and its
   four click handlers are reimplemented as React state. See
   src/styles/TravelAgents.css for the CSS notes.

   The page used to hot-link four Wikimedia Commons photos through
   Special:FilePath. Production's Content-Security-Policy whitelists
   commons.wikimedia.org but not the thumb.wikimedia.org host that FilePath
   redirects to, so the hero frame and all three destination cards were blocked
   there and rendered empty. `scripts/generate-travel-agent-images.cjs`
   downloads those originals once and writes WebPs into src/assets/travel-agents
   at their real display footprint (2x); the credits at the foot of the page
   carry the attribution.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import SEO from '../components/SEO'
import travioLogoSrc from '../assets/TravioGhana_Logo.svg'

/**
 * Photos from `scripts/generate-travel-agent-images.cjs` — see the header note.
 */
import accraSkyline from '../assets/travel-agents/accra-skyline.webp'
import aburiBotanicalGardens from '../assets/travel-agents/aburi-botanical-gardens.webp'
import capeCoastCastle from '../assets/travel-agents/cape-coast-castle.webp'
import kakumCanopyWalkway from '../assets/travel-agents/kakum-canopy-walkway.webp'
import '../styles/partner-pages.css'
import '../styles/TravelAgents.css'

const CONTACT = 'https://www.expeditiongotours.com/contact-us?subject=Travel%20agent%20partnership'

/** The three real Travio Ghana products the agent-desk preview links to. */
const TOURS = {
  accra: {
    id: 'cmt8ij61a00oc646p0sq1d8xq',
    slug: 'accra-guided-city-tour-cultural-and-historical-experience',
    title: 'Accra Guided City Tour: Cultural and Historical Experience',
    short: 'Accra Guided City Tour',
    meta: 'Accra · 6 hours',
    img: 'https://res.cloudinary.com/dfpagrtoy/image/upload/c_crop,w_1200,h_800,q_auto:good,f_auto/v1787654031/user-photos/e2orssutwzlqdun1wito.jpg',
  },
  capeCoast: {
    id: 'cmt8hjkii00bo646phdiznmrr',
    slug: 'cape-coast-castle-elmina-castle-kakum-national-park-tour',
    title: 'Cape Coast Castle, Elmina Castle & Kakum National Park Tour',
    short: 'Cape Coast, Elmina & Kakum',
    meta: 'Cape Coast · 11 hours',
    img: 'https://res.cloudinary.com/dfpagrtoy/image/upload/c_crop,w_1200,h_800,q_auto:good,f_auto/v1787653782/user-photos/erjqa4gam2uqoy9kih0c.jpg',
  },
  waterfalls: {
    id: 'cmt8hizsj00bk646ppg06lw18',
    slug: 'from-accra-waterfalls-aburi-gardens-cocoa-farm-tour',
    title: 'From Accra: Waterfalls, Aburi Gardens & Cocoa Farm Tour',
    short: 'Waterfalls & Aburi Gardens',
    meta: 'Eastern Region · 7 hours',
    img: 'https://res.cloudinary.com/dfpagrtoy/image/upload/c_crop,w_1200,h_800,q_auto:good,f_auto/v1787654560/user-photos/cthmqvlp7swcia1wto92.jpg',
  },
} as const

const tourPath = (t: { id: string; slug: string }) => `/tour/${t.id}/${t.slug}`

const STATS = [
  { count: '01', label: 'Apply for an agent account' },
  { count: '02', label: 'Access eligible trade rates' },
  { count: '03', label: 'Book for clients with support' },
]

const BENEFITS = [
  {
    feature: true,
    icon: '₵',
    title: 'Keep more of the value you create.',
    body: 'Approved agents see reduced partner rates on eligible experiences. Quote your client, set your selling price and see your potential margin before confirming. Rates and availability vary by product.',
  },
  {
    icon: '▦',
    title: 'One agent workspace',
    body: 'See trip details, booking status, guest information and upcoming departures together.',
  },
  {
    icon: '◉',
    title: 'Ghana focused inventory',
    body: 'Build itineraries around Accra, Cape Coast, Kakum, Akosombo and more.',
  },
  {
    icon: '✦',
    title: 'People to back you up',
    body: 'Our Ghana based team can help with tour details, pickup questions and booking changes.',
  },
]

const DESTINATIONS = [
  { img: capeCoastCastle, alt: "Cape Coast Castle on Ghana's coast", region: 'CENTRAL REGION', title: 'Cape Coast heritage', body: 'Stories, culture and the coast.' },
  { img: kakumCanopyWalkway, alt: 'Canopy walkway at Kakum National Park, Ghana', region: 'CENTRAL REGION', title: 'Kakum adventures', body: 'Nature from a new perspective.' },
  { img: aburiBotanicalGardens, alt: 'Aburi Botanical Gardens in Ghana', region: 'EASTERN REGION', title: 'Aburi escapes', body: 'Green spaces and slower moments.' },
]

const STEPS = [
  { num: '01', title: 'Sign up', body: 'Provide your basic contact and business information through the partner registration process.' },
  { num: '02', title: 'Receive your partner access', body: 'Our team reviews your details and shares your access and applicable rates.' },
  { num: '03', title: 'Log in and start booking', body: 'Browse eligible experiences, prepare a quote and manage client bookings.' },
]

const DASH_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tours', label: 'Tours' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'clients', label: 'Clients' },
  { key: 'earnings', label: 'Rates & margin' },
] as const

const SAMPLE_BOOKINGS = [
  { thumb: 'AC', title: 'Accra Guided City Tour', meta: '2 guests · Confirmed', status: 'Ready' },
  { thumb: 'CC', title: 'Cape Coast, Elmina & Kakum', meta: '4 guests · Awaiting confirmation', status: 'Pending' },
  { thumb: 'AB', title: 'Shai Hills & Akosombo Cruise', meta: '3 guests · Quote in progress', status: 'Draft' },
]

const SAMPLE_CLIENTS = [
  { thumb: 'JM', title: 'Jordan M.', meta: 'Accra City Tour · 2 travellers', status: 'Booked' },
  { thumb: 'SA', title: 'Sam A.', meta: 'Cape Coast & Kakum · 4 travellers', status: 'Pending' },
]

const FAQS = [
  { n: '01', q: 'What is the Travel Agent portal?', a: 'A dedicated platform where you can browse, recommend and book curated travel experiences for clients while managing reservations efficiently.' },
  { n: '02', q: 'What experiences are available?', a: 'The programme provides access to a broad selection of tours and activities, including cultural, adventure, food, nature and city experiences.' },
  { n: '03', q: 'How much can I earn?', a: 'Earnings depend on the number of successful bookings you make. Your potential margin depends on the partner rate, your selling price and the final booking terms. Check the rate for each eligible experience before quoting.' },
  { n: '04', q: 'How and when do I get paid?', a: 'Your margin and payment terms depend on the agreed partner arrangement. Confirm the applicable terms with our team when your account is approved.' },
  { n: '05', q: 'Can clients book for themselves?', a: 'You can manage bookings for clients. Ask our team which direct booking or referral tools are available for your account.' },
  { n: '06', q: 'What support is available?', a: 'You have access to a dedicated support team, tutorial videos, an extensive resource centre and a wider community of travel agents.' },
  { n: '07', q: 'What happens after signing up?', a: 'Our team reviews your request and explains access, available rates and how to place your first client booking.' },
]

/** The template's sample trade rate; the margin calculator is built around it. */
const SAMPLE_AGENT_RATE = 800

export default function TravelAgentsPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<(typeof DASH_TABS)[number]['key']>('overview')
  const [openFaq, setOpenFaq] = useState(0)
  const [clientPrice, setClientPrice] = useState(1000)

  // The template's `.reveal` IntersectionObserver, scoped to this page.
  useEffect(() => {
    const root = pageRef.current
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('in'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 },
    )
    nodes.forEach((n) => observer.observe(n))
    return () => observer.disconnect()
  }, [])

  // The template's margin calculator: gross margin above the sample agent rate.
  const margin =
    Number.isFinite(clientPrice) && clientPrice >= SAMPLE_AGENT_RATE
      ? `GHS ${new Intl.NumberFormat('en-GH').format(clientPrice - SAMPLE_AGENT_RATE)}`
      : `Enter GHS ${SAMPLE_AGENT_RATE}+`

  return (
    <div className="ta-page" ref={pageRef}>
      <main>
        <SEO
          title="Travel Agent & Reseller Programme — Partner Rates on Ghana Tours"
          description="Access reduced partner rates on Ghana tours and experiences. Plan trips, manage client bookings and keep your margins clear in one agent workspace."
          keywords="travel agent Ghana, tour operator partner rates Ghana, Ghana resell tours, travel agent programme Ghana, wholesale Ghana tours, affiliate Ghana tours"
          jsonLd={[
            {
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              name: 'Travel Agent & Reseller Programme',
              description:
                'Access reduced partner rates on Ghana tours and experiences. Plan trips, manage client bookings and keep your margins clear in one agent workspace.',
              url: 'https://www.travioghana.com/travel-agents',
              about: { '@type': 'Organization', name: 'Travio Ghana', url: 'https://www.travioghana.com' },
            },
          ]}
        />
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="kicker">
                <span />
                Travel agent &amp; reseller programme
              </div>
              <h1>
                More Ghana for your clients. <em>More room to earn.</em>
              </h1>
              <p>
                Access reduced partner rates on Ghana tours and experiences. Plan trips, manage client bookings and
                keep your margins clear in one agent workspace.
              </p>
              <div className="hero-actions">
                <a className="btn primary" href={CONTACT} target="_blank" rel="noopener noreferrer">
                  Become a travel partner
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                </a>
                <a className="btn secondary" href="#agent-desk">See the agent desk</a>
              </div>
              <div className="micro">
                <span><i />Private partner pricing</span>
                <span><i />Client booking workspace</span>
                <span><i />Ghana based support</span>
              </div>
            </div>

            <div className="portrait-stage">
              <div className="portrait-frame">
                <img src={accraSkyline} alt="Accra Airport City skyline in Ghana" decoding="async" fetchPriority="high" />
              </div>
              <div className="agent-badge">
                <span>Made for travel professionals</span>
                <strong>Partner trade rates</strong>
              </div>
              <div className="booking-card">
                <div className="booking-top">
                  <span>Client booking</span>
                  <span className="booking-status">Confirmed</span>
                </div>
                <h3>Accra cultural experience</h3>
                <p>Booked through your travel agent portal</p>
                <div className="booking-meta">
                  <span>Your margin</span>
                  <strong>Partner rate</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <section className="stats">
          <div className="container stats-inner">
            <div className="stats-intro">
              <h2>A practical partnership for selling Ghana.</h2>
            </div>
            {STATS.map((s) => (
              <div className="stat" key={s.count}>
                <strong>{s.count}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Benefits ───────────────────────────────────────────────────── */}
        <section className="benefits" id="benefits">
          <div className="container">
            <div className="benefit-head reveal">
              <div>
                <span className="label">Your partner advantage</span>
                <h2 className="title"><span>A better rate.</span> A better way to manage the trip.</h2>
              </div>
              <p>Designed for agents building Ghana itineraries, from a single city tour to a multi stop client journey.</p>
            </div>
            <div className="benefit-grid">
              {BENEFITS.map((b) => (
                <article
                  className={b.feature ? 'benefit-card benefit-feature reveal' : 'benefit-card reveal'}
                  key={b.title}
                >
                  <div className="benefit-icon">{b.icon}</div>
                  {b.feature && (
                    <div className="rate-sample">
                      <span>PUBLIC RATE</span>
                      <i />
                      <span>YOUR AGENT RATE</span>
                      <strong>Preferred pricing</strong>
                    </div>
                  )}
                  <h3>{b.title}</h3>
                  <p>{b.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Destinations ───────────────────────────────────────────────── */}
        <section className="selling" id="destinations">
          <div className="container">
            <div className="selling-head reveal">
              <span className="label">Build the itinerary</span>
              <h2 className="title">Ghana experiences your clients will remember.</h2>
              <p className="lead">
                A few places to start. Your partner account shows the experiences and rates currently available to you.
              </p>
            </div>
            <div className="destination-grid">
              {DESTINATIONS.map((d) => (
                <article className="destination-card reveal" key={d.title}>
                  <img src={d.img} alt={d.alt} loading="lazy" />
                  <div>
                    <span>{d.region}</span>
                    <h3>{d.title}</h3>
                    <p>{d.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Steps ──────────────────────────────────────────────────────── */}
        <section className="steps" id="how-it-works">
          <div className="container steps-shell">
            <div className="steps-copy reveal">
              <span className="label">Getting started is easy</span>
              <h2 className="title">Apply, get access, start selling Ghana.</h2>
              <p className="lead">Share a few details about your agency so we can set up the right partner access.</p>
              <div className="time-pill"><span>⌁</span>Designed for a fast start</div>
            </div>
            <div className="step-list">
              {STEPS.map((s) => (
                <article className="step-card reveal" key={s.num}>
                  <span className="step-num">{s.num}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Agent desk preview ─────────────────────────────────────────── */}
        <section className="portal" id="agent-desk">
          <div className="container portal-grid">
            <div className="portal-copy reveal">
              <span className="label">A workspace made for agents</span>
              <h2 className="title">Know where every client trip stands.</h2>
              <p>
                Move from finding a tour to confirming a booking without losing track of your clients. Explore this
                interactive preview of the proposed agent desk.
              </p>
              <div className="portal-points">
                <div className="portal-point"><span>EXPLORE</span>Browse Ghana experiences</div>
                <div className="portal-point"><span>QUOTE</span>Compare partner pricing</div>
                <div className="portal-point"><span>MANAGE</span>Follow client bookings</div>
                <div className="portal-point"><span>REVIEW</span>See your margin</div>
              </div>
              <p className="demo-disclaimer">
                Interface preview. Sample trips and amounts below are illustrative, not live account data.
              </p>
            </div>

            <div className="dashboard reveal" aria-label="Interactive preview of the proposed travel agent dashboard">
              <div className="dash-window">
                <div className="dash-nav">
                  <span className="dash-brand">
                    <img src={travioLogoSrc} alt="Travio Ghana logo" />
                    <small>Agent desk</small>
                  </span>
                  <span className="dash-user" aria-label="Sample agent profile">AG</span>
                </div>
                <div className="dash-layout">
                  <nav className="dash-menu" aria-label="Dashboard preview sections">
                    {DASH_TABS.map((tab) => (
                      <button
                        key={tab.key}
                        className={tab.key === activeTab ? 'dash-tab active' : 'dash-tab'}
                        data-tab={tab.key}
                        type="button"
                        aria-pressed={tab.key === activeTab}
                        onClick={() => setActiveTab(tab.key)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                  <div className="dash-body">
                    <div className="dash-context">AGENT DESK PREVIEW · BOOKINGS ARE EXAMPLES</div>

                    <section className={activeTab === 'overview' ? 'dash-panel active' : 'dash-panel'} data-panel="overview">
                      <h3>Good morning, Agent.</h3>
                      <p className="dash-sub">Real tours and sample bookings at a glance.</p>
                      <div className="dash-cards">
                        <div className="dash-card"><span>Upcoming trips</span><strong>03</strong></div>
                        <div className="dash-card"><span>Quotes in progress</span><strong>02</strong></div>
                        <div className="dash-card"><span>Potential margin</span><strong>Shown per quote</strong></div>
                      </div>
                      <div className="dash-title">Sample upcoming departures</div>
                      <Link className="dash-row dash-booking" to={tourPath(TOURS.accra)} target="_blank" rel="noopener">
                        <img className="dash-thumb" src={TOURS.accra.img} alt={TOURS.accra.short} />
                        <span>
                          <strong>{TOURS.accra.title}</strong>
                          <span>Sample booking · 2 guests</span>
                        </span>
                        <span className="dash-amount">View ↗</span>
                      </Link>
                      <Link className="dash-row dash-booking" to={tourPath(TOURS.capeCoast)} target="_blank" rel="noopener">
                        <img className="dash-thumb" src={TOURS.capeCoast.img} alt={TOURS.capeCoast.short} />
                        <span>
                          <strong>{TOURS.capeCoast.title}</strong>
                          <span>Sample booking · 4 guests</span>
                        </span>
                        <span className="dash-amount">View ↗</span>
                      </Link>
                    </section>

                    <section className={activeTab === 'tours' ? 'dash-panel active' : 'dash-panel'} data-panel="tours">
                      <h3>Explore tours on Travio Ghana</h3>
                      <p className="dash-sub">Real experiences currently listed on the platform.</p>
                      {[TOURS.capeCoast, TOURS.waterfalls, TOURS.accra].map((t) => (
                        <Link className="dash-tour" to={tourPath(t)} target="_blank" rel="noopener" key={t.id}>
                          <img className="tour-dot" src={t.img} alt="" />
                          <span>
                            <strong>{t.title}</strong>
                            <small>{t.meta}</small>
                          </span>
                          <b>View ↗</b>
                        </Link>
                      ))}
                      <p className="dash-tour-note">
                        Tour titles, photos and links come from Travio Ghana. Booking figures elsewhere in this preview
                        are examples; agent rates require approval.
                      </p>
                    </section>

                    <section className={activeTab === 'bookings' ? 'dash-panel active' : 'dash-panel'} data-panel="bookings">
                      <h3>Sample client bookings</h3>
                      <p className="dash-sub">Trip status and guest details in one list.</p>
                      {SAMPLE_BOOKINGS.map((b) => (
                        <div className="dash-row" key={b.thumb + b.title}>
                          <span className="dash-thumb">{b.thumb}</span>
                          <span>
                            <strong>{b.title}</strong>
                            <span>{b.meta}</span>
                          </span>
                          <span className="dash-amount">{b.status}</span>
                        </div>
                      ))}
                    </section>

                    <section className={activeTab === 'clients' ? 'dash-panel active' : 'dash-panel'} data-panel="clients">
                      <h3>Sample clients</h3>
                      <p className="dash-sub">A simple view of who is travelling and what they need.</p>
                      {SAMPLE_CLIENTS.map((c) => (
                        <div className="dash-row" key={c.thumb + c.title}>
                          <span className="dash-thumb">{c.thumb}</span>
                          <span>
                            <strong>{c.title}</strong>
                            <span>{c.meta}</span>
                          </span>
                          <span className="dash-amount">{c.status}</span>
                        </div>
                      ))}
                    </section>

                    <section className={activeTab === 'earnings' ? 'dash-panel active' : 'dash-panel'} data-panel="earnings">
                      <h3>Trade rates &amp; your margin</h3>
                      <p className="dash-sub">Illustrative quote: enter your own selling price to see the difference.</p>
                      <div className="rate-calculator">
                        <label>
                          Sample agent rate <strong>GHS {SAMPLE_AGENT_RATE}</strong>
                        </label>
                        <label htmlFor="sample-price">Your proposed client price (GHS)</label>
                        <input
                          id="sample-price"
                          type="number"
                          min={SAMPLE_AGENT_RATE}
                          max={100000}
                          step={10}
                          inputMode="numeric"
                          value={clientPrice}
                          onChange={(e) => setClientPrice(Number(e.target.value))}
                        />
                        <div className="margin-result">
                          <span>Illustrative gross margin</span>
                          <strong id="sample-margin">{margin}</strong>
                        </div>
                        <small>
                          Example only. Actual partner rates, taxes, fees and availability are shown after approval and
                          may vary.
                        </small>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <section className="faq">
          <div className="container faq-grid">
            <div className="faq-side reveal">
              <span className="label">Your questions answered</span>
              <h2 className="title">Everything you need to begin.</h2>
              <p>Learn how the portal works, how commissions are tracked and how your clients can book.</p>
              <a className="btn primary" href="https://www.expeditiongotours.com/help-centre" target="_blank" rel="noopener noreferrer">
                Visit Help Centre
              </a>
            </div>
            <div className="accordion reveal">
              {FAQS.map((f, i) => {
                const open = i === openFaq
                return (
                  <article className={open ? 'faq-item open' : 'faq-item'} key={f.n}>
                    <button
                      className="faq-question"
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenFaq(open ? -1 : i)}
                    >
                      <span><b>{f.n}</b>{f.q}</span>
                      <span className="toggle">+</span>
                    </button>
                    <div className="faq-answer">
                      <p>{f.a}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Closing CTA ────────────────────────────────────────────────── */}
        <section className="cta">
          <div className="container cta-inner reveal">
            <div>
              <h2>Let’s grow your Ghana business.</h2>
              <p>Get access to eligible trade rates and a clearer way to serve your Ghana bound clients.</p>
            </div>
            <a className="btn" href={CONTACT} target="_blank" rel="noopener noreferrer">Apply as a travel agent</a>
          </div>
        </section>

      </main>

      {/* ── Photography credits ──────────────────────────────────────────── */}
      <div className="container photo-credits">
        <strong>Photography credits</strong>
        <p>
          Photos show places in Ghana and illustrate potential itineraries; they are not representations of a specific
          bookable product.{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Accra_Skyline_-_Ghana.jpg">Accra skyline</a> by Synth85 (CC
          BY-SA 4.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:The_Cape_Coast_Castle_located_in_Cape_Coast_Ghana.jpg">Cape Coast Castle</a>{' '}
          by Treysam (CC BY-SA 4.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Canopy_walkway_in_Kakum_National_Park.jpg">Kakum canopy walkway</a>{' '}
          by Ibnali1 (CC BY-SA 4.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Aburi_Botanical_Gardens_11.jpg">Aburi Botanical Gardens</a>{' '}
          by Nkansahrexford (CC BY-SA 4.0). Photos cropped for layout; each crop is shared under the licence of its
          source photo.
        </p>
      </div>

      <Footer />
    </div>
  )
}
