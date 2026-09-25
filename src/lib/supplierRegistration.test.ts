import { describe, expect, it } from 'vitest'
import {
  buildSupplierApplicationFormData,
  firstInvalidStep,
  validateRegistrationStep,
} from './supplierRegistration'
import { createEmptySupplierRegistrationForm } from './supplierApplicationDraft'

const signedIn = { signedIn: true }

function filledAccountForm() {
  const form = createEmptySupplierRegistrationForm()
  form.account = {
    firstName: 'Peter',
    lastName: 'Mensah',
    email: 'peter@example.com',
    phone: '+233 24 000 0000',
  }
  return form
}

function filledBusinessForm() {
  const form = filledAccountForm()
  form.supplierCardId = 'registered_company'
  form.supplierKind = 'business'
  form.business = {
    ...form.business,
    brandName: 'Expedition-Go Tours',
    yearEstablished: '2023',
    website: 'expeditiongotours.com',
    social: '@expeditiongotours',
    legalName: 'Expedition-Go Tours Ltd',
    regNumber: 'CS-123456',
    tin: 'C0012345678',
    address: 'GA-123-4567, Osu',
    region: 'Greater Accra',
    city: 'Accra',
    taxAck: true,
  }
  form.operatingRegions = ['Greater Accra']
  form.services = ['tours', 'airport_transfers']
  form.primaryDocument = new File(['id'], 'ghana-card.png', { type: 'image/png' })
  form.compliance.acceptAll = true
  return form
}

describe('validateRegistrationStep', () => {
  it('requires the account fields and a matching password when signed out', () => {
    const form = createEmptySupplierRegistrationForm()
    expect(validateRegistrationStep(0, form, { signedIn: false })).toBe('First name is required')

    form.account.firstName = 'Peter'
    form.account.lastName = 'Mensah'
    form.account.email = 'not-an-email'
    expect(validateRegistrationStep(0, form, { signedIn: false })).toBe('Enter a valid email address')

    form.account.email = 'peter@example.com'
    form.account.phone = '+233240000000'
    expect(validateRegistrationStep(0, form, { signedIn: false })).toBe(
      'Create a password with at least 8 characters',
    )

    expect(
      validateRegistrationStep(0, form, { signedIn: false, password: 'Sup3rSecret!', confirmPassword: 'nope' }),
    ).toBe('Passwords do not match')

    expect(
      validateRegistrationStep(0, form, {
        signedIn: false,
        password: 'Sup3rSecret!',
        confirmPassword: 'Sup3rSecret!',
      }),
    ).toBeNull()
  })

  it('skips the password rules for signed-in visitors', () => {
    const form = filledAccountForm()
    expect(validateRegistrationStep(0, form, signedIn)).toBeNull()
  })

  it('requires a supplier type card', () => {
    const form = filledAccountForm()
    expect(validateRegistrationStep(1, form, signedIn)).toBe('Select how you are joining TravioGhana')
    form.supplierCardId = 'tour_guide'
    expect(validateRegistrationStep(1, form, signedIn)).toBeNull()
  })

  it('validates the individual profile, operating regions and tax acknowledgement', () => {
    const form = filledAccountForm()
    form.supplierCardId = 'tour_guide'
    form.supplierKind = 'individual'
    expect(validateRegistrationStep(2, form, signedIn)).toBe('First name is required')

    form.individual = {
      ...form.individual,
      firstName: 'Peter',
      lastName: 'Mensah',
      dob: '1990-01-01',
      idType: 'Ghana Card',
      idNumber: 'GHA-123',
      address: 'GA-123-4567',
      region: 'Greater Accra',
      city: 'Accra',
      brandName: 'Peter Tours',
    }
    expect(validateRegistrationStep(2, form, signedIn)).toBe('Select at least one region')
    form.operatingRegions = ['Greater Accra']
    expect(validateRegistrationStep(2, form, signedIn)).toBeNull()

    // Business variant requires the tax acknowledgement.
    const business = filledAccountForm()
    business.supplierCardId = 'registered_company'
    business.supplierKind = 'business'
    business.business = { ...business.business, brandName: 'X', yearEstablished: '2023', legalName: 'X Ltd', regNumber: 'CS-1', address: 'GA-1', region: 'Ashanti', city: 'Kumasi', taxAck: false }
    business.operatingRegions = ['Ashanti']
    expect(validateRegistrationStep(2, business, signedIn)).toBe(
      'Please confirm the tax responsibility acknowledgement',
    )
    business.business.taxAck = true
    expect(validateRegistrationStep(2, business, signedIn)).toBeNull()
  })

  it('requires the primary document and the standards acceptance', () => {
    const form = filledBusinessForm()
    form.primaryDocument = null
    expect(validateRegistrationStep(4, form, signedIn)).toBe('Upload the required document to continue')

    form.primaryDocument = new File(['id'], 'id.png', { type: 'image/png' })
    form.compliance.acceptAll = false
    expect(validateRegistrationStep(6, form, signedIn)).toBe(
      'Please review and accept the supplier standards',
    )
    form.compliance.acceptAll = true
    expect(validateRegistrationStep(6, form, signedIn)).toBeNull()
  })

  it('firstInvalidStep reports the earliest failing step of a complete form', () => {
    const form = filledBusinessForm()
    expect(firstInvalidStep(form, signedIn)).toBeNull()

    form.operatingRegions = []
    expect(firstInvalidStep(form, signedIn)).toBe(2)
  })
})

describe('buildSupplierApplicationFormData', () => {
  it('maps the business card onto the existing /suppliers/apply contract', () => {
    const form = filledBusinessForm()
    const payload = buildSupplierApplicationFormData(form)

    expect(payload.get('supplierType')).toBe('TOUR_COMPANY')

    const businessInfo = JSON.parse(String(payload.get('businessInfo')))
    expect(businessInfo).toMatchObject({
      legalBusinessName: 'Expedition-Go Tours Ltd',
      displayName: 'Expedition-Go Tours',
      businessType: 'company',
      country: 'GH',
      website: 'https://expeditiongotours.com',
      phoneNumber: '+233 24 000 0000',
      supplierCategory: 'registered_company',
      supplierKind: 'business',
      registrationNumber: 'CS-123456',
      taxResponsibilityAcknowledged: true,
    })
    expect(businessInfo.address).toEqual({
      line1: 'GA-123-4567, Osu',
      line2: '',
      city: 'Accra',
      state: 'Greater Accra',
      postalCode: '',
    })

    const operatingInfo = JSON.parse(String(payload.get('operatingInfo')))
    expect(operatingInfo.destinations).toEqual(['Greater Accra'])
    expect(operatingInfo.languages).toEqual(['English'])
    expect(operatingInfo.yearsInBusiness).toBe(new Date().getFullYear() - 2023)
    expect(operatingInfo.services).toEqual(['tours', 'airport_transfers'])
    expect(operatingInfo.tourCategories).toEqual(['Tours & Activities'])

    const payoutInfo = JSON.parse(String(payload.get('payoutInfo')))
    expect(payoutInfo).toMatchObject({ payoutMethod: 'bank', payoutSchedule: 'weekly', primaryPayoutMethod: true })

    const compliance = JSON.parse(String(payload.get('compliance')))
    expect(compliance).toMatchObject({ acceptedTerms: true, agreedToPayoutTerms: true, supplierStandardsAccepted: true })

    expect(String(payload.get('documentMeta'))).toContain('BUSINESS_CERTIFICATE')
    expect(payload.get('documents')).toBeInstanceOf(File)
  })

  it('maps an individual driver and their ID onto representativeInfo', () => {
    const form = createEmptySupplierRegistrationForm()
    form.account = { firstName: 'Ama', lastName: 'Boateng', email: 'ama@example.com', phone: '+233201111111' }
    form.supplierCardId = 'independent_driver'
    form.supplierKind = 'individual'
    form.individual = {
      ...form.individual,
      firstName: 'Ama',
      lastName: 'Boateng',
      dob: '1994-05-05',
      idType: 'Passport',
      idNumber: 'G1234567',
      address: 'GA-999-1111',
      region: 'Greater Accra',
      city: 'Tema',
      brandName: 'Ama Transfers',
    }
    form.operatingRegions = ['Greater Accra']
    form.payout.method = 'momo'
    form.payout.momo = { ...form.payout.momo, accountName: 'Ama Boateng', network: 'MTN Mobile Money', number: '0244000000' }
    form.primaryDocument = new File(['id'], 'passport.png', { type: 'image/png' })

    const payload = buildSupplierApplicationFormData(form)
    expect(payload.get('supplierType')).toBe('VEHICLE_OPERATOR')

    const businessInfo = JSON.parse(String(payload.get('businessInfo')))
    expect(businessInfo).toMatchObject({ legalBusinessName: 'Ama Transfers', businessType: 'individual', displayName: 'Ama Transfers' })

    const representativeInfo = JSON.parse(String(payload.get('representativeInfo')))
    expect(representativeInfo).toMatchObject({
      fullName: 'Ama Boateng',
      email: 'ama@example.com',
      dateOfBirth: '1994-05-05',
      idType: 'passport',
      idNumber: 'G1234567',
    })
    expect(representativeInfo.address.state).toBe('Greater Accra')

    const payoutInfo = JSON.parse(String(payload.get('payoutInfo')))
    expect(payoutInfo).toMatchObject({ payoutMethod: 'momo', momoNetwork: 'MTN Mobile Money', payoutCurrency: 'GHS' })

    expect(String(payload.get('documentMeta'))).toContain('GHANA_CARD')
  })
})
