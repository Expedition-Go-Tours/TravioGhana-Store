/* ============================================================================
   Partnerships — /partnerships
   ----------------------------------------------------------------------------
   Port of Expedition-Go_Partnerships_Icon_Revision.html.

   The template was a standalone document: its own nav and footer are dropped
   (this app renders a global Navbar and Footer), its html/body/:root resets
   live on the `.ptn-page` wrapper, and its runtime script is reimplemented as
   the effects below. See src/styles/PartnershipsPage.css for the CSS notes.
   ========================================================================== */

import { useEffect, useRef, useState, Fragment, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema } from '../components/SEO'
import '@/styles/partner-pages.css'
import '@/styles/PartnershipsPage.css'

/** The template's external-link arrow, repeated on nearly every CTA. */
function LinkIcon({ className = 'link-icon' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" />
    </svg>
  )
}

/** The four "why partner" marks, kept inline exactly as the template draws them. */
const BENEFIT_PATHS: string[][] = [
  ['M12 1v3', 'M12 20v3', 'M1 12h3', 'M20 12h3'],
  ['M12 2 20 6v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z', 'm9 12 2 2 4-4'],
  ['m12 2 9 5-9 5-9-5z', 'm3 11 9 5 9-5M3 15l9 5 9-5'],
  ['M12 21v-9M12 15C7 15 5 12 5 8c5 0 7 3 7 7ZM12 13c0-5 2-7 7-7 0 4-2 7-7 7ZM5 21h14'],
]
const BENEFIT_CIRCLES = [
  [
    { cx: 12, cy: 12, r: 8 },
    { cx: 12, cy: 12, r: 4 },
  ],
  null,
  null,
  null,
]

const BENEFITS = [
  {
    num: '01 · REACH',
    aria: 'Discover partner routes',
    h3: 'Meet travellers already looking for what you offer.',
    p: 'Gain visibility with people actively planning and booking experiences across Ghana.',
  },
  {
    num: '02 · TRUST',
    aria: 'Explore partnership routes',
    h3: 'Grow inside a quality-led travel network.',
    p: 'Build credibility through authentic experiences, trusted service and clear expectations.',
  },
  {
    num: '03 · VALUE',
    aria: 'See partnership options',
    h3: 'Turn complementary services into stronger journeys.',
    p: 'Combine local knowledge, hospitality, content and transport to deliver more for travellers.',
  },
  {
    num: '04 · GROWTH',
    aria: 'Find your partnership route',
    h3: 'Build a partnership designed to last.',
    p: 'Work with a Ghana-focused team that values local opportunity and sustainable collaboration.',
  },
]

const WIKIMEDIA = 'https://commons.wikimedia.org/wiki/Special:FilePath/'

/** The rail's twelve cards — the five programmes told twice over, as the template has them. */
const ROUTE_CARDS = [
  { file: 'Cape_Coast_Castle.jpg?width=900', alt: 'Cape Coast Castle in Ghana', to: '/supplier/list-experience', label: 'Tour & activity suppliers', no: '01', h3: 'List tours, activities and experiences for travellers discovering Ghana.', cta: 'List your experience' },
  { file: 'Accra_Skyline_-_Ghana.jpg?width=900', alt: 'Accra skyline in Ghana', to: '/hotels', label: 'Hotels & stays', no: '02', h3: 'List rooms or properties and connect guests with Ghana experiences.', cta: 'Explore stays partnership' },
  { file: 'Street_Outside_Makola_Market%2C_Accra%2C_Ghana.JPG?width=900', alt: 'Street outside Makola Market in Accra', to: '/travel-agents', label: 'Travel agents', no: '03', h3: 'Recommend curated Ghana experiences and manage bookings for your clients.', cta: 'Explore agent network' },
  { file: 'Canopy_Walkway_Kakum_National_Park.jpg?width=900', alt: 'Canopy walkway at Kakum National Park', to: '/content-creators', label: 'Content creators', no: '04', h3: 'Choose experiences, tell their stories and share your own booking link.', cta: 'Explore creator programme' },
  { file: 'Taxi-accra.jpg?width=900', alt: 'Taxi travelling in Accra', to: '/transport-providers', label: 'Transport providers', no: '05', h3: 'Show your fleet and respond to suitable journey requests.', cta: 'Explore transport partnership' },
  { file: 'Wli_Agumatse_Waterfall_aerial_view.jpg?width=900', alt: 'Wli waterfall in Ghana', to: '/supplier/list-experience', label: 'Tour & activity suppliers', no: '06', h3: 'List tours, activities and experiences for travellers discovering Ghana.', cta: 'List your experience' },
  { file: 'People_at_the_bojo_beach_resort.jpg?width=900', alt: 'Visitors at Bojo Beach Resort near Accra', to: '/hotels', label: 'Hotels & stays', no: '07', h3: 'List rooms or properties and connect guests with Ghana experiences.', cta: 'Explore stays partnership' },
  { file: 'Kente_weaving_in_Ghana.jpg?width=900', alt: 'A Ghanaian craft maker weaving kente', to: '/content-creators', label: 'Content creators', no: '08', h3: 'Choose experiences, tell their stories and share your own booking link.', cta: 'Explore creator programme' },
  { file: 'Shai_Hills_Ghana.jpg?width=900', alt: 'Landscape at Shai Hills in Ghana', to: '/transport-providers', label: 'Transport providers', no: '09', h3: 'Show your fleet and respond to suitable journey requests.', cta: 'Explore transport partnership' },
  { file: 'Waakye%2C_a_delicious_delicacy_in_Ghana.jpg?width=900', alt: 'A Ghanaian waakye dish', to: '/travel-agents', label: 'Travel agents', no: '10', h3: 'Recommend curated Ghana experiences and manage bookings for your clients.', cta: 'Explore agent network' },
  { file: 'Aburi_Botanical_Gardens.jpg?width=900', alt: 'Palm trees at Aburi Botanical Gardens', to: '/hotels', label: 'Hotels & stays', no: '11', h3: 'List rooms or properties and connect guests with Ghana experiences.', cta: 'Explore stays partnership' },
  { file: 'Volta_Lake_01.jpg?width=900', alt: 'Lake Volta near Sogakope in Ghana', to: '/supplier/list-experience', label: 'Tour & activity suppliers', no: '12', h3: 'List tours, activities and experiences for travellers discovering Ghana.', cta: 'List your experience' },
]

const JOINS = [
  {
    index: '01 / EXPERIENCES',
    symbol: '01',
    h3: 'Tour & activity suppliers',
    p: 'For tour operators, local guides and activity providers. Create a supplier profile, add your tour details, prices and availability, and manage bookings in your workspace.',
    detail: ['Free to list', '85% of each successful booking retained'],
    to: '/supplier/list-experience',
    cta: 'Join as a supplier',
  },
  {
    index: '02 / CONTENT',
    symbol: '02',
    h3: 'Content creators',
    p: 'For travel, food and lifestyle creators. Choose Ghana experiences that suit your audience, create authentic content and share your personal booking link.',
    detail: ['Curated experiences', 'Commission on confirmed bookings'],
    to: '/content-creators',
    cta: 'Join as a creator',
  },
  {
    index: '03 / REFERRALS',
    symbol: '03',
    h3: 'Travel agents',
    p: 'For travel agents and resellers. Recommend experiences to clients, track referred bookings through your link and manage activity from a partner dashboard.',
    detail: ['Personal booking link', 'Monthly commission payouts'],
    to: '/travel-agents',
    cta: 'Join as a travel agent',
  },
  {
    index: '04 / TRANSPORT',
    symbol: '04',
    h3: 'Transport providers',
    p: 'For professional drivers and fleet operators. Present your vehicles, set availability and rates, then respond to journey requests that suit your operation.',
    detail: ['Fleet visibility', 'Rates set by you'],
    to: '/transport-providers',
    cta: 'Join as a transport provider',
  },
  {
    index: '05 / ACCOMMODATION',
    symbol: '05',
    h3: 'Hotels & stays',
    p: 'For hotels, guesthouses, apartments, lodges and resorts. Present your property, add rooms and rates, and give guests a starting point for exploring Ghana.',
    detail: ['Property profile', 'Rooms & availability'],
    to: '/hotels',
    cta: 'Join as a hotel or stay',
  },
]

const STEPS = [
  { label: 'Step 01', h3: 'Choose your partnership', p: 'Find the supplier, creator, agent, transport or accommodation programme that fits what you do.' },
  { label: 'Step 02', h3: 'Explore the dedicated page', p: 'See the programme details and follow its joining steps on Travio Ghana.' },
  { label: 'Step 03', h3: 'Get started with the team', p: 'Set up your profile or speak to our team if you would like help before joining.' },
]

const TICKER_WORDS = ['LOCAL EXPERTISE', 'GLOBAL REACH', 'SHARED VALUE', 'BETTER JOURNEYS']

/** One ticker band. The template renders this line twice so -50% loops cleanly. */
function TickerLine() {
  return (
    <div className="ticker-line">
      {TICKER_WORDS.map((word, i) => (
        <Fragment key={word}>
          {i % 2 === 0 ? <span>{word}</span> : <b>{word}</b>}
          <i />
        </Fragment>
      ))}
    </div>
  )
}

export default function PartnershipsPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const artRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)

  // The template adds `loaded` to <body> on window load to slide the hero
  // headline up from its overflow-clipped resting position.
  useEffect(() => {
    const id = requestAnimationFrame(() => setLoaded(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // The template's [data-reveal] IntersectionObserver, scoped to this page.
  useEffect(() => {
    const root = pageRef.current
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
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

  // Scroll progress bar + hero parallax lift.
  useEffect(() => {
    let ticking = false
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${max ? window.scrollY / max : 0})`
      }
      if (artRef.current) {
        artRef.current.style.setProperty('--lift', `${Math.min(window.scrollY / 700, 1) * -22}px`)
      }
      ticking = false
    }
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(update)
        ticking = true
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Hero art tilt, skipped entirely under prefers-reduced-motion.
  useEffect(() => {
    const art = artRef.current
    if (!art) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const onMove = (event: PointerEvent) => {
      const r = art.getBoundingClientRect()
      art.style.setProperty('--mx', `${(((event.clientX - r.left) / r.width - 0.5) * 4).toFixed(2)}deg`)
      art.style.setProperty('--my', `${(((event.clientY - r.top) / r.height - 0.5) * -3).toFixed(2)}deg`)
    }
    const onLeave = () => {
      art.style.setProperty('--mx', '0deg')
      art.style.setProperty('--my', '0deg')
    }
    art.addEventListener('pointermove', onMove)
    art.addEventListener('pointerleave', onLeave)
    return () => {
      art.removeEventListener('pointermove', onMove)
      art.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  const routeSet = (duplicate: boolean) => (
    <div className="route-set" {...(duplicate ? { 'aria-hidden': 'true' } : {})}>
      {ROUTE_CARDS.map((card, i) => (
        <article className="route-card" style={{ '--i': i } as CSSProperties} key={`${card.no}-${card.label}`}>
          <img src={`${WIKIMEDIA}${card.file}`} alt={card.alt} loading="lazy" />
          <Link
            className="card-photo-link"
            to={card.to}
            aria-label={`Explore ${card.label}`}
            tabIndex={duplicate ? -1 : undefined}
          />
          <div className="route-card-inner">
            <div className="route-no">
              <span>{card.label}</span>
              <b>{card.no}</b>
            </div>
            <div className="route-bottom">
              <h3>{card.h3}</h3>
              <p>Explore the programme and see how to join.</p>
              <Link to={card.to} tabIndex={duplicate ? -1 : undefined}>
                {card.cta} <LinkIcon />
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  )

  return (
    <div ref={pageRef} className={`ptn-page${loaded ? ' loaded' : ''}`}>
      <SEO
        title="Partner with Travio Ghana | Five Ways to Join"
        description="Become a partner with Travio Ghana. Join Ghana's leading tourism platform as a tour operator, hotel, travel agent, content creator, or transport provider."
        keywords="Travio Ghana partnership, Ghana tourism partnership, tour operator partnership Ghana, travel partner Ghana, become a supplier Ghana"
        jsonLd={[
          buildBreadcrumbSchema([
            { name: 'Home', url: 'https://www.travioghana.com/' },
            { name: 'Partnerships', url: 'https://www.travioghana.com/partnerships' },
          ]),
        ]}
      />

      <div className="progress" aria-hidden="true" ref={progressRef} />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <header className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <div className="pill">
              <i className="pulse" />
              Join the Travio Ghana network
            </div>
            <h1 className="hero-title">
              <span className="hero-line"><span>Grow</span></span>
              <span className="hero-line"><span>travel.</span></span>
              <span className="hero-line"><span>Together.</span></span>
            </h1>
            <p>
              List your tours, share experiences, bring travellers, move guests or welcome them to stay. Choose the
              partnership that fits your business on Travio Ghana, powered by Expedition-Go Tours Ltd.
            </p>
            <div className="actions">
              <a className="btn btn-dark" href="#join">
                Explore the five ways to join <LinkIcon />
              </a>
              <a className="btn btn-light" href="#routes">Find your partnership route</a>
            </div>
            <div className="micro">Five clear ways to join · Operated by Expedition-Go Tours Ltd.</div>
          </div>

          <div className="hero-art" aria-label="Expedition-Go partnership network" ref={artRef}>
            <svg className="hero-orbit" viewBox="0 0 800 800" aria-hidden="true">
              <circle cx="400" cy="400" r="300" />
              <circle cx="400" cy="400" r="225" />
              <path d="M90 450c100-195 238-292 415-285 92 4 161 37 207 97" />
            </svg>
            <div className="hero-shot">
              <img src={`${WIKIMEDIA}Elmina_Castle_-_Ghana.jpg?width=1400`} alt="Elmina Castle on the Ghana coast" />
              <div className="shot-label">
                <div>
                  <span>Travio Ghana partner network</span>
                  <b>Better travel is built together.</b>
                </div>
                <span>Accra · Ghana</span>
              </div>
            </div>
            <div className="orbit-dot">
              <span>5 ways<br />to partner</span>
            </div>
            <div className="float-card">
              <small>Connected growth</small>
              <strong>Local businesses meeting global travellers.</strong>
              <div className="mini-people">
                <i>TO</i>
                <i>HT</i>
                <i>TA</i>
                <i>CC</i>
                <b>+ Transport</b>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Ticker band ────────────────────────────────────────────────── */}
      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          <TickerLine />
          <TickerLine />
        </div>
      </div>

      <main>
        {/* ── Why partner ──────────────────────────────────────────────── */}
        <section className="intro">
          <div className="wrap split">
            <div className="sticky" data-reveal>
              <div className="eyebrow">Why partner with us</div>
              <h2 className="display">
                When the right people connect, <span className="accent">travel gets better.</span>
              </h2>
              <p className="copy">
                Travio Ghana connects Ghanaian businesses and storytellers with travellers. Each partner gets a route
                built around what they actually offer, backed by Expedition-Go Tours Ltd.
              </p>
              <div className="side-note">
                Explore a programme, see how it works, then join through its dedicated Travio Ghana page.
              </div>
            </div>
            <div className="benefit-stack">
              {BENEFITS.map((b, i) => (
                <article className="benefit" data-reveal key={b.num}>
                  <div className="benefit-top">
                    <span className="benefit-num">{b.num}</span>
                    <a className="icon-link" href="#routes" aria-label={b.aria}>
                      <svg
                        className="benefit-svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        {BENEFIT_CIRCLES[i]?.map((c) => (
                          <circle key={`${c.cx}-${c.cy}-${c.r}`} cx={c.cx} cy={c.cy} r={c.r} />
                        ))}
                        {BENEFIT_PATHS[i].map((d) => <path key={d} d={d} />)}
                      </svg>
                    </a>
                  </div>
                  <h3>{b.h3}</h3>
                  <p>{b.p}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Routes rail ──────────────────────────────────────────────── */}
        <section className="routes" id="routes">
          <div className="wrap">
            <div className="routes-head" data-reveal>
              <div>
                <div className="eyebrow">Who we work with</div>
                <h2 className="display">Find where you fit.</h2>
              </div>
              <p className="routes-intro">
                Five programmes. Explore the moving stories, then choose the dedicated page for your business,
                audience or service.
              </p>
            </div>
            <div className="route-rail">
              {routeSet(false)}
              {routeSet(true)}
            </div>
            <div className="rail-note">Five ways to join, told through real images of Ghana. Hover to pause.</div>
          </div>

          <div className="route-network">
            <svg aria-hidden="true" viewBox="0 0 1280 205" preserveAspectRatio="none">
              <path d="M70 0v55c0 42 62 42 145 42s146 0 146 66" />
              <path d="M340 0v42c0 44 80 38 174 38s126 25 126 83" />
              <path d="M640 0v163" />
              <path d="M940 0v42c0 44-80 38-174 38s-126 25-126 83" />
              <path d="M1210 0v55c0 42-62 42-145 42s-146 0-146 66" />
            </svg>
            <span className="network-dot" aria-hidden="true" />
            <div className="route-summary">
              <h3>Five ways to join. One connected Ghana journey.</h3>
              <div className="route-tags">
                <span>Supply</span>
                <span>Create</span>
                <span>Refer</span>
                <span>Move</span>
                <span>Host</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Five ways to join ────────────────────────────────────────── */}
        <section className="join" id="join">
          <div className="wrap">
            <div className="join-head" data-reveal>
              <div>
                <div className="eyebrow">Choose your programme</div>
                <h2 className="display">
                  Five ways to <span className="accent">join us.</span>
                </h2>
              </div>
              <p>
                Find the partnership that fits what you do. Each path leads to a dedicated page with the details and
                next steps.
              </p>
            </div>
            <div className="join-grid">
              {JOINS.map((j) => (
                <article className="join-card" data-reveal key={j.index}>
                  <div className="join-top">
                    <span className="join-index">{j.index}</span>
                    <span className="join-symbol" aria-hidden="true">{j.symbol}</span>
                  </div>
                  <h3>{j.h3}</h3>
                  <p>{j.p}</p>
                  <div className="join-detail">
                    {j.detail.map((d) => <span key={d}>{d}</span>)}
                  </div>
                  <Link to={j.to}>
                    {j.cta} <LinkIcon />
                  </Link>
                </article>
              ))}
            </div>
            <div className="join-trust" data-reveal>
              <div>
                <strong>Know who you are joining.</strong>
                <p>
                  Travio Ghana is operated by Expedition-Go Tours Ltd in Accra. You can review the company and speak
                  with the team before signing up.
                </p>
              </div>
              <a href="https://www.expeditiongotours.com/" target="_blank" rel="noopener noreferrer">
                Meet Expedition-Go Tours <LinkIcon />
              </a>
              <a
                href="https://www.tripadvisor.com/Attraction_Review-g293797-d24155300-Reviews-Expedition_Go_Tours_Ltd-Accra_Greater_Accra.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read traveller reviews <LinkIcon />
              </a>
            </div>
          </div>
        </section>

        {/* ── How it begins ────────────────────────────────────────────── */}
        <section className="journey">
          <div className="wrap">
            <div className="journey-head" data-reveal>
              <div className="eyebrow">How it begins</div>
              <h2 className="display">
                Your route starts with one <span className="accent">good match.</span>
              </h2>
            </div>
            <div className="process-grid">
              <div className="process-image" data-reveal>
                <img
                  src="/partnerships/material.jpg"
                  alt="Two people smiling and greeting one another with a fist bump"
                  loading="lazy"
                />
                <div className="process-caption">
                  <small>From conversation to collaboration</small>
                  <h3>Five ways to grow with Travio Ghana.</h3>
                </div>
              </div>
              <div className="journey-list">
                {STEPS.map((s) => (
                  <article className="step" data-reveal key={s.label}>
                    <div className="step-top">
                      <span className="step-label">{s.label}</span>
                      <a className="icon-link" href="#join" aria-label={`Email us about ${s.label.toLowerCase()}`}>
                        <LinkIcon />
                      </a>
                    </div>
                    <div>
                      <h3>{s.h3}</h3>
                      <p>{s.p}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Closing ──────────────────────────────────────────────────── */}
        <section className="closing">
          <div className="wrap closing-box" data-reveal>
            <div className="closing-loop" aria-hidden="true" />
            <div className="closing-content">
              <div className="eyebrow" style={{ color: '#c1ff3d' }}>Your route starts here</div>
              <h2>Your place in Ghana travel starts here.</h2>
              <p>
                Choose your programme and take the next step on Travio Ghana. The right route is ready for your tours,
                audience, clients, fleet or property.
              </p>
              <a className="btn" href="#join">
                Find your way to join <LinkIcon />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ── Photography credits ──────────────────────────────────────────── */}
      <div className="photo-credits wrap">
        <strong>Photography credits</strong>
        <p>
          Real photographs, cropped for layout; the greeting image is illustrative and none depict current partners.{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Elmina_Castle_-_Ghana.jpg">Elmina Castle</a> by MrPanyGoff
          (CC BY-SA 2.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Cape_Coast_Castle.jpg">Cape Coast</a> by Efua (see source
          license);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Accra_Skyline_-_Ghana.jpg">Accra skyline</a> by Synth85 (CC
          BY-SA 4.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Street_Outside_Makola_Market,_Accra,_Ghana.JPG">Makola Market</a>{' '}
          by Benggriff (CC BY-SA 3.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Canopy_Walkway_Kakum_National_Park.jpg">Kakum</a> by Stig
          Nygaard (CC BY 2.0); <a href="https://commons.wikimedia.org/wiki/File:Taxi-accra.jpg">Accra taxi</a> by
          Fquasie (see source license); greeting photograph supplied by Expedition-Go Tours.{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Wli_Agumatse_Waterfall_aerial_view.jpg">Wli waterfall in Ghana</a>{' '}
          by Cornelius Agordome (license on source page);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:People_at_the_bojo_beach_resort.jpg">Visitors at Bojo Beach Resort near Accra</a>{' '}
          by OheneTakyi6 (license on source page);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Kente_weaving_in_Ghana.jpg">A Ghanaian craft maker weaving kente</a>{' '}
          by Fquasie (license on source page);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Shai_Hills_Ghana.jpg">Landscape at Shai Hills in Ghana</a> by
          Kaffzz (license on source page);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Waakye%2C_a_delicious_delicacy_in_Ghana.jpg">A Ghanaian waakye dish</a>{' '}
          by Tenbil Bright (license on source page);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Aburi_Botanical_Gardens.jpg">Palm trees at Aburi Botanical Gardens</a>{' '}
          by Wikimedia Commons contributor (license on source page);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Volta_Lake_01.jpg">Lake Volta near Sogakope in Ghana</a> by
          Amuzujoe (license on source page). Licenses and source details are linked on the respective photo pages.
        </p>
      </div>

      <Footer />
    </div>
  )
}
