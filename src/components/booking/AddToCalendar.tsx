import { Calendar } from 'lucide-react'
import './AddToCalendar.css'

interface AddToCalendarProps {
  title: string
  date?: string
  time?: string | null
  location?: string
  description?: string
}

function buildGoogleCalendarUrl({ title, date, time, location, description }: AddToCalendarProps): string {
  if (!date) return '#'
  const start = new Date(date)
  if (time) {
    const [h, m] = time.split(':').map(Number)
    if (!isNaN(h)) start.setHours(h, m || 0, 0, 0)
  }
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000)
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Travio Ghana booking',
    dates: `${fmt(start)}/${fmt(end)}`,
    location: location || '',
    details: description || `Your booking for ${title}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export default function AddToCalendar(props: AddToCalendarProps) {
  const url = buildGoogleCalendarUrl(props)
  if (!props.date) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="add-to-calendar-btn"
    >
      <Calendar size={16} />
      Add to calendar
    </a>
  )
}
