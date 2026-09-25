import { useTranslation } from 'react-i18next'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema } from '../components/SEO'
import BackToHelpCentre from '../components/support/BackToHelpCentre'
import './SupportPages.css'

export default function RefundPolicyPage() {
  const { t } = useTranslation()

  return (
    <div className="support-page">
      <SEO
        title="Refund Policy"
        description="Learn about Travio Ghana refund and cancellation policy. Find out how to cancel your Ghana tour booking and what refunds you're eligible for."
        keywords="Travio Ghana refund, cancellation policy Ghana, tour cancellation, booking refund Ghana"
        jsonLd={buildBreadcrumbSchema([
          { name: 'Home', url: 'https://www.travioghana.com/' },
          { name: 'Refund Policy', url: 'https://www.travioghana.com/refund-policy' },
        ])}
      />
      <div className="support-hero">
        <div className="support-hero-content">
          <h1 className="support-title">{t('footer.refundPolicy')}</h1>
          <p className="support-subtitle">{t('support.refundPolicySubtitle')}</p>
        </div>
      </div>

      <div className="support-container">
        <div className="support-article">
          <h2>Summary</h2>
          <p>
            The cancellation condition displayed on the experience page, at checkout or in your booking
            confirmation governs your booking. Where no different condition is displayed, our standard
            policy is:
          </p>
          <ul>
            <li>
              <strong>Cancel at least 24 hours before the scheduled start time:</strong> receive a full
              refund of the booking price.
            </li>
            <li>
              <strong>Cancel less than 24 hours before the scheduled start time:</strong> the booking is
              non-refundable.
            </li>
            <li>
              <strong>Fail to attend or arrive too late to participate:</strong> the booking is treated as
              a no-show and is non-refundable.
            </li>
          </ul>
          <p>
            If an experience has no stated start time, the standard cancellation deadline is normally{' '}
            <strong>11:59 p.m., two calendar days before the experience date</strong>, unless a different
            deadline is displayed for that booking.
          </p>
          <p>
            The cancellation deadline is calculated using the local time at the experience destination. The
            time Expedition-Go Tours Ltd or the relevant booking channel receives your cancellation request
            determines whether it was submitted before the deadline.
          </p>

          <h2>1. About this policy</h2>
          <p>
            This Refund and Cancellation Policy applies to bookings made through platforms operated by
            Expedition-Go Tours Ltd under the following trading names:
          </p>
          <ul>
            <li>Travio Ghana</li>
            <li>Travio Ghana</li>
            <li>Travio Africa</li>
          </ul>
          <p>
            Travio Ghana and Travio Africa are registered trading names of Expedition-Go Tours Ltd and are
            not separate legal entities.
          </p>
          <p>
            This policy applies to <strong>travioghana.com</strong>, <strong>travioghana.com</strong>,{' '}
            <strong>travioafrica.com</strong>, their subdomains and any booking tools operated by
            Expedition-Go Tours Ltd (together, the <strong>"Platform"</strong>).
          </p>
          <p>It should be read together with:</p>
          <ul>
            <li>our General Terms and Conditions</li>
            <li>the specific experience description</li>
            <li>the cancellation terms displayed during checkout</li>
            <li>your booking confirmation or voucher</li>
            <li>any supplier terms clearly disclosed before booking</li>
          </ul>
          <p>
            Nothing in this policy limits any mandatory consumer right available under applicable law.
          </p>

          <h2>2. Who provides your experience</h2>
          <p>An experience may be:</p>
          <ol>
            <li>organised and delivered directly by Expedition-Go Tours Ltd; or</li>
            <li>
              delivered by an independent tour operator, guide, attraction, transport provider or other
              supplier (a <strong>"Supplier"</strong>).
            </li>
          </ol>
          <p>
            Where an independent Supplier provides the experience, the cancellation conditions shown on the
            experience page or booking confirmation may reflect that Supplier's terms. If no different terms
            are displayed, our standard 24-hour policy applies.
          </p>

          <h2>3. How to cancel</h2>
          <p>
            To cancel, use the cancellation facility provided through the platform or sales channel where you
            booked. If no online cancellation facility is available, contact us using the details in
            Section 18.
          </p>
          <p>Your request should include:</p>
          <ul>
            <li>the lead traveller's full name</li>
            <li>booking reference</li>
            <li>experience name and date</li>
            <li>reason for cancellation, where relevant</li>
            <li>any supporting evidence required for an exception request</li>
          </ul>
          <p>
            A cancellation is complete only when it has been recorded by the booking channel or acknowledged
            by us in writing. Keep the cancellation confirmation for your records.
          </p>
          <p>
            Messages sent to a guide, driver or personal staff number may not constitute valid cancellation
            unless we confirm them through an official channel.
          </p>

          <h2>4. Bookings made through another platform</h2>
          <p>
            If you booked through GetYourGuide, Viator, Tripadvisor, Booking.com, TourHQ, Civitatis,
            Marriott Bonvoy, a travel agent or another third-party sales channel, you must normally request
            cancellation and any refund through that channel.
          </p>
          <p>
            The cancellation policy and process confirmed by that channel will apply to the booking. We may
            assist with operational information, but the third-party platform may control the cancellation
            record, payment and refund processing.
          </p>

          <h2>5. Different or non-refundable conditions</h2>
          <p>
            Some experiences may have a different cancellation deadline or may be non-refundable because they
            involve costs committed in advance. Any experience labelled <strong>"All Sales Final"</strong>,{' '}
            <strong>"Non-refundable"</strong> or materially similar wording cannot be changed or cancelled for
            a refund after booking, except where mandatory law requires otherwise or where Travio Ghana
            Tours or the Supplier cancels the experience. Examples may include:
          </p>
          <ul>
            <li>dated attraction tickets</li>
            <li>permits or visa-support services</li>
            <li>domestic flights or other transport tickets</li>
            <li>accommodation</li>
            <li>meals or catering ordered in advance</li>
            <li>special events</li>
            <li>private venue hire</li>
            <li>customised tours</li>
            <li>specialist guides, equipment or performers</li>
            <li>services expressly marked <strong>"Non-refundable"</strong></li>
          </ul>
          <p>
            A different condition applies only where it was clearly disclosed on the experience page, at
            checkout or in your booking confirmation before purchase.
          </p>

          <h2>6. Changes and rescheduling requested by you</h2>
          <p>
            You may request a change to the date, time, participant number or pickup details. Changes are
            subject to availability, Supplier approval and any price difference.
          </p>
          <p>
            A requested change is not confirmed until we approve it in writing. If the new option costs
            more, you must pay the difference before confirmation. If it costs less, any refund or credit
            will be handled according to the terms agreed for the change.
          </p>
          <p>
            Where we cannot accommodate the requested change, your original booking remains valid. If you
            then cancel it, the applicable cancellation deadline will be based on the original booking
            unless we expressly agree otherwise.
          </p>
          <p>
            Waiting for a response to a change request does not pause or extend the applicable cancellation
            deadline.
          </p>
          <p>
            Repeated changes or a change requested after the free-cancellation deadline may be refused or
            treated as a late cancellation.
          </p>

          <h2>7. Late arrival and no-shows</h2>
          <p>
            You are responsible for arriving at the confirmed meeting or pickup point on time and remaining
            contactable using the details supplied at booking.
          </p>
          <p>
            If you are absent after any waiting period stated in the booking information, the experience may
            depart without you. A missed experience caused by lateness, an incorrect pickup location,
            inability to contact you or failure to follow the joining instructions is treated as a no-show
            and is non-refundable.
          </p>
          <p>
            Traffic, flight delays, missed transport, immigration delays and difficulty locating the meeting
            point do not automatically create a right to a refund. Contact us immediately if you expect to
            be late; where reasonably possible, we will try to assist, but we cannot guarantee that the
            experience can wait or be rescheduled.
          </p>

          <h2>8. Illness, emergencies and exceptional requests</h2>
          <p>
            Illness, injury, bereavement, flight disruption or another personal emergency does not
            automatically override the stated cancellation terms.
          </p>
          <p>
            We may consider a reasonable exception request at our discretion and in consultation with the
            Supplier. We may request reliable supporting evidence. Any exception, partial refund,
            rescheduling or credit offered is voluntary unless required by law and does not establish a
            precedent for another booking.
          </p>
          <p>
            Travel insurance may cover circumstances that fall outside this policy. We strongly recommend
            appropriate travel insurance from the date of booking.
          </p>

          <h2>9. Weather and local conditions</h2>
          <p>
            Many experiences operate in rain or changing weather. A customer's preference not to participate
            because of weather does not qualify for a refund where the experience can operate safely and
            substantially as described.
          </p>
          <p>
            Where severe weather or another safety concern makes an experience unsafe or impossible, we or
            the Supplier may change the itinerary, postpone or cancel it. If the experience is cancelled,
            Section 11 applies.
          </p>
          <p>
            Natural conditions, wildlife sightings, water levels, visibility and similar features cannot be
            guaranteed unless the experience description expressly says otherwise.
          </p>

          <h2>10. Itinerary and site changes</h2>
          <p>
            We or the Supplier may make reasonable changes to the route, order, timing, guide, vehicle or
            included sites because of traffic, weather, closures, safety, availability or local operating
            conditions.
          </p>
          <p>
            A reasonable change that preserves the main nature and value of the experience does not normally
            create a right to a refund.
          </p>
          <p>
            If a significant part of the confirmed experience cannot be provided and no suitable alternative
            is offered, we will assess an appropriate partial or full refund based on the affected service,
            amounts recoverable from Suppliers and your mandatory legal rights.
          </p>

          <h2>11. Cancellation by Travio Ghana or a Supplier</h2>
          <p>
            We or the Supplier may cancel an experience because of safety concerns, severe weather,
            attraction closure, vehicle failure, guide unavailability, insufficient participation,
            governmental action or another operational event.
          </p>
          <p>
            If we or the Supplier cancels before the experience begins, you will normally be offered one of
            the following:
          </p>
          <ol>
            <li>rescheduling to another available date</li>
            <li>a reasonably comparable replacement experience</li>
            <li>a full refund of the price paid for the cancelled experience</li>
          </ol>
          <p>
            You may choose a refund where the proposed alternative is not acceptable, subject to any
            mandatory law and any special circumstances explained before you accept the alternative.
          </p>
          <p>
            We are not responsible for the cost of independently booked flights, accommodation, visas,
            transport, meals or other arrangements unless applicable law requires otherwise.
          </p>

          <h2>12. Events beyond reasonable control</h2>
          <p>
            Events beyond reasonable control may include severe weather, flood, fire, epidemic, road closure,
            civil disturbance, strike, war, governmental restriction, attraction closure, utility failure or
            transport-system disruption (a <strong>"Force Majeure Event"</strong>).
          </p>
          <p>
            Where a Force Majeure Event affects the booking, we will act reasonably and comply with
            applicable consumer law. Depending on the circumstances, recoverable Supplier costs and service
            already provided, we may offer rescheduling, a suitable alternative, credit, partial refund or
            full refund.
          </p>
          <p>
            Nothing in this section allows us to retain payment where doing so would be unlawful.
          </p>

          <h2>13. Experiences stopped after they begin</h2>
          <p>
            If you voluntarily leave an experience after it begins, miss part of the itinerary, decline an
            included service or are unable to continue for a personal reason, no refund is normally due.
          </p>
          <p>
            If a guide or Supplier removes you because of intoxication, abusive behaviour, unlawful
            conduct, failure to follow safety instructions or risk to others, no refund is normally due.
          </p>
          <p>
            If the experience is ended early because of a failure by Travio Ghana or the Supplier, or
            because safe performance becomes impossible, we will assess an appropriate remedy based on the
            circumstances, the proportion delivered and applicable law.
          </p>
          <p>
            Once an experience has begun, it is otherwise non-refundable unless mandatory law or the
            specific booking terms require a refund.
          </p>

          <h2>14. Refund method and processing time</h2>
          <p>
            Approved refunds are normally returned to the original payment method and currency used for the
            booking. We do not usually issue cash refunds for card or online payments.
          </p>
          <p>
            We aim to authorise an approved refund within <strong>5 to 10 business days</strong> after
            confirming eligibility. Your bank, card issuer, payment provider or booking channel may require
            additional time to display the funds. International banking and currency-conversion processes may
            also cause delay.
          </p>
          <p>
            Where a third-party booking channel collected payment, its processing timeline applies.
          </p>
          <p>
            If the original payment method is no longer available, we may require identity and account
            verification before agreeing a lawful alternative.
          </p>

          <h2>15. Currency conversion and external fees</h2>
          <p>
            Refunds are issued for the amount and currency originally charged or the equivalent amount
            processed by the relevant booking channel.
          </p>
          <p>
            Exchange-rate movements may mean the amount shown in your bank-account currency differs from the
            amount originally displayed. Bank charges, foreign-transaction fees, payment-provider charges
            and currency-conversion costs imposed independently by third parties are not refundable by us
            unless required by law.
          </p>

          <h2>16. Duplicate or incorrect charges</h2>
          <p>
            Contact us promptly if you believe you were charged twice or charged an incorrect amount.
            Provide the booking reference, payment date, amount and evidence showing the transactions.
          </p>
          <p>
            We will investigate with the payment provider. A confirmed duplicate or erroneous charge made by
            us will be refunded to the relevant payment method.
          </p>

          <h2>17. Chargebacks and payment disputes</h2>
          <p>
            Please contact us before initiating a chargeback so we have an opportunity to resolve the issue.
          </p>
          <p>
            Submitting a chargeback does not automatically cancel a booking. We may provide the bank or
            payment provider with booking confirmations, communications, attendance records, cancellation
            terms and other evidence reasonably required to respond to the dispute.
          </p>
          <p>
            Fraudulent or abusive chargebacks may result in cancellation of associated bookings or
            restriction of Platform access, without affecting any lawful right to dispute a genuine
            transaction.
          </p>

          <h2>18. Contacting us about a refund</h2>
          <p>
            <strong>Expedition-Go Tours Ltd</strong>
            <br />
            Trading address: <strong>Nmai Dzorn Adjiringano Road, Accra, Ghana</strong>
            <br />
            Registered address: <strong>H/N UNN House, near Harvest Chapel International, Accra, Ghana</strong>
            <br />
            Email: <strong>info@expeditiongotours.com</strong>
            <br />
            Telephone/WhatsApp: <strong>+233 59 140 9761</strong>
          </p>
          <p>
            Use the subject line <strong>"Cancellation or Refund Request - [booking reference]"</strong>.
          </p>
          <p>
            We aim to acknowledge a written complaint or disputed refund within three business days and
            provide a substantive response within 14 business days. Complex cases may take longer, in which
            case we will provide an update.
          </p>

          <h2>19. Governing terms and consumer rights</h2>
          <p>
            This policy forms part of the Expedition-Go Tours Ltd General Terms and Conditions. If there is
            a conflict, mandatory consumer law applies first, followed by the specific cancellation terms
            disclosed for the booking, this policy and the General Terms and Conditions.
          </p>
          <p>
            The English version controls if a translated version is inconsistent, unless applicable law
            requires otherwise.
          </p>

          <h2>20. Changes to this policy</h2>
          <p>
            We may update this policy to reflect changes in our services, suppliers, payment methods or
            legal obligations. The effective date will be displayed at the top.
          </p>
          <p>
            The cancellation conditions accepted when a booking was confirmed will normally continue to
            apply to that booking unless a later change is required by law or is more favourable to you.
          </p>

          <p className="support-meta">
            {t('support.updatedDate')}: August 2026
          </p>
          <p className="support-meta">
            <BackToHelpCentre />
          </p>
        </div>
      </div>

      <Footer />
    </div>
  )
}
