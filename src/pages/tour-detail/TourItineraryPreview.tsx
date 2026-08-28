import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Bed, UtensilsCrossed, MapPin, Navigation } from 'lucide-react'
import type { ItineraryDay, DayLogisticsMap } from '../../lib/tourTypes'
import type { PickupAreaShape, PickupLocationShape } from '../../lib/pickupZone'
import { formatItineraryDuration, ACCOMMODATION_TYPE_LABELS } from '../../lib/tourTypes'
// Shared black rounded marker/timeline styles (.itinerary-stop-simple-*)
// live in TourItinerary.css, whose only other consumer (TourItinerary.tsx)
// isn't imported anywhere in the page — so those classes were unstyled
// here without this import.
import './TourItinerary.css'
import './TourItineraryPreview.css'

const PREVIEW_COUNT = 3

interface MeetingNodeData {
  meetingMode?: 'meeting_point' | 'pickup' | 'none'
  meetingPoint?: string
  meetingPointAddress?: string
  meetingPointDescription?: string
  arrivalTimeType?: 'none' | '5min' | '10min' | '15min' | '30min' | 'notified' | 'custom'
  arrivalTimeCustom?: string
  pickupType?: 'area' | 'address'
  pickupAreas?: PickupAreaShape[]
  pickupLocations?: PickupLocationShape[]
  pickupDescription?: string
}

interface DropoffNodeData {
  dropoffOption?: 'same_location' | 'different_location' | 'none' | 'service'
  dropoffLocation?: string
  dropoffLocationAddress?: string
  dropoffDescription?: string
}

interface TourItineraryPreviewProps {
  itinerary: ItineraryDay[]
  meeting?: MeetingNodeData
  dropoff?: DropoffNodeData
  accommodationIncluded?: boolean
  meals?: { type: string; format: string }[]
  /** Supplier's per-day logistics — the accommodation type / meals set per day. */
  dayLogistics?: DayLogisticsMap
}

interface TimelineNode {
  title: string
  lines: string[]
  note: string
}

export default function TourItineraryPreview({
  itinerary,
  meeting,
  dropoff,
  accommodationIncluded,
  meals,
  dayLogistics,
}: TourItineraryPreviewProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  if (!itinerary || itinerary.length === 0) {
    return (
      <section className="itinerary-preview">
        <h2 className="overview-section-title">{t('tourDetail.itineraryPreview')}</h2>
        <p className="itinerary-empty">{t('tourDetail.noItinerary')}</p>
      </section>
    )
  }

  // A tour is multi-day when any stop was assigned to a day beyond the first
  // (the supplier assigns stops to day 1..N on the platform).
  const isMultiDay = itinerary.some((stop) => (stop.day || 1) > 1)

  // The meals/logistics strip is only shown when the itinerary itself carries
  // the data (a stop with meals assigned), so supplier toggles on tours whose
  // itinerary has no meal stops don't fabricate a meals pill.
  const itineraryHasMeals = itinerary.some((stop) => Array.isArray(stop.meals) && stop.meals.length > 0)

  // Group stops by day so multi-day tours can render one dot per day (with the
  // day's locations listed beneath) instead of a dot per location.
  const days = (() => {
    const map = new Map<number, ItineraryDay[]>()
    itinerary.forEach((stop) => {
      const d = stop.day || 1
      const arr = map.get(d)
      if (arr) arr.push(stop)
      else map.set(d, [stop])
    })
    return Array.from(map.entries()).map(([day, stops]) => ({ day, stops }))
  })()

  const isLong = isMultiDay ? days.length > PREVIEW_COUNT : itinerary.length > PREVIEW_COUNT
  const previewStops = isMultiDay ? [] : itinerary.slice(0, PREVIEW_COUNT)
  const extraStops = isMultiDay ? [] : itinerary.slice(PREVIEW_COUNT)
  const previewDays = isMultiDay ? days.slice(0, PREVIEW_COUNT) : []
  const extraDays = isMultiDay ? days.slice(PREVIEW_COUNT) : []
  const lastDay = days[days.length - 1]

  const admissionLabel = (stop: ItineraryDay) => {
    switch (stop.admissionIncluded) {
      case 'no':
        return t('tourDetail.admissionPaySeparately')
      case 'passby':
        return t('tourDetail.admissionPassBy')
      case 'yes':
        return t('tourDetail.admissionTicketIncluded')
      default:
        return stop.additionalFee ? undefined : t('tourDetail.admissionTicketIncluded')
    }
  }

  const stopMeta = (stop: ItineraryDay) => {
    const parts = [formatItineraryDuration(stop.duration, stop.durationUnit)]
    if (stop.activityName) {
      parts.push(stop.activityName)
    } else {
      const label = admissionLabel(stop)
      if (label) parts.push(label)
    }
    if (stop.accommodation) {
      parts.push(`${t('tourDetail.accommodationLabel')}: ${stop.accommodation}`)
    }
    if (Array.isArray(stop.meals) && stop.meals.length > 0) {
      parts.push(`${t('tourDetail.mealsLabel')}: ${stop.meals.join(', ')}`)
    }
    return parts.filter(Boolean).join(' \u2022 ')
  }

  const locationLine = (stop: ItineraryDay) => {
    const displayTitle = stop.locationName || stop.title
    return [
      stop.locationCity,
      stop.locationCountry,
      stop.locationAddress && stop.locationAddress !== displayTitle ? stop.locationAddress : undefined,
    ].filter(Boolean).join(', ')
  }

  const arrivalLabel = () => {
    if (meeting?.arrivalTimeType === 'custom') {
      return meeting.arrivalTimeCustom ? t('tourDetail.arriveBy', { time: meeting.arrivalTimeCustom }) : ''
    }
    switch (meeting?.arrivalTimeType) {
      case '5min':
        return t('tourDetail.arriveBefore', { minutes: 5 })
      case '10min':
        return t('tourDetail.arriveBefore', { minutes: 10 })
      case '15min':
        return t('tourDetail.arriveBefore', { minutes: 15 })
      case '30min':
        return t('tourDetail.arriveBefore', { minutes: 30 })
      case 'notified':
        return t('tourDetail.arrivalTimeNotified')
      default:
        return ''
    }
  }

  const start: TimelineNode | null = (() => {
    if (!meeting) return null
    if (meeting.meetingMode === 'pickup') {
      const lines = (meeting.pickupType === 'area'
        ? (meeting.pickupAreas || []).map((a) => a.name || a.address)
        : (meeting.pickupLocations || []).map((l) => l.name || l.address)).filter((x): x is string => Boolean(x))
      return {
        title: meeting.pickupType === 'area' ? t('tourDetail.pickupAreas') : t('tourDetail.pickupLocations'),
        lines,
        note: meeting.pickupDescription || '',
      }
    }
    if (meeting.meetingMode === 'meeting_point') {
      return {
        title: t('tourDetail.meetingPoint'),
        // meetingPoint already carries "name — address", so only show the
        // separate address when it isn't already embedded (no repeated line).
        lines: [
          meeting.meetingPoint,
          meeting.meetingPointAddress && meeting.meetingPointAddress !== meeting.meetingPoint && !meeting.meetingPoint?.includes(meeting.meetingPointAddress)
            ? meeting.meetingPointAddress
            : undefined,
        ].filter((x): x is string => Boolean(x)),
        note: arrivalLabel() || meeting.meetingPointDescription || '',
      }
    }
    return null
  })()

  const end: TimelineNode | null = (() => {
    if (!dropoff) return null
    if (dropoff.dropoffOption === 'same_location') {
      return {
        title: t('tourDetail.endPoint'),
        lines: [meeting?.meetingMode === 'pickup' ? t('tourDetail.returnsToPickupPoint') : t('tourDetail.returnsToMeetingPoint')],
        note: '',
      }
    }
    if (dropoff.dropoffOption === 'different_location') {
      return {
        title: t('tourDetail.dropOffPoint'),
        lines: [
          dropoff.dropoffLocation,
          dropoff.dropoffLocationAddress && dropoff.dropoffLocationAddress !== dropoff.dropoffLocation && !dropoff.dropoffLocation?.includes(dropoff.dropoffLocationAddress)
            ? dropoff.dropoffLocationAddress
            : undefined,
        ].filter((x): x is string => Boolean(x)),
        note: dropoff.dropoffDescription || '',
      }
    }
    return null
  })()

  const renderNode = (node: TimelineNode | null, kind: 'start' | 'end', isLast: boolean) => {
    if (!node) return null
    return (
      <div className="itinerary-stop-simple">
        <div className="itinerary-stop-simple-marker-col">
          <span className={`itinerary-stop-simple-marker itinerary-stop-simple-marker-${kind}`}>
            {kind === 'start' ? <MapPin size={16} strokeWidth={2.4} /> : <Navigation size={16} strokeWidth={2.4} />}
          </span>
          {!isLast && <div className="itinerary-stop-simple-line" />}
        </div>
        <div className="itinerary-stop-simple-content">
          <p className="itinerary-stop-simple-node-title">{node.title}</p>
          {node.lines.length > 0 ? (
            <div className="itinerary-stop-simple-node-lines">
              {node.lines.map((line, i) => (
                <p key={i} className="itinerary-stop-simple-loc">{line}</p>
              ))}
            </div>
          ) : (
            <p className="itinerary-stop-simple-loc itinerary-stop-simple-node-empty">
              {t('tourDetail.pickupNotSet')}
            </p>
          )}
          {node.note && <p className="itinerary-stop-simple-meta">{node.note}</p>}
        </div>
      </div>
    )
  }

  const renderStop = (stop: ItineraryDay, isLast: boolean, label: string) => {
    const displayTitle = stop.locationName || stop.title
    const locLine = locationLine(stop)
    return (
      <div className="itinerary-stop-simple">
        <div className="itinerary-stop-simple-marker-col">
          <span className="itinerary-stop-simple-marker">{label}</span>
          {!isLast && <div className="itinerary-stop-simple-line" />}
        </div>
        <div className="itinerary-stop-simple-content">
          {displayTitle && (
            <h3 className="itinerary-stop-simple-title">{displayTitle}</h3>
          )}
          {locLine && (
            <p className="itinerary-stop-simple-loc">{locLine}</p>
          )}
          {stop.description && (
            <p className="itinerary-stop-simple-desc">{stop.description}</p>
          )}
          {stopMeta(stop) && (
            <p className="itinerary-stop-simple-meta itinerary-stop-simple-meta-pill">{stopMeta(stop)}</p>
          )}
        </div>
      </div>
    )
  }

  // 1-based position of each stop within its own day (day markers are a
  // separate rail node, so every day's stops restart at 1).
  const perDayNumber = (() => {
    const counts: Record<number, number> = {}
    return itinerary.map((stop) => {
      const d = stop.day || 1
      counts[d] = (counts[d] || 0) + 1
      return counts[d]
    })
  })()

  const renderDayNode = (day: number) => {
    return (
      <div className="itinerary-stop-simple">
        <div className="itinerary-stop-simple-marker-col">
          <span className="itinerary-stop-simple-marker">{day}</span>
          <div className="itinerary-stop-simple-line" />
        </div>
        <div className="itinerary-stop-simple-content">
          <p className="itinerary-day-label">{t('tourDetail.itineraryDay', { day })}</p>
        </div>
      </div>
    )
  }

  // Multi-day tours: one dot per day on the rail, with that day's locations
  // listed beneath as a connected sub-timeline (small dot + joining line per
  // stop, so the itinerary reads as one continuous rail).
  const renderDayStops = (stops: ItineraryDay[], day: number) => {
    if (!stops || stops.length === 0) return null
    return (
      <div className="itinerary-day-stops">
        {stops.map((stop, i) => {
          const displayTitle = stop.locationName || stop.title
          const locLine = locationLine(stop)
          const meta = stopMeta(stop)
          // Every stop connects to the next one; only the very last stop of the
          // whole itinerary (with no drop-off node after it) ends the rail.
          const isVeryLast = day === lastDay?.day && i === stops.length - 1 && !end
          return (
            <div key={i} className="itinerary-stop-simple itinerary-day-stop">
              <div className="itinerary-stop-simple-marker-col">
                <span className="itinerary-day-stop-dot" />
                {!isVeryLast && <div className="itinerary-stop-simple-line" />}
              </div>
              <div className="itinerary-stop-simple-content">
                {displayTitle && <p className="itinerary-stop-simple-title">{displayTitle}</p>}
                {locLine && <p className="itinerary-stop-simple-loc">{locLine}</p>}
                {stop.description && <p className="itinerary-stop-simple-desc">{stop.description}</p>}
                {meta && <p className="itinerary-stop-simple-meta itinerary-stop-simple-meta-pill">{meta}</p>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderDay = (dayData: { day: number; stops: ItineraryDay[] }) => (
    <div key={`day-${dayData.day}`}>
      <div className="itinerary-stop-simple">
        <div className="itinerary-stop-simple-marker-col">
          <span className="itinerary-stop-simple-marker">{dayData.day}</span>
          <div className="itinerary-stop-simple-line" />
        </div>
        <div className="itinerary-stop-simple-content">
          <p className="itinerary-day-label">{t('tourDetail.itineraryDay', { day: dayData.day })}</p>
        </div>
      </div>
      {renderDayLogistics(true, dayData.day)}
      {renderDayStops(dayData.stops, dayData.day)}
    </div>
  )

  const renderStopAt = (globalIndex: number) => {
    const stop = itinerary[globalIndex]
    const day = stop.day || 1
    const isFirstOfDay = globalIndex === 0 || (itinerary[globalIndex - 1].day || 1) !== day
    return (
      <div key={globalIndex}>
        {isMultiDay && isFirstOfDay && (
          <>
            {renderDayNode(day)}
            {renderDayLogistics(true, day)}
          </>
        )}
        {renderStop(
          stop,
          globalIndex === itinerary.length - 1 && !end,
          String(isMultiDay ? perDayNumber[globalIndex] : globalIndex + 1),
        )}
      </div>
    )
  }

  const mealsLine = (meals && meals.length > 0
    ? meals.map((m) => [m.type, m.format ? `(${m.format})` : ''].filter(Boolean).join(' ')).join(', ')
    : '')

  // Overnight accommodation + meals rendered together in one logistics strip,
  // mirroring the supplier's itinerary preview (each item is a labeled span).
  // When the supplier set per-day logistics (dayLogistics[day]) those take
  // precedence — the exact accommodation type / meals for that day show
  // instead of the generic fallbacks. Both items are gated on the itinerary
  // actually reflecting them: overnight accommodation only makes sense on a
  // multi-day itinerary, and meals only show when a day/stop carries them.
  const renderDayLogistics = (indented: boolean, day?: number) => {
    const dayEntry = day != null ? dayLogistics?.[day] : undefined
    const showAccommodation = accommodationIncluded && isMultiDay
    const accommodationType = dayEntry?.accommodation
      ? ACCOMMODATION_TYPE_LABELS[dayEntry.accommodation] ?? ''
      : ''
    const dayMeals = (Array.isArray(dayEntry?.meals) ? dayEntry.meals : [])
      .filter((m) => m && (m.type || '').trim())
      .map((m) => [m.type, m.format ? `(${m.format})` : ''].filter(Boolean).join(' '))
      .join(', ')
    const showDayMeals = !!dayMeals
    const showGlobalMeals = !!mealsLine && itineraryHasMeals
    if (!showAccommodation && !showDayMeals && !showGlobalMeals) return null
    return (
      <div className={`itinerary-day-logistics${indented ? ' itinerary-day-logistics-indent' : ''}`}>
        {showAccommodation && (
          <span className="itinerary-day-logistics-item">
            <Bed size={13} strokeWidth={2.4} />
            {accommodationType
              ? t('tourDetail.overnightAccommodation', { type: accommodationType })
              : t('tourDetail.overnightAccommodationIncluded')}
          </span>
        )}
        {(showDayMeals || showGlobalMeals) && (
          <span className="itinerary-day-logistics-item">
            <UtensilsCrossed size={13} strokeWidth={2.4} />
            {t('tourDetail.mealsLabel')}: {showDayMeals ? dayMeals : mealsLine}
          </span>
        )}
      </div>
    )
  }

  return (
    <section className="itinerary-preview">
      <h2 className="overview-section-title">{t('tourDetail.itineraryPreview')}</h2>
      {!isMultiDay && renderDayLogistics(false)}
      <div className="itinerary-preview-body">
        <div className={`itinerary-preview-stops-wrap${isLong && !expanded ? ' has-fade' : ''}`}>
          <div className="itinerary-stops-simple">
            {renderNode(start, 'start', false)}
            {isMultiDay ? (
              <>
                {previewDays.map((dayData) => renderDay(dayData))}
                <AnimatePresence initial={false}>
                  {expanded && extraDays.length > 0 && (
                    <motion.div
                      key="extra-days"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    >
                      {extraDays.map((dayData) => renderDay(dayData))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <>
                {previewStops.map((_, i) => renderStopAt(i))}
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      key="extra"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    >
                      {extraStops.map((_, i) => renderStopAt(PREVIEW_COUNT + i))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
            {renderNode(end, 'end', true)}
          </div>
          {isLong && !expanded && <div className="itinerary-preview-fade" />}
        </div>
        {isLong && (
          <button
            type="button"
            className="itinerary-preview-toggle"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {expanded ? t('tourDetail.seeLess') : t('tourDetail.viewFullItinerary')}
          </button>
        )}
      </div>
    </section>
  )
}
