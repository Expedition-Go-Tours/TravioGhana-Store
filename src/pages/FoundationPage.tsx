/* ============================================================================
   Foundation — /foundation
   ----------------------------------------------------------------------------
   Port of Expedition-Go_Foundation_Updated_Photo (1).html.

   The template was a standalone document: its own topline, header and footer
   are dropped (this app renders a global Navbar and Footer), and its runtime
   script — the `.reveal` IntersectionObserver and the clone of the impact
   track's photo set — is reimplemented below. The gallery marquee doubles up
   its photo set in the markup instead of cloning it in JS. See
   src/styles/FoundationPage.css for the CSS notes.

   The page used to hot-link all thirteen photographs from Wikimedia Commons
   through Special:FilePath. Production's Content-Security-Policy whitelists
   commons.wikimedia.org but not the thumb.wikimedia.org host that FilePath
   redirects to, so every photograph on the page was blocked there. They also
   cost 5.45 MB over the wire, behind two redirects each.
   `scripts/generate-foundation-images.cjs` downloads those originals once and
   writes WebPs into src/assets/foundation at their real display footprint; the
   credits at the foot of the page carry the attribution.
   ========================================================================== */

import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema } from '../components/SEO'
import '@/styles/FoundationPage.css'

/**
 * Photos from `scripts/generate-foundation-images.cjs` — see the header note.
 */
import cleanup4 from '../assets/foundation/cleanup-4.webp'
import cleanup9 from '../assets/foundation/cleanup-9.webp'
import communityCleanUp from '../assets/foundation/community-clean-up.webp'
import marketWomen from '../assets/foundation/market-women.webp'
import schoolChildren from '../assets/foundation/school-children.webp'
import schoolgirl from '../assets/foundation/schoolgirl.webp'
import studentsReading from '../assets/foundation/students-reading.webp'
import teacherReading from '../assets/foundation/teacher-reading.webp'
import treePlanting from '../assets/foundation/tree-planting.webp'
import treePlanting9 from '../assets/foundation/tree-planting-9.webp'
import villageMeeting from '../assets/foundation/village-meeting.webp'
import waliMeeting from '../assets/foundation/wali-meeting.webp'
import youngWomen from '../assets/foundation/young-women.webp'

const CONTACT = '/contact-us'

/** Hero gallery: two columns, each its own scrolling strip of three photos. */
const GALLERY_LANE_1 = [
  {
    img: schoolChildren,
    alt: 'School children in an English class in Accra',
    label: 'Learning',
  },
  {
    img: treePlanting9,
    alt: 'Tree planting activity in Ghana',
    label: 'Growing',
  },
  {
    img: communityCleanUp,
    alt: 'Community clean-up in Winneba, Ghana',
    label: 'Community action',
  },
]

const GALLERY_LANE_2 = [
  {
    img: marketWomen,
    alt: 'Market women in Ghana',
    label: 'Livelihoods',
  },
  {
    img: villageMeeting,
    alt: 'Community development meeting in northern Ghana',
    label: 'Local voices',
  },
  {
    img: teacherReading,
    alt: 'A teacher helping a student read in Northern Ghana',
    label: 'Education',
  },
]

const MISSION_CARDS = [
  {
    title: 'Every booking contributes',
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

/** The four focus marks, kept inline exactly as the template draws them. */
const FOCUS_AREAS = [
  {
    num: '01 / PEOPLE',
    title: 'Individual Support',
    desc: 'Helping people when they need it most, with space to share their situation and request support.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
    ),
  },
  {
    num: '02 / PLACES',
    title: 'Community Support',
    desc: 'Working with communities, local leaders, schools, organisations and groups on the needs they identify.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 20v-8l8-7 8 7v8H4Z" />
        <path d="M9 20v-6h6v6" />
      </svg>
    ),
  },
  {
    num: '03 / PROGRESS',
    title: 'Community Projects',
    desc: 'Backing initiatives in education, environmental conservation, local development and community programmes.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 21V11M12 15c-4 0-6-2-6-6 4 0 6 2 6 6ZM12 12c0-4 2-6 6-6 0 4-2 6-6 6Z" />
        <path d="M5 21h14" />
      </svg>
    ),
  },
  {
    num: '04 / TOGETHER',
    title: 'Partner With Us',
    desc: 'Welcoming charities, NGOs, businesses, community organisations and individuals who want to create impact.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="7" r="2" />
        <circle cx="16" cy="7" r="2" />
        <path d="M2.5 19v-3a5.5 5.5 0 0 1 11 0v3M10.5 19v-3a5.5 5.5 0 0 1 11 0v3" />
      </svg>
    ),
  },
]

const HELP_CARDS = [
  {
    img: studentsReading,
    alt: 'Students reading in a classroom in Ghana',
    tag: 'For individuals',
    title: 'Share your situation.',
    copy: 'If you or someone you know needs support, start by telling the Foundation what is happening and how help could make a difference.',
    cta: 'Request help →',
  },
  {
    img: waliMeeting,
    alt: 'Community group meeting in Wa, Ghana',
    tag: 'For communities',
    title: 'Bring a local need forward.',
    copy: 'Community leaders, schools and organisations can share an initiative or need for the Foundation to consider.',
    cta: 'Get support →',
  },
]

const IMPACT_SHOTS = [
  {
    img: cleanup9,
    alt: 'Volunteers cleaning a street in Accra',
    caption: 'Local action',
  },
  {
    img: schoolgirl,
    alt: 'Schoolgirl photographed in northern Ghana',
    caption: 'Education & opportunity',
  },
  {
    img: treePlanting,
    alt: 'Tree planting initiative in Ghana',
    caption: 'Looking after our future',
  },
  {
    img: youngWomen,
    alt: 'Young women at a community health event in Ghana',
    caption: 'People working together',
  },
]

const VOLUNTEER_POINTS = [
  'Support community-led activities',
  'Contribute skills and experience',
  'Help meaningful projects move forward',
]

/** The hero's moving strip. The set is rendered twice so fnd-up/-down loop. */
function GalleryLane({
  images,
  eager,
}: {
  images: typeof GALLERY_LANE_1
  eager: boolean
}) {
  const set = (duplicate: boolean) => (
    <div className="set" {...(duplicate ? { 'aria-hidden': 'true' } : {})}>
      {images.map((img) => (
        <figure className="photo" key={`${duplicate ? 'dup-' : ''}${img.label}`}>
          <img
            src={img.img}
            alt={duplicate ? '' : img.alt}
            loading={eager && !duplicate ? 'eager' : 'lazy'}
          />
          <span>{img.label}</span>
        </figure>
      ))}
    </div>
  )
  return (
    <div className="lane">
      <div className="strip">
        {set(false)}
        {set(true)}
      </div>
    </div>
  )
}

/** The impact track's set. The duplicate exists only to close the loop. */
function ImpactSet({ duplicate }: { duplicate: boolean }) {
  return (
    <div className="impact-set" {...(duplicate ? { 'aria-hidden': 'true' } : {})}>
      {IMPACT_SHOTS.map((shot) => (
        <figure className="impact-shot" key={`${duplicate ? 'dup-' : ''}${shot.caption}`}>
          <img
            src={shot.img}
            alt={duplicate ? '' : shot.alt}
            loading="lazy"
          />
          <figcaption>{shot.caption}</figcaption>
        </figure>
      ))}
    </div>
  )
}

export default function FoundationPage() {
  const pageRef = useRef<HTMLDivElement>(null)

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

  return (
    <>
      {/* The app's Footer is a sibling, not a child: .fnd-page sets its own
          16px DM Sans context, and the footer should not inherit it. */}
      <div className="fnd-page" ref={pageRef}>
      <SEO
        title="Every Journey Makes a Difference"
        description="The Travio Ghana Foundation turns every booking into positive impact for individuals, communities and community-led projects across Ghana."
        keywords="Travio Ghana Foundation, Ghana community support, sustainable tourism Ghana, travel foundation Ghana, community impact Ghana"
        jsonLd={[
          buildBreadcrumbSchema([
            { name: 'Home', url: 'https://www.travioghana.com/' },
            { name: 'Foundation', url: 'https://www.travioghana.com/foundation' },
          ]),
        ]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="kicker">
              <span />
              Travio Ghana Foundation
            </div>
            <h1>
              Every journey can make a <em>difference.</em>
            </h1>
            <p>
              We believe tourism should do more than create memorable experiences. It
              should help build stronger communities, support people in need and open new
              possibilities across Ghana.
            </p>
            <div className="actions">
              <a className="btn primary" href="#impact">
                See how we help
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </a>
              <a className="btn secondary" href="#get-involved">
                Get involved
              </a>
            </div>
            <div className="micro">
              Every booking contributes • Locally led support • Shared impact
            </div>
          </div>

          <div className="gallery" aria-label="Moving gallery of real photographs from Ghana">
            <GalleryLane images={GALLERY_LANE_1} eager />
            <GalleryLane images={GALLERY_LANE_2} eager />
            <div className="gallery-badge">
              <i />
              Real moments from Ghana.
            </div>
          </div>
        </div>
      </section>

      {/* ── Proof strip ──────────────────────────────────────────────────── */}
      <div className="proof">
        <div className="container proof-inner">
          <div className="proof-item">
            <strong>2%</strong> of every booking revenue
          </div>
          <div className="proof-item">
            <span className="proof-mark">01</span>
            Individual support
          </div>
          <div className="proof-item">
            <span className="proof-mark">02</span>
            Community action
          </div>
          <div className="proof-item">
            <span className="proof-mark">03</span>
            Local projects
          </div>
        </div>
      </div>

      <main>
        {/* ── Mission ────────────────────────────────────────────────────── */}
        <section className="mission" id="impact">
          <div className="container mission-grid">
            <div className="mission-side reveal">
              <span className="label">Making a difference through travel</span>
              <h2 className="title">Travel should leave more behind than memories.</h2>
              <p className="lead">
                A portion of each journey booked through Travio Ghana helps support
                individuals, strengthen communities and move important local projects
                forward.
              </p>
              <div className="mission-note">
                <strong>Your journey becomes part of theirs.</strong>
                When you travel with Travio Ghana, you are helping create a better journey
                for someone else.
              </div>
            </div>
            <div className="mission-content">
              {MISSION_CARDS.map((card, i) => (
                <article className="mission-card reveal" key={card.title}>
                  <span className="step">{`0${i + 1}`}</span>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── What we focus on ───────────────────────────────────────────── */}
        <section className="focus">
          <div className="container">
            <div className="section-head reveal">
              <div>
                <span className="label">What we focus on</span>
                <h2 className="title">Four ways we help change the journey.</h2>
              </div>
              <p>
                Impact starts by listening. We work with people and partners to direct
                support where it can genuinely make a difference.
              </p>
            </div>
            <div className="focus-grid">
              {FOCUS_AREAS.map((area) => (
                <article className="focus-card reveal" key={area.num}>
                  <span className="focus-num">{area.num}</span>
                  <div>
                    <div className="focus-icon">{area.icon}</div>
                    <h3>{area.title}</h3>
                    <p>{area.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Commitment ─────────────────────────────────────────────────── */}
        <section className="commitment">
          <div className="container commitment-shell reveal">
            <div className="percent">
              2%<small>of every booking revenue</small>
            </div>
            <div className="commitment-copy">
              <span className="label">One simple commitment</span>
              <h2 className="title">Your trip helps another journey begin.</h2>
              <p>
                Every qualifying booking on the Travio Ghana platform contributes to the
                Foundation. It is a simple way to connect travel with real support—without
                asking travellers to add anything extra.
              </p>
              <div className="rule">
                <i>✓</i>Book an experience. Explore Ghana. Help create impact.
              </div>
            </div>
          </div>
        </section>

        {/* ── Request support ────────────────────────────────────────────── */}
        <section className="help" id="request-help">
          <div className="container">
            <div className="help-head reveal">
              <div>
                <span className="label">Request support</span>
                <h2 className="title">Tell us where help is needed.</h2>
              </div>
              <p>
                Whether you are reaching out for yourself or on behalf of a community, the
                Foundation is ready to listen.
              </p>
            </div>
            <div className="help-grid">
              {HELP_CARDS.map((card) => (
                <article className="help-card reveal" key={card.tag}>
                  <img src={card.img} alt={card.alt} />
                  <div className="help-copy">
                    <span className="help-tag">{card.tag}</span>
                    <h3>{card.title}</h3>
                    <p>{card.copy}</p>
                    <Link className="btn" to={CONTACT}>
                      {card.cta}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Scenes from across Ghana ───────────────────────────────────── */}
        <section className="gallery-section">
          <div className="container">
            <div className="gallery-head reveal">
              <span className="label">Scenes from across Ghana</span>
              <h2 className="title">Change is built side by side.</h2>
              <p className="lead">
                Real photographs of everyday life and community action across Ghana,
                reflecting the people and places behind our mission.
              </p>
            </div>
            <div className="impact-track" aria-label="Photographs of community life in Ghana">
              <ImpactSet duplicate={false} />
              <ImpactSet duplicate />
            </div>
          </div>
        </section>

        {/* ── Volunteer ──────────────────────────────────────────────────── */}
        <section className="volunteer" id="get-involved">
          <div className="container volunteer-shell reveal">
            <div className="volunteer-photo">
              <img
                src={cleanup4}
                alt="Volunteers taking part in a clean-up in Accra"
              />
            </div>
            <div className="volunteer-copy">
              <span className="label">Volunteer with us</span>
              <h2 className="title">Give your time. Make a difference.</h2>
              <p>
                Meaningful change takes people who are ready to show up. Join the
                Foundation's work and help turn care, experience and practical skills into
                local action.
              </p>
              <ul className="volunteer-points">
                {VOLUNTEER_POINTS.map((point) => (
                  <li key={point}>
                    <i>✓</i>
                    {point}
                  </li>
                ))}
              </ul>
              <Link className="btn primary" to={CONTACT}>
                Get involved
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Closing CTA ────────────────────────────────────────────────── */}
        <section className="cta">
          <div className="container cta-inner reveal">
            <div>
              <h2>Ready to make a difference?</h2>
              <p>Every booking helps. Every contribution moves a journey forward.</p>
            </div>
            <Link className="btn" to={CONTACT}>
              Contact the Foundation
            </Link>
          </div>
        </section>
      </main>

      {/* ── Photography credits ──────────────────────────────────────────── */}
      <div className="photo-attribution container">
        <strong>Photography credits and context</strong>
        <p>
          Photographs were taken in Ghana and cropped for the layout. They illustrate the
          Foundation’s areas of interest; people pictured are not identified as Foundation
          participants or beneficiaries.{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Ghana%20school%20children%20%288203372110%29.jpg">
            Ghana school children (8203372110)
          </a>{' '}
          by USAID in Africa (Public domain);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Tree%20planting%20in%20Ghana%209.jpg">
            Tree planting in Ghana 9
          </a>{' '}
          by Fquasie (CC BY-SA 4.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Community%20clean-up.jpg">
            Community clean-up
          </a>{' '}
          by Tahiru Rajab (CC BY-SA 4.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Market%20women%20in%20Ghana.jpg">
            Market women in Ghana
          </a>{' '}
          by Fquasie (CC BY-SA 4.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:A%20village%20community%20development%20meeting%20in%20northern%20Ghana.jpg">
            A village community development meeting in northern Ghana
          </a>{' '}
          by Qulat96 (CC BY-SA 4.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:A%20teacher%20assisting%20his%20student%20to%20read.jpg">
            A teacher assisting his student to read
          </a>{' '}
          by Alhassan Musah Amk (CC BY-SA 4.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Students%20reading%20in%20a%20classroom.jpg">
            Students reading in a classroom
          </a>{' '}
          by Bright Kwame Ayisi (CC0 1.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Wali_physical_meeting.jpg">
            Wali physical meeting
          </a>{' '}
          by Zakaria Tunsung (CC0 1.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Cleanup%20exercise%20in%20Ghana%209.jpg">
            Cleanup exercise in Ghana 9
          </a>{' '}
          by Esthee2010 (CC BY-SA 4.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Schoolgirl%20Ghana.jpg">
            Schoolgirl Ghana
          </a>{' '}
          by Inonotus (CC BY 4.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Ghana%20tree%20planting.jpg">
            Ghana tree planting
          </a>{' '}
          by Antorsu10 (CC BY-SA 4.0);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Ghana%20young%20women%20%287250530402%29.jpg">
            Ghana young women (7250530402)
          </a>{' '}
          by USAID in Africa (Public domain);{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Cleanup%20exercise%20in%20Ghana%204.jpg">
            Cleanup exercise in Ghana 4
          </a>{' '}
          by Esthee2010 (CC BY-SA 4.0). Individual licenses and source details are available
          through the linked photo pages.
        </p>
      </div>

      </div>
      <Footer />
    </>
  )
}
