import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Bed, UtensilsCrossed, MapPin, Navigation } from 'lucide-react'
import type { ItineraryDay, DayLogisticsMap } from '../../lib/tourTypes'
import type { PickupAreaShape, PickupLocationShape } from '../../lib/pickupZone'
import { formatItineraryDuration, ACCOMMODATION_TYPE_LABELS } from '../../lib/tourTypes'
import './TourItinerary.css'

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

interface TourItineraryProps {
  itinerary: ItineraryDay[]
  meeting?: MeetingNodeData
  dropoff?: DropoffNodeData
  accommodationIncluded?: boolean
  meals?: { type: string; format: string }[]
  /** Supplier's per-day logistics — the accommodation type / meals set per day. */
  dayLogistics?: DayLogisticsMap
}

const fadeUp = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] as const },
})

export default function TourItinerary({
  itinerary,
  meeting,
  dropoff,
  accommodationIncluded,
  meals,
  dayLogistics,
}: TourItineraryProps) {
  const { t } = useTranslation()

  if (!itinerary || itinerary.length === 0) {
    return (
      <section className="tour-itinerary-new">
        <h2 className="itinerary-title">{t('tourDetail.itinerary')}</h2>
        <p className="itinerary-empty">{t('tourDetail.noItinerary')}</p>
      </section>
    )
  }

  const isMultiDay = itinerary.some((stop) => (stop.day || 1) > 1)

  // The logistics strip only reflects the itinerary: overnight accommodation
  // requires a multi-day itinerary, and meals only show when a stop carries
  // meal data (so supplier toggles on tours without meal stops are ignored).
  const itineraryHasMeals = itinerary.some((stop) => Array.isArray(stop.meals) && stop.meals.length > 0)

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

  const start: { title: string; lines: string[]; note: string } | null = (() => {
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

  const end: { title: string; lines: string[]; note: string } | null = (() => {
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

  const renderNode = (node: { title: string; lines: string[]; note: string } | null, kind: 'start' | 'end', isLast: boolean) => {
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
    <motion.section
      key="itinerary"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="tour-itinerary-new"
    >
      <h2 className="itinerary-title">{t('tourDetail.itinerary')}</h2>

      {!isMultiDay && renderDayLogistics(false)}

      <div className="itinerary-stops-simple">
        {renderNode(start, 'start', false)}
        {itinerary.map((stop, index) => {
          const isLast = index === itinerary.length - 1 && !end
          const day = stop.day || 1
          const isFirstOfDay = index === 0 || (itinerary[index - 1].day || 1) !== day
          const markerLabel = String(isMultiDay ? perDayNumber[index] : index + 1)
          const displayTitle = stop.locationName || stop.title
          const durationLabel = formatItineraryDuration(stop.duration, stop.durationUnit)
          const locLine = [
            stop.locationCity,
            stop.locationCountry,
            stop.locationAddress && stop.locationAddress !== displayTitle ? stop.locationAddress : undefined,
          ].filter(Boolean).join(', ')

          let admissionLabelValue: string | undefined
          if (stop.activityName) {
            admissionLabelValue = stop.activityName
          } else {
            const label = admissionLabel(stop)
            if (label) admissionLabelValue = label
          }
          const metaParts = [durationLabel, admissionLabelValue]
          if (stop.accommodation) {
            metaParts.push(`${t('tourDetail.accommodationLabel')}: ${stop.accommodation}`)
          }
          if (Array.isArray(stop.meals) && stop.meals.length > 0) {
            metaParts.push(`${t('tourDetail.mealsLabel')}: ${stop.meals.join(', ')}`)
          }

          return (
            <motion.div
              key={index}
              {...fadeUp(index)}
            >
              {isMultiDay && isFirstOfDay && (
                <>
                  <div className="itinerary-stop-simple">
                    <div className="itinerary-stop-simple-marker-col">
                      <span className="itinerary-stop-simple-marker">{day}</span>
                      <div className="itinerary-stop-simple-line" />
                    </div>
                    <div className="itinerary-stop-simple-content">
                      <p className="itinerary-day-label">{t('tourDetail.itineraryDay', { day })}</p>
                    </div>
                  </div>
                  {renderDayLogistics(true, day)}
                </>
              )}
              <div className="itinerary-stop-simple">
                <div className="itinerary-stop-simple-marker-col">
                  <span className="itinerary-stop-simple-marker">{markerLabel}</span>
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
                  {metaParts.length > 0 && (
                    <p className="itinerary-stop-simple-meta itinerary-stop-simple-meta-pill">{metaParts.join(' \u2022 ')}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
        {renderNode(end, 'end', true)}
      </div>
    </motion.section>
  )
}
