import { describe, expect, it } from 'vitest'

import { createEmptySupplierApplicationForm, type SupplierApplicationForm } from './supplierApplicationDraft'
import {
  buildSupplierPayload,
  hasToursService,
  hasTransportService,
  isValidEmail,
  laterDocumentsFor,
  normalizeWebsite,
  primaryDocumentType,
  requiredSupplierDocuments,
  serviceLabels,
  splitFullName,
  STEP_ACCOUNT,
  STEP_PROFILE,
  STEP_REVIEW,
  STEP_SERVICES,
  STEP_TYPE,
  STEP_VERIFICATION,
  STEP_PAYOUT,
  supplierTypeOption,
  SUPPLIER_TYPE_OPTIONS,
  validateSupplierStep,
  yearsInBusinessFrom,
} from './supplierRegistration'

const CURRENT_YEAR = new Date().getFullYear()

function json(formData: FormData, key: string): Record<string, unknown> {
  return JSON.parse(String(formData.get(key))) as Record<string, unknown>
}

function filledIndividualForm(): SupplierApplicationForm {
  const form = createEmptySupplierApplicationForm()
  form.supplierChoice = 'individual_guide'
  form.account = {
    firstName: 'Ama',
    lastName: 'Boateng',
    email: 'ama@example.com',
    phone: '0244000000',
    phoneCountryCode: '+233',
  }
  form.profile = {
    ...form.profile,
    firstName: 'Ama',
    lastName: 'Boateng',
    dateOfBirth: '1992-04-12',
    idType: 'national_id',
    idNumber: 'GHA-123456789-0',
    brandName: 'Ama Cultural Walks',
    address: 'GA-123-4567',
    region: 'Greater Accra',
    city: 'Accra',
  }
  form.services = ['tours']
  form.operatingRegions = ['Greater Accra', 'Central']
  form.compliance = { acceptedTerms: true, agreedToPayoutTerms: true }
  return form
}

function filledBusinessForm(): SupplierApplicationForm {
  const form = createEmptySupplierApplicationForm()
  form.supplierChoice = 'registered_company'
  form.account = {
    firstName: 'Peter',
    lastName: 'Mensah',
    email: 'peter@expeditiongo.test',
    phone: '0244000000',
    phoneCountryCode: '+233',
  }
  form.profile = {
    ...form.profile,
    brandName: 'Expedition-Go Tours',
    legalBusinessName: 'Expedition-Go Tours Ltd',
    yearEstablished: String(CURRENT_YEAR - 4),
    website: 'www.expeditiongo.test',
    socialLinks: { instagram: 'https://instagram.com/expeditiongo', twitter: 'https://x.com/expeditiongo' },
    registrationNumber: 'CS-123456789',
    tin: 'C0012345678',
    address: 'GA-456-7890',
    region: 'Greater Accra',
    city: 'Accra',
  }
  form.services = ['tours', 'airport_transfers']
  form.operatingRegions = ['Ashanti']
  form.taxAcknowledged = true
  form.payout = {
    ...form.payout,
    method: 'bank',
    schedule: 'weekly',
    bankAccountName: 'Expedition-Go Tours Ltd',
    bankAccountNumber: '1234567890',
    bankName: 'Ecobank Ghana',
    bankCountry: 'Ghana',
    currency: 'GHS',
  }
  form.compliance = { acceptedTerms: true, agreedToPayoutTerms: true }
  return form
}

describe('supplier type options', () => {
  it('maps every card onto a backend supplier type and kind', () => {
    expect(SUPPLIER_TYPE_OPTIONS).toHaveLength(6)
    const ids = new Set(SUPPLIER_TYPE_OPTIONS.map((option) => option.id))
    expect(ids.size).toBe(SUPPLIER_TYPE_OPTIONS.length)

    const backendTypes = new Set(SUPPLIER_TYPE_OPTIONS.map((option) => option.supplierType))
    expect([...backendTypes].sort()).toEqual(
      [
        'OTHER_SERVICE_PROVIDER',
        'TOUR_COMPANY',
        'TOUR_GUIDE',
        'TRANSPORTATION_PROVIDER',
        'VEHICLE_OPERATOR',
      ].sort()
    )

    // Accommodation providers are no longer offered in this flow.
    expect(supplierTypeOption('accommodation')).toBeNull()
    expect(supplierTypeOption('registered_company')).toMatchObject({
      supplierType: 'TOUR_COMPANY',
      businessType: 'company',
      kind: 'business',
    })
    expect(supplierTypeOption('sole_proprietor')).toMatchObject({
      supplierType: 'TOUR_COMPANY',
      businessType: 'individual',
      kind: 'business',
    })
    expect(supplierTypeOption('independent_driver')).toMatchObject({
      supplierType: 'VEHICLE_OPERATOR',
      kind: 'individual',
    })
    expect(supplierTypeOption('nope')).toBeNull()
  })
})

describe('required + later documents', () => {
  it('requires only an ID for the individual supplier types', () => {
    expect(primaryDocumentType()).toBe('GHANA_CARD')
    for (const choice of ['individual_guide', 'experience_host', 'independent_driver']) {
      expect(requiredSupplierDocuments(choice).map((doc) => doc.type)).toEqual(['GHANA_CARD'])
    }
  })

  it('requires an ID plus a business certificate for business supplier types', () => {
    for (const choice of ['registered_company', 'sole_proprietor', 'transport_company']) {
      expect(requiredSupplierDocuments(choice).map((doc) => doc.type)).toEqual([
        'GHANA_CARD',
        'BUSINESS_CERTIFICATE',
      ])
    }
    // The ID card copy is unchanged (title/upload label the supplier sees).
    expect(requiredSupplierDocuments('individual_guide')[0]).toMatchObject({
      title: 'Government-issued ID',
      uploadLabel: 'Upload your ID',
    })
    expect(requiredSupplierDocuments('registered_company')[1]).toMatchObject({
      type: 'BUSINESS_CERTIFICATE',
      uploadLabel: 'Upload your certificate',
    })
  })

  it('lists the documents TravioGhana may ask for later', () => {
    // Individual guide selling tours → GTA licence only.
    expect(laterDocumentsFor('individual_guide', ['tours']).map((doc) => doc.name)).toEqual([
      'Ghana Tourism Authority licence',
    ])
    // Independent driver → the vehicle set, regardless of services.
    expect(laterDocumentsFor('independent_driver', []).map((doc) => doc.name)).toEqual([
      "Driver's licence",
      'Vehicle registration',
      'Vehicle insurance',
      'Roadworthiness',
    ])
    // Transport company → the vehicle set (certificate is required up front now).
    expect(laterDocumentsFor('transport_company', ['airport_transfers']).map((doc) => doc.name)).toEqual([
      "Driver's licence",
      'Vehicle registration',
      'Vehicle insurance',
      'Roadworthiness',
    ])
    // Registered company with transfers → vehicle registration/insurance.
    expect(laterDocumentsFor('registered_company', ['airport_transfers']).map((doc) => doc.name)).toEqual([
      'Vehicle registration',
      'Vehicle insurance',
    ])
    // Registered company selling tours only → GTA licence + liability insurance.
    expect(laterDocumentsFor('registered_company', ['tours']).map((doc) => doc.name)).toEqual([
      'Ghana Tourism Authority licence',
      'Public liability / activity insurance',
    ])
    // Nothing further to ask for yet.
    expect(laterDocumentsFor('sole_proprietor', [])).toEqual([])
    expect(laterDocumentsFor('experience_host', [])).toEqual([])
  })
})

describe('service + text helpers', () => {
  it('classifies services', () => {
    expect(hasToursService(['tours'])).toBe(true)
    expect(hasToursService(['other_experience'])).toBe(true)
    expect(hasTransportService(['airport_transfers'])).toBe(true)
    expect(hasTransportService(['tours'])).toBe(false)
    expect(serviceLabels(['private_transport', 'tours'])).toEqual(['Tours & Activities', 'Private Transport'])
  })

  it('normalizes websites and names', () => {
    expect(normalizeWebsite('expeditiongo.test')).toBe('https://expeditiongo.test')
    expect(normalizeWebsite('https://expeditiongo.test')).toBe('https://expeditiongo.test')
    expect(normalizeWebsite('  ')).toBe('')
    expect(splitFullName('Ama Serwaa Boateng')).toEqual({ firstName: 'Ama', lastName: 'Serwaa Boateng' })
    expect(splitFullName('')).toEqual({ firstName: '', lastName: '' })
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('a@b')).toBe(false)
  })

  it('derives years in business from the established year', () => {
    expect(yearsInBusinessFrom(String(CURRENT_YEAR - 5))).toBe(5)
    expect(yearsInBusinessFrom('')).toBe(0)
    expect(yearsInBusinessFrom('not-a-year')).toBe(0)
    expect(yearsInBusinessFrom(String(CURRENT_YEAR + 10))).toBe(0)
  })
})

describe('validateSupplierStep', () => {
  const noSession = { hasSession: false, password: '', confirmPassword: '' }
  const session = { hasSession: true, password: '', confirmPassword: '' }

  it('step 0 requires contact details and, when signed out, a matching password', () => {
    const empty = createEmptySupplierApplicationForm()
    expect(validateSupplierStep(STEP_ACCOUNT, empty, noSession)).toMatchObject({
      'account.firstName': expect.any(String),
      'account.lastName': expect.any(String),
      'account.email': expect.any(String),
      'account.phone': expect.any(String),
      'account.password': expect.any(String),
      'account.confirmPassword': expect.any(String),
    })

    // Signed-in applicants have no password fields unless they opt in.
    expect(validateSupplierStep(STEP_ACCOUNT, empty, session)).not.toHaveProperty('account.password')

    // A signed-in social-login account may add one — then it must be valid.
    const validAccount = filledIndividualForm()
    expect(
      validateSupplierStep(STEP_ACCOUNT, validAccount, { hasSession: true, password: '', confirmPassword: '' })
    ).toEqual({})
    expect(
      validateSupplierStep(STEP_ACCOUNT, validAccount, { hasSession: true, password: 'short', confirmPassword: 'short' })[
        'account.password'
      ]
    ).toMatch(/8 characters/)
    expect(
      validateSupplierStep(STEP_ACCOUNT, validAccount, {
        hasSession: true,
        password: 'longenough',
        confirmPassword: 'longenough',
      })
    ).toEqual({})

    const badEmail = createEmptySupplierApplicationForm()
    badEmail.account = { firstName: 'A', lastName: 'B', email: 'nope', phone: '123', phoneCountryCode: '+233' }
    const errors = validateSupplierStep(STEP_ACCOUNT, badEmail, session)
    expect(errors['account.email']).toMatch(/valid email/i)
    expect(errors['account.phone']).toMatch(/valid phone/i)

    const mismatched = { hasSession: false, password: 'longenough', confirmPassword: 'different' }
    expect(validateSupplierStep(STEP_ACCOUNT, empty, mismatched)['account.confirmPassword']).toMatch(/do not match/i)
  })

  it('step 1 requires a supplier type', () => {
    const form = createEmptySupplierApplicationForm()
    expect(validateSupplierStep(STEP_TYPE, form, session)['supplierChoice']).toBeTruthy()
    form.supplierChoice = 'individual_guide'
    expect(validateSupplierStep(STEP_TYPE, form, session)).toEqual({})
  })

  it('step 2 validates the individual profile, regions and (for business) the tax ack', () => {
    const individual = createEmptySupplierApplicationForm()
    individual.supplierChoice = 'individual_guide'
    const errors = validateSupplierStep(STEP_PROFILE, individual, session)
    expect(errors).toMatchObject({
      'profile.firstName': expect.any(String),
      'profile.dateOfBirth': expect.any(String),
      'profile.idType': expect.any(String),
      'profile.idNumber': expect.any(String),
      'profile.address': expect.any(String),
      'profile.region': expect.any(String),
      'profile.city': expect.any(String),
      'operatingRegions': expect.any(String),
    })
    expect(errors).not.toHaveProperty('taxAcknowledged')

    const business = filledBusinessForm()
    business.taxAcknowledged = false
    expect(validateSupplierStep(STEP_PROFILE, business, session)['taxAcknowledged']).toBeTruthy()

    business.taxAcknowledged = true
    expect(validateSupplierStep(STEP_PROFILE, business, session)).toEqual({})

    business.profile.yearEstablished = '1799'
    expect(validateSupplierStep(STEP_PROFILE, business, session)['profile.yearEstablished']).toMatch(/1900/)
  })

  it('step 3 requires at least one service', () => {
    const form = createEmptySupplierApplicationForm()
    expect(validateSupplierStep(STEP_SERVICES, form, session)['services']).toBeTruthy()
    form.services = ['tours']
    expect(validateSupplierStep(STEP_SERVICES, form, session)).toEqual({})
  })

  it('step 4 requires every up-front document', () => {
    const form = filledIndividualForm()
    expect(validateSupplierStep(STEP_VERIFICATION, form, session)['verificationDocuments']).toBeTruthy()
    form.verificationDocuments = [
      { key: 'k', type: 'GHANA_CARD', ownerType: 'SUPPLIER', file: new File(['x'], 'id.png') },
    ]
    expect(validateSupplierStep(STEP_VERIFICATION, form, session)).toEqual({})

    // A business also needs its registration certificate.
    const business = filledBusinessForm()
    business.verificationDocuments = [
      { key: 'k', type: 'GHANA_CARD', ownerType: 'SUPPLIER', file: new File(['x'], 'id.png') },
    ]
    expect(validateSupplierStep(STEP_VERIFICATION, business, session)['verificationDocuments']).toContain(
      'Business registration certificate'
    )
    business.verificationDocuments.push({
      key: 'c',
      type: 'BUSINESS_CERTIFICATE',
      ownerType: 'SUPPLIER',
      file: new File(['x'], 'cert.pdf'),
    })
    expect(validateSupplierStep(STEP_VERIFICATION, business, session)).toEqual({})
  })

  it('step 5 only checks optional payout details when they are filled in', () => {
    const form = filledIndividualForm()
    expect(validateSupplierStep(STEP_PAYOUT, form, session)).toEqual({})

    form.payout.method = 'paypal'
    form.payout.paypalEmail = 'not-an-email'
    expect(validateSupplierStep(STEP_PAYOUT, form, session)['payout.paypalEmail']).toBeTruthy()

    form.payout.paypalEmail = 'payouts@example.com'
    expect(validateSupplierStep(STEP_PAYOUT, form, session)).toEqual({})
  })

  it('step 6 requires accepting the supplier standards', () => {
    const form = filledIndividualForm()
    form.compliance = { acceptedTerms: false, agreedToPayoutTerms: false }
    expect(validateSupplierStep(STEP_REVIEW, form, session)['compliance.acceptedTerms']).toBeTruthy()
  })
})

describe('buildSupplierPayload', () => {
  it('maps an individual guide onto the backend contract', () => {
    const payload = buildSupplierPayload(filledIndividualForm())

    expect(payload.get('supplierType')).toBe('TOUR_GUIDE')

    const business = json(payload, 'businessInfo')
    expect(business).toMatchObject({
      legalBusinessName: 'Ama Cultural Walks',
      displayName: 'Ama Cultural Walks',
      businessType: 'individual',
      country: 'GH',
      phoneNumber: '+233244000000',
      website: '',
    })
    expect(business.address).toMatchObject({ line1: 'GA-123-4567', city: 'Accra', state: 'Greater Accra' })

    expect(json(payload, 'operatingInfo')).toMatchObject({
      regions: ['Greater Accra', 'Central'],
      services: ['Tours & Activities'],
      yearsInBusiness: 0,
    })

    const representative = json(payload, 'representativeInfo')
    expect(representative).toMatchObject({
      fullName: 'Ama Boateng',
      email: 'ama@example.com',
      phoneNumber: '+233244000000',
      dateOfBirth: '1992-04-12',
      // Stored as a slug, shown to admins as the readable label.
      idType: 'Ghana Card',
      idNumber: 'GHA-123456789-0',
    })
    expect(representative.address).toMatchObject({ city: 'Accra', state: 'Greater Accra' })

    expect(json(payload, 'payoutInfo')).toMatchObject({
      method: 'bank',
      schedule: 'WEEKLY',
      bankCountry: 'Ghana',
      payoutCurrency: 'GHS',
    })
    expect(json(payload, 'compliance')).toMatchObject({
      acceptedTerms: true,
      agreedToPayoutTerms: true,
      privacyAccepted: true,
      // Keys the admin's compliance checklist reads must be present, otherwise
      // accepted standards show as red X's in review.
      codeOfConductAccepted: true,
      dataProcessingAccepted: true,
      taxAcknowledged: false,
    })

    // No legacy vehicle/guide repeaters are written.
    expect(payload.get('vehicles')).toBeNull()
    expect(payload.get('guides')).toBeNull()
  })

  it('stores the phone as a canonical international number from the country code', () => {
    const usForm = filledIndividualForm()
    usForm.account.phoneCountryCode = '+1'
    usForm.account.phone = '2025551234'

    const usBusiness = json(buildSupplierPayload(usForm), 'businessInfo')
    const usRep = json(buildSupplierPayload(usForm), 'representativeInfo')
    expect(usBusiness.phoneNumber).toBe('+12025551234')
    expect(usRep.phoneNumber).toBe('+12025551234')

    // A Ghana number typed with the local leading zero normalises the same way.
    const ghForm = filledIndividualForm()
    ghForm.account.phoneCountryCode = '+233'
    ghForm.account.phone = '0244123456'
    expect(json(buildSupplierPayload(ghForm), 'representativeInfo').phoneNumber).toBe('+233244123456')

    // Drafts saved before the two-part input fall back to the Ghana default.
    const legacyForm = filledIndividualForm()
    legacyForm.account.phoneCountryCode = ''
    legacyForm.account.phone = '0244000000'
    expect(json(buildSupplierPayload(legacyForm), 'businessInfo').phoneNumber).toBe('+233244000000')
  })

  it('maps a registered company, its documents and its payout details', () => {
    const form = filledBusinessForm()
    form.payout.momoNumber = '0244000000'
    form.verificationDocuments = [
      {
        key: 'k',
        type: 'GHANA_CARD',
        ownerType: 'SUPPLIER',
        file: new File(['x'], 'ghana-card.jpg', { type: 'image/jpeg' }),
      },
      {
        key: 'c',
        type: 'BUSINESS_CERTIFICATE',
        ownerType: 'SUPPLIER',
        file: new File(['x'], 'cert.pdf', { type: 'application/pdf' }),
      },
    ]

    const payload = buildSupplierPayload(form)

    expect(payload.get('supplierType')).toBe('TOUR_COMPANY')

    const business = json(payload, 'businessInfo')
    expect(business).toMatchObject({
      legalBusinessName: 'Expedition-Go Tours Ltd',
      displayName: 'Expedition-Go Tours',
      businessType: 'company',
      website: 'https://www.expeditiongo.test',
      instagram: 'https://instagram.com/expeditiongo',
      twitter: 'https://x.com/expeditiongo',
      registrationNumber: 'CS-123456789',
      tin: 'C0012345678',
      yearEstablished: CURRENT_YEAR - 4,
    })

    expect(json(payload, 'operatingInfo')).toMatchObject({
      regions: ['Ashanti'],
      services: ['Tours & Activities', 'Airport Transfers'],
      // The admin renders `tourCategories` as the offering chips.
      tourCategories: ['Tours & Activities', 'Airport Transfers'],
      yearsInBusiness: 4,
    })

    expect(json(payload, 'payoutInfo')).toMatchObject({
      bankAccountName: 'Expedition-Go Tours Ltd',
      bankAccountNumber: '1234567890',
      bankName: 'Ecobank Ghana',
      bankCountry: 'Ghana',
      payoutCurrency: 'GHS',
    })

    const documents = payload.getAll('documents')
    expect(documents).toHaveLength(2)
    expect(json(payload, 'documentMeta')).toEqual([
      { type: 'GHANA_CARD', ownerType: 'SUPPLIER' },
      { type: 'BUSINESS_CERTIFICATE', ownerType: 'SUPPLIER' },
    ])
  })

  it('omits documentMeta when nothing was uploaded', () => {
    const payload = buildSupplierPayload(filledIndividualForm())
    expect(payload.getAll('documents')).toHaveLength(0)
    expect(payload.get('documentMeta')).toBeNull()
  })
})
