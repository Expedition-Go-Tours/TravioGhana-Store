import { describe, it, expect } from 'vitest'
import { partyFromTravelers, partyLabel } from './bookingUi'

describe('partyFromTravelers', () => {
  it('counts every numeric category and ignores contact metadata', () => {
    const party = partyFromTravelers({
      adults: 1,
      seniors: 2,
      students: 1,
      phoneNumber: '233201234567',
      location: 'Accra',
      details: [{ name: 'Ama', ageGroup: 'adult' }],
    })

    expect(party).toMatchObject({ adults: 1, seniors: 2, total: 4 })
    expect(party.counts).toEqual({ adults: 1, seniors: 2, students: 1 })
  })

  it('uses named details only when the booking has no counts', () => {
    const party = partyFromTravelers({
      details: [{ ageGroup: 'adult' }, { ageGroup: 'senior' }, { ageGroup: 'senior' }],
    })

    expect(party.total).toBe(3)
    expect(party.adults).toBe(1)
    expect(party.seniors).toBe(2)
  })

  it('handles malformed payloads', () => {
    expect(partyFromTravelers(null).total).toBe(0)
    expect(partyFromTravelers('travelers').total).toBe(0)
    expect(partyFromTravelers([]).total).toBe(0)
  })
})

describe('partyLabel', () => {
  it('renders all categories in a stable order', () => {
    expect(partyLabel({
      adults: 1,
      children: 0,
      infants: 0,
      seniors: 2,
      counts: { students: 1, adults: 1, seniors: 2 },
      total: 4,
    })).toBe('1 Adult · 2 Seniors · 1 Student')
  })

  it('falls back to the legacy fields when counts are absent', () => {
    expect(partyLabel({ adults: 2, children: 1, infants: 0, total: 3 }))
      .toBe('2 Adults · 1 Child')
  })

  it('renders a generic headcount when there are no category counts', () => {
    expect(partyLabel({ adults: 0, children: 0, infants: 0, total: 3 }))
      .toBe('3 People')
    expect(partyLabel(null)).toBe('')
  })
})
