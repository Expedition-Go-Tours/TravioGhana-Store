"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'
import type { DayAvailability } from '../../lib/tourAvailability'

const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

const DropdownArrowIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

// "Today" never changes during the calendar's lifetime.
const TODAY = new Date();

type DayAvailabilityStatus = DayAvailability

interface CalendarPickerProps {
  isOpen: boolean
  onClose: () => void
  onDateSelect: (date: Date) => void
  selectedDate?: Date | null
  /** Optional per-date availability lookup. When omitted, all future dates are treated as available. */
  getAvailability?: (date: Date) => DayAvailabilityStatus
  /** Optional remaining/capacity counts for a date (shown under the day number on available/limited days). */
  getDayCounts?: (date: Date) => {
    remaining: number | null
    capacity: number | null
    capacityUnit?: 'people' | 'groups'
  } | null
  /** When true and a day has no data yet, render a subtle pulse instead of a misleading "available" fallback. */
  loading?: boolean
  /** Fired whenever the user navigates to a different month (used to refetch availability for that window). */
  onMonthChange?: (year: number, month: number) => void
  /**
   * When true, every device uses the inspect-then-select flow (tap a day to see
   * availability / slot counts + a "Select this date" confirm button) instead of
   * selecting on the first click. Touch devices already behave this way.
   */
  requireConfirmation?: boolean
  /**
   * Extra content rendered inside the panel (below the availability legend).
   * Used to surface per-day time slots / opening hours for the chosen date
   * without leaving the calendar area.
   */
  footer?: ReactNode
  /**
   * When set and returns true for a date, selecting that date keeps the panel
   * open (after onDateSelect fires) so the parent can render `footer` content
   * for it. Omit (or return false) to keep the default close-on-select.
   */
  getKeepOpenOnSelect?: (date: Date) => boolean
}

export const CalendarPicker = ({ isOpen, onClose, onDateSelect, selectedDate, getAvailability, getDayCounts, loading, onMonthChange, requireConfirmation = false, footer, getKeepOpenOnSelect }: CalendarPickerProps) => {
  const defaultDate = selectedDate || TODAY
  const [currentYear, setCurrentYear] = useState(defaultDate.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(defaultDate.getMonth())
  const [selectedDay, setSelectedDay] = useState(defaultDate.getDate())
  const [showDropdown, setShowDropdown] = useState(false)
  const [direction, setDirection] = useState(0)
  const calendarRef = useRef<HTMLDivElement>(null)
  // Touch/coarse-pointer devices have no hover, so taps drive an
  // "inspect first, tap again to select" flow (see handleDayPress).
  const [isTouch] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(hover: none), (pointer: coarse)').matches
  })
  // The inspect-then-select flow applies on touch by default and on any device
  // when requireConfirmation is set (e.g. the booking widget on desktop).
  const confirmBeforeSelect = isTouch || requireConfirmation
  const [inspectDay, setInspectDay] = useState<number | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Clear any open tap-to-inspect banner whenever the calendar (re)opens.
  // React-recommended "adjust state during render" pattern, guarded so it only
  // runs on the isOpen transition.
  const [prevOpen, setPrevOpen] = useState(isOpen)
  if (isOpen && prevOpen !== isOpen) {
    setPrevOpen(isOpen)
    setInspectDay(null)
  }

  const getDayDetails = useCallback((day: number) => {
    const date = new Date(currentYear, currentMonth, day)
    const startOfDay = new Date(currentYear, currentMonth, day).getTime()
    const todayStart = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate()).getTime()
    const isPast = startOfDay < todayStart
    const isToday = !isPast && date.toDateString() === TODAY.toDateString()
    const availability: DayAvailabilityStatus = isPast ? 'past' : (getAvailability ? getAvailability(date) : 'available')
    const counts = getDayCounts ? getDayCounts(date) : null
    // The backend's aggregated status can lag real bookings (a partially
    // sold-out date may still read "available"). Derive the display status
    // from the actual remaining counts so dates with limited spots render
    // amber and sold-out days red, instead of green.
    const displayAvailability: DayAvailabilityStatus =
      availability !== 'available'
        ? availability
        : counts != null && counts.remaining != null && counts.capacity != null && counts.capacity > 0
          ? counts.remaining <= 0
            ? 'full'
            : counts.remaining < counts.capacity
              ? 'limited'
              : 'available'
          : 'available'
    const hasCounts = !isPast && counts != null && counts.remaining != null && counts.capacity != null && counts.remaining > 0 && (displayAvailability === 'available' || displayAvailability === 'limited')
    const countUnit = counts?.capacityUnit === 'groups' ? 'groups' : 'spots'
    const isFull = !isPast && displayAvailability === 'full'
    const isBlocked = !isPast && displayAvailability === 'blocked'
    const isSelected = day === selectedDay && !isPast
    const isPending = loading && counts == null && !isPast
    const selectable = !isPast && !isPending && (displayAvailability === 'available' || displayAvailability === 'limited')
    const title = displayAvailability === 'limited'
      ? `Limited availability${hasCounts ? ` · ${counts?.remaining} of ${counts?.capacity} ${countUnit} available` : ''}`
      : hasCounts
        ? `${counts?.remaining} of ${counts?.capacity} ${countUnit} available`
        : displayAvailability === 'full'
          ? 'Sold out'
          : displayAvailability === 'blocked'
            ? 'Not available'
            : 'Available'
    const dotClass = !isPast && !isPending
      ? displayAvailability === 'limited'
        ? 'bg-amber-400'
        : displayAvailability === 'full'
          ? 'bg-red-400'
          : displayAvailability === 'blocked'
            ? 'bg-slate-300'
            : 'bg-[#179237]'
      : null
    return { date, isPast, isToday, isFull, isBlocked, isSelected, isPending, selectable, displayAvailability, hasCounts, title, dotClass }
  }, [currentYear, currentMonth, selectedDay, getAvailability, getDayCounts, loading])

  if (!isOpen) return null

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth)

  const prevMonth = () => {
    setDirection(-1)
    const y = currentMonth === 0 ? currentYear - 1 : currentYear
    const m = currentMonth === 0 ? 11 : currentMonth - 1
    setCurrentMonth(m)
    setCurrentYear(y)
    setInspectDay(null)
    onMonthChange?.(y, m)
  }

  const nextMonth = () => {
    setDirection(1)
    const y = currentMonth === 11 ? currentYear + 1 : currentYear
    const m = currentMonth === 11 ? 0 : currentMonth + 1
    setCurrentMonth(m)
    setCurrentYear(y)
    setInspectDay(null)
    onMonthChange?.(y, m)
  }

  const handleSelectDay = (day: number) => {
    // Hard guard: sold-out / closed / past dates can never be selected.
    const meta = getDayDetails(day)
    if (!meta.selectable) return
    setSelectedDay(day)
    setInspectDay(null)
    const date = new Date(currentYear, currentMonth, day)
    onDateSelect(date)
    // When the parent wants to render per-date content (e.g. time slots) for
    // the just-selected date, keep the panel open until that flow completes.
    if (!getKeepOpenOnSelect?.(date)) {
      onClose()
    }
  }

  // Default: one tap selects. With confirmation required (touch by default,
  // or requireConfirmation set), the first tap reveals the availability info
  // (mirroring the hover tooltip) plus a "Select this date" button, and a
  // second tap on the same date — or that button — selects.
  const handleDayPress = (day: number, meta: ReturnType<typeof getDayDetails>) => {
    if (!meta.selectable) {
      // Sold-out / closed dates show their reason on tap but never select.
      if (confirmBeforeSelect && (meta.isFull || meta.isBlocked)) setInspectDay(day)
      return
    }
    if (!confirmBeforeSelect) {
      handleSelectDay(day)
      return
    }
    if (inspectDay === day) {
      handleSelectDay(day)
    } else {
      setInspectDay(day)
    }
  }

  const renderDays = () => {
    const days = []
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`empty-${i}`} className="w-9 h-9" />)
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const meta = getDayDetails(day)

      if (meta.isPast) {
        days.push(
          <div
            key={`day-${day}`}
            data-status="past"
            className="w-9 h-9 text-[14px] font-medium rounded-full flex items-center justify-center text-gray-300 cursor-not-allowed"
          >
            {day}
          </div>
        )
      } else if (meta.isPending) {
        days.push(
          <div
            key={`day-${day}`}
            data-status="pending"
            title="Checking availability…"
            aria-disabled="true"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 animate-pulse cursor-default"
          >
            <span className="text-[14px] font-medium text-slate-300">{day}</span>
          </div>
        )
      } else if (meta.isFull) {
        // Sold out — soft red pill, NOT selectable. On touch, tapping only
        // reveals the reason banner (see handleDayPress); never selects.
        days.push(
          <div
            key={`day-${day}`}
            data-status="full"
            title="Sold out"
            aria-disabled="true"
            onClick={() => handleDayPress(day, meta)}
            className={`relative w-9 h-9 text-[14px] font-medium rounded-full flex items-center justify-center cursor-not-allowed ${
              meta.isSelected
                ? 'bg-gradient-to-b from-[#ef4444] to-[#dc2626] text-white font-semibold shadow-[0_4px_10px_-2px_rgba(239,68,68,0.5)] scale-105 z-10'
                : 'bg-red-50 text-red-400 line-through'
            }`}
          >
            {day}
            {!meta.isSelected && (
              <span className="absolute bottom-[1px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full bg-red-400" />
            )}
          </div>
        )
      } else if (meta.isBlocked) {
        // Closed/blocked by the supplier — muted, NOT selectable.
        days.push(
          <div
            key={`day-${day}`}
            data-status="blocked"
            title="Not available"
            aria-disabled="true"
            onClick={() => handleDayPress(day, meta)}
            className="relative w-9 h-9 text-[14px] font-medium rounded-full flex items-center justify-center bg-slate-50 text-slate-300 cursor-not-allowed"
          >
            {day}
            {!meta.isSelected && (
              <span className="absolute bottom-[1px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full bg-red-400" />
            )}
          </div>
        )
      } else {
        days.push(
          <button
            key={`day-${day}`}
            data-status={meta.displayAvailability}
            onClick={() => handleDayPress(day, meta)}
            title={meta.title}
            className={`relative w-9 h-9 text-[14px] font-medium rounded-full flex items-center justify-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#179237]/40 active:scale-95 ${
              meta.isSelected
                ? meta.displayAvailability === 'limited'
                  ? 'bg-gradient-to-b from-[#f59e0b] to-[#d97706] text-white font-semibold shadow-[0_4px_10px_-2px_rgba(245,158,11,0.5)] scale-105 z-10'
                  : 'bg-gradient-to-b from-[#1a9e3d] to-[#147a2e] text-white font-semibold shadow-[0_4px_10px_-2px_rgba(23,146,55,0.5)] scale-105 z-10'
                : meta.displayAvailability === 'limited'
                  ? 'text-black hover:bg-amber-400/10'
                  : 'text-black hover:bg-[#179237]/10'
            } ${meta.isToday && !meta.isSelected ? 'ring-1 ring-inset ring-[#179237]/50 font-semibold' : ''}`}
          >
            {day}
            {!meta.isSelected && meta.dotClass && (
              <span
                className={`absolute bottom-[1px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full pointer-events-none ${meta.dotClass}`}
              />
            )}
          </button>
        )
      }
    }
    return days
  }

  return (
    <div ref={calendarRef} className="absolute top-full left-0 z-50 mt-1.5 w-full bg-white border border-black/[0.06] rounded-[20px] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18)] overflow-hidden p-5 animate-in fade-in zoom-in duration-200 origin-top">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-1.5 text-[16px] font-semibold text-gray-900 hover:opacity-70 transition-opacity focus:outline-none"
        >
          <span>{MONTH_NAMES[currentMonth]} {currentYear}</span>
          <div className={`text-gray-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : 'rotate-0'}`}>
            <DropdownArrowIcon />
          </div>
        </button>

        <div className="flex items-center gap-1.5">
          <button onClick={prevMonth} className="p-1.5 text-gray-500 hover:text-[#179237] hover:bg-[#179237]/8 rounded-full transition-colors focus:outline-none">
            <ChevronLeftIcon />
          </button>
          <button onClick={nextMonth} className="p-1.5 text-gray-500 hover:text-[#179237] hover:bg-[#179237]/8 rounded-full transition-colors focus:outline-none">
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-y-1 mb-1 text-center">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-[10px] font-bold text-gray-400 tracking-wider">
            {day.slice(0, 1)}{day.slice(1).toLowerCase()}
          </div>
        ))}
      </div>

      {/* Days Grid + Month/Year Dropdown */}
      <div className="relative h-[264px] mb-4">
        <div className="absolute w-full z-10">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`${currentYear}-${currentMonth}`}
              custom={direction}
              variants={{
                enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-7 gap-y-1 justify-items-center pb-8"
            >
              {renderDays()}
            </motion.div>
          </AnimatePresence>
        </div>

        {showDropdown && (
          <div className="absolute inset-0 z-30 flex flex-col p-3 rounded-[16px] bg-white/98 backdrop-blur-md transition-all duration-200">
            <div className="flex items-center justify-between mb-3 border-b pb-2.5 border-black/5">
              <button onClick={() => { setCurrentYear(y => y - 1); setInspectDay(null) }} className="p-1.5 text-gray-500 hover:text-[#179237] hover:bg-[#179237]/8 rounded-full transition-colors">
                <ChevronLeftIcon />
              </button>
              <span className="font-bold text-[16px] text-gray-900">{currentYear}</span>
              <button onClick={() => { setCurrentYear(y => y + 1); setInspectDay(null) }} className="p-1.5 text-gray-500 hover:text-[#179237] hover:bg-[#179237]/8 rounded-full transition-colors">
                <ChevronRightIcon />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 flex-1 overflow-y-auto">
              {MONTH_NAMES.map((m, idx) => {
                const isSelected = idx === currentMonth
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setCurrentMonth(idx)
                      setShowDropdown(false)
                      setInspectDay(null)
                      onMonthChange?.(currentYear, idx)
                    }}
                    className={`py-2 rounded-[10px] text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-[#179237] text-white shadow-sm'
                        : 'text-gray-700 hover:bg-[#179237]/8'
                    }`}
                  >
                    {m.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Per-date content (e.g. time slots / opening hours) for the selected
          day — rendered on the next line right under the date grid. */}
      {footer && (
        <div className="mt-4 border-t border-black/[0.06] pt-4">{footer}</div>
      )}

      {/* Inspect banner — mirrors the desktop hover tooltip for dates (coarse
          pointers have no hover) and doubles as the confirm step on devices /
          pickers that require confirmation before a date is selected. */}
      {confirmBeforeSelect && inspectDay != null && (() => {
        const meta = getDayDetails(inspectDay)
        if (!meta || meta.isPast || meta.isPending) return null
        return (
          <div className="mt-3 flex items-start justify-between gap-3 rounded-[12px] border border-black/[0.06] bg-slate-50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-gray-900">
                {meta.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
              <p className="text-[12px] text-gray-600">{meta.title}</p>
            </div>
            {meta.selectable && (
              <button
                type="button"
                onClick={() => handleSelectDay(inspectDay)}
                className="shrink-0 self-center rounded-lg bg-[#179237] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#147a2e] active:scale-95"
              >
                Select this date
              </button>
            )}
          </div>
        )
      })()}

      {/* Availability legend (single horizontal row — never wraps) */}
      {getAvailability && (
        <div className="flex items-center justify-center gap-x-3 pt-3.5 text-[11px] font-medium text-gray-500 whitespace-nowrap overflow-hidden">
          <span className="flex items-center gap-1.5">
            <span className="w-[7px] h-[7px] rounded-full bg-[#179237] shadow-[0_0_0_2px_rgba(23,146,55,0.15)]" /> Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-[7px] h-[7px] rounded-full bg-amber-400 shadow-[0_0_0_2px_rgba(251,191,36,0.18)]" /> Limited
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-[7px] h-[7px] rounded-full bg-red-400 shadow-[0_0_0_2px_rgba(248,113,113,0.18)]" /> Sold Out
          </span>
        </div>
      )}

    </div>
  )
}
