import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { X, CalendarDays, Users, ShieldCheck, CreditCard, Info, Clock, Minus, Plus } from 'lucide-react'
import { CalendarPicker } from '../ui/apple-calendar-picker'
import { useTourAvailability, useCalculateCheckout } from '../../hooks/useExpeditionBookings'
import { useTravelerSelection } from '../../hooks/useTravelerSelection'
import type { DayTimeSlot } from '../../lib/tourAvailability'
import { openingHoursForDay, resolveDayStatus } from '../../lib/tourAvailability'
import { categoryKey, categoryPayloadKey } from '../../lib/travelerBuckets'
import '../../pages/tour-detail/BookingWidget.css'

interface ChangeBookingTour {
  id?: string
  slug?: string
  title: string
  price: number
  time?: string
  scheduleType?: 'fixedTimeSlot' | 'operatingHours'
  timeSlots?: { startTime: string; endTime?: string }[]
  pricingModel?: 'perPerson' | 'perGroup'
  travelerPricing?: { label: string; price: number; minAge?: number | null; maxAge?: number | null; tiers?: { from: number; to: number; pricePerPerson: number }[] }[]
  groupSizePricing?: { from: number; to: number; price: number }[]
  minParticipants?: number | null
  maxParticipants?: number | null
}

interface ChangeBookingModalProps {
  tour: ChangeBookingTour
  isOpen: boolean
  onClose: () => void
  /** The traveller count already chosen for the booking, used to seed the stepper. */
  initialTravelers?: number
  /** The booking's original date (YYYY-MM-DD), so an unchanged selection prices
   *  the exact date the tour detail page quoted. */
  initialDate?: string
  /** The booking's current time slot (HH:mm), preselected so an unchanged
   *  selection keeps the same slot without re-picking it. */
  initialTime?: string | null
  /** The current per-category breakdown (adults/children/infants), used to build
   *  the exact travellers payload for the authoritative checkout calculation. */
  travelersCount?: Record<string, number>
  onReserve: (updates: { date: string; dateISO: string; time: string; selectedDate: string; selectedTime?: string | null; travelers: string; travelersCount: number; travelersPayload: Record<string, number>; price: number }) => void
}

const formatSlotTime = (time: string): string => {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10))
  if (!Number.isFinite(h)) return time
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m ? `${hour12}:${String(m).padStart(2, '0')} ${period}` : `${hour12} ${period}`
}

const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const currencySymbol = (currency?: string): string => {
  if (currency === 'GHS') return 'GH₵'
  if (currency === 'EUR') return '€'
  if (currency === 'GBP') return '£'
  return '$'
}

export default function ChangeBookingModal({ tour, isOpen, onClose, onReserve, initialTravelers, initialDate, initialTime, travelersCount }: ChangeBookingModalProps) {
  const { t } = useTranslation()
  const [selectedDate, setSelectedDate] = useState(() => {
    if (initialDate) return initialDate
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return toDateKey(d)
  })
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedTime, setSelectedTime] = useState<string | null>(initialTime || null)

  // Authoritative price for the selected date + traveller mix — the same
  // checkout calculation the tour detail page uses. Debounced so rapid
  // stepper/date changes don't trip the endpoint's rate limiter, and backed by
  // a client-side subtotal (mirroring the widget) so a price always shows even
  // when the API is unavailable.
  const calculateCheckout = useCalculateCheckout()
  const [pricing, setPricing] = useState<{ total: number; currency: string } | null>(null)
  const [dateUnavailable, setDateUnavailable] = useState(false)
  const [priceNote, setPriceNote] = useState<string | null>(null)

  // Seed the traveler picker from the current booking's exact per-category mix
  // (or its total headcount for per-group tours) so an unchanged selection
  // keeps the same travelers.
  const origTotal = useMemo(
    () => (travelersCount ? Object.values(travelersCount).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0) : 0),
    [travelersCount]
  )
  const initialCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const pricing = tour.travelerPricing || []
    const groups = pricing.length > 0 ? pricing : [{ label: 'Adult', price: tour.price || 0, minAge: null, maxAge: null }]
    for (const g of groups) {
      counts[categoryKey(g.label)] = travelersCount?.[categoryPayloadKey(g.label)] ?? 0
    }
    return counts
  }, [tour.travelerPricing, tour.price, travelersCount])

  const {
    isPerGroup,
    groupSizeBands,
    travelerGroups,
    totalTravelers,
    travelersPayload,
    bookableBounds,
    mixIssues,
    canIncrementCount,
    canDecrementCount,
    increment,
    decrement,
    clientSubtotal,
    anyTieredPricing,
    formatPrice,
    travelerOptions,
  } = useTravelerSelection(tour, {
    initialCounts,
    initialHeadcount: origTotal || initialTravelers || 1,
  })

  useEffect(() => {
    if (!isOpen || !tour.id) return
    const tourId = tour.id
    let cancelled = false
    const timer = setTimeout(() => {
      calculateCheckout
        .mutateAsync({ tourId, travelDate: selectedDate, travelers: travelersPayload })
        .then((res) => {
          if (cancelled) return
          if (!res.available) {
            setDateUnavailable(true)
            setPricing(null)
            setPriceNote(null)
          } else {
            setDateUnavailable(false)
            setPricing({ total: res.pricing.total, currency: res.pricing.currency })
            setPriceNote(null)
          }
        })
        .catch(() => {
          if (cancelled) return
          setDateUnavailable(false)
          setPricing(null)
          setPriceNote('Showing an estimate — the final price is confirmed at checkout.')
        })
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isOpen, tour.id, selectedDate, travelersPayload, calculateCheckout])

  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const availStart = useMemo(() => {
    const d = new Date(viewMonth.year, viewMonth.month, 1)
    return toDateKey(d)
  }, [viewMonth])
  const availEnd = useMemo(() => {
    const d = new Date(viewMonth.year, viewMonth.month + 1, 0)
    return toDateKey(d)
  }, [viewMonth])
  const { data: availabilityCalendar } = useTourAvailability(
    tour.slug || tour.id,
    isOpen ? availStart : undefined,
    isOpen ? availEnd : undefined
  )

  const availabilityMap = useMemo(() => {
    const map = new Map<string, 'available' | 'limited' | 'full' | 'blocked' | 'past'>()
    if (availabilityCalendar) {
      for (const day of availabilityCalendar) {
        // day.status already incorporates BLOCKED overrides (computeStatus
        // returns BLOCKED for a blocked date) plus the supplier day-limit
        // "limited" derivation in mapDay — never override it with the stored
        // override status, which reads AVAILABLE for a capacity-only override.
        map.set(day.date, day.status)
      }
    }
    return map
  }, [availabilityCalendar])

  const selectedDayInfo = useMemo(() => {
    if (!availabilityCalendar) return undefined
    return availabilityCalendar.find((d) => d.date === selectedDate)
  }, [availabilityCalendar, selectedDate])

  // Time slots for the selected date come from the availability calendar; when
  // the backend returns none (some tours only carry the schedule's static
  // slots), fall back to the supplier's configured time slots so the traveller
  // can still see and pick the actual start times.
  const selectedDaySlots: DayTimeSlot[] = useMemo(() => {
    if (selectedDayInfo?.timeSlots?.length) return selectedDayInfo.timeSlots
    if (tour.scheduleType === 'fixedTimeSlot' && Array.isArray(tour.timeSlots) && tour.timeSlots.length > 0) {
      return tour.timeSlots
        .slice()
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((s) => ({ time: s.startTime, capacity: 0, booked: 0, remaining: null }))
    }
    return []
  }, [selectedDayInfo, tour.scheduleType, tour.timeSlots])

  // Opening-hours tours have no fixed slots, so surface the supplier's Step-14
  // opening hours for the chosen day in the calendar footer instead.
  const openingHoursLabel = tour.scheduleType === 'operatingHours'
    ? openingHoursForDay(tour, new Date(`${selectedDate}T00:00:00`))
    : ''

  const formattedDate = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00`)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }, [selectedDate])

  const total = pricing?.total ?? clientSubtotal
  const displayCurrency = pricing?.currency
  const travelerMixLabel = Object.entries(travelersPayload)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .map(([k, v]) => `${v} ${k.charAt(0).toUpperCase() + k.slice(1)}`)
    .join(', ')

  // Same rules as the tour detail page: a fixed-slot day requires an explicit
  // slot, and an invalid passenger mix can't be reserved.
  const needTime = selectedDaySlots.length > 0 && !selectedTime
  const mixBlocked = !isPerGroup && mixIssues.length > 0
  const reserveBlocked = dateUnavailable || needTime || mixBlocked

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">{tour.title}</h2>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                <CalendarDays className="size-3.5 text-slate-500" />
                {formattedDate}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                <Users className="size-3.5 text-slate-500" />
                {totalTravelers}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="change-booking-body flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-3 rounded-xl bg-slate-50/70 p-4">
            <div className="flex items-start gap-2.5 text-xs text-slate-600">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#179237]" />
              <span>
                <span className="font-semibold text-slate-800 underline underline-offset-2 cursor-pointer">Cancellation policy</span>
                &bull; Free cancellation up to 24 hours before the tour
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-600">
              <CreditCard className="mt-0.5 size-4 shrink-0 text-[#179237]" />
              <span>
                <span className="font-semibold text-slate-800 underline underline-offset-2 cursor-pointer">Reserve now, pay later</span>
                &bull; Book your spot and pay nothing today
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-600">
              <Info className="mt-0.5 size-4 shrink-0 text-[#179237]" />
              <span>
                <span className="font-semibold text-slate-800">Book ahead</span>
                &bull; Reserve now to secure your preferred date and time
              </span>
            </div>
          </div>

          <div className="rounded-xl border-2 border-[#179237] bg-white p-4">
            <h3 className="text-sm font-bold text-slate-900">{tour.title}</h3>
            <p className="mt-1 text-xs text-slate-500">Pickup included</p>
            <div className="mt-3 space-y-1">
              <p className="text-xs text-slate-600">{travelerMixLabel || `${totalTravelers} ${totalTravelers === 1 ? 'Adult' : 'Adults'}`}</p>
              <p className="text-sm font-bold text-slate-900">
                Total {currencySymbol(displayCurrency)}{total.toFixed(2)}
              </p>
              {dateUnavailable && (
                <p className="text-[11px] font-medium text-rose-500">This date is no longer available. Please pick another date.</p>
              )}
              {!dateUnavailable && priceNote && <p className="text-[11px] text-slate-500">{priceNote}</p>}
              {!dateUnavailable && !priceNote && <p className="text-[11px] text-slate-400">Includes all taxes and fees</p>}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Select Date</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCalendar((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#179237] focus:ring-2 focus:ring-[#179237]/15"
              >
                <span>{formattedDate}</span>
                <span className="text-slate-400">{showCalendar ? '▲' : '▼'}</span>
              </button>
              {showCalendar && (
                <div className="absolute top-full left-0 right-0 z-20 mt-2">
                  <CalendarPicker
                    isOpen={showCalendar}
                    onClose={() => setShowCalendar(false)}
                    onDateSelect={(date) => {
                      setSelectedDate(toDateKey(date))
                      setSelectedTime(null)
                    }}
                    selectedDate={selectedDate ? new Date(`${selectedDate}T00:00:00`) : null}
                    getAvailability={(date) => {
                      const key = toDateKey(date)
                      const info = availabilityCalendar?.find((d) => d.date === key)
                      return resolveDayStatus({
                        schedule: tour,
                        date,
                        apiStatus: availabilityMap.get(key),
                        apiIsOperatingDay: info?.isOperatingDay,
                      })
                    }}
                    getDayCounts={(date) => {
                      const day = availabilityCalendar?.find((d) => d.date === toDateKey(date))
                      if (!day) return null
                      return {
                        remaining: day.remaining,
                        capacity: day.capacity,
                        capacityUnit: day.capacityUnit,
                      }
                    }}
                    onMonthChange={(year, month) => setViewMonth({ year, month })}
                    requireConfirmation
                    getKeepOpenOnSelect={(date) => {
                      const key = toDateKey(date)
                      const info = availabilityCalendar?.find((d) => d.date === key)
                      const hasSlots = !!info?.timeSlots?.length
                        || (tour.scheduleType === 'fixedTimeSlot' && !!tour.timeSlots?.length)
                      const hasHours = tour.scheduleType === 'operatingHours' && openingHoursForDay(tour, date) !== ''
                      return hasSlots || hasHours
                    }}
                    footer={
                      selectedDate && (
                        selectedDaySlots.length > 0 ? (
                          <div className="booking-calendar-slots">
                            <div className="booking-label booking-calendar-footer-label">
                              <Clock size={15} />
                              {t('booking.selectTime', 'Select time')}
                            </div>
                            <div className="booking-slot-grid booking-slot-grid-compact">
                              {selectedDaySlots.map((slot) => {
                                const slotFull = slot.remaining != null && slot.remaining <= 0
                                const isSelectedSlot = selectedTime === slot.time
                                return (
                                  <button
                                    key={slot.time}
                                    type="button"
                                    disabled={slotFull}
                                    onClick={() => {
                                      setSelectedTime(slot.time)
                                      setShowCalendar(false)
                                    }}
                                    className={`booking-slot-chip${isSelectedSlot ? ' booking-slot-chip-active' : ''}`}
                                  >
                                    <span className="booking-slot-time">{formatSlotTime(slot.time)}</span>
                                    {slot.remaining != null && (
                                      <span className="booking-slot-cap">
                                        {slotFull
                                          ? t('booking.soldOut', 'Sold out')
                                          : selectedDayInfo?.capacityUnit === 'groups'
                                            ? `${Math.max(0, slot.groupsRemaining ?? 0)} ${t('booking.groupSlots', 'group slots')}`
                                            : `${Math.max(0, slot.remaining)} ${t('booking.spotsLeft', 'spots left')}`}
                                      </span>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                            {selectedDayInfo?.capacityUnit === 'groups' && selectedDayInfo.maxGroupSize != null && (
                              <p className="booking-slot-note">
                                {t('booking.groupBookingsNote', 'Group bookings · up to {{max}} travelers per group', { max: selectedDayInfo.maxGroupSize })}
                              </p>
                            )}
                          </div>
                        ) : openingHoursLabel ? (
                          <div className="booking-calendar-hours">
                            <div className="booking-label booking-calendar-footer-label">
                              <Clock size={15} />
                              {t('booking.openingHours', 'Opening hours')}
                            </div>
                            <p className="booking-slot-note">{openingHoursLabel}</p>
                            <button
                              type="button"
                              className="booking-calendar-done-btn"
                              onClick={() => setShowCalendar(false)}
                            >
                              {t('booking.done', 'Done')}
                            </button>
                          </div>
                        ) : null
                      )
                    }
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Users className="size-4 text-slate-400" />
              {t('booking.travelers')}
            </label>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              {isPerGroup && groupSizeBands.length > 0 && (
                <div className="group-size-bands">
                  {groupSizeBands
                    .slice()
                    .sort((a, b) => a.from - b.from)
                    .map((band, i) => {
                      const isActive = totalTravelers >= band.from && totalTravelers <= band.to
                      const rangeLabel = band.from === band.to
                        ? `${band.from}`
                        : (Number.isFinite(band.to) ? `${band.from}-${band.to}` : `${band.from}+`)
                      return (
                        <div
                          key={i}
                          className={`group-size-band${isActive ? ' group-size-band-active' : ''}`}
                        >
                          <span>{t('booking.groupOf', 'Group of {{range}}', { range: rangeLabel })}</span>
                          <span className="group-size-band-price">{formatPrice(band.price)}</span>
                        </div>
                      )
                    })}
                </div>
              )}
              {anyTieredPricing && (
                <p className="booking-tier-hint">{t('booking.tierPricingHint', 'Per-person prices below depend on your total number of travelers.')}</p>
              )}
              <div>
                {travelerOptions.map((opt) => {
                  const category = travelerGroups.find((g) => categoryKey(g.label) === opt.key)
                  const canDecrement = canDecrementCount(opt.key)
                  const canIncrement = canIncrementCount(opt.key)
                  return (
                    <div key={opt.key} className="guest-type">
                      <div className="guest-type-info">
                        <span className="guest-type-label">{opt.label}</span>
                        <span className="guest-type-desc">{opt.age}</span>
                        {category?.notAllowed && (
                          <span className="guest-type-desc">{t('booking.notAllowed', 'Not permitted on this tour')}</span>
                        )}
                      </div>
                      <div className="guest-type-price">
                        <span className="guest-type-unit">{opt.price}</span>
                        {!isPerGroup && opt.count > 0 && (
                          <span className="guest-type-line">
                            {t('booking.perPersonShort', 'per person')}
                          </span>
                        )}
                      </div>
                      <div className="guest-type-controls">
                        <button
                          className="guest-btn"
                          onClick={() => decrement(opt.key)}
                          disabled={!canDecrement}
                          aria-label={`Remove one ${opt.label}`}
                        >
                          <Minus size={16} />
                        </button>
                        <span className="guest-count">{opt.count}</span>
                        <button
                          className="guest-btn"
                          onClick={() => increment(opt.key)}
                          disabled={!canIncrement}
                          aria-label={`Add one ${opt.label}`}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {bookableBounds.max != null && (
                <p className="booking-slot-note">
                  {t('booking.bookableRange', 'Bookable by {{min}}–{{max}} travelers', { min: bookableBounds.min, max: bookableBounds.max })}
                </p>
              )}
              {bookableBounds.max == null && bookableBounds.min > 1 && (
                <p className="booking-slot-note">
                  {t('booking.minTravelersNote', 'Minimum {{min}} travelers', { min: bookableBounds.min })}
                </p>
              )}
              {mixIssues.length > 0 && (
                <p className="booking-slot-warning">{mixIssues[0].message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4">
          <button
            disabled={reserveBlocked}
            onClick={() => {
              onReserve({
                date: formattedDate,
                dateISO: selectedDate,
                selectedDate,
                time: selectedTime
                  ? formatSlotTime(selectedTime)
                  : (openingHoursLabel ? `Open ${openingHoursLabel}` : (tour.time || 'Flexible')),
                selectedTime: selectedTime || null,
                travelers: `${totalTravelers} ${totalTravelers === 1 ? 'adult' : 'adults'}`,
                travelersCount: totalTravelers,
                travelersPayload,
                price: pricing?.total ?? clientSubtotal,
              })
              onClose()
            }}
            className={`w-full rounded-full py-3.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] ${
              reserveBlocked
                ? 'cursor-not-allowed bg-slate-300'
                : 'bg-[#179237] hover:brightness-110'
            }`}
          >
            {dateUnavailable ? 'Unavailable' : (needTime ? t('booking.selectTimeFirst', 'Please select a time slot') : 'Reserve Now')}
          </button>
          {mixBlocked && (
            <p className="mt-2 text-center text-xs text-rose-500">{mixIssues[0]?.message}</p>
          )}
        </div>
      </motion.div>
    </div>
  )
}
