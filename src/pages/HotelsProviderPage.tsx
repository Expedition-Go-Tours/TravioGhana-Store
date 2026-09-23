import { useEffect } from 'react'
import { setAuthReturnTo } from '../lib/auth'
import Footer from '../components/Footer'
import RevealOnScroll from '../components/shared/RevealOnScroll'
import FAQAccordion from '../components/shared/FAQAccordion'
import '../styles/partner-pages.css'
import '../styles/HotelsStays.css'

interface HotelsProviderPageProps {
  onOpenAuth?: (mode: 'signin' | 'signup') => void
}

const PROPERTY_TYPES = [
  { icon: '▥', title: 'Hotels & resorts', desc: 'Manage room types, seasonal rates and guest reservations.' },
  { icon: '⌂', title: 'Guesthouses', desc: 'Present your local hospitality to travellers seeking authentic stays.' },
  { icon: '▦', title: 'Apartments', desc: 'List serviced apartments and longer-stay accommodation.' },
  { icon: '♢', title: 'Lodges & villas', desc: 'Showcase distinctive escapes, retreats and private properties.' },
]

const STEPS = [
  { num: '01', title: 'Create your property profile', desc: 'Add your location, facilities, policies and the details that help guests choose confidently.' },
  { num: '02', title: 'Add rooms, photos and rates', desc: 'Show each room type clearly, set your pricing and keep availability accurate.' },
  { num: '03', title: 'Publish and manage bookings', desc: 'Receive reservations, track guest activity and manage your accommodation from one workspace.' },
]

const BENEFITS = [
  { icon: '↗', title: 'Reach travellers already planning Ghana.', desc: 'Put your rooms in front of guests searching for places to stay, tours and local experiences.' },
  { icon: '⌁', title: 'Manage with less friction.', desc: 'Keep rates, availability and reservations organised in one clear partner view.' },
  { icon: '◎', title: 'Grow with partner support.', desc: 'Access onboarding guidance, a dedicated partner team and practical resources.' },
]

const FAQ_ITEMS = [
  { question: 'What types of accommodation can join?', answer: 'Hotels, resorts, guesthouses, serviced apartments, villas, lodges and other professionally managed stays can apply to join.' },
  { question: 'Can I manage several properties?', answer: 'The dashboard concept supports a portfolio view, allowing accommodation businesses to organise multiple properties and room types.' },
  { question: 'Can I control my room rates and availability?', answer: 'Yes. Partners can set their room rates and keep their available inventory current so travellers see accurate options.' },
  { question: 'Can guests also discover tours and activities?', answer: 'Yes. The partnership can help guests connect their stay with curated local experiences, creating added value throughout their trip.' },
  { question: 'How do I contact the partnerships team?', answer: 'For programme enquiries, contact partners@expedition-go.com or use the Travio Ghana Contact Us page.' },
]

export default function HotelsProviderPage({ onOpenAuth }: HotelsProviderPageProps) {
  useEffect(() => {
    setAuthReturnTo('/hotels')
  }, [])

  const handleApply = () => { onOpenAuth?.('signup') }

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="hs-hero">
        <div className="wrap hs-hero-grid">
          <div>
            <div className="hs-eyebrow">Accommodation partners</div>
            <h1>More stays.<br /><em>One simple place.</em></h1>
            <p className="hs-hero-copy">
              List your hotel, guesthouse, apartment or resort with Travio Ghana. Manage rooms, rates and reservations while helping travellers experience more of Ghana.
            </p>
            <div className="hs-buttons">
              <a className="hs-btn hs-btn-dark" href="#apply">List your property <i>↗</i></a>
              <a className="hs-btn hs-btn-ghost" href="#how">Explore the dashboard <i>↓</i></a>
            </div>
          </div>
          <div className="hs-hero-visual">
            <div className="hs-room-photo">
              <img src="https://theroyalsenchi.com/wp-content/uploads/2024/09/Untitled-3.jpg" alt="Comfortable hotel suite with a garden view" loading="eager" />
              <span className="hs-photo-label">Your property, beautifully presented</span>
            </div>
            <div className="hs-dashboard">
              <div className="hs-dash-top">
                <div className="hs-dash-property">
                  <div className="hs-property-thumb">
                    <img src="https://theroyalsenchi.com/wp-content/uploads/2024/09/Untitled-3.jpg" alt="" />
                  </div>
                  <div><b>Akwaaba Garden Stay</b><span>Accra · Published</span></div>
                </div>
                <button className="hs-add-property">+ Add property</button>
              </div>
              <div className="hs-dash-body">
                <aside className="hs-sidebar">
                  <div className="hs-side-item active"><i>⌂</i>Overview</div>
                  <div className="hs-side-item"><i>□</i>Properties</div>
                  <div className="hs-side-item"><i>▦</i>Calendar</div>
                  <div className="hs-side-item"><i>◇</i>Bookings</div>
                  <div className="hs-side-item"><i>₵</i>Rates</div>
                  <div className="hs-side-item"><i>◌</i>Reviews</div>
                </aside>
                <div className="hs-dash-main">
                  <div className="hs-dash-head">
                    <h3>Good morning, Ama</h3>
                    <span className="hs-period">Last 30 days&#x25BC;</span>
                  </div>
                  <div className="hs-dash-stats">
                    <div className="hs-dash-stat"><span>Revenue</span><strong>GH₵18.4k</strong><small>↗ 12.8%</small></div>
                    <div className="hs-dash-stat"><span>Occupancy</span><strong>78%</strong><small>↗ 8.2%</small></div>
                    <div className="hs-dash-stat"><span>Bookings</span><strong>42</strong><small>↗ 6 new</small></div>
                  </div>
                  <div className="hs-booking-row">
                    <div className="hs-guest"><span className="hs-avatar">KA</span><div><b>Kwame A.</b><br /><span style={{ fontSize: 12, color: '#68716c' }}>Garden Suite · 3 nights</span></div></div>
                    <span style={{ fontSize: 12, color: '#68716c' }}>21–24 Sep</span>
                    <span className="hs-confirmed">Confirmed</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="hs-float-card">
              <div className="hs-float-icon">₵</div>
              <div><small>Next payout</small><strong>GH₵6,240</strong><span style={{ fontSize: 11, color: '#68716c' }}>Scheduled · 28 September</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust bar ──────────────────────────────────────── */}
      <section className="hs-trust">
        <div className="wrap hs-trust-grid">
          <p>Designed to help accommodation businesses reach travellers and manage their inventory with confidence.</p>
          <div><strong>18k+</strong><span>Destinations covered</span></div>
          <div><strong>30M+</strong><span>Travellers served annually</span></div>
          <div><strong>200k+</strong><span>Curated travel experiences</span></div>
        </div>
      </section>

      {/* ── Property types ─────────────────────────────────── */}
      <section className="hs-section">
        <div className="wrap">
          <RevealOnScroll>
            <div className="hs-eyebrow">Made for every kind of stay</div>
            <p style={{ fontSize: 21, lineHeight: 1.65, color: '#68716c', maxWidth: 650, margin: '12px 0 0' }}>
              Whether you manage one apartment or a growing hotel portfolio, your accommodation deserves a clear path to new guests, simpler administration and stronger travel partnerships.
            </p>
            <div className="hs-types">
              {PROPERTY_TYPES.map((t, i) => (
                <article key={i} className="hs-type">
                  <i>{t.icon}</i>
                  <h3>{t.title}</h3>
                  <p>{t.desc}</p>
                </article>
              ))}
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── Partner tools ──────────────────────────────────── */}
      <section className="hs-section" id="platform">
        <div className="wrap">
          <RevealOnScroll>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 40, marginBottom: 50 }}>
              <h2 className="eg-section-title" style={{ fontFamily: 'var(--font-display)', maxWidth: 760 }}>
                Your property business,<br />under one roof.
              </h2>
              <p style={{ maxWidth: 430, color: '#68716c', lineHeight: 1.6 }}>
                One clear workspace for the daily decisions that keep your accommodation bookable and your guests informed.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', background: '#fff', borderRadius: 28, overflow: 'hidden', boxShadow: '0 20px 60px rgba(56,43,28,.09)' }}>
              <aside style={{ background: 'var(--eg-forest)', color: '#fff', padding: 24 }}>
                <div style={{ font: '800 15px var(--font-display)', marginBottom: 30 }}>STAY MANAGER</div>
                <button style={{ display: 'block', width: '100%', padding: 12, border: 0, borderRadius: 9, background: 'rgba(255,255,255,.13)', color: '#fff', textAlign: 'left', marginBottom: 5, fontWeight: 700, cursor: 'pointer' }}>▥ &nbsp; Rooms &amp; rates</button>
                <button style={{ display: 'block', width: '100%', padding: 12, border: 0, borderRadius: 9, background: 'transparent', color: 'rgba(255,255,255,.62)', textAlign: 'left', marginBottom: 5, cursor: 'pointer' }}>▦ &nbsp; Availability</button>
                <button style={{ display: 'block', width: '100%', padding: 12, border: 0, borderRadius: 9, background: 'transparent', color: 'rgba(255,255,255,.62)', textAlign: 'left', cursor: 'pointer' }}>◇ &nbsp; Reservations</button>
              </aside>
              <div style={{ padding: 30 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                  <div><span style={{ fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', color: '#d77842', fontWeight: 800 }}>Inventory</span><h3 style={{ font: '800 27px var(--font-display)', margin: '4px 0 0' }}>Rooms &amp; rates</h3></div>
                  <button className="hs-btn hs-btn-dark" style={{ padding: '11px 14px', fontSize: 12 }}>+ Add room</button>
                </div>
                <div style={{ border: '1px solid rgba(28,33,31,.13)', borderRadius: 15, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr .55fr .55fr .55fr', gap: 15, padding: '13px 15px', background: '#f7f4ee', color: '#68716c', fontSize: 11 }}><span>Room type</span><span>Available</span><span>Nightly rate</span><span>Status</span></div>
                  {['Garden Suite|4 rooms|GH₵850|● Live', 'Deluxe King|8 rooms|GH₵640|● Live', 'Family Room|3 rooms|GH₵980|● Live'].map((row, i) => {
                    const [name, avail, rate, status] = row.split('|')
                    return (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.3fr .55fr .55fr .55fr', gap: 15, padding: '13px 15px', borderTop: '1px solid rgba(28,33,31,.13)', fontSize: 13, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                          <span style={{ width: 34, height: 30, borderRadius: 7, background: ['#dcc8ae','#b9cdbf','#c8b9c9'][i], flexShrink: 0 }} />
                          {name}
                        </div>
                        <span>{avail}</span>
                        <strong style={{ color: '#193f33' }}>{rate}</strong>
                        <span style={{ color: '#39765a' }}>{status}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── Steps ─────────────────────────────────────────── */}
      <section className="hs-section" id="how">
        <div className="wrap">
          <RevealOnScroll>
            <div className="hs-steps">
              <div className="hs-steps-copy">
                <div className="hs-eyebrow">How it works</div>
                <h2 className="eg-section-title" style={{ marginTop: 22 }}>From property to published.</h2>
                <p>Share the essentials, prepare your inventory and start welcoming travellers through the Travio Ghana network.</p>
                <a className="hs-btn hs-btn-dark" href="#apply" style={{ marginTop: 20 }}>Start your listing <i>↗</i></a>
              </div>
              <div className="hs-step-stack">
                {STEPS.map((s) => (
                  <article key={s.num} className="hs-step">
                    <span className="hs-step-num">{s.num}</span>
                    <div><h3>{s.title}</h3><p>{s.desc}</p></div>
                  </article>
                ))}
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── Benefits (dark) ──────────────────────────────────── */}
      <section className="hs-section hs-benefits" id="benefits">
        <div className="wrap">
          <RevealOnScroll>
            <div className="hs-eyebrow" style={{ color: '#e9b597' }}>Why accommodation partners join</div>
            <h2 className="eg-section-title" style={{ marginTop: 22 }}>More than a listing.<br />A stronger guest journey.</h2>
            <div className="hs-benefit-grid">
              {BENEFITS.map((b, i) => (
                <article key={i} className="hs-benefit">
                  <i>{b.icon}</i>
                  <div><h3>{b.title}</h3><p>{b.desc}</p></div>
                </article>
              ))}
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section className="hs-section">
        <div className="wrap">
          <RevealOnScroll>
            <h2 className="eg-section-title" style={{ marginBottom: 45 }}>Before you list.</h2>
            <FAQAccordion items={FAQ_ITEMS} />
          </RevealOnScroll>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <div className="wrap" style={{ paddingTop: 20 }}>
        <RevealOnScroll>
          <div className="eg-cta" id="apply" style={{ background: 'var(--eg-terracotta)' }}>
            <div className="eg-cta-eyebrow">Open your doors to more travellers</div>
            <h2>Give every great stay a place to be discovered.</h2>
            <p>List your accommodation, keep your business organised and connect with travellers exploring Ghana.</p>
            <button
              onClick={handleApply}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 11,
                padding: '16px 22px', background: '#fff', color: '#15201d',
                borderRadius: 999, fontWeight: 700, fontSize: 15,
                border: 'none', cursor: 'pointer', marginTop: 28, position: 'relative', zIndex: 2,
              }}
            >
              List your property
            </button>
          </div>
        </RevealOnScroll>
      </div>
      <Footer />
    </main>
  )
}