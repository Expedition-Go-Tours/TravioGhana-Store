import { useState, type FormEvent } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useUpdateOwnRestaurantVenue } from '../../../hooks/useRestaurantActions'
import {
  dashboardError,
  type DashboardSession,
} from '../../../hooks/useRestaurantDashboard'
import { DashboardPageHeader, InfoNote, SaveBar } from './components'

interface Form {
  description: string
  phone: string
  website: string
  menuUrl: string
  cuisines: string
  dietary: string
  amenities: string
  mealTypes: string
}

function fromSession(session: DashboardSession): Form {
  const d = session.venue.details
  return {
    description: d.description || '',
    phone: d.phone || '',
    website: d.website || '',
    menuUrl: d.menuUrl || '',
    cuisines: d.cuisines.join(', '),
    dietary: d.dietary.join(', '),
    amenities: d.amenities.join(', '),
    mealTypes: d.mealTypes.join(', '),
  }
}

function commaList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function absolute(value: string): string | null {
  const text = value.trim()
  if (!text) return null
  return /^https?:\/\//i.test(text) ? text : `https://${text}`
}

export default function DashboardBusinessInfo() {
  const { slug = '' } = useParams<{ slug: string }>()
  const session = useOutletContext<DashboardSession>()
  const [form, setForm] = useState<Form>(() => fromSession(session))
  const [saved, setSaved] = useState<Form>(() => fromSession(session))
  const update = useUpdateOwnRestaurantVenue(slug)

  const set = (key: keyof Form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const dirty = (Object.keys(form) as Array<keyof Form>).some((key) => form[key] !== saved[key])

  const save = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    update.mutate(
      {
        description: form.description.trim(),
        phone: form.phone.trim(),
        website: absolute(form.website) || undefined,
        menuUrl: absolute(form.menuUrl),
        cuisines: commaList(form.cuisines),
        dietary: commaList(form.dietary).map((item) => item.toLowerCase()),
        amenities: commaList(form.amenities),
        mealTypes: commaList(form.mealTypes).map((item) => item.toLowerCase()),
      },
      {
        onSuccess: () => {
          setSaved(form)
          toast.success('Business information published.')
        },
        onError: (error) => toast.error(dashboardError(error)),
      },
    )
  }

  return (
    <form onSubmit={(event) => void save(event)}>
      <DashboardPageHeader
        eyebrow="Business info"
        title="Business information"
        description="What diners read before they decide to visit. Changes go live as soon as you save."
      />
      <InfoNote>
        Ratings, rank and reviews are not editable here. They belong to diners and the sources that
        produced them.
      </InfoNote>

      <section className="rd-section" aria-labelledby="rd-story-title">
        <div className="rd-section__head">
          <h2 id="rd-story-title">Your story</h2>
          <span>{form.description.length} / 3000</span>
        </div>
        <label className="rd-field">
          Description
          <textarea
            aria-label="Description"
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            maxLength={3000}
            rows={6}
            placeholder="Tell diners what makes this restaurant worth visiting."
          />
          <small>Be concrete about the food, the room and the people.</small>
        </label>
      </section>

      <section className="rd-section" aria-labelledby="rd-contact-title">
        <div className="rd-section__head">
          <h2 id="rd-contact-title">Contact & links</h2>
        </div>
        <div className="rd-field-grid">
          <label className="rd-field">
            Phone
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => set('phone', event.target.value)}
              maxLength={40}
              placeholder="+233 20 000 0000"
            />
          </label>
          <label className="rd-field">
            Website
            <input
              type="url"
              value={form.website}
              onChange={(event) => set('website', event.target.value)}
              maxLength={500}
              placeholder="https://"
            />
          </label>
        </div>
        <label className="rd-field">
          Menu link
          <input
            type="url"
            value={form.menuUrl}
            onChange={(event) => set('menuUrl', event.target.value)}
            maxLength={500}
            placeholder="https://your-restaurant.com/menu"
          />
          <small>
            A fallback for restaurants whose menu lives on their own site. A published structured menu
            takes priority when both are set.
          </small>
        </label>
      </section>

      <section className="rd-section" aria-labelledby="rd-filters-title">
        <div className="rd-section__head">
          <h2 id="rd-filters-title">Food & features</h2>
          <span>Separate values with commas</span>
        </div>
        <div className="rd-field-grid">
          <label className="rd-field">
            Cuisines
            <input value={form.cuisines} onChange={(event) => set('cuisines', event.target.value)} placeholder="Ghanaian, Seafood" />
          </label>
          <label className="rd-field">
            Dietary options
            <input value={form.dietary} onChange={(event) => set('dietary', event.target.value)} placeholder="Vegetarian, Vegan" />
          </label>
          <label className="rd-field">
            Meals served
            <input value={form.mealTypes} onChange={(event) => set('mealTypes', event.target.value)} placeholder="Breakfast, Lunch, Dinner" />
          </label>
          <label className="rd-field">
            Amenities
            <input value={form.amenities} onChange={(event) => set('amenities', event.target.value)} placeholder="Outdoor seating, Wheelchair accessible" />
          </label>
        </div>
      </section>

      <SaveBar dirty={dirty} pending={update.isPending} onSave={() => void save()} />
    </form>
  )
}
