import { useEffect } from 'react'
import { setAuthReturnTo } from '../lib/auth'
import Footer from '../components/Footer'
import RevealOnScroll from '../components/shared/RevealOnScroll'
import FAQAccordion from '../components/shared/FAQAccordion'
import '../styles/partner-pages.css'
import '../styles/TravelAgents.css'
import partners9 from '../assets/partners/partners9.avif'

interface TravelAgentsPageProps {
  onOpenAuth?: (mode: 'signin' | 'signup') => void
}

const STATS = [
  { strong: '10k+', span: 'Reseller bookings monthly' },
  { strong: '85%', span: 'Revenue retained' },
  { strong: '200+', span: 'Curated experiences' },
]

const FEATURES = [
  { icon: '↗', title: 'Your personal booking link', desc: 'Share curated Ghana experiences with clients using a unique referral URL that tracks every completed booking.' },
  { icon: '◎', title: 'Real-time booking management', desc: 'View confirmed bookings, guest details and tour information from one straightforward dashboard.' },
  { icon: '⌁', title: 'Monthly commission payouts', desc: 'Earn a transparent share of every confirmed booking and receive reliable monthly payouts.' },
]

const BENEFITS = [
  { tag: 'EARNING', icon: '↗', title: 'Competitive monthly commission.', desc: 'Earn a transparent commission share on every confirmed booking placed through your personal link.' },
  { tag: 'RANGE', icon: '◎', title: 'Curated Ghana experiences.', desc: 'Offer clients a growing portfolio of cultural tours, food experiences, wildlife safaris and adventure activities across Ghana.' },
  { tag: 'SUPPORT', icon: '⌁', title: 'Dedicated reseller support.', desc: 'Access a partner account manager, practical resources and ongoing support for your bookings.' },
]

const FAQ_ITEMS = [
  { question: 'What is the Travel Agent Programme?', answer: 'It connects travel agents and resellers with curated Ghana experiences. Book tours for clients, share your personal link and earn monthly commission on confirmed bookings.' },
  { question: 'Can I manage client bookings from a dashboard?', answer: 'Yes. Your reseller dashboard shows all bookings placed through your link, including guest details, tour information and booking status.' },
  { question: 'How do I share experiences with clients?', answer: 'You receive a personal booking link that tracks referrals. Share it directly with clients or embed it in your marketing to attribute bookings.' },
  { question: 'How are agent commissions paid?', answer: 'Commissions are calculated monthly on confirmed bookings and paid through secure payout channels. Payout details are provided during onboarding.' },
  { question: 'Who can I contact about the programme?', answer: 'Contact the partnerships team at info@expeditiongotours.com or use the Travio Ghana Contact Us page.' },
]

export default function TravelAgentsPage({ onOpenAuth }: TravelAgentsPageProps) {
  useEffect(() => {
    setAuthReturnTo('/travel-agents')
  }, [])

  const handleApply = () => { onOpenAuth?.('signup') }

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="ta-hero">
        <div className="wrap ta-hero-grid">
          <div>
            <div className="ta-kicker"><span />Travel agent network</div>
            <h1>Recommend <em>experiences.</em><br />Earn every month.</h1>
            <p className="ta-hero-copy">
              Offer your clients curated Ghana experiences through Travio Ghana and earn a transparent commission on every confirmed booking — managed from one simple dashboard.
            </p>
            <div className="ta-hero-actions">
              <button className="ta-btn ta-btn-primary" onClick={handleApply}>Join as a travel agent</button>
              <a className="ta-btn ta-btn-secondary" href="#benefits">See how it works</a>
            </div>
            <div className="ta-micro">
              <span><i /> Personal booking link</span>
              <span><i /> Monthly payouts</span>
              <span><i /> Real-time dashboard</span>
            </div>
          </div>
          <div className="ta-portrait-stage">
            <div className="ta-portrait-frame">
              <img src={partners9} alt="Travel agents and clients planning a Ghana experience" loading="eager" />
            </div>
            <div className="ta-agent-badge">
              <span>Verified agent</span>
              <strong>Ama Kwame</strong>
            </div>
            <div className="ta-booking-card">
              <div className="ta-booking-top">
                <span>NEW BOOKING</span>
                <span className="ta-booking-status">Confirmed</span>
              </div>
              <h3>Cape Coast Day Tour</h3>
              <p>2 adults · 1 child · Full day</p>
              <div className="ta-booking-meta">
                <span>Ref EG-8724</span>
                <strong>GH₵1,200</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ───────────────────────────────────── */}
      <section className="ta-stats">
        <div className="wrap ta-stats-inner">
          <div className="ta-stats-intro">
            <h2>Trusted by travel agents who want more.</h2>
          </div>
          {STATS.map((s, i) => (
            <div key={i} className="ta-stat"><strong>{s.strong}</strong><span>{s.span}</span></div>
          ))}
        </div>
      </section>

      {/* ── Features sidebar ─────────────────────────────── */}
      <section className="ta-section">
        <div className="wrap">
          <RevealOnScroll>
            <div className="ta-features">
              <div className="ta-sticky">
                <div className="ta-kicker"><span />Built for agents</div>
                <h2 className="eg-section-title" style={{ marginTop: 22 }}>Tools that earn<br />your trust.</h2>
                <p>Everything you need to recommend, book and manage client experiences — without extra paperwork.</p>
              </div>
              <div className="ta-feature-list">
                {FEATURES.map((f, i) => (
                  <article key={i} className="ta-feature">
                    <div className="ta-feature-icon">{f.icon}</div>
                    <div>
                      <h3>{f.title}</h3>
                      <p>{f.desc}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── Benefits ──────────────────────────────────────── */}
      <section className="ta-section ta-benefits" id="benefits">
        <div className="wrap">
          <RevealOnScroll>
            <div className="ta-benefit-head">
              <h2 className="eg-section-title">Built to help<br />your business grow.</h2>
              <p>Practical tools and support for travel agents who want more earnings, stronger client relationships and simpler bookings.</p>
            </div>
            <div className="ta-cards">
              {BENEFITS.map((b, i) => (
                <article key={i} className="ta-card">
                  <span className="ta-mini-tag">{b.tag}</span>
                  <div>
                    <div className="ta-card-icon">{b.icon}</div>
                    <h3>{b.title}</h3>
                    <p>{b.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section className="ta-section">
        <div className="wrap">
          <RevealOnScroll>
            <h2 className="eg-section-title" style={{ textAlign: 'center', marginBottom: 50 }}>Questions, answered.</h2>
            <FAQAccordion items={FAQ_ITEMS} />
          </RevealOnScroll>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <div className="wrap" style={{ paddingTop: 20 }}>
        <RevealOnScroll>
          <div className="eg-cta">
            <div className="eg-cta-eyebrow">Your next opportunity starts here</div>
            <h2>Ready to recommend Ghana<br />and earn every month?</h2>
            <p>Join the Travio Ghana travel agent network and earn transparent commission on curated experiences across Ghana.</p>
            <button
              onClick={handleApply}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 11,
                padding: '16px 22px', background: '#fff', color: '#15201d',
                borderRadius: 999, fontWeight: 700, fontSize: 15,
                border: 'none', cursor: 'pointer', marginTop: 28, position: 'relative', zIndex: 2,
              }}
            >
              Join the network
            </button>
          </div>
        </RevealOnScroll>
      </div>
      <Footer />
    </main>
  )
}