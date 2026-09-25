import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowUp, Check, Cookie, LifeBuoy } from 'lucide-react'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema } from '../components/SEO'
import { useCookieConsent } from '../context/CookieConsentContext'
import './CookiesPolicyPage.css'

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

/** Section anchors mirror the reference document's numbered headings. */
const SECTIONS = [
  { id: '1-about-this-policy', num: '01', label: 'About this policy' },
  { id: '2-what-cookies-and-similar-technologies-are', num: '02', label: 'What cookies and similar technologies are' },
  { id: '3-how-we-use-cookies', num: '03', label: 'How we use cookies' },
  { id: '4-services-that-may-place-cookies', num: '04', label: 'Services that may place cookies' },
  { id: '5-consent-and-legal-basis', num: '05', label: 'Consent and legal basis' },
  { id: '6-managing-or-withdrawing-your-consent', num: '06', label: 'Managing or withdrawing your consent' },
  { id: '7-how-long-cookies-remain', num: '07', label: 'How long cookies remain' },
  { id: '8-international-data-transfers', num: '08', label: 'International data transfers' },
  { id: '9-children', num: '09', label: 'Children' },
  { id: '10-updates-to-this-policy', num: '10', label: 'Updates to this policy' },
  { id: '11-contact-us', num: '11', label: 'Contact us' },
]

const POLICY_TABS = [
  { label: 'Supplier Terms', to: '/supplier-terms' },
  { label: 'Terms & Conditions', to: '/terms-and-conditions' },
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Cookies Policy', to: '/cookies-policy', active: true },
]

const COOKIE_CONTROLS = [
  'Accept all cookies',
  'Reject non-essential cookies',
  'Manage choices by category',
  'Change preferences at any time',
]

const LAST_UPDATED = 'August 2026'

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CookiesPolicyPage() {
  const { t } = useTranslation()
  const { openPreferences } = useCookieConsent()
  const [currentId, setCurrentId] = useState(SECTIONS[0].id)
  const [showToTop, setShowToTop] = useState(false)
  const tabsRef = useRef<HTMLElement>(null)
  const tocRef = useRef<HTMLElement>(null)

  /** Center an item inside a horizontal rail without touching page scroll. */
  const centerInRail = (rail: HTMLElement | null, item: HTMLElement | null) => {
    if (!rail || !item || rail.scrollWidth <= rail.clientWidth) return
    const itemLeft = item.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft
    const target = itemLeft - (rail.clientWidth - item.offsetWidth) / 2
    rail.scrollTo({
      left: Math.max(0, target),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  /* Bring the active policy tab into view on small screens. */
  useEffect(() => {
    const rail = tabsRef.current
    centerInRail(rail, rail?.querySelector<HTMLElement>('.cp-tab--active') ?? null)
  }, [])

  /* Keep the mobile "On this page" rail following the current section. */
  useEffect(() => {
    const rail = tocRef.current
    centerInRail(rail, rail?.querySelector<HTMLElement>('a.is-current') ?? null)
  }, [currentId])

  /* Scroll-spy for the "On this page" table of contents. */
  useEffect(() => {
    const nodes = SECTIONS.map((section) => document.getElementById(section.id)).filter(
      (node): node is HTMLElement => node !== null,
    )
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrentId(entry.target.id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  /* Floating back-to-top control, shown once the reader is deep in the page. */
  useEffect(() => {
    const onScroll = () => setShowToTop(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="cookies-page">
      <SEO
        title="Cookie Policy"
        description="Learn how Travio Ghana uses cookies on our booking platform. Manage your cookie preferences and understand what data we collect."
        keywords="Travio Ghana cookies, cookie policy, website cookies, tracking cookies Ghana"
        jsonLd={buildBreadcrumbSchema([
          { name: 'Home', url: 'https://www.travioghana.com/' },
          { name: 'Cookies Policy', url: 'https://www.travioghana.com/cookies-policy' },
        ])}
      />

      <div className="cp-wrap">
        {/* ===== Hero ===== */}
        <section className="cp-hero" aria-labelledby="cp-title">
          <div className="cp-hero-copy">
            <p className="cp-kicker">
              <Cookie size={13} aria-hidden="true" />
              Your choices
            </p>
            <h1 id="cp-title">{t('footer.cookiesPolicy')}</h1>
            <p className="cp-hero-lead">{t('company.cookiesSubtitle')}</p>
            <p className="cp-updated">
              <i aria-hidden="true" />
              {t('support.updatedDate')} &middot; {LAST_UPDATED}
            </p>
          </div>

          <aside className="cp-summary" aria-label="Your cookie controls">
            <h2>Your cookie controls</h2>
            <ul>
              {COOKIE_CONTROLS.map((item) => (
                <li key={item}>
                  <Check size={15} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </aside>
        </section>

        {/* ===== Legal policy tabs ===== */}
        <nav className="cp-tabs" aria-label="Legal policies" ref={tabsRef}>
          {POLICY_TABS.map((tab) =>
            tab.active ? (
              <span key={tab.label} className="cp-tab cp-tab--active" aria-current="page">
                {tab.label}
              </span>
            ) : (
              <Link key={tab.label} to={tab.to} className="cp-tab">
                {tab.label}
              </Link>
            ),
          )}
        </nav>

        {/* ===== Layout: sticky TOC + article ===== */}
        <div className="cp-layout">
          <aside className="cp-sidebar">
            <p className="cp-sidebar-label">On this page</p>
            <nav className="cp-toc" aria-label="On this page" ref={tocRef}>
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className={currentId === section.id ? 'is-current' : ''}
                  aria-current={currentId === section.id ? 'location' : undefined}
                >
                  <span>{section.num}</span>
                  {section.label}
                </a>
              ))}
            </nav>

            <div className="cp-helpbox">
              <b>Need help?</b>
              <p>Questions about cookies or your privacy choices? Manage them any time.</p>
              <button type="button" className="cp-helpbox-btn" onClick={openPreferences}>
                <LifeBuoy size={13} aria-hidden="true" />
                Open Cookie Settings
              </button>
            </div>
          </aside>

          <article className="cp-content">
            <p>When you first visit our Platform, you can choose to:</p>
            <ul>
              <li><strong>Accept all cookies</strong>;</li>
              <li><strong>Reject non-essential cookies</strong>; or</li>
              <li><strong>Manage preferences</strong> by cookie category.</li>
            </ul>
            <p>
              Strictly necessary cookies are always active because they are required for core
              functions such as security, account access, bookings, payments and remembering your
              privacy choices. We will not place analytics, personalisation or advertising cookies
              on your device until you consent, where consent is required by applicable law.
            </p>
            <p>
              You can change or withdraw your choice at any time by selecting{' '}
              <strong>&ldquo;Cookie Settings&rdquo;</strong> in the footer of our websites. Rejecting
              optional cookies will not prevent you from browsing or making a booking, although some
              optional features may work differently.
            </p>

            <h2 id="1-about-this-policy">1. About this policy</h2>
            <p>
              This Cookie Policy explains how <strong>Expedition-Go Tours Ltd</strong> (
              <strong>&ldquo;Travio Ghana&rdquo;</strong>, <strong>&ldquo;we&rdquo;</strong>,{' '}
              <strong>&ldquo;us&rdquo;</strong> or <strong>&ldquo;our&rdquo;</strong>) uses cookies and
              similar technologies when you visit or use:
            </p>
            <ul>
              <li><strong>travioghana.com</strong>;</li>
              <li><strong>travioghana.com</strong>;</li>
              <li><strong>travioafrica.com</strong>;</li>
              <li>their subdomains, supplier and administration portals;</li>
              <li>our booking tools, applications and embedded services; and</li>
              <li>any other website or digital service that links to this policy.</li>
            </ul>
            <p>Together, these are the <strong>&ldquo;Platform&rdquo;</strong>.</p>
            <p>
              <strong>Travio Ghana</strong> and <strong>Travio Africa</strong> are registered trading
              names of Expedition-Go Tours Ltd and are not separate legal entities.
            </p>
            <p>
              This policy should be read with our <Link to="/privacy-policy">Privacy Policy</Link>,
              which explains how we collect, use, disclose and protect personal information.
            </p>

            <h2 id="2-what-cookies-and-similar-technologies-are">
              2. What cookies and similar technologies are
            </h2>
            <p>
              A cookie is a small text file placed on your browser or device when you visit a
              website. Cookies allow a website to recognise a device, remember preferences, keep an
              account secure, maintain a booking session and understand how the website is used.
            </p>
            <p>We may also use similar technologies, including:</p>
            <ul>
              <li>browser local storage and session storage;</li>
              <li>pixels, tags and web beacons;</li>
              <li>software development kits in applications;</li>
              <li>device identifiers; and</li>
              <li>scripts that measure website performance or interactions.</li>
            </ul>
            <p>
              References to <strong>&ldquo;cookies&rdquo;</strong> in this policy include these similar
              technologies where appropriate.
            </p>
            <p>Cookies may be:</p>
            <ul>
              <li>
                <strong>Session cookies</strong>, which normally expire when you close your browser;
                or
              </li>
              <li>
                <strong>Persistent cookies</strong>, which remain for a stated period or until you
                delete them.
              </li>
            </ul>
            <p>They may also be:</p>
            <ul>
              <li>
                <strong>First-party cookies</strong>, set by the Expedition-Go Tours, Travio Ghana or
                Travio Africa domain you are visiting; or
              </li>
              <li>
                <strong>Third-party cookies</strong>, set by another organisation whose service is
                used on the Platform.
              </li>
            </ul>

            <h2 id="3-how-we-use-cookies">3. How we use cookies</h2>

            <h3>3.1 Strictly necessary cookies</h3>
            <p>
              These cookies are essential for the Platform to function securely and provide a
              service you request. They may be used to:
            </p>
            <ul>
              <li>operate secure pages and prevent fraud or misuse;</li>
              <li>maintain your login or supplier session;</li>
              <li>remember items, travellers or services during booking and checkout;</li>
              <li>process payments and confirm transactions;</li>
              <li>balance network traffic and maintain website availability;</li>
              <li>remember language, currency or accessibility choices where necessary for a requested service; and</li>
              <li>record your cookie consent and privacy preferences.</li>
            </ul>
            <p>
              These cookies cannot normally be switched off through our consent tool. You may block
              them in your browser, but parts of the Platform may stop working.
            </p>

            <h3>3.2 Functional and personalisation cookies</h3>
            <p>
              With your consent where required, these cookies help the Platform remember optional
              choices and provide enhanced features, such as:
            </p>
            <ul>
              <li>preferred destination, language or currency;</li>
              <li>recently viewed Experiences;</li>
              <li>saved searches or favourites;</li>
              <li>chat, maps, video and social-media features; and</li>
              <li>a more personalised browsing experience.</li>
            </ul>
            <p>
              If you reject these cookies, some optional features may be unavailable or may not
              remember your choices.
            </p>

            <h3>3.3 Analytics and performance cookies</h3>
            <p>
              With your consent where required, these cookies help us understand how visitors use
              the Platform. They may collect information about:
            </p>
            <ul>
              <li>pages and Experiences viewed;</li>
              <li>searches, clicks and navigation paths;</li>
              <li>approximate location, browser and device type;</li>
              <li>page-loading speed, errors and technical performance;</li>
              <li>how visitors reached the Platform; and</li>
              <li>whether website improvements or campaigns are effective.</li>
            </ul>
            <p>
              We use this information to measure audiences, identify problems and improve our
              services. Analytics information may be aggregated, but identifiers and usage
              information can still constitute personal data.
            </p>

            <h3>3.4 Advertising and marketing cookies</h3>
            <p>
              With your consent, we and our advertising partners may use cookies or pixels to:
            </p>
            <ul>
              <li>measure advertising performance;</li>
              <li>limit how often an advertisement is shown;</li>
              <li>understand whether a booking followed an advertisement;</li>
              <li>build or use audiences for relevant advertising; and</li>
              <li>show Expedition-Go Tours, Travio Ghana or Travio Africa promotions on other websites and platforms.</li>
            </ul>
            <p>
              These technologies may recognise your browser or device across services. If you reject
              marketing cookies, you may still see advertising, but it may be less relevant and
              will not use our optional advertising cookies.
            </p>

            <h2 id="4-services-that-may-place-cookies">4. Services that may place cookies</h2>
            <p>
              The services used on a particular page depend on the features active at the time.
            </p>
            <p>
              <strong>Website security and hosting</strong> — Hosting, content-delivery and security
              providers. Purpose: security, fraud prevention, traffic management and delivery.
              Category: strictly necessary.
            </p>
            <p>
              <strong>Account and booking system</strong> — Travio Ghana account, supplier portal
              and booking tools. Purpose: login, session management, basket and booking progress.
              Category: strictly necessary.
            </p>
            <p>
              <strong>Payments</strong> — Stripe, PayPal or another displayed payment provider.
              Purpose: secure checkout, payment processing and fraud prevention. Category: strictly
              necessary.
            </p>
            <p>
              <strong>Consent management</strong> — Travio Ghana or its consent-management provider.
              Purpose: store and apply cookie choices. Category: strictly necessary.
            </p>
            <p>
              <strong>Website analytics</strong> — Google Analytics or another enabled analytics
              provider. Purpose: audience measurement and website improvement. Category: analytics.
            </p>
            <p>
              <strong>Advertising measurement</strong> — Google Ads, Meta or another enabled
              advertising provider. Purpose: campaign measurement, conversion tracking and relevant
              advertising. Category: advertising.
            </p>
            <p>
              <strong>Maps and location</strong> — Google Maps or another enabled mapping provider.
              Purpose: display maps, routes, meeting points or location features. Category:
              functional.
            </p>
            <p>
              <strong>Video and social content</strong> — YouTube, Instagram, TikTok or another
              embedded provider. Purpose: display media or enable social features. Category:
              functional or advertising.
            </p>
            <p>
              <strong>Customer support</strong> — Live-chat, messaging or support provider. Purpose:
              provide requested support and remember chat state. Category: necessary or functional,
              depending on use.
            </p>
            <p>
              This list identifies the types of services that may be used; it does not mean every
              provider is active on every page. The <strong>Cookie Settings</strong> panel should
              display the current cookie name, provider, purpose, category and duration detected or
              configured for the Platform.
            </p>
            <p>
              Third parties may process information under their own privacy and cookie policies. We
              do not control cookies placed directly by a third party after you leave our Platform
              or interact with that party&apos;s service.
            </p>

            <h2 id="5-consent-and-legal-basis">5. Consent and legal basis</h2>
            <p>
              Where UK privacy rules apply, we request consent before storing or accessing
              non-essential cookies on your device. Consent must be freely given, specific, informed
              and expressed through a clear positive action.
            </p>
            <p>
              We do not treat silence, inactivity, pre-ticked options or simply continuing to browse
              as consent. <strong>Reject non-essential cookies</strong> should be as easy to select
              as <strong>Accept all cookies</strong>.
            </p>
            <p>
              Strictly necessary cookies may be used without consent where they are essential to
              transmit a communication or provide an online service you expressly request. Where
              cookie information constitutes personal data, our <Link to="/privacy-policy">Privacy
              Policy</Link> explains the corresponding data-protection legal bases and your rights.
            </p>
            <p>
              We also handle cookie-related personal information in accordance with Ghana&apos;s Data
              Protection Act, 2012 (Act 843) and, where applicable, the UK GDPR, Data Protection Act
              2018 and Privacy and Electronic Communications Regulations 2003.
            </p>

            <h2 id="6-managing-or-withdrawing-your-consent">6. Managing or withdrawing your consent</h2>
            <p>
              You can review and change optional cookie categories at any time using the{' '}
              <strong>Cookie Settings</strong> link in the website footer. Withdrawing consent does
              not make earlier processing unlawful, but it stops the relevant optional cookies from
              being used in the future where technically possible.
            </p>
            <p>
              When you withdraw consent, we will update your preference and stop future optional
              tracking. Cookies already stored may remain until they expire or you delete them
              through your browser. We will make reasonable efforts to remove or deactivate cookies
              through our consent tool where supported.
            </p>
            <p>
              Your browser may allow you to view, delete or block cookies, block third-party
              cookies, or clear cookies when the browser closes. Blocking all cookies may prevent
              account, booking, payment or supplier-portal functions from working correctly.
            </p>

            <h2 id="7-how-long-cookies-remain">7. How long cookies remain</h2>
            <p>Cookie duration depends on its purpose:</p>
            <ul>
              <li>session cookies normally expire when the browser session ends;</li>
              <li>security, authentication and booking cookies remain only as long as reasonably required for the relevant function;</li>
              <li>cookie-preference records may remain long enough to remember your choice and demonstrate compliance;</li>
              <li>analytics and advertising cookies remain for the period shown in Cookie Settings, unless you delete them sooner; and</li>
              <li>third-party cookies follow the retention period stated by the relevant provider.</li>
            </ul>
            <p>
              We will not retain a cookie for longer than necessary for its stated purpose. We
              periodically review cookie durations and remove technologies we no longer need.
            </p>

            <h2 id="8-international-data-transfers">8. International data transfers</h2>
            <p>
              Some cookie and technology providers may process information outside Ghana or the
              United Kingdom. Where personal information is transferred internationally, we use the
              safeguards described in our <Link to="/privacy-policy">Privacy Policy</Link> and
              require appropriate protection where applicable.
            </p>

            <h2 id="9-children">9. Children</h2>
            <p>
              The Platform is intended for adults making travel arrangements. We do not knowingly
              use advertising cookies to profile children. A parent or guardian booking for a child
              should manage cookie choices on the device being used.
            </p>

            <h2 id="10-updates-to-this-policy">10. Updates to this policy</h2>
            <p>
              We may update this policy when our websites, providers, legal obligations or cookie
              practices change. The effective date and version appear at the top.
            </p>
            <p>
              Where a change materially affects the choices previously made, we may display the
              consent banner again and request fresh consent. We recommend reviewing this policy
              periodically.
            </p>

            <h2 id="11-contact-us">11. Contact us</h2>
            <p>For questions about cookies, privacy choices or personal information, contact:</p>
            <p>
              <strong>Expedition-Go Tours Ltd</strong>
              <br />
              Trading address: <strong>Nmai Dzorn Adjiringano Road, Accra, Ghana</strong>
              <br />
              Registered address: <strong>H/N UNN House, near Harvest Chapel International, Accra, Ghana</strong>
              <br />
              Company registration number: <strong>CS026170223</strong>
              <br />
              TIN: <strong>C0062656392</strong>
              <br />
              Email: <a href="mailto:info@expeditiongotours.com">info@expeditiongotours.com</a>
              <br />
              Telephone/WhatsApp: <strong>+233 59 140 9761</strong>
            </p>
            <p>
              Please use the subject line <strong>&ldquo;Cookie or Privacy Request&rdquo;</strong>.
            </p>
            <p>
              You may also have the right to complain to the relevant data-protection authority. Our{' '}
              <Link to="/privacy-policy">Privacy Policy</Link> contains further information about
              regulatory complaints and your data-protection rights.
            </p>

            <p className="cp-meta">
              {t('support.updatedDate')}: {LAST_UPDATED}
            </p>
          </article>
        </div>
      </div>

      <button
        type="button"
        className={`cp-to-top${showToTop ? ' is-visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
      >
        <ArrowUp size={18} aria-hidden="true" />
      </button>

      <Footer />
    </div>
  )
}
