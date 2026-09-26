/**
 * Public "List Your Experience" marketing page (/supplier/list-experience).
 *
 * Ported from the reviewed supplier template (TravioGhana_Supplier.html):
 * hero + device wall, proof bar, trust & verification layer, how-it-works,
 * why-TravioGhana, commission terms, experience carousel, supplier FAQ and
 * the closing CTA. The navbar and footer are the site's own components and
 * stay aligned to this page's `.wrap` column (see Navbar.css / Footer.css
 * `body:has(.le-page)` rules).
 *
 * The application form itself lives on /supplier/register — every CTA here
 * routes there.
 */
import { useCallback, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

import Footer from '@/components/Footer'
import SEO, { buildBreadcrumbSchema, buildFAQSchema } from '@/components/SEO'
import FAQAccordion from '@/components/shared/FAQAccordion'
import { useSupplierStatus } from '@/hooks/useSupplierStatus'
import { getSupplierPortalUrl, isApprovedSupplier } from '@/lib/supplier'
import { SUPPORT_EMAIL, WHATSAPP_URL } from '@/lib/support'

import phoneLogin from '@/assets/phone-screens/login.png'
import phoneDashboard from '@/assets/phone-screens/dashboard.png'
import phoneProducts from '@/assets/phone-screens/products.png'
import tripadvisorLogo from '@/assets/tripadvisor.png'
import getYourGuideLogo from '@/assets/icons/getyourguide.png'
import imgCapeCoast from '@/assets/supplier/cape-coast-heritage.avif'
import imgCoastal from '@/assets/supplier/historic-coastal-tours.avif'
import imgElmina from '@/assets/supplier/elmina-experiences.avif'
import imgAccra from '@/assets/supplier/accra-city.avif'
import imgWaterfalls from '@/assets/supplier/waterfalls-nature.avif'
import imgWaterBoat from '@/assets/supplier/water-boat.avif'

import '@/styles/partner-pages.css'
import '@/styles/ListExperience.css'

const DEMO_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=TravioGhana%20Supplier%2015-Minute%20Demo`

const HERO_IMAGES = [
  { src: phoneLogin, alt: 'Supplier login screen', cls: 'le-phone-a' },
  { src: phoneDashboard, alt: 'Supplier dashboard with bookings and earnings', cls: 'le-phone-b' },
  { src: phoneProducts, alt: 'Tour products management screen', cls: 'le-phone-c' },
]

const PROOF = [
  { strong: '0', span: 'upfront listing fees' },
  { strong: '85%', span: 'of each booking retained' },
  { strong: '15%', span: 'flat platform commission' },
  { strong: 'Local', span: 'supplier support in Ghana' },
]

const VERIFY_POINTS = [
  {
    strong: 'Operated by Expedition-Go Tours Ltd',
    small: 'TravioGhana is a trading marketplace operated by the same company behind Expedition-Go Tours.',
  },
  {
    strong: 'Independent public presence',
    small: 'Check our official company website and established travel profiles before you register.',
  },
  {
    strong: 'Speak with a real person',
    small: 'Request a supplier introduction call, WhatsApp conversation or live listing demo before joining.',
  },
]

const SAFE_ITEMS = [
  {
    strong: 'No upfront payment to join',
    text: 'There is no setup or listing fee. The 15% commission applies only when you receive a successful booking.',
  },
  {
    strong: 'You create your own login',
    text: 'Register through the official supplier portal and use your own account credentials.',
  },
  {
    strong: 'You stay in control',
    text: 'Manage your product information, prices and availability from your supplier workspace.',
  },
  {
    strong: 'Assisted onboarding is available',
    text: 'If you prefer, our supplier team can guide you through creating your first listing.',
  },
]

const STEPS = [
  {
    num: 'STEP 01',
    title: 'Create your profile',
    desc: 'Register through the official TravioGhana supplier portal using your own login details.',
  },
  {
    num: 'STEP 02',
    title: 'Add your experience',
    desc: 'Enter your itinerary, photos, inclusions, pricing, pickup details and availability.',
  },
  {
    num: 'STEP 03',
    title: 'Review & publish',
    desc: 'Our team can review the listing with you and help make sure everything is ready for travellers.',
  },
  {
    num: 'STEP 04',
    title: 'Receive bookings',
    desc: 'Manage reservations and fulfil bookings according to your supplier agreement.',
  },
]

const WHY_CARDS = [
  {
    icon: 'globe',
    title: 'Reach travellers worldwide',
    desc: 'Be discovered by travellers actively searching for authentic tours, activities and attractions.',
  },
  {
    icon: 'megaphone',
    title: 'We support the marketing',
    desc: 'Your activity can be promoted through social media, email, the platform and partner channels.',
  },
  {
    icon: 'shield',
    title: 'Know who you are partnering with',
    desc: 'TravioGhana is operated by Expedition-Go Tours Ltd, with clear company details and direct supplier support.',
  },
  {
    icon: 'headset',
    title: 'Support when you need it',
    desc: 'Get help with onboarding, listings and resolving issues so your products keep moving.',
  },
] as const

const TERMS = [
  { label: 'LISTING', text: 'No setup or maintenance fee' },
  { label: 'CONTROL', text: 'Set pricing and availability' },
  { label: 'PAYOUTS', text: 'Monthly or bi-weekly options' },
  { label: 'FLEXIBILITY', text: 'Deactivate when you choose' },
]

const EXPERIENCES = [
  {
    src: imgCapeCoast,
    title: 'Cape Coast Heritage',
    desc: 'Castles, history and the Atlantic coast',
    alt: 'Cape Coast Castle and coastal town in Ghana',
  },
  {
    src: imgCoastal,
    title: 'Historic Coastal Tours',
    desc: "Ghana's heritage sites and coastal stories",
    alt: 'Cape Coast Castle cannons overlooking the Ghana coastline',
  },
  {
    src: imgElmina,
    title: 'Elmina Experiences',
    desc: 'Architecture, culture and local history',
    alt: 'Historic Elmina Castle archway overlooking the sea in Ghana',
  },
  {
    src: imgAccra,
    title: 'Accra City Experiences',
    desc: 'Landmarks, culture and city discovery',
    alt: 'Independence Arch in Accra Ghana',
  },
  {
    src: imgWaterfalls,
    title: 'Waterfalls & Nature',
    desc: 'Outdoor adventures through lush Ghana',
    alt: 'Visitor at Kintampo Waterfalls in Ghana',
  },
  {
    src: imgWaterBoat,
    title: 'Water & Boat Experiences',
    desc: 'Coastal life, lakes and local waterways',
    alt: 'Fishing boats on water in Accra Ghana',
  },
]

const FAQ_ITEMS = [
  {
    question: 'Who can register as a supplier?',
    answer:
      'Registered companies and independent operators that are legally compliant and provide responsible, high-quality travel activities can apply. Listings are reviewed for quality, safety and sustainability.',
  },
  {
    question: 'How much does it cost to list?',
    answer: 'There is no fee to add or maintain an activity. You are charged only when a booking is successful.',
  },
  {
    question: 'What is the commission fee?',
    answer:
      'A flat 15% commission applies to each successful booking, meaning you retain 85%. The fee supports platform management, tools, insights and promotion.',
  },
  {
    question: 'How and when will I be paid?',
    answer:
      "Completed bookings are consolidated for payout. Suppliers can use the available monthly or bi-weekly schedule, subject to the platform's current payment terms and required business documentation.",
  },
  {
    question: 'Do I control my pricing and availability?',
    answer:
      'Yes. Suppliers can manage pricing and availability and may deactivate an activity or account when they choose.',
  },
  {
    question: 'Do I need technical skills?',
    answer:
      'No. The supplier dashboard is designed to guide you through adding, managing and updating tours, with support available along the way.',
  },
  {
    question: 'How are activities promoted?',
    answer:
      'Eligible tours can be promoted through TravioGhana, social channels, email, content and relevant partner distribution channels.',
  },
  {
    question: 'What happens after I sign up?',
    answer:
      'Confirm your email, access your supplier portal, add your activity and submit the required business information. Our team then reviews your listing before it goes live.',
  },
  {
    question: 'Who operates TravioGhana?',
    answer:
      'TravioGhana is operated by Expedition-Go Tours Ltd. Suppliers can verify the operating company through our official websites and speak with the supplier team before registering.',
  },
  {
    question: 'Do I have to create my first listing alone?',
    answer:
      'No. Assisted onboarding is available if you would like our supplier team to guide you through the listing process.',
  },
  {
    question: 'How do I know I am using the official supplier portal?',
    answer:
      'Always access supplier onboarding through travioghana.com or supplier.travioghana.com. If you are unsure about a message, contact our supplier team through the official website before sharing information.',
  },
]

/** Inline icons ported from the reference (21px, 1.9 stroke, currentColor). */
function Icon({ name, className = 'icon-svg' }: { name: 'coin' | 'check' | 'globe' | 'megaphone' | 'shield' | 'headset'; className?: string }) {
  if (name === 'coin') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v18M16 7.5c0-1.7-1.8-3-4-3S8 5.8 8 7.5s1.8 3 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3" />
      </svg>
    )
  }
  if (name === 'check') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 12 4 4L19 6" />
      </svg>
    )
  }
  if (name === 'globe') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
    )
  }
  if (name === 'megaphone') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 13V9l12-5v14L4 13Z" />
        <path d="M8 14l1.5 5H13l-2-6M18 9v4" />
      </svg>
    )
  }
  if (name === 'shield') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    )
  }
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M4 13v4a2 2 0 0 0 2 2h2v-7H6a2 2 0 0 0-2 1ZM20 13v4a2 2 0 0 1-2 2h-2v-7h2a2 2 0 0 1 2 1Z" />
      <path d="M16 19c0 1.1-.9 2-2 2h-2" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg className="le-link-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 5h5v5" />
      <path d="M10 14 19 5" />
      <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

/**
 * Reference reveal: elements tagged `le-reveal` fade/slide in once.
 * The reference shipped this as a page script; a hook keeps the DOM identical
 * to the design (no wrapper divs inside grids).
 */
function useRevealOnScroll(rootRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>('.le-reveal'))
    if (typeof IntersectionObserver === 'undefined') {
      items.forEach((el) => el.classList.add('le-in'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('le-in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 },
    )
    items.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [rootRef])
}

export default function ListExperiencePage() {
  const navigate = useNavigate()
  const pageRef = useRef<HTMLElement>(null)
  useRevealOnScroll(pageRef)

  // Approved suppliers who land on the marketing URL go straight to their
  // portal (same guard the page carried before the split from /supplier/register).
  const { profile } = useSupplierStatus({ forceEnabled: true })
  useEffect(() => {
    if (!profile || !isApprovedSupplier(profile.status)) return
    let cancelled = false
    ;(async () => {
      const portalUrl = await getSupplierPortalUrl(profile)
      if (!cancelled && portalUrl) window.location.replace(portalUrl)
    })()
    return () => {
      cancelled = true
    }
  }, [profile])

  const handleApplyCta = useCallback(() => {
    navigate('/supplier/register')
  }, [navigate])

  return (
    <motion.main
      ref={pageRef}
      className="le-page"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <SEO
        title="List Your Experience"
        description="List tours and activities on TravioGhana. Reach more travellers, manage availability and keep 85% of every successful booking."
        keywords="list your experience Ghana, become a supplier Ghana, TravioGhana supplier, Ghana tour operator, list tours Ghana"
        jsonLd={[
          buildBreadcrumbSchema([
            { name: 'Home', url: 'https://www.travioghana.com/' },
            { name: 'List Your Experience', url: 'https://www.travioghana.com/supplier/list-experience' },
          ]),
          buildFAQSchema(FAQ_ITEMS),
        ]}
      />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="le-hero">
        <div className="wrap le-hero-grid">
          <div className="le-hero-copy">
            <div className="le-kicker"><span aria-hidden="true" />🇬🇭 Built for Ghanaian experience providers</div>
            <h1>List your tours. <em>Grow your bookings.</em></h1>
            <p>Join a Ghana-focused tours and activities marketplace. Manage your products, availability and bookings in one supplier workspace—with local support when you need it.</p>
            <div className="le-hero-actions">
              <button type="button" className="le-btn le-btn-primary" onClick={handleApplyCta}>
                Become a supplier
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              </button>
              <a className="le-btn le-btn-ghost" href="#verify">Verify us first</a>
            </div>
            <div className="le-micro">
              <span><i aria-hidden="true" />Free to join &amp; list</span>
              <span><i aria-hidden="true" />Keep 85% of each booking</span>
              <span><i aria-hidden="true" />Operated by Expedition-Go Tours Ltd</span>
            </div>
          </div>

          <div className="le-device-wall" aria-label="TravioGhana supplier platform screens">
            {HERO_IMAGES.map((img) => (
              <div key={img.cls} className={`le-device ${img.cls}`}>
                <img src={img.src} alt={img.alt} loading="eager" />
              </div>
            ))}
            <div className="le-float-card le-float-earning">
              <span className="le-float-icon"><Icon name="coin" /></span>
              <span><strong>85% is yours</strong><small>Per successful booking</small></span>
            </div>
            <div className="le-float-card le-float-booking">
              <span className="le-float-icon"><Icon name="check" /></span>
              <span><strong>Booking confirmed</strong><small>Manage it from your dashboard</small></span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Proof bar ──────────────────────────────────────────────────── */}
      <div className="le-proof">
        <div className="wrap le-proof-inner">
          {PROOF.map((p) => (
            <div key={p.span} className="le-proof-item">
              <strong>{p.strong}</strong>
              <span>{p.span}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Trust & verification ───────────────────────────────────────── */}
      <section className="le-trust" id="verify">
        <div className="wrap">
          <div className="le-trust-head le-reveal">
            <span className="le-label">Trust &amp; verification</span>
            <h2 className="le-title">Verify TravioGhana before you join.</h2>
            <p className="le-lead">We understand that suppliers need to know exactly who they are partnering with. TravioGhana is operated by Expedition-Go Tours Ltd, and you can verify our business and speak with our team before creating a supplier account.</p>
          </div>

          <div className="le-verify-grid">
            <article className="le-verify-panel le-verify-panel--primary le-reveal">
              <span className="le-verify-badge"><i aria-hidden="true" />Official TravioGhana supplier onboarding</span>
              <h3>Know the company behind the marketplace.</h3>
              <p>TravioGhana connects travellers with Ghanaian tours and experiences while giving local operators a dedicated supplier workspace to manage their products and bookings.</p>

              <div className="le-verify-points">
                {VERIFY_POINTS.map((point, i) => (
                  <div key={point.strong} className="le-verify-point">
                    <span className="le-verify-num">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>{point.strong}</strong>
                      <small>{point.small}</small>
                    </div>
                  </div>
                ))}
              </div>

              <div className="le-verify-actions">
                <a className="le-verify-chip" href="https://www.expeditiongotours.com/" target="_blank" rel="noopener noreferrer">
                  Expedition-Go Tours<ExternalLinkIcon />
                </a>
                <a className="le-verify-chip" href="https://www.travioghana.com/" target="_blank" rel="noopener noreferrer">
                  TravioGhana website<ExternalLinkIcon />
                </a>
                <a className="le-verify-chip" href="#supplier-faq">Supplier questions</a>
              </div>
            </article>

            <article className="le-verify-panel le-reveal">
              <span className="le-label">Safe onboarding</span>
              <h3>What to expect when you register.</h3>
              <p>We keep the process transparent so you know what information is needed and why.</p>

              <div className="le-safe-list">
                {SAFE_ITEMS.map((item) => (
                  <div key={item.strong} className="le-safe-item">
                    <span className="le-safe-check"><Icon name="check" /></span>
                    <div>
                      <strong>{item.strong}</strong>
                      <p>{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="le-official-note">For your security, always use the official TravioGhana website and supplier portal when creating or accessing your account.</div>
            </article>
          </div>

          <div className="le-social-proof le-reveal">
            <div className="le-social-proof-title">
              <h3>Independent travel-platform proof</h3>
              <span>Check our public profiles before you join</span>
            </div>

            <div className="le-social-proof-grid">
              <article className="le-proof-profile">
                <div className="le-profile-top">
                  <div className="le-profile-brand">
                    <div className="le-profile-logo">
                      <img src={tripadvisorLogo} alt="Tripadvisor" />
                    </div>
                  </div>
                  <a
                    className="le-profile-link"
                    href="https://www.tripadvisor.com/Attraction_Review-g293797-d24155300-Reviews-Expedition_Go_Tours_Ltd-Accra_Greater_Accra.html"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View profile<ExternalLinkIcon />
                  </a>
                </div>

                <div className="le-profile-rating"><strong>4.9</strong><span>out of 5</span></div>
                <div className="le-stars" aria-hidden="true">★★★★★</div>

                <div className="le-profile-statline">
                  <span className="le-profile-pill">931+ reviews</span>
                  <span className="le-profile-pill">Accra, Ghana</span>
                  <span className="le-profile-pill">Joined July 2022</span>
                </div>

                <p className="le-profile-copy">Expedition-Go Tours Ltd has an established public Tripadvisor operator profile where suppliers can independently review our traveller feedback and operating history.</p>
              </article>

              <article className="le-proof-profile">
                <div className="le-profile-top">
                  <div className="le-profile-brand">
                    <div className="le-profile-logo le-profile-logo--gyg">
                      <img src={getYourGuideLogo} alt="GetYourGuide" />
                    </div>
                  </div>
                  <a
                    className="le-profile-link"
                    href="https://www.getyourguide.com/expedition-go-tours-s484318/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View profile<ExternalLinkIcon />
                  </a>
                </div>

                <div className="le-profile-rating"><strong>4.6</strong><span>across reviewed activities</span></div>
                <div className="le-stars" aria-hidden="true">★★★★★</div>

                <div className="le-profile-statline">
                  <span className="le-profile-pill">424+ reviews</span>
                  <span className="le-profile-pill">4 reviewed activities</span>
                  <span className="le-profile-pill">Public supplier profile</span>
                </div>

                <p className="le-profile-copy">Our GetYourGuide supplier profile publicly shows Expedition-Go Tours activities and traveller reviews across Cape Coast, Accra, Boti and Shai Hills/Akosombo experiences.</p>
              </article>
            </div>
          </div>

          <div className="le-post-proof-demo le-reveal">
            <div className="le-verify-demo">
              <div className="le-verify-demo-copy">
                <h3>Meet the supplier team before you join.</h3>
                <p>If you’re unsure about the platform, book a short introduction call or ask for a live product-listing demo. You can verify who you’re dealing with before creating an account.</p>
              </div>
              <div className="le-verify-demo-actions">
                <a className="le-btn le-demo-primary" href={DEMO_MAILTO}>Book a 15-min demo</a>
                <a className="le-btn le-demo-secondary" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="le-process" id="how-it-works">
        <div className="wrap">
          <div className="le-process-head le-reveal">
            <span className="le-label">How it works</span>
            <h2 className="le-title">From supplier to live listing in four steps.</h2>
          </div>

          <div className="le-process-grid">
            {STEPS.map((step) => (
              <article key={step.num} className="le-process-card le-reveal">
                <span className="le-step-num">{step.num}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why TravioGhana ────────────────────────────────────────────── */}
      <section className="le-why">
        <div className="wrap">
          <div className="le-why-head le-reveal">
            <div>
              <span className="le-label">Why TravioGhana</span>
              <h2 className="le-title">Built to help your business grow.</h2>
            </div>
            <p>A Ghana-first marketplace, an easy supplier dashboard and hands-on support in one dependable partnership.</p>
          </div>
          <div className="le-why-grid">
            {WHY_CARDS.map((card) => (
              <article key={card.title} className="le-why-card le-reveal">
                <div className="le-why-icon"><Icon name={card.icon} /></div>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Commission terms ───────────────────────────────────────────── */}
      <section className="le-terms">
        <div className="wrap le-terms-shell le-reveal">
          <div className="le-split-visual">
            <div className="le-split-ring">
              <div className="le-split-inner"><div><strong>85%</strong><span>You keep</span></div></div>
            </div>
            <div className="le-commission-note"><strong>15%</strong> platform fee</div>
          </div>
          <div className="le-terms-copy">
            <span className="le-label">Simple commercial terms</span>
            <h2 className="le-title">You only pay when you receive a booking.</h2>
            <p>Adding and maintaining an activity is free. A flat 15% commission applies only to successful bookings and covers platform tools, insights, management and promotion.</p>
            <div className="le-term-list">
              {TERMS.map((term) => (
                <div key={term.label} className="le-term-item"><span>{term.label}</span>{term.text}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── What you can list ──────────────────────────────────────────── */}
      <section className="le-experiences">
        <div className="wrap">
          <div className="le-experience-head le-reveal">
            <div>
              <span className="le-label">What you can list</span>
              <h2 className="le-title">Showcase unforgettable experiences across Ghana.</h2>
            </div>
            <p>From heritage and city tours to waterfalls, coastal escapes and local experiences.</p>
          </div>
        </div>

        <div className="le-experience-track" aria-label="Ghana tours and activity inspiration">
          <div className="le-experience-set">
            {EXPERIENCES.map((exp) => (
              <figure key={exp.title} className="le-experience-card">
                <img src={exp.src} alt={exp.alt} loading="lazy" />
                <figcaption>
                  <strong>{exp.title}</strong>
                  <span>{exp.desc}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="le-experience-set" aria-hidden="true">
            {EXPERIENCES.map((exp) => (
              <figure key={`dup-${exp.title}`} className="le-experience-card">
                <img src={exp.src} alt="" loading="lazy" />
                <figcaption>
                  <strong>{exp.title}</strong>
                  <span>{exp.desc}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Supplier FAQ ───────────────────────────────────────────────── */}
      <section className="le-faq" id="supplier-faq">
        <div className="wrap le-faq-grid">
          <div className="le-faq-side le-reveal">
            <span className="le-label">Supplier FAQ</span>
            <h2 className="le-title">Know before you list.</h2>
            <p>Clear answers about eligibility, pricing, payments and how the platform helps your business grow.</p>
            <Link className="le-btn" to="/help-centre">Visit Help Centre</Link>
          </div>

          <div className="le-reveal">
            <FAQAccordion items={FAQ_ITEMS} numbered />
          </div>
        </div>
      </section>

      {/* ── Closing CTA ────────────────────────────────────────────────── */}
      <section className="le-cta">
        <div className="wrap">
          <div className="le-cta-final le-reveal">
            <div className="le-cta-center">
              <span className="le-cta-eyebrow">READY WHEN YOU ARE</span>
              <h2>Start listing your experiences on TravioGhana.</h2>
              <p>Create your supplier account yourself, or speak with our supplier team first if you would like help<br className="le-desktop-break" /> or want to verify the platform.</p>
              <div className="le-cta-final-actions">
                <button type="button" className="le-btn le-cta-white" onClick={handleApplyCta}>Create supplier account</button>
                <a className="le-btn le-cta-outline" href="#verify">Talk to supplier support</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </motion.main>
  )
}
