import { describe, it, expect } from 'vitest'
import {
  isSupplierOperatingDay,
  resolveDayStatus,
  supplierOperatingDays,
  type TourScheduleInfo,
} from '../tourAvailability'

const date = (iso: string) => new Date(`${iso}T00:00:00`)

describe('supplierOperatingDays', () => {
  it('prefers the explicit daysOfWeek list', () => {
    const schedule: TourScheduleInfo = {
      daysOfWeek: ['Monday', 'Friday'],
      weeklySchedule: {
        Monday: [{ startTime: '08:00', endTime: '17:00' }],
        Friday: [{ startTime: '08:00', endTime: '17:00' }],
      },
    }
    expect(supplierOperatingDays(schedule)).toEqual(['Monday', 'Friday'])
  })

  it('falls back to the weekly-schedule keys that carry hours', () => {
    expect(supplierOperatingDays({ weeklySchedule: { Tuesday: [{ startTime: '08:00', endTime: '17:00' }] } }))
      .toEqual(['Tuesday'])
  })

  it('returns null when neither daysOfWeek nor weekly hours exist (unknown → all days)', () => {
    expect(supplierOperatingDays({})).toBeNull()
    expect(supplierOperatingDays(undefined)).toBeNull()
    expect(supplierOperatingDays({ weeklySchedule: { Monday: [] } })).toBeNull()
  })
})

describe('isSupplierOperatingDay', () => {
  it('treats an empty/unknown schedule as all days operating (backend default)', () => {
    expect(isSupplierOperatingDay({}, date('2026-08-29'))).toBe(true) // Saturday
    expect(isSupplierOperatingDay(undefined, date('2026-08-29'))).toBe(true)
  })

  it('reflects a partial week (Mon–Fri)', () => {
    const monFri: TourScheduleInfo = { daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }
    expect(isSupplierOperatingDay(monFri, date('2026-08-25'))).toBe(true) // Tuesday
    expect(isSupplierOperatingDay(monFri, date('2026-08-29'))).toBe(false) // Saturday
    expect(isSupplierOperatingDay(monFri, date('2026-08-30'))).toBe(false) // Sunday
  })
})

describe('resolveDayStatus', () => {
  const monFri: TourScheduleInfo = { daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }

  it("the API's isOperatingDay=false blocks the day even when the status says available", () => {
    expect(resolveDayStatus({
      schedule: monFri,
      date: date('2026-08-29'),
      apiStatus: 'available',
      apiIsOperatingDay: false,
    })).toBe('blocked')
  })

  it('passes through non-available backend statuses on operating days', () => {
    expect(resolveDayStatus({ schedule: monFri, date: date('2026-08-25'), apiStatus: 'limited', apiIsOperatingDay: true })).toBe('limited')
    expect(resolveDayStatus({ schedule: monFri, date: date('2026-08-25'), apiStatus: 'full', apiIsOperatingDay: true })).toBe('full')
    expect(resolveDayStatus({ schedule: monFri, date: date('2026-08-25'), apiStatus: 'blocked' })).toBe('blocked')
    expect(resolveDayStatus({ schedule: monFri, date: date('2026-08-25'), apiStatus: 'past' })).toBe('past')
  })

  it('blocks an off-day even when the backend status is available', () => {
    expect(resolveDayStatus({ schedule: monFri, date: date('2026-08-29'), apiStatus: 'available', apiIsOperatingDay: true })).toBe('blocked')
  })

  it('returns available for an operating day with an available backend status', () => {
    expect(resolveDayStatus({ schedule: monFri, date: date('2026-08-25'), apiStatus: 'available', apiIsOperatingDay: true })).toBe('available')
  })

  it('resolves map-miss dates from the supplier schedule (no apiStatus at all)', () => {
    expect(resolveDayStatus({ schedule: monFri, date: date('2026-08-25') })).toBe('available')
    expect(resolveDayStatus({ schedule: monFri, date: date('2026-08-29') })).toBe('blocked')
  })

  it('keeps legacy tours (unknown schedule) available when the map has no entry', () => {
    expect(resolveDayStatus({ schedule: {}, date: date('2026-08-29') })).toBe('available')
  })
})
