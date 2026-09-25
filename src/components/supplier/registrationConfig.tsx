/**
 * Static data + rules for the supplier registration wizard
 * (ported from ~/Downloads/travio_supplier_registration.html).
 */
import type { ReactNode } from 'react'

export type SupplierKind = 'business' | 'individual'

export type SupplierCardId =
  | 'registered_company'
  | 'sole_proprietor'
  | 'tour_guide'
  | 'experience_host'
  | 'transport_company'
  | 'independent_driver'

export interface SupplierCard {
  id: SupplierCardId
  kind: SupplierKind
  title: string
  description: string
  /** Value sent as `supplierType` to POST /suppliers/apply. */
  backendType: string
  icon: ReactNode
}

const icon = (children: ReactNode) => <>{children}</>

export const SUPPLIER_CARDS: SupplierCard[] = [
  {
    id: 'registered_company',
    kind: 'business',
    title: 'Registered Company',
    description: 'A registered tour operator, company or organisation.',
    backendType: 'TOUR_COMPANY',
    icon: icon(
      <>
        <path d="M4 21V3h11v18M9 7h2M9 11h2M9 15h2M15 9h5v12M17.5 13h.01M17.5 17h.01M2 21h20" />
      </>,
    ),
  },
  {
    id: 'sole_proprietor',
    kind: 'business',
    title: 'Sole Proprietor / Business',
    description: 'You operate under a business or trading name.',
    backendType: 'OTHER_SERVICE_PROVIDER',
    icon: icon(
      <>
        <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </>,
    ),
  },
  {
    id: 'tour_guide',
    kind: 'individual',
    title: 'Individual Tour Guide',
    description: 'You personally lead tours and experiences.',
    backendType: 'TOUR_GUIDE',
    icon: icon(
      <>
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <circle cx="12" cy="10" r="3" />
        <path d="M8 18c.9-2 2.2-3 4-3s3.1 1 4 3" />
      </>,
    ),
  },
  {
    id: 'experience_host',
    kind: 'individual',
    title: 'Independent Experience Host',
    description: 'You run activities or local experiences independently.',
    backendType: 'OTHER_SERVICE_PROVIDER',
    icon: icon(
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M4 19c.9-3.1 2.6-4.8 5-4.8 1.8 0 3.2.9 4.2 2.5" />
        <path d="M16.5 6.5v5M14 9h5" />
        <path d="M16 15.5c2.5 0 4 1.5 4 3.5" />
      </>,
    ),
  },
  {
    id: 'transport_company',
    kind: 'business',
    title: 'Transport Company',
    description: 'You provide airport transfers, private transport or fleet services.',
    backendType: 'TRANSPORTATION_PROVIDER',
    icon: icon(
      <>
        <path d="M3 6h13l4 5v7H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
        <path d="M16 6v5h4M7 18a2 2 0 1 0 4 0M16 18a2 2 0 1 0 4 0M5 10h7" />
      </>,
    ),
  },
  {
    id: 'independent_driver',
    kind: 'individual',
    title: 'Independent Driver',
    description: 'You personally provide transport or transfer services.',
    backendType: 'VEHICLE_OPERATOR',
    icon: icon(
      <>
        <path d="m5 11 2-5h10l2 5M3 11h18v7H3z" />
        <path d="M6 18a2 2 0 1 0 4 0M14 18a2 2 0 1 0 4 0M7 14h.01M17 14h.01" />
      </>,
    ),
  },
]

export function supplierCard(id: string | null | undefined): SupplierCard | undefined {
  return SUPPLIER_CARDS.find((c) => c.id === id)
}

export type ServiceGroup = 'tours' | 'transport' | 'experience'

export interface ServiceCard {
  id: string
  group: ServiceGroup
  title: string
  description: string
  icon: ReactNode
}

export const SERVICE_CARDS: ServiceCard[] = [
  {
    id: 'tours',
    group: 'tours',
    title: 'Tours & Activities',
    description: 'City tours, day trips, cultural experiences, nature and adventure activities.',
    icon: icon(
      <>
        <path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2V6Z" />
        <path d="M8 4v13M16 7v13" />
      </>,
    ),
  },
  {
    id: 'airport_transfers',
    group: 'transport',
    title: 'Airport Transfers',
    description: 'Airport pickup, drop-off and return transfers.',
    icon: icon(
      <>
        <path d="M22 2 9 15M22 2l-7 20-4-9-9-4 20-7Z" />
      </>,
    ),
  },
  {
    id: 'private_transport',
    group: 'transport',
    title: 'Private Transport',
    description: 'Private driver, chauffeur and point-to-point transport.',
    icon: icon(
      <>
        <path d="m5 11 2-5h10l2 5M3 11h18v7H3z" />
        <path d="M6 18v2M18 18v2M6 14h.01M18 14h.01" />
      </>,
    ),
  },
  {
    id: 'experience',
    group: 'experience',
    title: 'Other Experience',
    description: 'Food, workshops, events or another bookable service.',
    icon: icon(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </>,
    ),
  },
]

export type PayoutMethodId = 'bank' | 'paypal' | 'momo'
export type PayoutScheduleId = 'weekly' | 'twice_month' | 'monthly'

export interface PayoutMethodCard {
  id: PayoutMethodId
  title: string
  description: string
  icon: ReactNode
}

export const PAYOUT_METHODS: PayoutMethodCard[] = [
  {
    id: 'bank',
    title: 'Bank Transfer',
    description: 'Receive your earnings directly into your bank account.',
    icon: icon(
      <>
        <path d="m3 10 9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18M2 18h20" />
      </>,
    ),
  },
  {
    id: 'paypal',
    title: 'PayPal',
    description: 'Receive payouts through your PayPal account.',
    icon: icon(
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18M7 15h3" />
      </>,
    ),
  },
  {
    id: 'momo',
    title: 'Mobile Money',
    description: 'Receive payouts directly to your Ghana mobile money wallet.',
    icon: icon(
      <>
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M10 5h4M11 18h2" />
      </>,
    ),
  },
]

export interface PayoutScheduleCard {
  id: PayoutScheduleId
  title: string
  /** Bold lead-in line shown above the detail paragraph. */
  lead: string
  detail: string
  icon: ReactNode
}

export const PAYOUT_SCHEDULES: PayoutScheduleCard[] = [
  {
    id: 'weekly',
    title: 'Weekly',
    lead: 'Every Monday',
    detail: 'Payouts are generated every Monday for eligible experiences completed by the Sunday before.',
    icon: icon(
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" />
      </>,
    ),
  },
  {
    id: 'twice_month',
    title: 'Twice a month',
    lead: 'The 1st and 15th of each month',
    detail: 'Payouts are generated twice a month, on the 1st and the 15th.',
    icon: icon(
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18M7 14h4M13 14h4M7 17h4M13 17h4" />
      </>,
    ),
  },
  {
    id: 'monthly',
    title: 'Monthly',
    lead: 'The 1st of each month',
    detail: 'One payout a month, generated on the 1st for the previous month.',
    icon: icon(
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18M8 14h8M8 17h5" />
      </>,
    ),
  },
]

/** The 16 administrative regions of Ghana (reference order). */
export const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Central',
  'Eastern',
  'Western',
  'Western North',
  'Volta',
  'Oti',
  'Northern',
  'North East',
  'Savannah',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo',
] as const

export const ID_TYPE_OPTIONS = [
  'Ghana Card',
  'Passport',
  'Other government-issued ID',
] as const

export const MOMO_NETWORKS = ['MTN Mobile Money', 'Telecel Cash', 'AT Money'] as const

export const BANK_CURRENCIES = ['GHS', 'USD', 'GBP', 'EUR'] as const

/**
 * Documents TravioGhana may ask for later — ported from the reference's
 * `updateVerificationRequirements()`. Informational only: none of these are
 * collected during registration.
 */
export function laterDocumentsFor(
  cardId: string,
  kind: string,
  serviceGroups: ServiceGroup[],
): { name: string; detail: string }[] {
  const docs: { name: string; detail: string }[] = []
  const add = (name: string, detail: string) => docs.push({ name, detail })

  const isIndividual = kind === 'individual'
  const isTransportCompany = cardId === 'transport_company'
  const isIndependentDriver = cardId === 'independent_driver'
  const isRegisteredCompany = cardId === 'registered_company'
  const hasTours = serviceGroups.includes('tours') || serviceGroups.includes('experience')
  const hasTransport = serviceGroups.includes('transport')

  if (isIndividual && hasTours && !isIndependentDriver) {
    add('Ghana Tourism Authority licence', 'May be requested before applicable tours or experiences go live.')
  }

  if (!isIndividual && hasTours) {
    add('Ghana Tourism Authority licence', 'May be required before applicable tour listings go live.')
    add('Public liability / activity insurance', 'May be required for applicable tours or activities before publishing.')
  }

  if (isIndependentDriver) {
    add("Driver's licence", 'Required before transport services or vehicle-based tours become bookable.')
    add('Vehicle registration', 'Required for the vehicle used to fulfil bookings.')
    add('Vehicle insurance', 'Required before the vehicle becomes active on TravioGhana.')
    add('Roadworthiness', 'Required where applicable before the vehicle becomes active.')
  } else if (isTransportCompany) {
    add("Driver's licence", 'Add driver documents when assigning drivers to TravioGhana bookings.')
    add('Vehicle registration', 'Add registration documents for vehicles used on TravioGhana.')
    add('Vehicle insurance', 'Required for vehicles used to fulfil bookings.')
    add('Roadworthiness', 'Required where applicable for active vehicles.')
  } else if (isRegisteredCompany && hasTransport) {
    add('Vehicle registration', 'May be requested before Airport Transfer or Private Transport listings go live.')
    add('Vehicle insurance', 'May be requested before the vehicle is used for Travio bookings.')
  } else if (hasTransport) {
    add('Vehicle / driver documents', 'TravioGhana may request the relevant transport documents before the service goes live.')
  }

  return docs
}

/** Primary verification document collected at registration. */
export function primaryDocumentFor(kind: SupplierKind | '') {
  if (kind === 'individual') {
    return {
      type: 'GHANA_CARD',
      title: 'Government-issued ID',
      description:
        'Upload one Ghana Card, passport or another accepted government-issued ID. Your name and date of birth should match your profile.',
      uploadLabel: 'Upload your ID',
      quickSubtitle: 'That\u2019s all we need to start your individual supplier account.',
    }
  }
  return {
    type: 'BUSINESS_CERTIFICATE',
    title: 'Business registration certificate',
    description:
      'Upload your business registration certificate so we can confirm the business behind this TravioGhana supplier account.',
    uploadLabel: 'Upload business certificate',
    quickSubtitle: 'That\u2019s all we need to start your business supplier account.',
  }
}

export const WIZARD_STEPS = [
  { title: 'Account', subtitle: 'Your contact details' },
  { title: 'Supplier type', subtitle: 'How you operate' },
  { title: 'Profile', subtitle: 'You or your business' },
  { title: 'Services', subtitle: 'What you want to sell' },
  { title: 'Verification', subtitle: 'Documents & trust' },
  { title: 'Payout', subtitle: 'How you get paid' },
  { title: 'Review', subtitle: 'Check and submit' },
] as const

export const SUPPLIER_STANDARDS = [
  {
    title: 'Information is accurate',
    detail: 'I confirm the information provided is accurate and I will keep my supplier information current.',
  },
  {
    title: 'Authorised to sell',
    detail: 'I am authorised to sell the tours, activities, experiences or transport services I list.',
  },
  {
    title: 'TravioGhana Supplier Terms',
    detail: 'I agree to the applicable booking, cancellation, payout, service-quality and supplier obligations.',
  },
  {
    title: 'Information processing & verification',
    detail:
      'I allow Expedition-Go Tours Ltd to process and verify the information and documents I provide for supplier verification, compliance, account administration and marketplace operations.',
  },
  {
    title: 'Distribution across our network',
    detail:
      'I agree that eligible listings may be distributed through TravioGhana, the Expedition-Go Tours network and authorised partners where applicable.',
  },
] as const
