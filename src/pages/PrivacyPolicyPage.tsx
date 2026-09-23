import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import SEO, { buildBreadcrumbSchema } from '../components/SEO'
import LegalPageShell from '../components/shared/LegalPageShell'

const SUMMARY = [
  { icon: '✓', text: 'How we collect and use your information' },
  { icon: '✓', text: 'Data shared across our trading names' },
  { icon: '✓', text: 'Your rights under the Data Protection Act (Act 843)' },
  { icon: '✓', text: 'Contact us for any privacy request' },
]

const TOC = [
  { id: '2-who-we-are', num: '02', label: 'Who we are' },
  { id: '3-our-trading-names-and-platforms', num: '03', label: 'Our trading names and platforms' },
  { id: '4-laws-that-apply', num: '04', label: 'Laws that apply' },
  { id: '5-personal-information-we-collect', num: '05', label: 'Personal information we collect' },
  { id: '6-how-we-collect-information', num: '06', label: 'How we collect information' },
  { id: '7-why-we-use-your-information-and-our-lawful-bases', num: '07', label: 'Why we use your information and our lawful bases' },
  { id: '8-information-used-across-expedition-go-tours-travio-ghana-and-travio-africa', num: '08', label: 'Information used across Expedition-Go Tours, Travio Ghana and Travio Africa' },
  { id: '9-independent-suppliers', num: '09', label: 'Independent suppliers' },
  { id: '10-who-we-share-information-with', num: '10', label: 'Who we share information with' },
  { id: '11-payments', num: '11', label: 'Payments' },
  { id: '12-cookies-and-similar-technologies', num: '12', label: 'Cookies and similar technologies' },
  { id: '13-marketing-and-communication-preferences', num: '13', label: 'Marketing and communication preferences' },
  { id: '14-social-media-and-third-party-websites', num: '14', label: 'Social media and third-party websites' },
  { id: '15-reviews-photographs-and-promotional-content', num: '15', label: 'Reviews, photographs and promotional content' },
  { id: '16-international-transfers', num: '16', label: 'International transfers' },
  { id: '17-how-long-we-keep-information', num: '17', label: 'How long we keep information' },
  { id: '18-how-we-protect-information', num: '18', label: 'How we protect information' },
  { id: '19-children', num: '19', label: 'Children' },
  { id: '20-automated-decision-making', num: '20', label: 'Automated decision-making' },
  { id: '21-your-privacy-rights', num: '21', label: 'Your privacy rights' },
  { id: '22-complaints-to-regulators', num: '22', label: 'Complaints to regulators' },
  { id: '23-changes-to-this-policy', num: '23', label: 'Changes to this policy' },
  { id: '24-contact-us', num: '24', label: 'Contact us' },
]

export default function PrivacyPolicyPage() {
  const { t } = useTranslation()

  return (
    <>
      <SEO
        title="Privacy Policy - Travio Ghana Ghana"
        description="Travio Ghana respects your privacy. Learn how we collect, use, and protect your personal data when you book tours and experiences through our platform."
        keywords="Travio Ghana privacy, data protection Ghana, travel privacy policy, personal data policy"
        robots="noindex, follow"
        jsonLd={buildBreadcrumbSchema([
          { name: 'Home', url: 'https://travioghana.com/' },
          { name: 'Privacy Policy', url: 'https://travioghana.com/privacy-policy' },
        ])}
      />
      <LegalPageShell
        eyebrow="Privacy"
        title={t('footer.privacyPolicy')}
        description={t('company.privacySubtitle')}
        updated="Last updated · August 2026"
        summary={SUMMARY}
        toc={TOC}
        activeTab="privacy"
      >
          <p>
            Expedition-Go Tours Ltd respects your privacy and is committed to handling personal
            information fairly, lawfully, securely and transparently.
          </p>
          <p>
            This Privacy Policy explains what information we collect, why we use it, who we share
            it with, how long we keep it, how we protect it and the rights available to you.
          </p>
          <p>It applies when you:</p>
          <ul>
            <li>visit or use our websites, applications, booking platforms or supplier portals;</li>
            <li>create an account, search for or book a tour, activity, transfer or other travel experience;</li>
            <li>communicate with our customer-support team;</li>
            <li>submit a review, photograph or other content;</li>
            <li>subscribe to marketing;</li>
            <li>apply to become a supplier or business partner; or</li>
            <li>otherwise interact with Expedition-Go Tours Ltd.</li>
          </ul>

          <h2 id="2-who-we-are">2. Who we are</h2>
          <p>The controller responsible for your personal information is:</p>
          <p>
            <strong>Expedition-Go Tours Ltd</strong>
            <br />
            Company registration number: <strong>CS026170223</strong>
            <br />
            TIN: <strong>C0062656392</strong>
            <br />
            Registered address: <strong>H/N UNN House, near Harvest Chapel International, Accra, Ghana</strong>
            <br />
            Trading address: <strong>Nmai Dzorn Adjiringano Road, Accra, Ghana</strong>
            <br />
            Website: <a href="https://www.travioghana.com" target="_blank" rel="noopener noreferrer">https://www.travioghana.com</a>
            <br />
            Email: <a href="mailto:info@expeditiongotours.com">info@expeditiongotours.com</a>
            <br />
            Telephone/WhatsApp: <strong>+233 59 140 9761</strong>
          </p>
          <p>
            Expedition-Go Tours Ltd was incorporated in Ghana on 18 February 2023 under the
            Companies Act, 2019 (Act 992).
          </p>
          <p>
            For UK data-protection purposes, Expedition-Go Tours Ltd is registered with the{' '}
            <strong>Information Commissioner&apos;s Office (ICO)</strong>:
          </p>
          <ul>
            <li>ICO registration reference: <strong>ZC163854</strong></li>
            <li>UK registration address: <strong>49 Somerset Place, Newcastle upon Tyne, NE4 6JS, United Kingdom</strong></li>
            <li>Date registered: <strong>2 June 2026</strong></li>
            <li>Current registration expiry date: <strong>1 June 2027</strong></li>
          </ul>

          <h2 id="3-our-trading-names-and-platforms">3. Our trading names and platforms</h2>
          <p>
            <strong>Travio Ghana</strong> and <strong>Travio Africa</strong> are registered trading
            names of Expedition-Go Tours Ltd. They are not separate legal entities.
          </p>
          <p>
            For data-protection purposes, Expedition-Go Tours Ltd is the controller across the
            following branded services:
          </p>
          <ul>
            <li>Travio Ghana;</li>
            <li>Travio Ghana; and</li>
            <li>Travio Africa.</li>
          </ul>
          <p>
            References to <strong>&ldquo;Travio Ghana&rdquo;</strong>, <strong>&ldquo;we&rdquo;</strong>,{' '}
            <strong>&ldquo;us&rdquo;</strong> or <strong>&ldquo;our&rdquo;</strong> in this policy include
            services operated under all three trading names.
          </p>
          <p>
            This policy applies to <strong>travioghana.com</strong>,{' '}
            <strong>travioghana.com</strong>, <strong>travioafrica.com</strong>, their subdomains,
            supplier and administration portals, and associated applications or booking tools
            (together, the <strong>&ldquo;Platform&rdquo;</strong>).
          </p>
          <p>
            Information may be used across these branded platforms, systems and operational teams
            for the purposes described in this policy. This is internal use by the same legal
            entity, not a sale or transfer to separate Travio companies.
          </p>

          <h2 id="4-laws-that-apply">4. Laws that apply</h2>
          <p>
            We process personal information in accordance with applicable data-protection and
            electronic-marketing laws, including:
          </p>
          <ul>
            <li>Ghana&apos;s <strong>Data Protection Act, 2012 (Act 843)</strong>; and</li>
            <li>
              where UK data-protection law applies, the <strong>UK General Data Protection Regulation (UK GDPR)</strong>,
              the <strong>Data Protection Act 2018</strong> and the{' '}
              <strong>Privacy and Electronic Communications Regulations 2003 (PECR)</strong>.
            </li>
          </ul>
          <p>
            Where more than one law applies, we will meet the requirements applicable to the
            relevant processing and individual.
          </p>

          <h2 id="5-personal-information-we-collect">5. Personal information we collect</h2>
          <p>
            Depending on how you interact with us, we may collect the following categories of
            information.
          </p>

          <p><strong>5.1 Identity and contact information</strong></p>
          <ul>
            <li>full name;</li>
            <li>title, age or date of birth where relevant;</li>
            <li>email address;</li>
            <li>telephone or WhatsApp number;</li>
            <li>home, billing, pickup or delivery address;</li>
            <li>nationality and country of residence; and</li>
            <li>emergency contact details where reasonably required for safety.</li>
          </ul>

          <p><strong>5.2 Account information</strong></p>
          <ul>
            <li>username and encrypted password;</li>
            <li>account preferences;</li>
            <li>saved or wish-listed experiences;</li>
            <li>language, currency and notification preferences; and</li>
            <li>account history.</li>
          </ul>

          <p><strong>5.3 Booking and travel information</strong></p>
          <ul>
            <li>booking reference and selected experience;</li>
            <li>dates, participant numbers, pickup location and itinerary;</li>
            <li>accommodation or flight information supplied for pickup or coordination;</li>
            <li>accessibility, dietary or mobility requirements;</li>
            <li>communications about the booking;</li>
            <li>attendance, cancellations, refunds and complaints; and</li>
            <li>information about other travellers included in your booking.</li>
          </ul>

          <p><strong>5.4 Identity and travel-document information</strong></p>
          <p>
            For services that legally or operationally require it, such as visa-support, airport,
            permit or regulated travel services, we may collect passport details, identification
            documents, visa information, travel dates or supporting documents. We collect only
            what is reasonably necessary for the requested service.
          </p>

          <p><strong>5.5 Payment and transaction information</strong></p>
          <ul>
            <li>booking price, currency and payment status;</li>
            <li>billing name and address;</li>
            <li>payment-method type and limited payment identifiers;</li>
            <li>refund, dispute and chargeback information; and</li>
            <li>invoices and transaction records.</li>
          </ul>
          <p>
            Full card details are normally collected and processed by our authorised payment
            provider and are not stored directly by us, unless expressly stated at the point of
            payment.
          </p>

          <p><strong>5.6 Communications and customer support</strong></p>
          <ul>
            <li>emails, contact forms, telephone or WhatsApp messages;</li>
            <li>social-media messages;</li>
            <li>customer-service notes;</li>
            <li>call or chat records where recording is disclosed; and</li>
            <li>feedback, survey responses and complaints.</li>
          </ul>

          <p><strong>5.7 Reviews and content</strong></p>
          <ul>
            <li>ratings and written reviews;</li>
            <li>photographs or videos you upload;</li>
            <li>display name and country;</li>
            <li>responses to review requests; and</li>
            <li>other content you choose to publish.</li>
          </ul>

          <p><strong>5.8 Technical and usage information</strong></p>
          <ul>
            <li>IP address;</li>
            <li>browser, device, operating-system and language information;</li>
            <li>device identifiers;</li>
            <li>login, access and security logs;</li>
            <li>pages viewed, searches, clicks and booking journey;</li>
            <li>referring website or campaign; and</li>
            <li>cookie, analytics and consent preferences.</li>
          </ul>

          <p><strong>5.9 Supplier and business-partner information</strong></p>
          <p>If you list or supply experiences, we may collect:</p>
          <ul>
            <li>personal and business contact details;</li>
            <li>identity and business-verification documents;</li>
            <li>company, tax and licensing information;</li>
            <li>bank or payout details;</li>
            <li>insurance and safety documentation;</li>
            <li>listings, pricing, availability and performance information;</li>
            <li>customer-service and complaint records; and</li>
            <li>account access and audit logs.</li>
          </ul>

          <p><strong>5.10 Special-category or sensitive information</strong></p>
          <p>
            We do not routinely request sensitive information. However, you may provide health,
            disability, accessibility, dietary or religious information where it is necessary to
            arrange a safe and suitable experience.
          </p>
          <p>
            Where UK law applies, we process special-category information only when an additional
            legal condition is available, such as explicit consent, vital interests or another
            condition permitted by law. Under Ghanaian law, we apply the safeguards required for
            special personal data.
          </p>
          <p>Please do not send sensitive information that is not necessary for your booking.</p>

          <h2 id="6-how-we-collect-information">6. How we collect information</h2>
          <p>We collect information:</p>
          <ul>
            <li>directly from you when you create an account, book, contact us, submit content or become a supplier;</li>
            <li>from a lead traveller who books on your behalf;</li>
            <li>from suppliers, guides, attraction operators and business partners involved in a booking;</li>
            <li>from travel agents, resellers or distribution partners through which you booked;</li>
            <li>from payment, identity-verification, fraud-prevention and communications providers;</li>
            <li>automatically through cookies, logs and similar technologies; and</li>
            <li>from public sources where lawful, such as business registers, professional websites and social-media pages.</li>
          </ul>
          <p>
            If you provide information about another person, you must have authority to do so and
            must make this policy available to them.
          </p>

          <h2 id="7-why-we-use-your-information-and-our-lawful-bases">7. Why we use your information and our lawful bases</h2>
          <p>
            The lawful basis depends on the purpose and the law that applies.
          </p>
          <p>
            <strong>Create and manage accounts</strong> â€” Identity, contact and account information.
            Lawful basis: Contract; legitimate interests in providing account features and security.
          </p>
          <p>
            <strong>Search, book and deliver experiences</strong> â€” Identity, contact, booking,
            travel and payment information. Lawful basis: Contract; steps requested before
            entering a contract.
          </p>
          <p>
            <strong>Share booking details with the relevant supplier</strong> â€” Identity, contact,
            booking, pickup and necessary travel information. Lawful basis: Contract; legitimate
            interests in completing and supporting the booking.
          </p>
          <p>
            <strong>Process payments, refunds and payouts</strong> â€” Identity, transaction and
            payment information. Lawful basis: Contract; legal obligation; legitimate interests in
            financial administration.
          </p>
          <p>
            <strong>Provide support and handle complaints</strong> â€” Contact, booking and
            communications information. Lawful basis: Contract; legal obligation; legitimate
            interests in customer service and dispute resolution.
          </p>
          <p>
            <strong>Manage safety, emergencies and accessibility</strong> â€” Booking, contact and
            necessary health or accessibility information. Lawful basis: Contract; vital
            interests; explicit consent or other special-category condition where required.
          </p>
          <p>
            <strong>Prevent fraud and protect the Platform</strong> â€” Identity, transaction,
            device, usage and security information. Lawful basis: Legitimate interests; legal
            obligation.
          </p>
          <p>
            <strong>Verify and manage suppliers</strong> â€” Identity, business, tax, licensing,
            payout and performance information. Lawful basis: Contract; legal obligation;
            legitimate interests in marketplace quality and safety.
          </p>
          <p>
            <strong>Send service communications</strong> â€” Contact and booking information. Lawful
            basis: Contract; legitimate interests in keeping you informed.
          </p>
          <p>
            <strong>Request and publish reviews</strong> â€” Booking information and content you
            submit. Lawful basis: Legitimate interests in quality, transparency and customer
            information; consent where required.
          </p>
          <p>
            <strong>Improve services and produce aggregated analytics</strong> â€” Usage, booking,
            support and survey information. Lawful basis: Legitimate interests; consent where
            cookies or similar technologies require it.
          </p>
          <p>
            <strong>Send direct marketing</strong> â€” Contact details and marketing preferences.
            Lawful basis: Consent where required; legitimate interests only where permitted by law.
          </p>
          <p>
            <strong>Comply with tax, accounting, regulatory and legal duties</strong> â€” Identity,
            booking, transaction and communications information. Lawful basis: Legal obligation;
            legitimate interests in establishing and defending legal claims.
          </p>
          <p>
            <strong>Corporate transactions and professional advice</strong> â€” Relevant business
            and customer records. Lawful basis: Legitimate interests; legal obligation where
            applicable.
          </p>
          <p>
            Where we rely on legitimate interests, we consider whether the processing is necessary
            and balance our interests against your rights and reasonable expectations.
          </p>
          <p>
            Where we rely on consent, you may withdraw it at any time. Withdrawal does not affect
            processing that was lawful before withdrawal.
          </p>

          <h2 id="8-information-used-across-expedition-go-tours-travio-ghana-and-travio-africa">8. Information used across Expedition-Go Tours, Travio Ghana and Travio Africa</h2>
          <p>
            When you use any of our branded services, you agree that relevant information may be
            accessed and used within Expedition-Go Tours Ltd across the Travio Ghana,
            Travio Ghana and Travio Africa platforms and operational teams where necessary to:
          </p>
          <ul>
            <li>create or synchronise your account;</li>
            <li>administer bookings and supplier listings;</li>
            <li>provide customer support;</li>
            <li>process payments, refunds and supplier payouts;</li>
            <li>maintain consistent records;</li>
            <li>prevent fraud and protect Platform security;</li>
            <li>improve our services; and</li>
            <li>comply with legal obligations.</li>
          </ul>
          <p>
            We apply role-based access controls and make information available only to authorised
            personnel who need it for their work.
          </p>
          <p>
            Operational use needed to provide your booking is not optional. Marketing across our
            trading names will follow your marketing preferences and any consent required by law.
          </p>

          <h2 id="9-independent-suppliers">9. Independent suppliers</h2>
          <p>
            Some experiences are delivered directly by Travio Ghana. Others are delivered by
            independent tour operators, guides, attractions, transport providers or other
            suppliers.
          </p>
          <p>
            We provide the relevant supplier with the information reasonably necessary to confirm
            and deliver your booking, such as your name, contact details, participant information,
            pickup details and disclosed accessibility needs.
          </p>
          <p>
            An independent supplier may act as a separate controller for information it receives
            and for information it collects while delivering the experience. Its own privacy
            notice may apply. Suppliers must use booking information only for lawful purposes
            connected with the booking and their legal duties.
          </p>

          <h2 id="10-who-we-share-information-with">10. Who we share information with</h2>
          <p>We may share relevant information with:</p>
          <ul>
            <li>the supplier, guide, driver, attraction or other provider responsible for the experience;</li>
            <li>payment processors, banks and fraud-prevention providers;</li>
            <li>hosting, cloud-storage, software, analytics and cybersecurity providers;</li>
            <li>email, SMS, telephone, WhatsApp and customer-support providers;</li>
            <li>distribution partners, resellers and online travel agencies involved in your booking;</li>
            <li>identity, licensing or business-verification providers;</li>
            <li>insurers, auditors, accountants, lawyers and other professional advisers;</li>
            <li>tax, regulatory, police, court or governmental authorities where required or lawfully requested;</li>
            <li>a buyer, investor or successor in connection with a genuine corporate transaction, subject to appropriate confidentiality; and</li>
            <li>other parties where you direct us or give valid consent.</li>
          </ul>
          <p>
            Service providers acting as processors may use information only on our documented
            instructions and must protect it appropriately.
          </p>
          <p>We do not sell your personal information.</p>

          <h2 id="11-payments">11. Payments</h2>
          <p>
            Payments may be handled by third-party payment providers. These providers may act as
            processors or independent controllers depending on the service and applicable law.
            Their privacy notices explain their own processing.
          </p>
          <p>
            We use payment and transaction information to take payment, confirm bookings, issue
            refunds, reconcile supplier payouts, prevent fraud, respond to chargebacks and meet
            financial-record obligations.
          </p>
          <p>Do not send full card information through ordinary email, social media or WhatsApp.</p>

          <h2 id="12-cookies-and-similar-technologies">12. Cookies and similar technologies</h2>
          <p>
            We use cookies, pixels, tags, local storage and similar technologies for:
          </p>
          <ul>
            <li>strictly necessary Platform functions;</li>
            <li>account login and security;</li>
            <li>remembering language, currency and other preferences;</li>
            <li>analytics and performance measurement; and</li>
            <li>advertising and campaign measurement where you consent.</li>
          </ul>
          <p>
            Strictly necessary technologies operate because they are required to provide the
            service. Where Ghanaian or UK law requires consent for non-essential technologies,
            they will remain disabled until you choose to accept them.
          </p>
          <p>
            You can accept, reject or change non-essential cookie choices through the cookie
            preference tool on our Platform. Browser controls may also block or delete cookies,
            although this may affect functionality.
          </p>
          <p>
            A separate <Link to="/cookies-policy">Cookie Policy</Link> or preference centre should
            identify the specific technologies, providers, purposes and retention periods
            currently used on each Platform.
          </p>

          <h2 id="13-marketing-and-communication-preferences">13. Marketing and communication preferences</h2>
          <p>
            We may send booking confirmations, safety notices, pickup updates, account messages
            and other service communications necessary for your relationship with us. These are
            not marketing messages.
          </p>
          <p>
            We will send promotional email, SMS or similar electronic marketing where permitted by
            law, including where you have consented. In limited circumstances, we may market
            similar services to an existing customer where the law permits and a clear opt-out was
            provided.
          </p>
          <p>You can stop marketing at any time by:</p>
          <ul>
            <li>using the unsubscribe link in the message;</li>
            <li>changing available account or cookie preferences; or</li>
            <li>contacting <a href="mailto:info@expeditiongotours.com">info@expeditiongotours.com</a>.</li>
          </ul>
          <p>We may retain a minimal suppression record so that we can respect your opt-out.</p>

          <h2 id="14-social-media-and-third-party-websites">14. Social media and third-party websites</h2>
          <p>
            If you interact with us on Facebook, Instagram, TikTok, YouTube, X, LinkedIn or
            another social platform, that platform may independently process information under
            its own privacy policy.
          </p>
          <p>
            Our Platform may link to third-party websites or services. We do not control their
            privacy practices and encourage you to read their notices.
          </p>
          <p>
            Where we use advertising pixels, audience tools or social-media analytics, we will
            provide any required information and obtain consent where required.
          </p>

          <h2 id="15-reviews-photographs-and-promotional-content">15. Reviews, photographs and promotional content</h2>
          <p>
            When you submit a review, rating, photograph or video, we process the information you
            choose to provide to publish, moderate and respond to it and to help other travellers
            make informed choices.
          </p>
          <p>
            Your review may be displayed on our Platform under your chosen display name and
            country. You may ask us to remove or anonymise it, subject to legal recordkeeping and
            our legitimate need to address fraud or disputes.
          </p>
          <p>
            We will obtain separate permission where required before using an identifiable
            traveller&apos;s photograph or video in promotional campaigns. You may withdraw consent
            for future uses, although this will not necessarily require withdrawal of material
            already lawfully printed or published.
          </p>

          <h2 id="16-international-transfers">16. International transfers</h2>
          <p>
            Travio Ghana operates from Ghana and serves travellers and suppliers internationally,
            including in the United Kingdom. Information may therefore be accessed or processed
            in Ghana, the UK or other countries where our suppliers and service providers operate.
          </p>
          <p>
            Where Ghanaian law applies, we will take reasonable steps to ensure that international
            processing complies with the Data Protection Act, 2012 (Act 843).
          </p>
          <p>
            Where the UK GDPR restricts a transfer of personal information outside the UK, we will
            use an approved safeguard where required, such as:
          </p>
          <ul>
            <li>UK adequacy regulations;</li>
            <li>the UK International Data Transfer Agreement;</li>
            <li>the UK Addendum to approved standard contractual clauses; or</li>
            <li>a lawful exception for a specific transfer.</li>
          </ul>
          <p>
            We will also assess transfer risks and apply supplementary technical, organisational
            or contractual protections where appropriate. You may contact us for more information
            about safeguards relevant to your information.
          </p>

          <h2 id="17-how-long-we-keep-information">17. How long we keep information</h2>
          <p>
            We keep personal information only as long as reasonably necessary for the purpose
            collected, including legal, tax, accounting, fraud-prevention and dispute requirements.
          </p>
          <p>Our general retention approach is:</p>
          <p>
            <strong>Account information</strong> â€” While the account is active and for up to 24
            months after closure, unless longer retention is required.
          </p>
          <p>
            <strong>Booking, payment, invoice and refund records</strong> â€” Up to 6 years after
            the transaction or longer where required by Ghanaian or UK law.
          </p>
          <p>
            <strong>Customer-support and complaint records</strong> â€” Normally up to 3 years after
            resolution; longer where connected to a claim or legal duty.
          </p>
          <p>
            <strong>Identity or travel documents collected for a specific service</strong> â€”
            Deleted or securely restricted when the service and required verification period end,
            unless law requires longer retention.
          </p>
          <p>
            <strong>Supplier verification, contract and payout records</strong> â€” During the
            relationship and normally up to 6 years afterwards.
          </p>
          <p>
            <strong>Security and technical logs</strong> â€” Normally up to 12 months, unless needed
            to investigate an incident.
          </p>
          <p>
            <strong>Marketing records</strong> â€” Until consent is withdrawn, you opt out, or the
            data is no longer needed; suppression records may be retained to honour your choice.
          </p>
          <p>
            <strong>Cookie and consent records</strong> â€” According to the cookie schedule and as
            needed to demonstrate your preferences.
          </p>
          <p>
            <strong>Reviews and public content</strong> â€” While published or until removal is
            justified, with limited archival retention where necessary.
          </p>
          <p>
            Actual periods may be shorter or longer depending on legal duties, the nature of the
            information, risk, disputes and whether information can be anonymised.
          </p>

          <h2 id="18-how-we-protect-information">18. How we protect information</h2>
          <p>
            We use proportionate technical and organisational measures designed to protect
            personal information, including where appropriate:
          </p>
          <ul>
            <li>access controls and staff permissions;</li>
            <li>authentication and password protection;</li>
            <li>encryption in transit and, where appropriate, at rest;</li>
            <li>secure payment providers;</li>
            <li>backups, logging and monitoring;</li>
            <li>supplier and processor contracts;</li>
            <li>staff confidentiality and training; and</li>
            <li>incident-response procedures.</li>
          </ul>
          <p>
            No internet or storage system is completely secure. You are responsible for protecting
            account credentials and notifying us promptly of suspected unauthorised access.
          </p>
          <p>
            If a personal-data breach occurs, we will investigate, mitigate harm and notify the
            relevant regulator and affected individuals where the law requires.
          </p>

          <h2 id="19-children">19. Children</h2>
          <p>
            Our Platform is intended for adults making travel arrangements. A person under 18
            must not create an account or make a booking independently.
          </p>
          <p>
            Information about a child may be provided by a parent, guardian or authorised lead
            traveller where necessary for a family or group booking. We use it only for the
            booking, safety and legal requirements. We do not knowingly direct behavioural
            advertising to children.
          </p>
          <p>Contact us if you believe a child has provided information without appropriate authority.</p>

          <h2 id="20-automated-decision-making">20. Automated decision-making</h2>
          <p>
            We may use automated tools to help detect payment fraud, account misuse or security
            risks, or to rank and recommend experiences.
          </p>
          <p>
            We do not intend to make a decision based solely on automated processing that produces
            legal or similarly significant effects unless it is necessary for a contract,
            authorised by law or based on explicit consent and the required safeguards are
            provided. Where applicable, you may request human review, express your view and
            challenge the decision.
          </p>

          <h2 id="21-your-privacy-rights">21. Your privacy rights</h2>
          <p>
            Your exact rights depend on your location and the applicable law. Subject to legal
            conditions and exceptions, you may have the right to:
          </p>
          <ul>
            <li>be informed about how your information is used;</li>
            <li>request access to your personal information;</li>
            <li>request correction of inaccurate or incomplete information;</li>
            <li>request deletion of information;</li>
            <li>restrict or object to certain processing;</li>
            <li>withdraw consent at any time;</li>
            <li>object to direct marketing;</li>
            <li>receive certain information in a portable format;</li>
            <li>object to or seek review of certain automated decisions; and</li>
            <li>complain to a data-protection regulator.</li>
          </ul>
          <p>
            To exercise a right, email <a href="mailto:info@expeditiongotours.com">info@expeditiongotours.com</a>{' '}
            with the subject line <strong>&ldquo;Data Protection Request&rdquo;</strong>. Please
            explain your request and the brand or booking involved.
          </p>
          <p>
            We may request information needed to verify your identity. We will not normally charge
            a fee, but the law may permit a reasonable fee or refusal where a request is
            manifestly unfounded, excessive or repetitive.
          </p>
          <p>
            Where the UK GDPR applies, we normally respond within one month, subject to any lawful
            extension. Where Ghanaian law applies, we will respond within the period required by
            that law.
          </p>

          <h2 id="22-complaints-to-regulators">22. Complaints to regulators</h2>
          <p>Please contact us first so we can try to resolve your concern.</p>
          <p>You may also complain to the regulator applicable to you:</p>
          <ul>
            <li>
              <strong>Ghana:</strong> Data Protection Commission -{' '}
              <a href="https://dataprotection.org.gh" target="_blank" rel="noopener noreferrer">https://dataprotection.org.gh</a>
            </li>
            <li>
              <strong>United Kingdom:</strong> Information Commissioner&apos;s Office -{' '}
              <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer">https://ico.org.uk/make-a-complaint/</a>.
              Our ICO registration reference is <strong>ZC163854</strong>.
            </li>
          </ul>
          <p>Your right to complain or seek another legal remedy is not affected by contacting us first.</p>

          <h2 id="23-changes-to-this-policy">23. Changes to this policy</h2>
          <p>
            We may update this policy to reflect changes in our services, technology, suppliers or
            legal obligations. The current version and effective date will be displayed on the
            Platform.
          </p>
          <p>
            If a change materially affects how we use personal information, we will provide an
            appropriate notice and obtain consent where required.
          </p>

          <h2 id="24-contact-us">24. Contact us</h2>
          <p>For privacy questions or requests, contact:</p>
          <p>
            <strong>Expedition-Go Tours Ltd</strong>
            <br />
            <strong>Privacy contact / Data Protection Supervisor</strong>
            <br />
            Trading address: <strong>Nmai Dzorn Adjiringano Road, Accra, Ghana</strong>
            <br />
            Registered address: <strong>H/N UNN House, near Harvest Chapel International, Accra, Ghana</strong>
            <br />
            UK data-protection registration address:{' '}
            <strong>49 Somerset Place, Newcastle upon Tyne, NE4 6JS, United Kingdom</strong>
            <br />
            ICO registration reference: <strong>ZC163854</strong>
            <br />
            Email: <a href="mailto:info@expeditiongotours.com">info@expeditiongotours.com</a>
            <br />
            Telephone/WhatsApp: <strong>+233 59 140 9761</strong>
          </p>
          <p>
            Please use the subject line <strong>&ldquo;Privacy Enquiry&rdquo;</strong> or{' '}
            <strong>&ldquo;Data Protection Request&rdquo;</strong> so your message can be directed
            appropriately.
          </p>

          <p>Last updated: August 2026</p>
      </LegalPageShell>
    </>
  )
}
