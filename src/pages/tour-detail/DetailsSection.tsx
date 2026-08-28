import i18n from '../../i18n/config'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import type { PickupAreaShape, PickupLocationShape } from '../../lib/pickupZone'
import './DetailsSection.css'

interface InfoSection {
  key: string
  title: string
  content: React.ReactNode
}

interface DetailsSectionProps {
  sections: InfoSection[]
}

export default function DetailsSection({ sections }: DetailsSectionProps) {
  return (
    <motion.section
      key="details"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="details-section"
    >
      <div className="details-section-list">
        {sections.map((section) => (
          <div key={section.key} className="details-row">
            <h3 className="details-row-heading">{section.title}</h3>
            <div className="details-row-content">
              {section.content}
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  )
}

export function buildIncludedExcludedContent(
  included?: string[],
  excluded?: string[]
): React.ReactNode {
  const inc = included ?? []
  const exc = excluded ?? []
  const items = [
    ...inc.map((item, i) => ({ key: `inc-${i}`, type: 'inc', text: typeof item === 'string' ? item : String(item) })),
    ...exc.map((item, i) => ({ key: `exc-${i}`, type: 'exc', text: typeof item === 'string' ? item : String(item) })),
  ]
  if (items.length === 0) {
    return <p className="details-empty">{i18n.t('tourDetail.detailsNotAvailable')}</p>
  }
  return (
    <ul className="details-list">
      {items.map((entry) => (
        <li key={entry.key} className={`details-list-item ${entry.type === 'inc' ? 'included' : 'excluded'}`}>
          {entry.type === 'inc'
            ? <Check size={18} strokeWidth={2.5} className="details-check-icon" />
            : <X size={18} strokeWidth={2.5} className="details-x-icon" />}
          <span>{entry.text}</span>
        </li>
      ))}
    </ul>
  )
}

function parseNumberedContent(text: string): { preamble: string; items: { num: string; content: string }[] } {
  const lines = text.split('\n')
  const items: { num: string; content: string }[] = []
  const preambleParts: string[] = []
  let inItems = false

  for (const line of lines) {
    const trimmed = line.trim()
    const match = trimmed.match(/^(\d+)\.\s+(.*)/)
    if (match) {
      inItems = true
      items.push({ num: match[1], content: match[2] })
    } else if (inItems) {
      if (items.length > 0) {
        items[items.length - 1].content += '\n' + trimmed
      }
    } else {
      preambleParts.push(trimmed)
    }
  }

  return {
    preamble: preambleParts.join('\n'),
    items,
  }
}

export function buildAboutContent(text: string): React.ReactNode {
  if (!text) {
    return <p className="details-text">{i18n.t('tourDetail.experienceComingSoon')}</p>
  }

  const { preamble, items } = parseNumberedContent(text)

  return (
    <div className="details-about">
      {preamble && <p className="details-text">{preamble}</p>}
      {items.length > 0 && (
        <ul className="details-about-list">
          {items.map((item) => (
            <li key={item.num} className="details-about-item">
              {item.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function buildMeetingContent(
  meetingAddress: string,
  meetingInstructions: string
): React.ReactNode {
  return (
    <div className="details-text">
      {meetingAddress && <p>{i18n.t('tourDetail.meetingPoint')}: {meetingAddress}</p>}
      {meetingInstructions && <p>{meetingInstructions}</p>}
      {!meetingAddress && !meetingInstructions && (
        <p>{i18n.t('tourDetail.pickupConfirmedAfterBooking')}</p>
      )}
    </div>
  )
}

interface MeetingPickupData {
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
  dropoffOption?: 'same_location' | 'different_location' | 'none' | 'service'
  dropoffLocation?: string
  dropoffLocationAddress?: string
  dropoffDescription?: string
}

/** Renders the supplier's meeting-point / pickup / drop-off configuration as
    structured detail content (wired from productContent / bookingAndTickets). */
export function buildMeetingPickupContent(data?: MeetingPickupData): React.ReactNode {
  const meeting = data || {}
  const arrivalLabel = () => {
    if (meeting.arrivalTimeType === 'custom') {
      return meeting.arrivalTimeCustom ? i18n.t('tourDetail.arriveBy', { time: meeting.arrivalTimeCustom }) : ''
    }
    switch (meeting.arrivalTimeType) {
      case '5min': return i18n.t('tourDetail.arriveBefore', { minutes: 5 })
      case '10min': return i18n.t('tourDetail.arriveBefore', { minutes: 10 })
      case '15min': return i18n.t('tourDetail.arriveBefore', { minutes: 15 })
      case '30min': return i18n.t('tourDetail.arriveBefore', { minutes: 30 })
      case 'notified': return i18n.t('tourDetail.arrivalTimeNotified')
      default: return ''
    }
  }

  const hasStart = meeting.meetingMode === 'meeting_point' || meeting.meetingMode === 'pickup'
  const hasEnd = meeting.dropoffOption === 'same_location' || meeting.dropoffOption === 'different_location'

  if (!hasStart && !hasEnd) {
    return <div className="details-text"><p>{i18n.t('tourDetail.pickupConfirmedAfterBooking')}</p></div>
  }

  return (
    <div className="details-text">
      {meeting.meetingMode === 'meeting_point' && (
        <>
          {meeting.meetingPoint && <p><strong>{i18n.t('tourDetail.meetingPoint')}:</strong> {meeting.meetingPoint}</p>}
          {meeting.meetingPointAddress && meeting.meetingPointAddress !== meeting.meetingPoint && (
            <p className="details-mt-1">{meeting.meetingPointAddress}</p>
          )}
          {(arrivalLabel() || meeting.meetingPointDescription) && (
            <p className="details-mt-1">{arrivalLabel() || meeting.meetingPointDescription}</p>
          )}
        </>
      )}

      {meeting.meetingMode === 'pickup' && (
        <>
          {meeting.pickupType === 'area' && Array.isArray(meeting.pickupAreas) && meeting.pickupAreas.length > 0 && (
            <>
              <p><strong>{i18n.t('tourDetail.pickupAreas')}:</strong></p>
              <ul className="details-bullet-list">
                {meeting.pickupAreas.map((a, i) => (
                  <li key={i} className="details-bullet-item">
                    <span>{a.name || a.address}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {meeting.pickupType !== 'area' && Array.isArray(meeting.pickupLocations) && meeting.pickupLocations.length > 0 && (
            <>
              <p><strong>{i18n.t('tourDetail.pickupLocations')}:</strong></p>
              <ul className="details-bullet-list">
                {meeting.pickupLocations.map((l, i) => (
                  <li key={i} className="details-bullet-item">
                    <span>{l.name || l.address}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {meeting.pickupDescription && <p className="details-mt-1">{meeting.pickupDescription}</p>}
        </>
      )}

      {meeting.dropoffOption === 'same_location' && (
        <p className="details-mt-1">
          {meeting.meetingMode === 'pickup' ? i18n.t('tourDetail.returnsToPickupPoint') : i18n.t('tourDetail.returnsToMeetingPoint')}
        </p>
      )}

      {meeting.dropoffOption === 'different_location' && (
        <>
          <p className="details-mt-1"><strong>{i18n.t('tourDetail.dropOffPoint')}:</strong> {meeting.dropoffLocation || i18n.t('tourDetail.detailsNotAvailable')}</p>
          {meeting.dropoffLocationAddress && meeting.dropoffLocationAddress !== meeting.dropoffLocation && (
            <p className="details-mt-1">{meeting.dropoffLocationAddress}</p>
          )}
          {meeting.dropoffDescription && <p className="details-mt-1">{meeting.dropoffDescription}</p>}
        </>
      )}
    </div>
  )
}

export function buildAccessibilityContent(
  accessibilityText: string,
  restrictionsText: string,
  travelerReqsText: string
): React.ReactNode {
  return (
    <div className="details-text">
      {accessibilityText && <p>{accessibilityText}</p>}
      {restrictionsText && <p>{restrictionsText}</p>}
      {travelerReqsText && <p>{travelerReqsText}</p>}
      {!accessibilityText && !restrictionsText && !travelerReqsText && (
        <p>{i18n.t('tourDetail.contactForAccessibility')}</p>
      )}
    </div>
  )
}

export function buildStringListContent(items: string[]): React.ReactNode {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="details-text">{i18n.t('tourDetail.detailsNotAvailable')}</p>
  }
  return (
    <ul className="details-bullet-list">
      {items.map((item, i) => (
        <li key={i} className="details-bullet-item">
          <span>{typeof item === 'string' ? item : String(item)}</span>
        </li>
      ))}
    </ul>
  )
}

export function buildNotSuitableContent(items: string[]): React.ReactNode {
  return buildStringListContent(items)
}

export function buildNotAllowedContent(items: string[]): React.ReactNode {
  return buildStringListContent(items)
}

export function buildKnowBeforeContent(text: string): React.ReactNode {
  if (!text) {
    return <p className="details-text">{i18n.t('tourDetail.detailsNotAvailable')}</p>
  }

  const { preamble, items } = parseNumberedContent(text)

  if (items.length === 0) {
    return <p className="details-text">{text}</p>
  }

  return (
    <div className="details-about">
      {preamble && <p className="details-text">{preamble}</p>}
      <ul className="details-bullet-list">
        {items.map((item) => (
          <li key={item.num} className="details-bullet-item">
            {item.content}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function buildCancellationContent(
  cutoffHours: number | undefined,
  refundRules: string
): React.ReactNode {
  return (
    <div className="details-text">
      {cutoffHours ? (
        <p>
          {i18n.t('tourDetail.cancellationWithHours', { hours: cutoffHours })}
        </p>
      ) : (
        <p>
          {refundRules || i18n.t('tourDetail.cancellationDefault')}
        </p>
      )}
      {refundRules && cutoffHours && <p className="details-mt-1">{refundRules}</p>}
    </div>
  )
}
