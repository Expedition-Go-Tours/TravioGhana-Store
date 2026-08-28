import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CalendarPicker } from './apple-calendar-picker'

// The calendar always opens on the current month, so tests exercise a fixed
// future month (the one after today) where every day is bookable.
const today = new Date()
const openYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear()
const openMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1
const openDate = new Date(openYear, openMonth, 15)

const toKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const dayKey = (day: number) => `${openYear}-${String(openMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

// Day 5: available with counts, day 6: limited, day 7: sold out, day 8: blocked.
const getDayCounts = (date: Date) => {
  const k = toKey(date)
  if (k === dayKey(5)) return { remaining: 5, capacity: 5, capacityUnit: 'people' as const }
  if (k === dayKey(6)) return { remaining: 1, capacity: 5, capacityUnit: 'people' as const }
  if (k === dayKey(7)) return { remaining: 0, capacity: 5, capacityUnit: 'people' as const }
  return null
}
const getAvailability = (date: Date) => (toKey(date) === dayKey(8) ? 'blocked' : 'available')

const originalMatchMedia = window.matchMedia
const stubMatchMedia = (matches: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}
afterEach(() => {
  window.matchMedia = originalMatchMedia
})

const dayCell = (day: number): HTMLElement => {
  const el = screen.getByText(String(day))
  return (el.closest('button') || el.closest('div')) as HTMLElement
}

const renderPicker = (overrides: Partial<Parameters<typeof CalendarPicker>[0]> = {}) => {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onDateSelect: vi.fn(),
    selectedDate: openDate,
    getAvailability,
    getDayCounts,
    ...overrides,
  }
  render(<CalendarPicker {...props} />)
  return props
}

describe('CalendarPicker availability dots', () => {
  it('shows the legend-colored dot under an available date instead of the count text', () => {
    stubMatchMedia(false)
    renderPicker()
    const cell = dayCell(5)
    expect(cell.tagName).toBe('BUTTON')
    expect(cell.getAttribute('data-status')).toBe('available')
    expect(cell.querySelector('span')).toHaveClass('bg-[#179237]')
    expect(screen.queryByText('3/5')).not.toBeInTheDocument()
  })

  it('shows the amber dot under a limited date', () => {
    stubMatchMedia(false)
    renderPicker()
    const cell = dayCell(6)
    expect(cell.getAttribute('data-status')).toBe('limited')
    expect(cell.querySelector('span')).toHaveClass('bg-amber-400')
  })
})

describe('CalendarPicker sold-out / closed hardening', () => {
  it('renders a sold-out date as a non-selectable cell (not a button)', () => {
    stubMatchMedia(false)
    renderPicker()
    const cell = dayCell(7)
    expect(cell.tagName).toBe('DIV')
    expect(cell.getAttribute('aria-disabled')).toBe('true')
    expect(cell.querySelector('span')).toHaveClass('bg-red-400')
  })

  it('never selects a sold-out date on desktop', () => {
    stubMatchMedia(false)
    const { onDateSelect } = renderPicker()
    fireEvent.click(dayCell(7))
    expect(onDateSelect).not.toHaveBeenCalled()
  })

  it('never selects a closed date on desktop', () => {
    stubMatchMedia(false)
    const { onDateSelect } = renderPicker()
    const cell = dayCell(8)
    expect(cell.getAttribute('data-status')).toBe('blocked')
    expect(cell.querySelector('span')).toHaveClass('bg-red-400')
    fireEvent.click(cell)
    expect(onDateSelect).not.toHaveBeenCalled()
  })

  it('shows a "Sold out" banner on touch but still never selects', () => {
    stubMatchMedia(true)
    const { onDateSelect } = renderPicker()
    const cell = dayCell(7)
    fireEvent.click(cell)
    expect(screen.getByText('Sold out')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /select this date/i })).not.toBeInTheDocument()
    expect(onDateSelect).not.toHaveBeenCalled()
    fireEvent.click(cell)
    expect(onDateSelect).not.toHaveBeenCalled()
  })
})

describe('CalendarPicker mobile tap-to-inspect', () => {
  it('first tap inspects (banner + select button), second tap selects', () => {
    stubMatchMedia(true)
    const { onDateSelect, onClose } = renderPicker()
    fireEvent.click(dayCell(5))
    expect(screen.getByText(/5 of 5 spots available/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /select this date/i })).toBeInTheDocument()
    expect(onDateSelect).not.toHaveBeenCalled()
    fireEvent.click(dayCell(5))
    expect(onDateSelect).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('selects the date when "Select this date" is clicked', () => {
    stubMatchMedia(true)
    const { onDateSelect, onClose } = renderPicker()
    fireEvent.click(dayCell(5))
    fireEvent.click(screen.getByRole('button', { name: /select this date/i }))
    expect(onDateSelect).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not show the inspect banner on hover-capable devices', () => {
    stubMatchMedia(false)
    const { onDateSelect } = renderPicker()
    fireEvent.click(dayCell(5))
    expect(screen.queryByRole('button', { name: /select this date/i })).not.toBeInTheDocument()
    expect(onDateSelect).toHaveBeenCalledTimes(1)
  })
})

describe('CalendarPicker requireConfirmation (desktop two-step)', () => {
  it('first click inspects (banner + slot counts + select button), does not select', () => {
    stubMatchMedia(false)
    const { onDateSelect } = renderPicker({ requireConfirmation: true })
    fireEvent.click(dayCell(5))
    expect(screen.getByText(/5 of 5 spots available/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /select this date/i })).toBeInTheDocument()
    expect(onDateSelect).not.toHaveBeenCalled()
  })

  it('selects the date when "Select this date" is clicked', () => {
    stubMatchMedia(false)
    const { onDateSelect, onClose } = renderPicker({ requireConfirmation: true })
    fireEvent.click(dayCell(5))
    fireEvent.click(screen.getByRole('button', { name: /select this date/i }))
    expect(onDateSelect).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('selects on a second click of the same date', () => {
    stubMatchMedia(false)
    const { onDateSelect, onClose } = renderPicker({ requireConfirmation: true })
    fireEvent.click(dayCell(5))
    expect(onDateSelect).not.toHaveBeenCalled()
    fireEvent.click(dayCell(5))
    expect(onDateSelect).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows a "Sold out" banner but never selects', () => {
    stubMatchMedia(false)
    const { onDateSelect } = renderPicker({ requireConfirmation: true })
    const cell = dayCell(7)
    fireEvent.click(cell)
    expect(screen.getByText('Sold out')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /select this date/i })).not.toBeInTheDocument()
    fireEvent.click(cell)
    expect(onDateSelect).not.toHaveBeenCalled()
  })
})

describe('CalendarPicker footer + keep-open', () => {
  it('renders the footer content inside the panel', () => {
    stubMatchMedia(false)
    renderPicker({ footer: <div>Pick a time</div> })
    expect(screen.getByText('Pick a time')).toBeInTheDocument()
  })

  it('keeps the panel open when getKeepOpenOnSelect returns true', () => {
    stubMatchMedia(false)
    const { onDateSelect, onClose } = renderPicker({ getKeepOpenOnSelect: () => true })
    fireEvent.click(dayCell(5))
    expect(onDateSelect).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes the panel when getKeepOpenOnSelect returns false', () => {
    stubMatchMedia(false)
    const { onDateSelect, onClose } = renderPicker({ getKeepOpenOnSelect: () => false })
    fireEvent.click(dayCell(5))
    expect(onDateSelect).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes the panel by default when getKeepOpenOnSelect is omitted', () => {
    stubMatchMedia(false)
    const { onDateSelect, onClose } = renderPicker()
    fireEvent.click(dayCell(5))
    expect(onDateSelect).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
