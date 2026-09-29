/* ============================================================================
   Supplier Terms — /supplier-terms
   ----------------------------------------------------------------------------
   Port of Travio_Ghana_Supplier_Terms_Mobile_Scroll_Fixed.html.

   The prototype was a standalone document: its own nav and footer are dropped
   (this app renders a global Navbar and Footer), and its runtime script — the
   scroll-spy, the mobile pill auto-centring, the anchor scrolling and the
   back-to-top button — is reimplemented as the effects below. See
   src/styles/SupplierTermsPage.css for the CSS notes and the app-integration
   offsets (the app's navbar is fixed, the prototype's header was not).
   ========================================================================== */

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema, SITE_URL } from '../components/SEO'
import { POLICY_TABS } from '../lib/policyTabs'
import '@/styles/SupplierTermsPage.css'

const SUPPLIER_DASHBOARD = 'https://supplier.travioghana.com/'

const SUMMARY = [
  'Free to list and maintain',
  '15% commission on successful bookings',
  'Bi-weekly eligible payouts',
  'Use of the platform constitutes agreement',
]

/** The prototype's 31-entry section navigator, in document order. */
const TOC = [
  { id: '1-introduction', num: '01', label: 'Introduction and agreement' },
  { id: '2-about-platform', num: '02', label: 'About the platform' },
  { id: '3-definitions', num: '03', label: 'Definitions' },
  { id: '4-relationship', num: '04', label: 'Independent supplier relationship' },
  { id: '5-registration', num: '05', label: 'Registration, verification and approval' },
  { id: '6-listings', num: '06', label: 'Listings and content accuracy' },
  { id: '7-pricing-commission', num: '07', label: 'Pricing and commission' },
  { id: '8-bookings', num: '08', label: 'Bookings and availability' },
  { id: '9-cancellations', num: '09', label: 'Cancellations, changes and force majeure' },
  { id: '10-payments', num: '10', label: 'Payments and payouts' },
  { id: '11-refunds', num: '11', label: 'Refunds, chargebacks and disputed bookings' },
  { id: '12-taxes', num: '12', label: 'Taxes and statutory obligations' },
  { id: '13-circumvention', num: '13', label: 'No booking or payment circumvention' },
  { id: '14-communications', num: '14', label: 'Traveller communication and data use' },
  { id: '15-standards', num: '15', label: 'Service, conduct and quality standards' },
  { id: '16-staff-subcontracting', num: '16', label: 'Guides, drivers, staff and subcontracting' },
  { id: '17-compliance-insurance', num: '17', label: 'Licensing, legal compliance and insurance' },
  { id: '18-incidents', num: '18', label: 'Safety incidents and emergencies' },
  { id: '19-complaints-reviews', num: '19', label: 'Complaints and reviews' },
  { id: '20-content-distribution', num: '20', label: 'Content, intellectual property and distribution' },
  { id: '21-brand-data', num: '21', label: 'Branding, privacy and confidentiality' },
  { id: '22-suspension', num: '22', label: 'Suspension, corrective action and investigation' },
  { id: '23-termination', num: '23', label: 'Termination and existing bookings' },
  { id: '24-liability', num: '24', label: 'Platform responsibility and supplier indemnity' },
  { id: '25-platform', num: '25', label: 'Platform availability and intellectual property' },
  { id: '26-country', num: '26', label: 'Country-specific requirements and Ghana suppliers' },
  { id: '27-disputes', num: '27', label: 'Dispute resolution and governing law' },
  { id: '28-general', num: '28', label: 'General provisions' },
  { id: '29-updates', num: '29', label: 'Changes to these terms' },
  { id: '30-acknowledgement', num: '30', label: 'Supplier acknowledgement' },
  { id: 'ready-to-start-selling', num: '31', label: 'Start selling' },
]

export default function SupplierTermsPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const tocRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState<string | null>(null)
  const [showTop, setShowTop] = useState(false)

  /** The prototype's moveTabHorizontally: centre the active pill on phones. */
  const centreActivePill = useCallback((id: string) => {
    const toc = tocRef.current
    if (!toc || window.innerWidth > 850) return
    const link = toc.querySelector<HTMLAnchorElement>(`a[href="#${id}"]`)
    if (!link) return
    const targetLeft = link.offsetLeft - toc.clientWidth / 2 + link.offsetWidth / 2
    const maxLeft = Math.max(0, toc.scrollWidth - toc.clientWidth)
    toc.scrollTo({ left: Math.max(0, Math.min(targetLeft, maxLeft)), behavior: 'smooth' })
  }, [])

  // The prototype's updateActiveFromScroll, plus the back-to-top reveal.
  // Its viewport reading lines (95 / 135) shift by the app's 64px navbar.
  useEffect(() => {
    const sections = TOC
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)

    let ticking = false
    const update = () => {
      const offset = window.innerWidth <= 850 ? 199 : 159
      let current = sections[0]
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= offset) current = section
        else break
      }
      if (current) setActive(current.id)
      setShowTop(window.scrollY > 600)
      ticking = false
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', update)
    }
  }, [])

  // Follow the scroll-spy with the mobile navigator.
  useEffect(() => {
    if (active) centreActivePill(active)
  }, [active, centreActivePill])

  // Anchor jumps land below the fixed navbar (and the sticky navigator on
  // phones) rather than under it.
  const onTocClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    event.preventDefault()
    const stickyOffset = window.innerWidth <= 850 ? 186 : 92
    const y = target.getBoundingClientRect().top + window.pageYOffset - stickyOffset
    window.scrollTo({ top: y, behavior: 'smooth' })
    setActive(id)
    if (history.replaceState) history.replaceState(null, '', `#${id}`)
  }

  return (
    <>
      <div className="stp-page" ref={pageRef}>
        <SEO
          title="Supplier Terms & Agreement"
          description="The supplier terms that govern listing and selling tours and activities through Travio Ghana, a Ghanaian tours and activities platform managed by Expedition-Go Tours Ltd."
          keywords="Travio Ghana supplier terms, supplier agreement Ghana, list tours Ghana"
          jsonLd={buildBreadcrumbSchema([
            { name: 'Home', url: `${SITE_URL}/` },
            { name: 'Supplier Terms', url: `${SITE_URL}/supplier-terms` },
          ])}
        />

        <main>
          {/* ── Hero ──────────────────────────────────────────────────── */}
          <section className="wrap hero">
            <div>
              <div className="kicker">Supplier agreement</div>
              <h1>Supplier Terms</h1>
              <p>
                The terms that govern listing, selling and delivering tours and
                activities through Travio Ghana, a Ghanaian tours and activities
                platform managed by Expedition-Go Tours Ltd.
              </p>
              <div className="updated">
                <i />Last updated · September 2026
              </div>
            </div>
            <aside className="summary">
              <h2>At a glance</h2>
              <ul>
                {SUMMARY.map((item) => (
                  <li key={item}>
                    <i>✓</i>
                    {item}
                  </li>
                ))}
              </ul>
            </aside>
          </section>

          {/* ── Policy tabs ───────────────────────────────────────────── */}
          <div className="legal-nav">
            <div className="wrap policy-tabs">
              {POLICY_TABS.map((tab) => (
                <Link
                  key={tab.key}
                  to={tab.to}
                  className={tab.key === 'supplier-terms' ? 'active' : undefined}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>

          {/* ── Section navigator + agreement ─────────────────────────── */}
          <div className="wrap layout">
            <aside className="sidebar">
              <div className="label">On this page</div>
              <nav className="toc" ref={tocRef}>
                {TOC.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={active === item.id ? 'current' : undefined}
                    onClick={(event) => onTocClick(event, item.id)}
                  >
                    <span>{item.num}</span>
                    {item.label}
                  </a>
                ))}
              </nav>
              <div className="helpbox">
                <b>Need help?</b>
                <p>Questions about this agreement or your Travio supplier account?</p>
                <a href={SUPPLIER_DASHBOARD}>Supplier dashboard ↗</a>
              </div>
            </aside>

            <article className="content">
              <div className="support-article">
                <h2 id="1-introduction">1. Introduction and agreement</h2>
                <p>
                  This Supplier Agreement (&quot;Agreement&quot;) applies to tour
                  operators, activity providers, independent guides and other
                  travel-service providers who register, list or supply products
                  through Travio Ghana supplier platform.
                </p>
                <p>
                  <strong>Expedition-Go Tours Ltd</strong> manages and operates
                  Travio Ghana supplier services. In this Agreement, &quot;Travio
                  Ghana&quot;, &quot;we&quot;, &quot;us&quot; and &quot;our&quot; may
                  refer to the applicable platform service operated by Expedition-Go
                  Tours Ltd.
                </p>
                <div className="acceptance-notice">
                  <strong>Your use of the platform means you agree to these terms.</strong>
                  <p>
                    By creating or maintaining a supplier account, submitting or
                    publishing a tour or activity, accepting a booking, or otherwise
                    using the <strong>Travio Ghana platform</strong>, you confirm
                    that you have read, understood and agree to be bound by these
                    Supplier Terms &amp; Agreement. No separate physical signature is
                    required unless we specifically request one.
                  </p>
                </div>

                <h2 id="2-about-platform">2. About the platform</h2>
                <p>
                  Travio Ghana is a Ghanaian online tours and activities marketplace
                  connecting travellers with independent tour operators, activity
                  providers and guides offering experiences across Ghana.
                </p>
                <p>
                  The platform may provide listing tools, marketing, booking
                  facilitation, payment collection, customer communication, customer
                  support, affiliate distribution, supplier technology and related
                  marketplace services.
                </p>
                <p>
                  Unless expressly stated otherwise, Travio Ghana does not operate
                  the Supplier&apos;s Experience. The Supplier remains responsible
                  for delivering every Experience it accepts.
                </p>

                <h2 id="3-definitions">3. Definitions</h2>
                <p>
                  <strong>Booking</strong> means a confirmed reservation or purchase
                  of a Supplier tour or activity through the platform or an
                  authorised distribution channel.
                </p>
                <p>
                  <strong>Experience</strong> means any tour, activity, attraction,
                  excursion, class, transfer, multi-day trip or other travel
                  experience supplied by the Supplier.
                </p>
                <p>
                  <strong>Retail Price</strong> means the customer-facing selling
                  price provided or approved by the Supplier.
                </p>
                <p>
                  <strong>Commission</strong> means the percentage or amount retained
                  by Travio Ghana from the Retail Price of a completed Booking.
                </p>
                <p>
                  <strong>Supplier Payout</strong> means the amount payable to the
                  Supplier after applicable commission, refunds, adjustments,
                  chargebacks or other authorised deductions.
                </p>
                <p>
                  <strong>Traveller Information</strong> means personal information
                  relating to a Traveller that the Supplier receives in connection
                  with a Booking.
                </p>

                <h2 id="4-relationship">4. Independent supplier relationship</h2>
                <p>
                  The Supplier operates as an independent business. Nothing in this
                  Agreement creates employment, partnership, joint venture, franchise
                  or general agency between the Supplier and Expedition-Go Tours Ltd.
                </p>
                <p>
                  The relationship is non-exclusive unless otherwise agreed in
                  writing. Suppliers may sell through their own channels and other
                  marketplaces, and Travio Ghana may list competing or similar
                  Experiences.
                </p>

                <h2 id="5-registration">5. Registration, verification and approval</h2>
                <p>
                  The Supplier must provide accurate and current account information.
                  We may request business registration documents, tourism licences,
                  tax details, bank or payment information, identification, insurance
                  documents, vehicle documents and other information reasonably
                  required to verify the Supplier.
                </p>
                <p>
                  We may approve, reject, suspend or request further information
                  regarding an application where reasonably necessary for marketplace
                  quality, legal compliance, fraud prevention or Traveller safety.
                </p>
                <p>
                  Approval to use the platform does not constitute a representation
                  that the Supplier has satisfied every legal requirement applicable
                  to its business.
                </p>

                <h2 id="6-listings">6. Listings and content accuracy</h2>
                <p>
                  The Supplier is responsible for ensuring each listing is accurate,
                  current, complete and not misleading. This includes titles,
                  descriptions, photographs, itinerary, inclusions, exclusions,
                  meeting or pickup information, duration, capacity, availability,
                  prices, restrictions, accessibility information, cancellation terms
                  and safety information.
                </p>
                <p>
                  The Supplier must promptly update material changes. Travio Ghana may
                  make reasonable editorial changes for grammar, formatting,
                  translation, categorisation, search optimisation, clarity and
                  marketplace consistency, without intentionally changing the
                  substance of the Experience.
                </p>

                <h2 id="7-pricing-commission">7. Pricing and commission</h2>
                <h3>7.1 Retail prices</h3>
                <p>
                  The Supplier sets or approves its Retail Prices. Mandatory charges
                  must be included or clearly disclosed before Booking.
                </p>
                <h3>7.2 Standard commission</h3>
                <p>
                  There is no cost to add or maintain a standard listing. Unless
                  another rate is agreed in writing, Travio Ghana&apos;s standard
                  commission is{' '}
                  <strong>15% of the applicable Retail Price of each completed Booking</strong>.
                </p>
                <h3>7.3 Alternative commercial arrangements</h3>
                <p>
                  Different rates may apply to specific Experiences, promotions,
                  affiliate distribution, wholesale arrangements, travel-agent
                  channels, special partnerships or territories where agreed through
                  the Supplier Dashboard, email or another written communication.
                </p>

                <h2 id="8-bookings">8. Bookings and availability</h2>
                <p>
                  Where an Experience uses instant confirmation, the Supplier must
                  honour confirmed Bookings. For on-request Experiences, the Supplier
                  must accept or decline within the period shown on the platform.
                </p>
                <p>
                  The Supplier must maintain accurate availability and take reasonable
                  steps to prevent overbooking. A confirmed Booking must not be
                  cancelled solely because another customer is willing to pay a
                  higher price.
                </p>

                <h2 id="9-cancellations">9. Cancellations, changes and force majeure</h2>
                <h3>9.1 Supplier cancellations</h3>
                <p>
                  If the Supplier cannot fulfil a confirmed Booking, it must notify
                  Travio Ghana immediately and, where reasonable, offer an alternative
                  date, comparable or upgraded Experience, or another acceptable
                  solution. If no reasonable alternative is available, Travio Ghana
                  may cancel and refund the Traveller. The Supplier is not entitled to
                  payout for an Experience it failed to deliver.
                </p>
                <h3>9.2 Traveller cancellations</h3>
                <p>
                  Traveller cancellations are handled according to the cancellation
                  policy displayed for the Experience at the time of Booking. Once
                  booked, those conditions may not be retrospectively changed to the
                  Traveller&apos;s disadvantage.
                </p>
                <h3>9.3 Safety and force majeure</h3>
                <p>
                  A Supplier will not normally be penalised for cancelling where
                  delivery becomes unsafe or impracticable because of dangerous
                  weather, road or attraction closures, natural disaster, civil
                  unrest, government action, serious transport disruption, security
                  threats or similar circumstances outside reasonable control,
                  provided prompt notice is given and reasonable rescheduling or
                  refund assistance is offered.
                </p>

                <h2 id="10-payments">10. Payments and payouts</h2>
                <h3>10.1 Payment collection</h3>
                <p>
                  Where Travio Ghana processes a Traveller payment, the Supplier
                  authorises Travio Ghana to collect that payment in connection with
                  the Booking.
                </p>
                <h3>10.2 Payout eligibility</h3>
                <p>
                  Payouts become eligible after the relevant Experience has been
                  completed and there is no unresolved refund request, chargeback,
                  Traveller complaint, fraud investigation, payment dispute or
                  material service-delivery issue.
                </p>
                <h3>10.3 Payout schedule</h3>
                <p>
                  Eligible Supplier payouts are ordinarily processed{' '}
                  <strong>twice each month</strong> according to Travio Ghana&apos;s
                  current supplier payment schedule. Supported methods may include
                  bank transfer, mobile money or approved payment processors.
                </p>
                <h3>10.4 Payment details</h3>
                <p>
                  The Supplier is responsible for accurate payment details and for
                  delays or failures caused by incorrect or unsupported payout
                  information. Travio Ghana is not responsible for delays caused by
                  third-party payment networks after a payment has been properly
                  initiated.
                </p>

                <h2 id="11-refunds">11. Refunds, chargebacks and disputed bookings</h2>
                <p>
                  Travio Ghana may temporarily withhold the payout relating to a
                  specific Booking where a Traveller requests a refund, a payment is
                  charged back, fraudulent activity is suspected, a serious complaint
                  is made, or the Experience may not have been delivered as advertised.
                </p>
                <p>
                  If the Supplier is cleared following review, the eligible withheld
                  amount becomes payable. If the Supplier is responsible, Travio Ghana
                  may issue a full or partial refund, reduce or cancel the related
                  payout, recover an amount already paid from future payouts, or take
                  other reasonable action permitted under this Agreement.
                </p>

                <h2 id="12-taxes">12. Taxes and statutory obligations</h2>
                <p>
                  Unless Travio Ghana expressly states otherwise, the Supplier is
                  responsible for taxes, VAT or equivalent consumption taxes, tourism
                  levies, income taxes, local fees and other statutory obligations
                  applicable to its supply. Travio Ghana may make deductions required
                  by law.
                </p>

                <h2 id="13-circumvention">13. No booking or payment circumvention</h2>
                <p>
                  A Supplier must not request or encourage a Traveller introduced
                  through Travio Ghana to cancel or replace a platform Booking in
                  order to pay the Supplier directly or through another marketplace.
                </p>
                <p>
                  This includes sending alternative payment links, requesting cash to
                  avoid commission, creating duplicate direct reservations, or
                  otherwise intentionally bypassing Travio Ghana&apos;s booking or
                  payment system.
                </p>
                <p>
                  This restriction does not prevent the Supplier from dealing with
                  customers independently obtained through its own channels.
                </p>

                <h2 id="14-communications">14. Traveller communication and data use</h2>
                <p>
                  Traveller contact details may be used only for legitimate purposes
                  connected with fulfilling the Booking, arranging pickup, confirming
                  logistics, providing support, protecting Traveller safety or
                  complying with law.
                </p>
                <p>
                  The Supplier must not use Traveller Information obtained through
                  Travio Ghana for unrelated marketing without appropriate permission
                  and must not sell Traveller Information.
                </p>

                <h2 id="15-standards">15. Service, conduct and quality standards</h2>
                <p>
                  The Supplier must deliver each Experience professionally, safely and
                  substantially as advertised. The Supplier must provide appropriately
                  trained personnel, communicate material delays or itinerary changes,
                  use reasonably safe equipment, follow applicable safety requirements
                  and treat Travellers respectfully.
                </p>
                <p>
                  The Supplier must not discriminate against, harass, threaten or
                  deliberately endanger a Traveller.
                </p>

                <h2 id="16-staff-subcontracting">16. Guides, drivers, staff and subcontracting</h2>
                <p>
                  The Supplier is responsible for every employee, guide, driver,
                  contractor or other person assigned to a Booking. Where applicable,
                  personnel must hold legally required licences and be competent for
                  their duties.
                </p>
                <p>
                  The Supplier must not transfer a confirmed Booking to an unrelated
                  third-party operator without Travio Ghana&apos;s approval where doing
                  so materially changes the provider advertised to the Traveller.
                  Approved subcontracting does not remove the Supplier&apos;s
                  responsibility.
                </p>

                <h2 id="17-compliance-insurance">17. Licensing, legal compliance and insurance</h2>
                <p>
                  The Supplier represents that it holds all licences, permits,
                  registrations and approvals legally required to operate its business
                  and provide the Experiences it lists, and will comply with applicable
                  laws in every jurisdiction where it operates.
                </p>
                <p>
                  The Supplier must promptly inform Travio Ghana if a material licence,
                  registration, permit or authorisation expires, is suspended, revoked
                  or becomes restricted.
                </p>
                <p>
                  The Supplier must maintain insurance required by law and, where
                  appropriate for the activity, suitable public liability, motor
                  vehicle, passenger, professional or other relevant coverage. Travio
                  Ghana may request proof of insurance.
                </p>

                <h2 id="18-incidents">18. Safety incidents and emergencies</h2>
                <p>
                  Traveller safety takes priority. In an accident, injury, security
                  incident or other serious event, the Supplier must first take
                  reasonable steps to protect the Traveller and contact appropriate
                  emergency services where necessary.
                </p>
                <p>
                  Travio Ghana must then be informed as soon as reasonably practicable.
                  The Supplier must reasonably cooperate with investigations and
                  preserve relevant reports, photographs, receipts, witness information
                  and other lawful evidence.
                </p>

                <h2 id="19-complaints-reviews">19. Complaints and reviews</h2>
                <p>
                  Where Travio Ghana requests information concerning a Traveller
                  complaint, the Supplier should provide a substantive response within{' '}
                  <strong>72 hours</strong>, unless faster action is reasonably required.
                </p>
                <p>
                  Suppliers must not create or purchase fake reviews, impersonate
                  Travellers, threaten Travellers over reviews, manipulate review
                  systems or condition a legally required refund on removal of a
                  legitimate review.
                </p>

                <h2 id="20-content-distribution">20. Content, intellectual property and distribution</h2>
                <p>
                  The Supplier retains ownership of content it owns, including
                  photographs, videos, descriptions and logos.
                </p>
                <p>
                  The Supplier grants Expedition-Go Tours Ltd a non-exclusive,
                  worldwide, transferable, sublicensable and royalty-free licence to
                  host, reproduce, edit, translate, format, display, promote and
                  distribute Supplier Content for the purpose of selling, advertising,
                  marketing and distributing the Supplier&apos;s Products.
                </p>
                <p>
                  This may include distribution through{' '}
                  <strong>Travio Ghana, Expedition-Go Tours</strong>, approved websites
                  and applications, social channels, search engines, travel agents,
                  affiliates, content creators, hotels, tourism partners, approved
                  resellers and other authorised distribution partners in Ghana and
                  relevant international source markets.
                </p>
                <p>
                  The Supplier confirms it has the rights required to provide and
                  license uploaded content.
                </p>

                <h2 id="21-brand-data">21. Branding, privacy and confidentiality</h2>
                <p>
                  Neither Party acquires ownership of the other&apos;s trademarks or
                  branding. The Supplier may identify itself as a Travio supplier but
                  may not represent itself as owned by or able to legally bind
                  Expedition-Go Tours Ltd unless authorised in writing.
                </p>
                <p>
                  Each Party must comply with applicable privacy and data-protection
                  laws and take reasonable measures to prevent unauthorised access,
                  loss, misuse or disclosure of Traveller Information.
                </p>
                <p>
                  Each Party must protect the other&apos;s non-public commercially
                  sensitive information, including negotiated rates, business
                  processes, Traveller data and other information reasonably understood
                  to be confidential.
                </p>

                <h2 id="22-suspension">22. Suspension, corrective action and investigation</h2>
                <p>
                  Travio Ghana may temporarily suspend a Product, future Bookings,
                  disputed payouts or a Supplier account while reasonably investigating
                  safety concerns, fraud, suspected illegal activity, licensing
                  problems, repeated complaints, payment circumvention, data-security
                  incidents or material breaches.
                </p>
                <p>
                  Depending on severity, action may include guidance, warning, listing
                  correction, an improvement plan, temporary visibility restriction,
                  product suspension, payout adjustment, account suspension or
                  termination. Serious matters may justify immediate action.
                </p>

                <h2 id="23-termination">23. Termination and existing bookings</h2>
                <p>
                  Either Party may terminate this Agreement with{' '}
                  <strong>30 days&apos; written notice</strong>.
                </p>
                <p>
                  Travio Ghana may terminate or deactivate a Supplier immediately for
                  serious matters including fraud, deliberate payment circumvention,
                  serious safety breaches, significant licensing violations, illegal
                  activity, intentional misrepresentation, misuse of Traveller data or
                  repeated material breaches.
                </p>
                <p>
                  Unless Travio Ghana directs otherwise, the Supplier must honour
                  confirmed Bookings made before termination. Travio Ghana may cancel
                  future Bookings where continuing them creates significant safety,
                  legal, fraud or fulfilment risk.
                </p>

                <h2 id="24-liability">24. Platform responsibility and supplier indemnity</h2>
                <p>
                  Travio Ghana operates a marketplace connecting Travellers with
                  independent Suppliers. Except where Travio Ghana itself is directly
                  responsible under applicable law, Travio Ghana is not responsible for
                  Supplier acts or omissions, Supplier vehicles or equipment, Supplier
                  personnel, third-party attraction conditions, weather, road
                  conditions, government action or circumstances outside Travio
                  Ghana&apos;s reasonable control.
                </p>
                <p>
                  To the extent permitted by law, the Supplier will indemnify
                  Expedition-Go Tours Ltd, Travio Ghana and their directors, employees
                  and representatives against third-party claims, losses, liabilities,
                  penalties or reasonable legal expenses arising directly from the
                  Supplier&apos;s negligent or unlawful delivery, breach of this
                  Agreement, infringement of third-party rights or violation of
                  applicable law.
                </p>
                <p>
                  Nothing in these Terms excludes liability that cannot lawfully be
                  excluded.
                </p>

                <h2 id="25-platform">25. Platform availability and intellectual property</h2>
                <p>
                  Travio Ghana aims to maintain reliable Platform availability but does
                  not guarantee uninterrupted service. Temporary interruptions may
                  occur because of maintenance, internet failures, payment-provider
                  outages, cyber-security events, hosting failures or other
                  circumstances beyond reasonable control.
                </p>
                <p>
                  The Travio Ghana name, software, website design, supplier tools,
                  databases, platform functionality and proprietary materials belong to
                  Expedition-Go Tours Ltd or its applicable licensors. Supplier
                  participation does not transfer ownership of these assets.
                </p>

                <h2 id="26-country">26. Ghana legal and regulatory requirements</h2>
                <p>
                  Suppliers are responsible for complying with the laws and local
                  requirements applicable in Ghana and in the specific locality where
                  each Experience is provided. Travio Ghana may introduce additional
                  Ghana-specific compliance requirements where necessary.
                </p>
                <p>
                  Suppliers operating Experiences in Ghana must comply with applicable
                  Ghanaian tourism, business, transport, tax, consumer-protection and
                  data-protection requirements and maintain applicable registrations or
                  licences with the appropriate authorities, including the Ghana Tourism
                  Authority where required.
                </p>

                <h2 id="27-disputes">27. Dispute resolution and governing law</h2>
                <p>
                  Before commencing formal proceedings, the Parties should attempt in
                  good faith to resolve a dispute through written communication and
                  should normally allow up to <strong>30 days</strong> for that process.
                </p>
                <p>
                  Unless mandatory local law requires otherwise, this Agreement is
                  governed by the laws of the <strong>Republic of Ghana</strong>.
                </p>
                <p>
                  Unresolved commercial disputes may be referred to arbitration in
                  Accra, Ghana in accordance with applicable Ghanaian alternative
                  dispute-resolution law. Unless otherwise agreed, proceedings will be
                  in English before one independent arbitrator. Nothing prevents a
                  Party from seeking urgent interim relief from a competent court where
                  legally permitted.
                </p>

                <h2 id="28-general">28. General provisions</h2>
                <h3>28.1 Notices</h3>
                <p>
                  Formal notices may be delivered through the Supplier Dashboard, the
                  Supplier&apos;s registered email address or another agreed
                  communication method.
                </p>
                <h3>28.2 Assignment</h3>
                <p>
                  The Supplier may not transfer this Agreement or its Supplier account
                  without prior written approval. Expedition-Go Tours Ltd may assign its
                  rights as part of a corporate restructuring, merger, acquisition,
                  financing, sale or transfer of the Travio business, subject to
                  applicable law.
                </p>
                <h3>28.3 Severability</h3>
                <p>
                  If a provision is found unlawful or unenforceable, it will be modified
                  to the minimum extent required where possible, and the remainder of
                  the Agreement will continue in effect.
                </p>
                <h3>28.4 Entire agreement</h3>
                <p>
                  This Agreement, together with applicable rate confirmations, country
                  requirements, platform policies, safety requirements and written
                  commercial arrangements, constitutes the agreement governing Supplier
                  participation in the platform.
                </p>

                <h2 id="29-updates">29. Changes to these terms</h2>
                <p>
                  Travio Ghana may update these Terms where reasonably necessary because
                  of changes in law, platform features, distribution channels, payments,
                  operations, safety requirements or the business model.
                </p>
                <p>
                  Where a change materially affects Supplier financial obligations,
                  liability or dispute rights, reasonable notice will be provided and
                  renewed acceptance may be requested where appropriate.
                </p>
                <p>
                  Continued use of the platform after the effective date of other
                  notified changes constitutes acceptance of those changes.
                </p>

                <h2 id="30-acknowledgement">30. Supplier acknowledgement</h2>
                <p>
                  By creating or maintaining a supplier account, listing an Experience,
                  accepting a Booking or otherwise using the{' '}
                  <strong>Travio Ghana platform</strong>, the Supplier confirms that:
                </p>
                <ul>
                  <li>the information supplied to Travio Ghana is accurate;</li>
                  <li>the Supplier has authority to enter into this Agreement;</li>
                  <li>the Supplier has read and agrees to these Supplier Terms &amp; Agreement;</li>
                  <li>the Supplier agrees to the applicable commission structure;</li>
                  <li>the Supplier is responsible for the Experiences it supplies and delivers;</li>
                  <li>
                    eligible Products may be marketed and distributed through Travio
                    Ghana, Expedition-Go Tours and approved distribution partners for
                    the purpose of promoting and selling tours and activities in Ghana;
                  </li>
                  <li>
                    the Supplier will comply with applicable law, licensing, safety and
                    data-protection requirements; and
                  </li>
                  <li>continued use of the platform constitutes electronic acceptance of these Terms.</li>
                </ul>
                <p className="support-meta">
                  <strong>Last updated: September 2026</strong>
                </p>
              </div>

              <h2 className="support-section-title" id="ready-to-start-selling">
                Ready to start selling?
              </h2>
              <div className="support-actions">
                <a
                  className="support-btn support-btn-primary"
                  href={SUPPLIER_DASHBOARD}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                  Open supplier dashboard
                </a>
              </div>
            </article>
          </div>
        </main>

        <button
          type="button"
          className={`to-top${showTop ? ' show' : ''}`}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
        >
          ↑
        </button>
      </div>

      <Footer />
    </>
  )
}
