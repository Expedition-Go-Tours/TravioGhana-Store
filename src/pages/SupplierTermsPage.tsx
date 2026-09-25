import LegalPageShell from '../components/shared/LegalPageShell'
import SEO, { buildBreadcrumbSchema, SITE_URL } from '../components/SEO'
import './SupportPages.css'
import './SupplierTermsPage.css'

const SUMMARY = [
  { icon: '✓', text: 'Free to list and maintain' },
  { icon: '✓', text: '15% commission on successful bookings' },
  { icon: '✓', text: 'Monthly or bi-weekly payouts' },
  { icon: '✓', text: 'Accurate listings and safe delivery required' },
]

const TOC = [
  { id: '1-introduction', num: '01', label: 'Introduction' },
  { id: '2-registration-and-approval', num: '02', label: 'Registration and approval' },
  { id: '3-listing-obligations', num: '03', label: 'Listing obligations' },
  { id: '4-commission', num: '04', label: 'Commission' },
  { id: '5-payouts', num: '05', label: 'Payouts' },
  { id: '6-bookings-and-cancellations', num: '06', label: 'Bookings and cancellations' },
  { id: '7-conduct-and-quality-standards', num: '07', label: 'Conduct and quality standards' },
  { id: '8-suspension-and-termination', num: '08', label: 'Suspension and termination' },
  { id: '9-liability-and-indemnity', num: '09', label: 'Liability and indemnity' },
  { id: '10-general', num: '10', label: 'General' },
]

export default function SupplierTermsPage() {
  return (
    <LegalPageShell
      eyebrow="Partner agreement"
      title="Supplier Terms"
      description="The terms that govern selling tours and experiences through Travio Ghana."
      updated="Last updated · August 2026"
      summary={SUMMARY}
      toc={TOC}
      activeTab="supplier-terms"
    >
      {/* Matches the prerendered /supplier-terms copy crawlers receive. */}
      <SEO
        title="Supplier Terms"
        description="Terms and conditions for suppliers listing tours and experiences on Travio Ghana."
        keywords="Travio Ghana supplier terms, list tours Ghana"
        jsonLd={buildBreadcrumbSchema([
          { name: 'Home', url: `${SITE_URL}/` },
          { name: 'Supplier Terms', url: `${SITE_URL}/supplier-terms` },
        ])}
      />
      <h2 id="1-introduction">1. Introduction</h2>
      <p>
        These Supplier Terms (the &ldquo;Terms&rdquo;) form a legally binding agreement between you (&ldquo;Supplier&rdquo;, &ldquo;you&rdquo;) and Expedition-Go Tours Ltd (&ldquo;Travio Ghana&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By registering a supplier account and listing experiences on the Travio Ghana platform (the &ldquo;Platform&rdquo;), you accept and agree to these Terms.
      </p>
      <p>
        These Terms apply to every Supplier who lists, manages or fulfils bookable tours, activities and experiences on the Platform. They should be read together with our general <a href="/terms-and-conditions">Terms &amp; Conditions</a>, <a href="/privacy-policy">Privacy Policy</a> and any product-specific policies published on the Platform.
      </p>
      <p>
        We may update these Terms from time to time. Material changes will be communicated to registered Suppliers at least 14 days before they take effect. Continued listing after the effective date constitutes acceptance of the revised Terms.
      </p>

      <h2 id="2-registration-and-approval">2. Registration and approval</h2>
      <p>
        To sell on the Platform you must complete a supplier application and be approved by the Travio Ghana team. We may accept or reject any application at our sole discretion without obligation to disclose the reason.
      </p>
      <p>
        You agree that all information submitted during registration is accurate, current and complete. You must promptly update your profile if any information changes.
      </p>
      <p>
        A supplier account is personal to you and may not be transferred, shared or sold to any third party without our prior written consent.
      </p>

      <h2 id="3-listing-obligations">3. Listing obligations</h2>
      <p>
        Each experience you list on the Platform must be accurately and honestly described. Photos, itineraries, pricing, inclusions, exclusions, meeting points, age or fitness restrictions and cancellation policies must be current and not misleading.
      </p>
      <p>
        You may not list experiences that are illegal, unsafe, discriminatory or that infringe the intellectual property rights of any third party. We reserve the right to remove any listing at our discretion.
      </p>
      <p>
        You are responsible for keeping availability and pricing current. Over-bookings caused by stale availability may result in penalties or suspension.
      </p>

      <h2 id="4-commission">4. Commission</h2>
      <p>
        Travio Ghana charges a commission of 15% on the net payable amount of each successful booking made through the Platform. Commission is deducted automatically before payout remittance.
      </p>
      <p>
        Commission applies to the final confirmed booking amount after discounts, promotions and refunds. You agree not to attempt to circumvent the Platform commission by conducting transactions with guests off-Platform.
      </p>

      <h2 id="5-payouts">5. Payouts</h2>
      <p>
        Payouts are processed on a monthly or bi-weekly cycle, depending on your configuration and region. A booking must have been completed and its payment settled before the corresponding supplier payout is released.
      </p>
      <p>
        You must provide accurate and current payout method details. We are not liable for delayed or failed payouts caused by incorrect payout information.
      </p>
      <p>
        Payouts are made in the currency configured for your account. Currency conversion, if applicable, uses the rate at payout time unless otherwise agreed.
      </p>

      <h2 id="6-bookings-and-cancellations">6. Bookings and cancellations</h2>
      <p>
        When a booking is confirmed through the Platform you must honour it. Cancellations by the Supplier should be exceptional and communicated promptly through the Platform.
      </p>
      <p>
        Repeated or unjustified cancellations may result in penalties, reduced listing visibility or account suspension. Guest-initiated cancellations follow the cancellation policy stated on the listing.
      </p>

      <h2 id="7-conduct-and-quality-standards">7. Conduct and quality standards</h2>
      <p>
        You must deliver all experiences safely, professionally and in accordance with applicable laws and industry standards. Discrimination, harassment, unsafe practices or fraudulent behaviour will result in immediate account suspension.
      </p>
      <p>
        You must respond to booking enquiries, guest questions and platform communications in a timely and professional manner.
      </p>

      <h2 id="8-suspension-and-termination">8. Suspension and termination</h2>
      <p>
        We may suspend or terminate your supplier account at our sole discretion, with or without notice, in the event of a breach of these Terms, a serious guest complaint, safety concerns, suspected fraud or extended inactivity.
      </p>
      <p>
        You may terminate your supplier relationship by contacting us at <a href="mailto:info@expeditiongotours.com">info@expeditiongotours.com</a>. Outstanding confirmed bookings must be honoured or transferred with our assistance.
      </p>

      <h2 id="9-liability-and-indemnity">9. Liability and indemnity</h2>
      <p>
        Travio Ghana acts as a booking platform and is not the direct provider of experiences unless expressly stated. You are solely responsible for the safety, legality and quality of your experiences.
      </p>
      <p>
        You agree to indemnify and hold harmless Travio Ghana, its directors, employees and agents from any claims, losses, damages or expenses arising from your listing, fulfilment or breach of these Terms.
      </p>

      <h2 id="10-general">10. General</h2>
      <p>
        These Terms are governed by the laws of Ghana. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of Accra, Ghana.
      </p>
      <p>
        If any provision of these Terms is held unenforceable, the remaining provisions shall continue in full force and effect. Our failure to enforce any provision shall not constitute a waiver.
      </p>
      <p>
        For questions about these Terms, contact <a href="mailto:info@expeditiongotours.com">info@expeditiongotours.com</a>.
      </p>
    </LegalPageShell>
  )
}