import { describe, expect, it } from 'vitest'
import {
  extractSupplierSocials,
  formatSupplierAddress,
  mapSupplierProfile,
  normaliseOperatingHours,
  type RawSupplierTour,
} from './supplierProfile'

/**
 * Fixtures mirror the live API, not the registration wizard: businessInfo.phone
 * (not phoneNumber), businessInfo.address as a plain string, no operatingInfo /
 * representativeInfo blocks, country as an ISO code, averageRating as a string.
 */
const liveBusinessInfo = {
  city: 'Accra',
  phone: '+233501234567',
  taxId: 'TAX-EG-2024-001',
  registrationNumber: 'EG-2024-001',
  address: 'Nmai Dzorn Adjiringano Rd, Accra, Ghana',
  country: 'GH',
  website: 'https://expeditiongotours.com',
  legalBusinessName: 'Expedition-Go Tours LTD',
  businessType: 'Tour Operator',
  description:
    'Expedition-Go Tours Ltd delivers premium travel experiences across Ghana, showcasing its rich culture, history, and natural beauty.',
  instagram: 'https://instagram.com/expeditiongotours',
  tiktok: 'https://www.tiktok.com/@expeditiongotours',
  youtube: 'https://youtube.com/@ExpeditionGoTravelandToursLTD',
  facebook: '',
  whatsapp: '',
  operatingHours: {
    Monday: [{ startTime: '08:00', endTime: '22:00' }],
    Tuesday: [{ startTime: '08:00', endTime: '22:00' }],
    Wednesday: [{ startTime: '08:00', endTime: '22:00' }],
    Thursday: [{ startTime: '08:00', endTime: '22:00' }],
    Friday: [{ startTime: '08:00', endTime: '22:00' }],
    Saturday: [{ startTime: '08:00', endTime: '22:00' }],
    Sunday: [{ startTime: '08:00', endTime: '22:00' }],
  },
}

const liveTour: RawSupplierTour = {
  id: 'cmt8ij61a00oc646p0sq1d8xq',
  supplierId: 'cmpcxwl3k0000caylg0jcp879',
  city: 'Accra',
  averageRating: '4.20',
  supplier: {
    id: 'cmpcxwl3k0000caylg0jcp879',
    name: 'Expedition-Go Tours LTD',
    photoURL: 'https://lh3.googleusercontent.com/a/avatar=s96-c',
    verified: true,
    supplierType: 'TOUR_COMPANY',
    supplierProfile: {
      averageRating: '4.86',
      totalBookings: 7,
      status: 'ACTIVE',
      supplierType: 'TOUR_COMPANY',
      businessInfo: liveBusinessInfo,
    },
  },
}

describe('mapSupplierProfile — live API shapes', () => {
  it('reads the account page fields the payload actually carries', () => {
    const profile = mapSupplierProfile({ tour: liveTour })

    expect(profile.supplierId).toBe('cmpcxwl3k0000caylg0jcp879')
    expect(profile.name).toBe('Expedition-Go Tours LTD')
    expect(profile.description).toBe(liveBusinessInfo.description)
    expect(profile.phone).toBe('+233501234567')
    expect(profile.website).toBe('https://expeditiongotours.com')
    expect(profile.address).toBe('Nmai Dzorn Adjiringano Rd, Accra, Ghana')
    expect(profile.operatingHours).toBe('Every day 08:00–22:00')
    expect(profile.businessType).toBe('Tour Operator')
    expect(profile.city).toBe('Accra')
    expect(profile.country).toBe('Ghana')
    expect(profile.verified).toBe(true)
    expect(profile.supplierType).toBe('TOUR_COMPANY')
    expect(profile.socials.map((s) => s.label)).toEqual(['Instagram', 'TikTok', 'YouTube'])
  })

  it('parses the string averageRating and never substitutes a tour rating', () => {
    expect(mapSupplierProfile({ tour: liveTour }).rating).toBe(4.86)

    const unrated: RawSupplierTour = {
      ...liveTour,
      supplier: {
        ...liveTour.supplier!,
        supplierProfile: { ...liveTour.supplier!.supplierProfile, averageRating: null },
      },
    }
    // The tour itself is rated 4.20 — the supplier is not, so the profile must
    // not borrow it (that leaked one tour's score onto the supplier page).
    expect(mapSupplierProfile({ tour: unrated }).rating).toBeNull()
  })

  it('never reports bookings as a tour count', () => {
    expect(mapSupplierProfile({ tour: liveTour }).toursCount).toBe(0)
  })

  it('omits legalName when it matches the trading name, keeps it when it differs', () => {
    expect(mapSupplierProfile({ tour: liveTour }).legalName).toBeNull()

    const renamed: RawSupplierTour = {
      ...liveTour,
      supplier: { ...liveTour.supplier!, name: 'Travio Ghana' },
    }
    expect(mapSupplierProfile({ tour: renamed }).legalName).toBe('Expedition-Go Tours LTD')
  })

  it('falls back to a synthesised sentence only when the supplier wrote no description', () => {
    const silent: RawSupplierTour = {
      ...liveTour,
      supplier: {
        ...liveTour.supplier!,
        supplierProfile: {
          ...liveTour.supplier!.supplierProfile,
          businessInfo: { ...liveBusinessInfo, description: '' },
        },
      },
    }
    expect(mapSupplierProfile({ tour: silent }).description).toBe(
      'Expedition-Go Tours LTD offers guided experiences.',
    )
  })

  it('works for the tour-detail card too, which passes the supplier block alone', () => {
    const profile = mapSupplierProfile({ supplier: liveTour.supplier })
    expect(profile.description).toBe(liveBusinessInfo.description)
    expect(profile.phone).toBe('+233501234567')
    expect(profile.address).toBe('Nmai Dzorn Adjiringano Rd, Accra, Ghana')
  })
})

describe('formatSupplierAddress', () => {
  it('passes the API string through untouched', () => {
    expect(formatSupplierAddress('Nmai Dzorn Adjiringano Rd, Accra, Ghana')).toBe(
      'Nmai Dzorn Adjiringano Rd, Accra, Ghana',
    )
  })

  it('still formats the registration wizard object form', () => {
    expect(
      formatSupplierAddress({ line1: '12 Oxford St', city: 'Accra', state: 'Greater Accra', postalCode: 'GA-123' }),
    ).toBe('12 Oxford St, Accra, Greater Accra, GA-123')
  })

  it('composes city and country only when there is no address at all', () => {
    expect(formatSupplierAddress(null, { city: 'Achimota', country: 'GH' })).toBe('Achimota, Ghana')
    expect(formatSupplierAddress('', { city: 'Accra', region: '', country: 'GH' })).toBe('Accra, Ghana')
    expect(formatSupplierAddress(null, {})).toBeNull()
  })
})

describe('normaliseOperatingHours', () => {
  it('collapses seven identical days', () => {
    expect(normaliseOperatingHours(liveBusinessInfo.operatingHours)).toBe('Every day 08:00–22:00')
  })

  it('groups consecutive days with matching hours', () => {
    const hours = {
      Monday: [{ startTime: '08:00', endTime: '18:00' }],
      Tuesday: [{ startTime: '08:00', endTime: '18:00' }],
      Wednesday: [{ startTime: '08:00', endTime: '18:00' }],
      Thursday: [{ startTime: '08:00', endTime: '18:00' }],
      Friday: [{ startTime: '08:00', endTime: '18:00' }],
      Saturday: [{ startTime: '09:00', endTime: '13:00' }],
    }
    expect(normaliseOperatingHours(hours)).toBe('Mon–Fri 08:00–18:00; Sat 09:00–13:00')
  })

  it('keeps split windows on one day', () => {
    const hours = {
      Monday: [
        { startTime: '08:00', endTime: '12:00' },
        { startTime: '14:00', endTime: '18:00' },
      ],
    }
    expect(normaliseOperatingHours(hours)).toBe('Mon 08:00–12:00, 14:00–18:00')
  })

  it('returns null for missing or malformed data instead of inventing hours', () => {
    expect(normaliseOperatingHours(null)).toBeNull()
    expect(normaliseOperatingHours(undefined)).toBeNull()
    expect(normaliseOperatingHours({})).toBeNull()
    expect(normaliseOperatingHours({ Monday: [] })).toBeNull()
    expect(normaliseOperatingHours('Mon–Fri 8–5')).toBe('Mon–Fri 8–5')
  })
})

describe('extractSupplierSocials', () => {
  it('keeps only filled networks and leaves full URLs alone', () => {
    const links = extractSupplierSocials(liveBusinessInfo)
    expect(links).toEqual([
      { network: 'instagram', label: 'Instagram', url: 'https://instagram.com/expeditiongotours' },
      { network: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@expeditiongotours' },
      { network: 'youtube', label: 'YouTube', url: 'https://youtube.com/@ExpeditionGoTravelandToursLTD' },
    ])
  })

  it('accepts bare handles and bare WhatsApp numbers', () => {
    const links = extractSupplierSocials({
      instagram: 'expeditiongotours',
      whatsapp: '+233 50 123 4567',
      facebook: '   ',
    })
    expect(links).toEqual([
      { network: 'instagram', label: 'Instagram', url: 'https://expeditiongotours' },
      { network: 'whatsapp', label: 'WhatsApp', url: 'https://wa.me/233501234567' },
    ])
  })

  it('returns an empty list when nothing is set', () => {
    expect(extractSupplierSocials(null)).toEqual([])
    expect(extractSupplierSocials({})).toEqual([])
  })
})
