import Footer from '../components/Footer'
import SEO from '../components/SEO'
import RevealOnScroll from '../components/shared/RevealOnScroll'
import FAQAccordion from '../components/shared/FAQAccordion'
import BundledImage from '@/components/shared/BundledImage'
import { useComingSoon } from '../hooks/useComingSoon'
import '../styles/partner-pages.css'
import '../styles/ContentCreators.css'
import content1 from '../assets/content-creators/content1.avif'
import content2 from '../assets/content-creators/content2.avif'
import content3 from '../assets/content-creators/content3.avif'
import content4 from '../assets/content-creators/content4.avif'
import content5 from '../assets/content-creators/content5.avif'
import content6 from '../assets/content-creators/content6.avif'
import content7 from '../assets/content-creators/content7.avif'

const CREATOR_IMAGES = [
  { src: content1, label: 'Travel storyteller', w: 600, h: 750 },
  { src: content2, label: 'Community', w: 600, h: 400 },
  { src: content3, label: 'Food & lifestyle', w: 600, h: 400 },
  { src: content4, label: 'Culture & lifestyle', w: 600, h: 900 },
  { src: content5, label: 'Experiences', w: 600, h: 900 },
  { src: content6, label: 'Original content', w: 600, h: 900 },
  { src: content7, label: 'Explore Ghana', w: 600, h: 1067 },
]

const COMMUNITY_POINTS = [
  'Curated Ghana experiences with real guest reviews',
  'Earn commission on every confirmed booking',
  'Dedicated creator partner support',
]

const BENEFITS = [
  { icon: '↗', title: 'Earn from every booking.', desc: 'Share your content and booking links with your audience and earn a transparent commission on every confirmed experience.' },
  { icon: '◎', title: 'Access curated experiences.', desc: 'Choose from a growing portfolio of cultural tours, food safaris, wildlife adventures and unique stays across Ghana.' },
  { icon: '⌁', title: 'A dedicated creator team.', desc: 'Receive support from a creator partner manager, early access to new experiences and practical partnership resources.' },
]

const HOW_STEPS = [
  { num: '01', title: 'Applications open soon', desc: 'The programme is not accepting applications yet. When the window opens, you will tell us about your platform, audience and content style.' },
  { num: '02', title: 'Choose experiences and create', desc: 'Pick the experiences that fit your audience, visit or sample them and create authentic content.' },
  { num: '03', title: 'Share and earn', desc: 'Publish your content with your personal booking link and earn commission on every confirmed booking.' },
]

const EARNINGS = [
  { strong: '15%', span: 'Standard commission rate' },
  { strong: '30 days', span: 'Cookie window for referral tracking' },
  { strong: 'Monthly', span: 'Payout cycle for earnings' },
]

const FAQ_ITEMS = [
  { question: 'What is the Travio Ghana Creator Programme?', answer: 'It is a partnership for travel and lifestyle content creators who want to feature authentic Ghana experiences, share curated booking links and earn commission on confirmed bookings.' },
  { question: 'Do I need a minimum follower count?', answer: 'When applications open, we will review creators based on content quality, relevance and audience fit rather than a strict follower count.' },
  { question: 'How do creators earn commission?', answer: 'Creators receive a personal booking link that tracks referrals. When a guest completes a booking through that link, the creator earns a transparent commission.' },
  { question: 'Can I get sponsored access to experiences?', answer: 'Sponsored and hosted experiences are available for selected creators who align with the Travio Ghana brand. These are discussed during onboarding.' },
  { question: 'How are creator payouts processed?', answer: 'Earnings accumulate monthly and are paid out through secure payout channels. Full details are provided during the partner setup.' },
]

export default function ContentCreatorsPage() {
  // The creator programme is not accepting applications yet, so both CTAs are
  // dormant "Coming soon" controls (see useComingSoon).
  const comingSoon = useComingSoon()

  return (
    <main>
      <SEO
        title="Ghana Content Creator Programme — Earn on Travel Content"
        description="Join the Travio Ghana creator programme. Feature authentic Ghana travel experiences, earn commission on every booking your audience makes, and get transparent payouts plus dedicated creator support."
        keywords="Ghana content creator programme, travel creator Ghana, Ghana travel influencer, earn from travel content Ghana, Ghana creator commission"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Ghana Content Creator Programme',
            description:
              'Join the Travio Ghana creator programme, feature authentic travel experiences in Ghana and earn commission on every booking your audience makes.',
            url: 'https://www.travioghana.com/content-creators',
            about: { '@type': 'Organization', name: 'Travio Ghana', url: 'https://www.travioghana.com' },
          },
        ]}
      />
      {/* ── Hero (centred) ──────────────────────────────── */}
      <section className="cc-hero">
        <div className="cc-hero-copy">
          <div className="cc-kicker"><span />Creator programme</div>
          <h1>Create content.<br /><em>Earn on Ghana experiences.</em></h1>
          <p>Join the Travio Ghana creator programme, feature authentic travel experiences in Ghana and earn commission on every booking your audience makes.</p>
          <div className="cc-hero-actions">
            <button type="button" className="cc-btn cc-btn-primary is-coming-soon" {...comingSoon}>Coming soon</button>
            <a className="cc-btn cc-btn-secondary" href="#benefits">Learn more</a>
          </div>
          <div className="cc-hero-proof">
            <span><i /> Transparent commission</span>
            <span><i /> Curated experiences</span>
            <span><i /> Dedicated creator support</span>
          </div>
        </div>
        <div className="cc-stage">
          <div className="cc-track">
            {[...CREATOR_IMAGES, ...CREATOR_IMAGES].map((img, i) => (
              <figure key={i} className="cc-card">
                <BundledImage
                  src={img.src}
                  alt={img.label}
                  width={img.w}
                  height={img.h}
                  sizes="290px"
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>{img.label}</figcaption>
              </figure>
            ))}
          </div>
          <div className="cc-community">
            <h2>Authentic travel content starts with real experiences.</h2>
            <div className="cc-points">
              {COMMUNITY_POINTS.map((p, i) => (
                <span key={i}><i>✓</i>{p}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits ──────────────────────────────────────── */}
      <section className="cc-section cc-benefits" id="benefits">
        <div className="wrap">
          <RevealOnScroll>
            <div className="cc-benefit-head">
              <h2 className="eg-section-title">Made for creators<br />who want more.</h2>
              <p>Authentic content, curated experiences and transparent earnings — built for creators who care about what they share.</p>
            </div>
            <div className="cc-benefit-grid">
              {BENEFITS.map((b, i) => (
                <article key={i} className="cc-benefit">
                  <div className="cc-benefit-icon">{b.icon}</div>
                  <div>
                    <h3>{b.title}</h3>
                    <p>{b.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="cc-section">
        <div className="wrap">
          <RevealOnScroll>
            <div className="cc-how-grid">
              <div className="cc-how-sticky">
                <div className="cc-kicker"><span />Three steps to start</div>
                <h2 className="eg-section-title" style={{ marginTop: 22 }}>From content<br />to commission.</h2>
                <p>Applications are opening soon. Once they do, choose experiences that fit your audience and start earning from your content.</p>
              </div>
              <div className="cc-step-stack">
                {HOW_STEPS.map((s) => (
                  <article key={s.num} className="cc-step">
                    <span className="cc-step-num">{s.num}</span>
                    <div><h3>{s.title}</h3><p>{s.desc}</p></div>
                  </article>
                ))}
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── Earnings ──────────────────────────────────────── */}
      <section className="cc-section" style={{ background: '#f8faf8' }}>
        <div className="wrap">
          <RevealOnScroll>
            <h2 className="eg-section-title" style={{ textAlign: 'center', marginBottom: 50 }}>Transparent creator earnings.</h2>
            <div className="cc-benefit-grid" style={{ maxWidth: 900, margin: '0 auto', gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {EARNINGS.map((e, i) => (
                <div key={i} style={{ textAlign: 'center', padding: 28, border: '1px solid #dfe7e1', borderRadius: 22 }}>
                  <strong style={{ fontFamily: 'var(--font-display)', fontSize: 42, color: '#087747', letterSpacing: '-.04em' }}>{e.strong}</strong>
                  <p style={{ margin: '8px 0 0', color: '#5e6b64', fontSize: 14, fontWeight: 700 }}>{e.span}</p>
                </div>
              ))}
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section className="cc-section">
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
          <div className="eg-cta" style={{ background: '#075634' }}>
            <div className="eg-cta-eyebrow">Your audience deserves real travel stories</div>
            <h2>Create.<br />Share. Earn.</h2>
            <p>Join the Travio Ghana creator programme and turn authentic Ghana experiences into engaging content and transparent earnings.</p>
            <button
              type="button"
              className="is-coming-soon"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 11,
                padding: '16px 22px', background: '#fff', color: '#15201d',
                borderRadius: 999, fontWeight: 700, fontSize: 15,
                border: 'none', cursor: 'pointer', marginTop: 28, position: 'relative', zIndex: 2,
              }}
              {...comingSoon}
            >
              Coming soon
            </button>
          </div>
        </RevealOnScroll>
      </div>

      <Footer />
    </main>
  )
}