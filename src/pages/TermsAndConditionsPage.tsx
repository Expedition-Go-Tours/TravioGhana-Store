import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Footer from '@/components/Footer'
import '../styles/LegalPage.css'

const SUMMARY = [
  { icon: '✓', text: 'Applies to Platform users and bookings' },
  { icon: '✓', text: 'Specific experience terms may also apply' },
  { icon: '✓', text: 'Four-day standard cancellation window' },
  { icon: '✓', text: 'Governed by the laws of Ghana' },
]

const TOC = [
  { id: '1-about-us', num: '01', label: 'About us' },
  { id: '2-scope-of-these-terms', num: '02', label: 'Scope of these Terms' },
  { id: '3-our-role-and-the-role-of-suppliers', num: '03', label: 'Our role and the role of suppliers' },
  { id: '4-experience-information', num: '04', label: 'Experience information' },
  { id: '5-making-a-booking', num: '05', label: 'Making a booking' },
  { id: '6-prices-and-payments', num: '06', label: 'Prices and payments' },
  { id: '7-accounts-and-platform-security', num: '07', label: 'Accounts and Platform security' },
  { id: '8-traveller-responsibilities', num: '08', label: 'Traveller responsibilities' },
  { id: '9-pickup-waiting-time-and-no-shows', num: '09', label: 'Pickup, waiting time and no-shows' },
  { id: '10-changes-requested-by-you', num: '10', label: 'Changes requested by you' },
  { id: '11-cancellations-refunds-and-changes-by-us', num: '11', label: 'Cancellations, refunds and changes by us' },
  { id: '12-weather-safety-and-events-beyond-reasonable-control', num: '12', label: 'Weather, safety and events beyond reasonable control' },
  { id: '13-complaints', num: '13', label: 'Complaints' },
  { id: '14-reviews-photographs-and-user-content', num: '14', label: 'Reviews, photographs and user content' },
  { id: '15-privacy-and-use-of-information-across-the-expedition-go-tours-ecosystem', num: '15', label: 'Privacy and use of information across the Travio Ghana ecosystem' },
  { id: '16-intellectual-property', num: '16', label: 'Intellectual property' },
  { id: '17-liability', num: '17', label: 'Liability' },
  { id: '18-third-party-services-and-links', num: '18', label: 'Third-party services and links' },
  { id: '19-suspension-and-termination', num: '19', label: 'Suspension and termination' },
  { id: '20-changes-to-these-terms', num: '20', label: 'Changes to these Terms' },
  { id: '21-governing-law-and-disputes', num: '21', label: 'Governing law and disputes' },
  { id: '22-general-provisions', num: '22', label: 'General provisions' },
  { id: '23-contact-us', num: '23', label: 'Contact us' },
]

const POLICY_TABS = [
  { key: 'supplier-terms', label: 'Supplier Terms', to: '/supplier-terms' },
  { key: 'terms', label: 'Terms & Conditions', to: '/terms-and-conditions' },
  { key: 'privacy', label: 'Privacy Policy', to: '/privacy-policy' },
  { key: 'cookies', label: 'Cookies Policy', to: '/cookies-policy' },
]

export default function TermsAndConditionsPage() {
  const [activeTOC, setActiveTOC] = useState<string | null>(null)
  const [showToTop, setShowToTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowToTop(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll-spy: highlight the TOC item for the section currently in view.
  useEffect(() => {
    const sections = TOC.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveTOC(entry.target.id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )

    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  return (
    <main style={{ paddingTop: 80, background: '#f7f7f3' }}>
      {/* ── Hero card ──────────────────────────────────── */}
      <section className="leg-wrap leg-hero">
        <div>
          <div className="leg-kicker">Platform terms</div>
          <h1>Terms &amp; Conditions</h1>
          <p>The agreement governing access to and use of Travio Ghana and its connected booking services.</p>
          <div className="leg-updated"><i></i>Last updated · August 2026</div>
        </div>
        <aside className="leg-summary">
          <h2>Important</h2>
          <ul>
            {SUMMARY.map((s, i) => (
              <li key={i}><i>{s.icon}</i>{s.text}</li>
            ))}
          </ul>
        </aside>
      </section>

      {/* ── Policy-tab bar ──────────────────────────────── */}
      <div style={{ padding: '18px 0' }}>
        <div className="leg-wrap leg-tabs">
          {POLICY_TABS.map((tab) => (
            <Link
              key={tab.key}
              to={tab.to}
              className={tab.key === 'terms' ? 'active' : ''}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── TOC sidebar + content ──────────────────────── */}
      <div className="leg-wrap leg-layout">
        <aside className="leg-sidebar">
          <div className="leg-label">On this page</div>
          <nav className="leg-toc">
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={activeTOC === item.id ? 'current' : ''}
                onClick={() => setActiveTOC(item.id)}
              >
                <span className="leg-toc-num">{item.num}</span>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="leg-helpbox">
            <b>Need help?</b>
            <p>Questions about this document or your relationship with Travio Ghana?</p>
            <Link to="/contact-us">Contact support →</Link>
          </div>
        </aside>

        <div className="leg-content">
          <p>
            These General Terms and Conditions (the <strong>“Terms”</strong>) govern your access to and use of the websites, applications, booking services and related services operated by or on behalf of Expedition-Go Tours Ltd, including <strong>travioghana.com</strong>, <strong>travioghana.com</strong>, <strong>travioafrica.com</strong>, their subdomains and any booking journey made available through them (together, the <strong>“Platform”</strong>).
          </p>
          <p>
            These Terms should be read together with our Privacy Policy, Cookie Policy, the description and cancellation terms shown for the experience you book, and any additional terms clearly presented during checkout.
          </p>
          <p>
            By accessing the Platform, creating an account or making a booking, you confirm that you have read, understood and agreed to these Terms. If you do not agree, you must not use the Platform.
          </p>

          <h2 id="1-about-us">1. About us</h2>
          <p>
            The Platform is operated by <strong>Expedition-Go Tours Ltd</strong>, a private company limited by shares incorporated in the Republic of Ghana on <strong>18 February 2023</strong> under the Companies Act, 2019 (Act 992), with company registration number <strong>CS026170223</strong> and taxpayer identification number <strong>C0062656392</strong> (<strong>“Travio Ghana”</strong>, <strong>“we”</strong>, <strong>“us”</strong> or <strong>“our”</strong>).
          </p>
          <p>
            Our registered address is <strong>H/N UNN House, near Harvest Chapel International, Accra, Ghana</strong>. Our principal trading and customer-facing address, as displayed on our Google Business Profile, is <strong>Nmai Dzorn Adjiringano Road, Accra, Ghana</strong>.
          </p>
          <p>Contact details:</p>
          <ul>
            <li>Website: <strong>https://www.travioghana.com</strong></li>
            <li>Email: <strong>info@expeditiongotours.com</strong></li>
            <li>Telephone/WhatsApp: <strong>+233 59 140 9761</strong></li>
            <li>Trading address: <strong>Nmai Dzorn Adjiringano Road, Accra, Ghana</strong></li>
            <li>Registered address: <strong>H/N UNN House, near Harvest Chapel International, Accra, Ghana</strong></li>
          </ul>
          <p>
            <strong>Travio Ghana</strong> and <strong>Travio Africa</strong> are registered trading names of Expedition-Go Tours Ltd and are not separate legal entities. Services offered under those names are operated by Expedition-Go Tours Ltd. Section 15 explains how information may be used across our connected branded platforms and services.
          </p>

          <h2 id="2-scope-of-these-terms">2. Scope of these Terms</h2>
          <p>These Terms apply to all visitors, account holders, travellers, customers and other users of the Platform (<strong>“Users”</strong> or <strong>“you”</strong>).</p>
          <p>You must be at least 18 years old and legally capable of entering into a binding contract to make a booking. If you book for another person or a group, you confirm that you have authority to accept these Terms on their behalf and that you will provide all relevant booking information and restrictions to them.</p>
          <p>Additional terms may apply to a particular tour, activity, attraction ticket, transfer, accommodation-related experience or other travel service (each an <strong>“Experience”</strong>). Where there is a conflict, mandatory consumer law will apply first, followed by the specific terms disclosed on the Experience page or booking confirmation, and then these Terms.</p>

          <h2 id="3-our-role-and-the-role-of-suppliers">3. Our role and the role of suppliers</h2>
          <p>Experiences available through the Platform may be:</p>
          <ol>
            <li>organised and delivered directly by Expedition-Go Tours Ltd; or</li>
            <li>organised and delivered by an independent tour operator, guide, attraction, transport provider or other third-party supplier (a <strong>“Supplier”</strong>).</li>
          </ol>
          <p>Where Travio Ghana operates the Experience directly, your contract for the Experience is with Travio Ghana.</p>
          <p>Where an independent Supplier operates the Experience, Travio Ghana provides booking, payment collection, customer-support and marketplace services and may act as the Supplier&apos;s disclosed commercial agent. Unless the booking page states otherwise, the contract for delivery of that Experience is between you and the Supplier. The Supplier remains responsible for performing the Experience safely, lawfully and substantially as described.</p>
          <p>Independent Suppliers are not employees of Travio Ghana. Nothing in these Terms removes any responsibility that Travio Ghana has under applicable law or for services it directly provides.</p>

          <h2 id="4-experience-information">4. Experience information</h2>
          <p>We aim to ensure that descriptions, photographs, itineraries, availability, inclusions, exclusions, accessibility information, meeting points and prices are accurate. Information supplied by an independent Supplier is that Supplier&apos;s responsibility, although we may review or moderate it.</p>
          <p>Times, routes, vehicles, guides, sites and itinerary order may change where reasonably necessary because of traffic, weather, site closures, safety concerns or other operational conditions. A material change will be communicated as soon as reasonably practicable and handled in accordance with Section 11.</p>
          <p>Images may be illustrative. You must review the full Experience description, restrictions and booking confirmation before travelling.</p>

          <h2 id="5-making-a-booking">5. Making a booking</h2>
          <p>To make a booking, you must provide complete and accurate information, including the correct names of participants, contact details, pickup information and any information reasonably required for safety or accessibility.</p>
          <p>Your booking becomes binding when we issue a booking confirmation by email, on-screen message or through your account. An automated acknowledgement that we have received a request is not a confirmation unless it clearly states that the booking is confirmed.</p>
          <p>You must check your confirmation immediately and notify us without delay if anything is incorrect. We may cancel or refuse a booking where there is an obvious pricing or description error, suspected fraud, unlawful activity, misuse of the Platform or inability to provide the Experience. Where we cancel for one of these reasons and you are not at fault, amounts paid for the affected booking will be refunded.</p>

          <h2 id="6-prices-and-payments">6. Prices and payments</h2>
          <p>The total price and currency payable will be displayed before you confirm the booking. The price will identify any taxes, booking charges or compulsory fees included at checkout. Optional costs and items excluded from the Experience will be identified where applicable.</p>
          <p>Payments may be collected by us under the Expedition-Go Tours, Travio Ghana or Travio Africa trading name, or by an authorised payment processor on our behalf or on behalf of the relevant Supplier. You authorise us and our payment providers to charge the selected payment method for the total amount shown at checkout.</p>
          <p>You confirm that you are authorised to use the selected payment method. Your bank or payment provider may charge exchange-rate or international transaction fees, which are outside our control.</p>
          <p>We may correct an obvious pricing error before the Experience begins. If the corrected price is higher, you may accept the corrected price or cancel for a full refund.</p>

          <h2 id="7-accounts-and-platform-security">7. Accounts and Platform security</h2>
          <p>You are responsible for keeping your login details confidential and for activity performed through your account. Notify us immediately if you suspect unauthorised access.</p>
          <p>You must not:</p>
          <ul>
            <li>use the Platform unlawfully, fraudulently or for a commercial purpose not authorised by us;</li>
            <li>impersonate another person or submit false information;</li>
            <li>interfere with the Platform&apos;s security or operation;</li>
            <li>introduce malicious code;</li>
            <li>scrape, copy, extract or reuse Platform content through automated means without written permission;</li>
            <li>make speculative, false or abusive bookings; or</li>
            <li>use Platform information to bypass us and improperly solicit Suppliers or customers.</li>
          </ul>
          <p>We may restrict or suspend access where reasonably necessary to protect Users, Suppliers, the Platform or our legal rights.</p>

          <h2 id="8-traveller-responsibilities">8. Traveller responsibilities</h2>
          <p>You are responsible for:</p>
          <ul>
            <li>arriving at the stated meeting or pickup point on time;</li>
            <li>checking email, telephone and Platform messages for operational updates;</li>
            <li>carrying valid passports, visas, permits, tickets and identification;</li>
            <li>complying with health, safety, age, fitness, clothing and accessibility requirements;</li>
            <li>following lawful and reasonable instructions from guides, drivers, Suppliers and site personnel;</li>
            <li>behaving respectfully and not endangering or disrupting others; and</li>
            <li>disclosing relevant mobility, medical or accessibility needs before booking where this is necessary for safe participation.</li>
          </ul>
          <p>Unless expressly included, you are responsible for travel insurance, transport to the meeting point, personal expenses and other excluded costs. We strongly recommend appropriate travel and medical insurance.</p>
          <p>A guide or Supplier may refuse or end participation without refund where a person is intoxicated, abusive, acting unlawfully, creating a safety risk or materially disrupting the Experience.</p>

          <h2 id="9-pickup-waiting-time-and-no-shows">9. Pickup, waiting time and no-shows</h2>
          <p>Pickup arrangements, coverage areas and estimated pickup windows will be stated on the Experience page or booking confirmation. Pickup times may be affected by traffic, weather and the sequence of scheduled collections.</p>
          <p>You must be ready at the confirmed location during the stated pickup window. If you are not present or contactable after any waiting period stated in the booking details, you may be treated as a no-show. Unless applicable law or the specific Experience terms require otherwise, no-shows are not refundable.</p>

          <h2 id="10-changes-requested-by-you">10. Changes requested by you</h2>
          <p>Requests to change the date, time, pickup point, lead traveller or number of participants are subject to availability and any price difference. A change is not effective until confirmed by us in writing.</p>
          <p>Where a requested change cannot be accommodated, the original booking remains valid unless it is cancelled in accordance with Section 11.</p>

          <h2 id="11-cancellations-refunds-and-changes-by-us">11. Cancellations, refunds and changes by us</h2>
          <p><strong>11.1 Your right to cancel</strong></p>
          <p>Unless a different policy is clearly displayed on the Experience page or booking confirmation:</p>
          <ul>
            <li>cancellation received at least <strong>four calendar days before</strong> the scheduled start time qualifies for a full refund of the booking price; and</li>
            <li>cancellation received less than four calendar days before the scheduled start time, or failure to attend, is non-refundable.</li>
          </ul>
          <p>The time we receive the cancellation request determines whether it is made within the permitted period. Cancellations must be submitted through the booking channel or official contact method identified in your confirmation.</p>
          <p><strong>11.2 Non-refundable and special-condition bookings</strong></p>
          <p>Some Experiences may include dated admission tickets, permits, accommodation, flights, meals, special equipment or other non-recoverable costs. A different cancellation policy may apply where it is prominently disclosed before payment.</p>
          <p><strong>11.3 Refund processing</strong></p>
          <p>Approved refunds will normally be returned to the original payment method. Processing time depends on the payment provider and banking system. Fees imposed independently by your bank or card provider may not be refundable by us.</p>
          <p><strong>11.4 Changes or cancellation by Travio Ghana or a Supplier</strong></p>
          <p>We or the Supplier may make reasonable non-material changes to the itinerary for operational, safety or local conditions. If an Experience is cancelled, cannot be delivered, or is materially changed before it begins, we will offer, where reasonably available:</p>
          <ol>
            <li>a suitable alternative or rescheduled date; or</li>
            <li>a refund for the cancelled or materially affected Experience.</li>
          </ol>
          <p>We are not responsible for separately arranged travel, accommodation or other consequential costs except where required by applicable law.</p>

          <h2 id="12-weather-safety-and-events-beyond-reasonable-control">12. Weather, safety and events beyond reasonable control</h2>
          <p>Experiences may be affected by severe weather, flooding, road closures, attraction closures, governmental action, civil disturbance, strikes, epidemics, technical failure or other circumstances beyond reasonable control (<strong>“Force Majeure Events”</strong>).</p>
          <p>Safety takes priority. We or the Supplier may modify, postpone or cancel an Experience where reasonably necessary. Your available remedy will depend on the circumstances, recoverable Supplier costs, the specific booking terms and applicable consumer law. Nothing in this section permits us to retain money where doing so would be unlawful.</p>

          <h2 id="13-complaints">13. Complaints</h2>
          <p>Raise any problem as soon as possible during the Experience so that the guide, Supplier or our support team has a reasonable opportunity to resolve it.</p>
          <p>If the matter is not resolved, submit a written complaint to <a href="mailto:info@expeditiongotours.com">info@expeditiongotours.com</a> within <strong>14 days</strong> after the Experience, including your booking reference, a clear description and any supporting evidence. We aim to acknowledge complaints within <strong>three business days</strong> and provide a substantive response within <strong>14 business days</strong>. Complex complaints may take longer, in which case we will provide an update.</p>

          <h2 id="14-reviews-photographs-and-user-content">14. Reviews, photographs and user content</h2>
          <p>If you submit a review, photograph, video or other content (<strong>“User Content”</strong>), you confirm that it is accurate, lawful, does not infringe another person&apos;s rights and does not contain confidential, abusive, discriminatory or misleading material.</p>
          <p>You retain ownership of your User Content but grant Travio Ghana a worldwide, non-exclusive, royalty-free licence to host, reproduce, adapt for formatting, translate, publish and display it for operating and promoting the Platform and Experiences. This licence ends when the content is deleted from our systems, except for content already used in lawful published materials or retained where legally required.</p>
          <p>We may moderate or remove User Content that breaches these Terms. Separate consent will be obtained where required before we use an identifiable traveller&apos;s photograph or video for promotional purposes.</p>

          <h2 id="15-privacy-and-use-of-information-across-the-expedition-go-tours-ecosystem">15. Privacy and use of information across the Travio Ghana ecosystem</h2>
          <p>We collect and process personal information in accordance with our Privacy Policy and applicable data-protection law, including Ghana&apos;s Data Protection Act, 2012 (Act 843), where applicable.</p>
          <p>Because <strong>Travio Ghana</strong> and <strong>Travio Africa</strong> are trading names of Expedition-Go Tours Ltd rather than separate companies, information used through those branded services remains under the responsibility of Expedition-Go Tours Ltd. By using the Platform or making a booking, you acknowledge and agree that Travio Ghana may use and make relevant personal information available across the Expedition-Go Tours, Travio Ghana and Travio Africa branded platforms, systems and operational teams where reasonably necessary to:</p>
          <ul>
            <li>create, administer and synchronise your account or booking;</li>
            <li>match you with an Experience or Supplier;</li>
            <li>process or reconcile payments, refunds and supplier payouts;</li>
            <li>provide customer service and communicate booking updates;</li>
            <li>prevent fraud, misuse and security incidents;</li>
            <li>maintain accurate business, tax and transaction records;</li>
            <li>improve the functionality, safety and reliability of our services; or</li>
            <li>comply with legal and regulatory obligations.</li>
          </ul>
          <p>Expedition-Go Tours Ltd is the legal entity responsible for this internal use of information across the three trading names. We will make available only the information reasonably necessary for the relevant purpose and will apply appropriate confidentiality, security, access-control and retention safeguards. Our Privacy Policy will identify the relevant purposes, lawful bases, categories of information, recipients, retention periods and any international transfers.</p>
          <p>Operational data sharing needed to perform a booking is not optional where the relevant Travio service forms part of that booking. Where consent is legally required—particularly for direct electronic marketing—we will request it separately. You may withdraw marketing consent at any time without affecting an existing booking.</p>
          <p>We may also share necessary information with the Supplier, payment processors, communications providers, technology providers, professional advisers, regulators and law-enforcement bodies. We do not sell personal information.</p>
          <p>Your data-protection rights and the process for exercising them are explained in our Privacy Policy. Privacy enquiries may be sent to <a href="mailto:info@expeditiongotours.com">info@expeditiongotours.com</a> with the subject line <strong>“Data Protection Request”</strong>.</p>

          <h2 id="16-intellectual-property">16. Intellectual property</h2>
          <p>The Platform and its content—including software, design, text, graphics, trademarks, databases and original photographs—are owned by or licensed to Travio Ghana and are protected by applicable intellectual-property law.</p>
          <p>We grant you a limited, revocable, non-exclusive, non-transferable licence to use the Platform for personal, lawful travel-search and booking purposes. No content may be copied, sold, republished, reverse-engineered or commercially exploited without prior written permission, except where the law expressly permits it.</p>
          <p>“Travio Ghana”, “Travio Ghana”, “Travio Africa” and their associated names, logos and branding are owned by or registered to Expedition-Go Tours Ltd and may not be used without our prior written permission.</p>

          <h2 id="17-liability">17. Liability</h2>
          <p>Nothing in these Terms excludes or limits liability that cannot lawfully be excluded, including liability for fraud, fraudulent misrepresentation, wilful misconduct, or death or personal injury caused by negligence where applicable law prohibits exclusion.</p>
          <p>Subject to the paragraph above and applicable consumer law:</p>
          <ul>
            <li>Travio Ghana is responsible for losses that are a reasonably foreseeable result of its breach of these Terms or failure to exercise reasonable care and skill;</li>
            <li>Travio Ghana is not responsible for loss caused by your breach, failure to follow instructions, inaccurate information or failure to obtain required travel documents;</li>
            <li>where an independent Supplier provides the Experience, that Supplier is principally responsible for its performance, acts and omissions, although this does not remove any separate duty owed by Travio Ghana; and</li>
            <li>Travio Ghana is not liable for indirect or consequential business loss, loss of profit, loss of opportunity or loss of data arising from personal consumer use of the Platform.</li>
          </ul>
          <p>Any financial cap on liability should be inserted only after advice from Ghanaian counsel and must not restrict mandatory consumer rights.</p>

          <h2 id="18-third-party-services-and-links">18. Third-party services and links</h2>
          <p>The Platform may contain links to third-party websites, maps, payment services or other services. Their terms and privacy practices apply when you use them. We are not responsible for third-party content or services merely because a link is provided, except to the extent required by law.</p>

          <h2 id="19-suspension-and-termination">19. Suspension and termination</h2>
          <p>You may stop using the Platform at any time. We may suspend or terminate an account, cancel affected bookings or restrict access where reasonably necessary because of fraud, payment failure, unlawful conduct, abusive behaviour, security risk or a material breach of these Terms.</p>
          <p>Where possible and lawful, we will give reasonable notice and explain the action. Termination does not affect rights and obligations that arose before termination or provisions intended to continue afterwards.</p>

          <h2 id="20-changes-to-these-terms">20. Changes to these Terms</h2>
          <p>We may update these Terms to reflect changes in law, our services, technology or business operations. The updated version and effective date will be published on the Platform. Material changes will be notified in an appropriate manner.</p>
          <p>The terms accepted when a booking was confirmed will normally continue to govern that booking unless a change is required by law or is more favourable to you.</p>

          <h2 id="21-governing-law-and-disputes">21. Governing law and disputes</h2>
          <p>These Terms and any non-contractual obligations arising from them are governed by the laws of the Republic of Ghana, subject to any mandatory consumer rights that apply in your country of residence.</p>
          <p>You and Travio Ghana should first attempt to resolve a dispute through the complaint process in Section 13. If it cannot be resolved, the courts of competent jurisdiction in Ghana will have jurisdiction, except where mandatory consumer law permits you to bring proceedings elsewhere.</p>

          <h2 id="22-general-provisions">22. General provisions</h2>
          <p>If any provision is held invalid or unenforceable, the remaining provisions remain effective. A failure or delay in enforcing a right is not a waiver of that right.</p>
          <p>You may not transfer your rights or obligations under these Terms without our written consent. We may transfer our rights or obligations as part of a genuine restructuring, merger, sale or transfer of the Platform, provided this does not reduce your mandatory rights.</p>
          <p>These Terms, the Privacy Policy, the booking confirmation, the Experience description and any applicable Supplier terms form the agreement relevant to your use and booking. No person who is not a party to that agreement has a right to enforce it, except where applicable law provides otherwise.</p>
          <p>The English version controls if a translated version is inconsistent, unless applicable law requires otherwise.</p>

          <h2 id="23-contact-us">23. Contact us</h2>
          <p>Questions about these Terms or a booking may be sent to:</p>
          <p>
            <strong>Expedition-Go Tours Ltd</strong>
            <br />
            <strong>Trading address: Nmai Dzorn Adjiringano Road, Accra, Ghana</strong>
            <br />
            <strong>Registered address: H/N UNN House, near Harvest Chapel International, Accra, Ghana</strong>
            <br />
            Company registration number: <strong>CS026170223</strong>
            <br />
            TIN: <strong>C0062656392</strong>
            <br />
            Website: <a href="https://www.travioghana.com" target="_blank" rel="noopener noreferrer">https://www.travioghana.com</a>
            <br />
            Email: <a href="mailto:info@expeditiongotours.com">info@expeditiongotours.com</a>
            <br />
            Telephone/WhatsApp: <strong>+233 59 140 9761</strong>
          </p>
          <p>Last updated: August 2026</p>
        </div>
      </div>

      <Footer />

      <button
        type="button"
        className={`leg-to-top${showToTop ? ' show' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
      >
        ↑
      </button>
    </main>
  )
}
