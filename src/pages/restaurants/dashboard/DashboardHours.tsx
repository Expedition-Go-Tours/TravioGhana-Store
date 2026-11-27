import { useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { Clock3 } from 'lucide-react'
import { toast } from 'sonner'
import { useUpdateOwnRestaurantVenue } from '../../../hooks/useRestaurantActions'
import {
  dashboardError,
  useDashboardSession,
  type DashboardSession,
} from '../../../hooks/useRestaurantDashboard'
import {
  DashboardPageHeader,
  ErrorBlock,
  InfoNote,
  LoadingBlock,
  SaveBar,
} from './components'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type Day = (typeof DAYS)[number]

const LABELS: Record<Day, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

interface DayHours {
  open: string
  close: string
  closed: boolean
}

type Week = Record<Day, DayHours>
type Extras = Record<Day, string[][]>

function emptyWeek(): Week {
  return Object.fromEntries(DAYS.map((day) => [day, { open: '', close: '', closed: true }])) as Week
}

function emptyExtras(): Extras {
  return Object.fromEntries(DAYS.map((day) => [day, []])) as unknown as Extras
}

function asTime(value: unknown): string {
  const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})/)
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : ''
}

/**
 * The catalogue stores each day as an array of ranges. This editor handles the
 * first service and preserves any later ones instead of silently dropping them.
 */
function readHours(hours: Record<string, unknown> | null): { week: Week; extras: Extras } {
  const week = emptyWeek()
  const extras = emptyExtras()
  if (!hours) return { week, extras }

  for (const day of DAYS) {
    const aliases = [day, LABELS[day].toLowerCase()]
    for (const alias of aliases) {
      const value = hours[alias]
      if (!value) continue
      const ranges = Array.isArray(value) ? (value as unknown[]) : [value]
      const first = ranges[0]
      let editable: unknown = first
      if (Array.isArray(first)) {
        editable = first[0]
        if (ranges.length > 1) {
          extras[day] = ranges.slice(1).filter(Array.isArray) as string[][]
        }
      } else if (ranges.length > 1) {
        extras[day] = ranges.slice(1).filter(Array.isArray) as string[][]
      }

      let open = ''
      let close = ''
      if (Array.isArray(editable)) {
        open = asTime(editable[0])
        close = asTime(editable[1])
      } else if (editable && typeof editable === 'object') {
        const row = editable as Record<string, unknown>
        open = asTime(row.open)
        close = asTime(row.close)
      } else if (typeof editable === 'string') {
        const parts = editable.split(/\s*(?:-|–|—|to)\s*/i)
        open = asTime(parts[0])
        close = asTime(parts[1])
      }

      if (open && close) week[day] = { open, close, closed: false }
      break
    }
  }

  return { week, extras }
}

function buildHours(week: Week, extras: Extras): Record<string, string[][]> {
  return Object.fromEntries(
    DAYS.map((day) => {
      const row = week[day]
      const ranges: string[][] = []
      if (!row.closed && row.open && row.close) ranges.push([row.open, row.close])
      ranges.push(...extras[day])
      return [day, ranges]
    }),
  )
}

function sameWeek(a: Week, b: Week): boolean {
  return DAYS.every((day) =>
    ['open', 'close', 'closed'].every(
      (key) => a[day][key as keyof DayHours] === b[day][key as keyof DayHours],
    ),
  )
}

function HoursEditor({ session, slug }: { session: DashboardSession; slug: string }) {
  const initial = readHours(session.venue.details.hours)
  const [week, setWeek] = useState<Week>(initial.week)
  // Later services are preserved verbatim; the editor only owns the first one.
  const extras = initial.extras
  const [savedWeek, setSavedWeek] = useState<Week>(initial.week)
  const update = useUpdateOwnRestaurantVenue(slug)

  const setDay = (day: Day, patch: Partial<DayHours>) =>
    setWeek((current) => ({ ...current, [day]: { ...current[day], ...patch } }))

  const dirty = !sameWeek(week, savedWeek)

  const save = () => {
    update.mutate(
      { hours: buildHours(week, extras) },
      {
        onSuccess: () => {
          setSavedWeek(week)
          toast.success('Opening hours published.')
        },
        onError: (error) => toast.error(dashboardError(error)),
      },
    )
  }

  return (
    <>
      <section className="rd-section" aria-labelledby="rd-hours-title">
        <div className="rd-section__head">
          <h2 id="rd-hours-title">Weekly opening hours</h2>
          <span>24-hour clock</span>
        </div>
        <div className="rd-hours">
          {DAYS.map((day) => {
            const row = week[day]
            return (
              <div className="rd-hours__row" key={day}>
                <strong>{LABELS[day]}</strong>
                <input
                  type="time"
                  aria-label={`${LABELS[day]} opening time`}
                  value={row.open}
                  disabled={row.closed}
                  onChange={(event) => setDay(day, { open: event.target.value })}
                />
                <span aria-hidden="true">–</span>
                <input
                  type="time"
                  aria-label={`${LABELS[day]} closing time`}
                  value={row.close}
                  disabled={row.closed}
                  onChange={(event) => setDay(day, { close: event.target.value })}
                />
                <label className="rd-hours__closed">
                  <input
                    type="checkbox"
                    checked={row.closed}
                    onChange={(event) => setDay(day, { closed: event.target.checked })}
                  />
                  Closed
                </label>
                {extras[day].length > 0 && (
                  <small>{extras[day].length} extra service{extras[day].length === 1 ? '' : 's'} kept</small>
                )}
              </div>
            )
          })}
        </div>
        <p className="rd-hours__note">
          <Clock3 size={14} /> Times are shown in {session.venue.timezone || 'Africa/Accra'}. The
          &ldquo;Open now&rdquo; signal on your listing follows these hours.
        </p>
      </section>

      <SaveBar dirty={dirty} pending={update.isPending} onSave={save} note="Hours publish as soon as you save." />
    </>
  )
}

export default function DashboardHours() {
  const { slug = '' } = useParams<{ slug: string }>()
  const context = useOutletContext<DashboardSession>()
  const session = useDashboardSession(slug)
  const current = session.data || context

  return (
    <>
      <DashboardPageHeader
        eyebrow="Hours"
        title="Opening hours"
        description="Keep service times accurate so diners know when they can visit."
      />
      <InfoNote>
        Hours publish immediately. Additional services already recorded for a day are kept when you
        save the first service.
      </InfoNote>
      {session.isPending && !context ? (
        <LoadingBlock label="Loading hours…" />
      ) : session.isError ? (
        <ErrorBlock message={dashboardError(session.error)} onRetry={() => void session.refetch()} />
      ) : (
        <HoursEditor session={current} slug={slug} />
      )}
    </>
  )
}
