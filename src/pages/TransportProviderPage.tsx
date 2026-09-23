import { useEffect } from 'react'
import { setAuthReturnTo } from '../lib/auth'
import Footer from '../components/Footer'
import RevealOnScroll from '../components/shared/RevealOnScroll'
import FAQAccordion from '../components/shared/FAQAccordion'
import '../styles/partner-pages.css'
import '../styles/TransportPartners.css'

interface TransportProviderPageProps {
  onOpenAuth?: (mode: 'signin' | 'signup') => void
}

const TICKER_ITEMS = [
  'Tour transfers',
  'Airport pickups',
  'Group transport',
  'Multi-day journeys',
  'Private excursions',
]

const STEPS = [
  { num: '01', title: 'List your fleet', desc: 'Showcase your vehicles, seating capacity and services to travellers and tour operators. Our simple onboarding gets you started quickly.' },
  { num: '02', title: 'Set availability and pricing', desc: 'Keep vehicle availability current, set your own rates and receive booking requests that match your operation.' },
  { num: '03', title: 'Accept journeys and earn', desc: 'Confirm suitable bookings, deliver reliable service and receive secure payment for every completed journey.' },
]

const BENEFITS = [
  { tag: 'EARNING', icon: '↗', title: 'Competitive rates, set by you.', desc: 'Price your transport services and earn through a trusted network of tour operators who need dependable vehicles.' },
  { tag: 'CONTROL', icon: '⌁', title: 'Simple fleet management.', desc: 'Manage vehicles, booking requests and real-time availability without a complicated setup.' },
  { tag: 'SUPPORT', icon: '◎', title: 'A partner team beside you.', desc: 'Access a dedicated account manager, practical resources and ongoing partner support.' },
]

const CHECKS = [
  { title: 'Road-ready vehicles', desc: 'Clean, maintained and suitable for guest transport.' },
  { title: 'Professional service', desc: 'Reliable drivers, clear communication and timely pickups.' },
  { title: 'Current availability', desc: 'Accurate fleet schedules help prevent missed opportunities.' },
  { title: 'Traveller-first mindset', desc: 'Safe, comfortable journeys from pickup to destination.' },
]

const FAQ_ITEMS = [
  { question: 'What is the Transport Partner Programme?', answer: 'It connects transport providers with tour operators and travellers who need safe, comfortable and dependable vehicles across Ghana.' },
  { question: 'Can I choose my own prices?', answer: 'Yes. Transport partners set their own rates and decide which suitable booking requests to accept.' },
  { question: 'How will I manage my fleet?', answer: 'The partner experience is designed to let you manage vehicles, availability and booking requests in one straightforward place.' },
  { question: 'How are partner payments handled?', answer: 'Payments are processed securely for completed bookings. Full payout and onboarding information is provided during partner setup.' },
  { question: 'Who can I contact about the programme?', answer: 'Contact the partnerships team at partners@expedition-go.com or use the Travio Ghana Contact Us page.' },
]

export default function TransportProviderPage({ onOpenAuth }: TransportProviderPageProps) {
  useEffect(() => {
    setAuthReturnTo('/transport-providers')
  }, [])

  const handleApply = () => {
    onOpenAuth?.('signup')
  }

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="tp-hero">
        <div className="wrap tp-hero-grid">
          <div>
            <div className="tp-eyebrow">Transport partner network</div>
            <h1>Put your fleet <em>in motion.</em></h1>
            <p className="tp-hero-copy">
              Connect with tour operators and travellers who need safe, reliable and comfortable transport across Ghana. You bring the vehicles. We help bring the journeys.
            </p>
            <div className="tp-actions">
              <a className="tp-btn tp-btn-dark" href="#apply">Become a transport partner</a>
              <a className="tp-btn tp-btn-light" href="#process">See how it works</a>
            </div>
          </div>
          <div className="tp-visual">
            <div className="tp-route-line">
              <span className="tp-route-dot" />
              <span className="tp-route-dot" />
              <span className="tp-route-dot" />
            </div>
            <div className="tp-photo">
              <img
                src="/images/transport.webp"
                alt="Travio Ghana transport on a Ghana journey"
                loading="eager"
              />
              <div className="tp-image-caption">
                <b>Ready when Ghana moves.</b>
                <span>Reliable transport. More journeys.</span>
              </div>
            </div>
            <div className="tp-fleet-chip tp-fleet-chip-top">
              <strong>50+</strong>
              <span>destinations covered</span>
            </div>
            <div className="tp-fleet-chip tp-fleet-chip-bottom">
              <strong>10k+</strong>
              <span>monthly bookings</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ticker ───────────────────────────────────────── */}
      <div className="tp-ticker">
        <div className="tp-ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i}>{item}</span>
          ))}
        </div>
      </div>

      {/* ── Metrics / Intro ──────────────────────────────── */}
      <section className="tp-section">
        <div className="wrap">
          <RevealOnScroll>
            <div className="tp-intro">
              <div>
                <div className="tp-eyebrow">A better route to growth</div>
              </div>
              <div>
                <p className="tp-lead">
                  Your vehicles should spend more time earning and less time waiting. Travio Ghana helps verified transport businesses showcase their fleet, receive booking requests and build long-term relationships with travel operators.
                </p>
              </div>
            </div>
            <div className="tp-metrics">
              <div className="tp-metric"><strong>500+</strong><span>Verified transport providers</span></div>
              <div className="tp-metric"><strong>50+</strong><span>Destinations across the network</span></div>
              <div className="tp-metric"><strong>10k+</strong><span>Monthly partner bookings</span></div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── Network / Dispatch ────────────────────────────── */}
      <section className="tp-section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <RevealOnScroll>
            <div className="tp-network">
              <div className="tp-network-head">
                <h2>A clearer view of every journey.</h2>
                <p>A partnership designed around real trips: manage your fleet, keep availability current and respond to new booking requests from one place.</p>
              </div>
              <div className="tp-dispatch">
                <aside className="tp-dispatch-side">
                  <small>Available fleet</small>
                  <div className="tp-fleet-list">
                    <div className="tp-vehicle active">
                      <div className="tp-vehicle-icon">▰</div>
                      <div><b>Executive SUV</b><span>Available · 5 seats</span></div>
                    </div>
                    <div className="tp-vehicle">
                      <div className="tp-vehicle-icon" style={{ background: '#3463e8' }}>▰</div>
                      <div><b>Passenger van</b><span>On trip · 12 seats</span></div>
                    </div>
                    <div className="tp-vehicle">
                      <div className="tp-vehicle-icon" style={{ background: '#79af55' }}>▰</div>
                      <div><b>Coaster bus</b><span>Available · 28 seats</span></div>
                    </div>
                  </div>
                </aside>
                <div className="tp-dispatch-map">
                  <div className="tp-map-grid" />
                  <div className="tp-road" />
                  <i className="tp-pin tp-pin-a" />
                  <i className="tp-pin tp-pin-b" />
                  <i className="tp-pin tp-pin-c" />
                  <article className="tp-trip-card">
                    <header><span>NEW ASSIGNMENT</span><span>EG-1048</span></header>
                    <h3>Accra → Cape Coast</h3>
                    <p>Private day tour · 5 passengers</p>
                    <footer><b>06:00 departure</b><span className="tp-accepted">Accepted ✓</span></footer>
                  </article>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── Steps ─────────────────────────────────────────── */}
      <section id="process" className="tp-section">
        <div className="wrap">
          <RevealOnScroll>
            <div className="tp-steps">
              <div className="tp-sticky">
                <div className="tp-eyebrow">How to get started</div>
                <h2 className="eg-section-title" style={{ marginTop: 22, fontFamily: 'var(--font-display)' }}>
                  Three steps. More roads ahead.
                </h2>
                <p>Getting listed is straightforward. Tell us about your business, add your fleet and start receiving suitable opportunities.</p>
              </div>
              <div className="tp-step-list">
                {STEPS.map((s) => (
                  <article key={s.num} className="tp-step">
                    <span className="tp-step-num">{s.num}</span>
                    <div>
                      <h3>{s.title}</h3>
                      <p>{s.desc}</p>
                    </div>
                    <span className="tp-step-arrow">↗</span>
                  </article>
                ))}
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── Benefits ──────────────────────────────────────── */}
      <section className="tp-section tp-benefits" id="benefits">
        <div className="wrap">
          <RevealOnScroll>
            <div className="tp-benefit-head">
              <h2 className="eg-section-title" style={{ fontFamily: 'var(--font-display)' }}>Built to keep<br />business moving.</h2>
              <p>Practical tools and support for transport companies that want more visibility, stronger travel partnerships and better fleet utilisation.</p>
            </div>
            <div className="tp-cards">
              {BENEFITS.map((b, i) => (
                <article key={i} className="tp-card">
                  <span className="tp-mini-tag">{b.tag}</span>
                  <div>
                    <div className="tp-card-icon">{b.icon}</div>
                    <h3>{b.title}</h3>
                    <p>{b.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── Requirements ──────────────────────────────────── */}
      <section className="tp-section">
        <div className="wrap">
          <RevealOnScroll>
            <div className="tp-requirements">
              <div className="tp-req-copy">
                <div className="tp-eyebrow" style={{ color: '#9bcf9e' }}>Built on reliability</div>
                <h2>Good journeys start with trusted partners.</h2>
                <p>We welcome professional transport operators who care about safety, communication and the traveller experience.</p>
                <a className="tp-btn tp-btn-light" style={{ marginTop: 20 }} href="#apply">Apply to join</a>
              </div>
              <div className="tp-checklist">
                <h3>A strong partner profile</h3>
                {CHECKS.map((c, i) => (
                  <div key={i} className="tp-check">
                    <span className="tp-check-icon">✓</span>
                    <div><b>{c.title}</b><span>{c.desc}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section className="tp-section">
        <div className="wrap">
          <RevealOnScroll>
            <h2 className="eg-section-title" style={{ textAlign: 'center', marginBottom: 50, fontFamily: 'var(--font-display)' }}>
              Questions, answered.
            </h2>
            <FAQAccordion items={FAQ_ITEMS} />
          </RevealOnScroll>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <div className="wrap" style={{ paddingTop: 20 }}>
        <RevealOnScroll>
          <div className="eg-cta" id="apply">
            <div className="eg-cta-eyebrow">Your next route starts here</div>
            <h2>Ready to move more people—and your business?</h2>
            <p>Join the Travio Ghana transport network and turn available fleet capacity into more journeys across Ghana.</p>
            <button
              className="eg-cta-btn"
              onClick={handleApply}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 11,
                padding: '16px 22px',
                background: '#fff',
                color: '#15201d',
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 15,
                border: 'none',
                cursor: 'pointer',
                marginTop: 28,
                position: 'relative',
                zIndex: 2,
              }}
            >
              List your fleet for free
            </button>
          </div>
        </RevealOnScroll>
      </div>
      <Footer />
    </main>
  )
}