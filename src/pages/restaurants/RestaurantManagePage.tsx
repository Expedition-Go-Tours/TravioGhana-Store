import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  BadgeCheck,
  ChevronRight,
  Clock3,
  ExternalLink,
  Image,
  LockKeyhole,
  Save,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import { toast } from 'sonner'
import SEO from '../../components/SEO'
import Footer from '../../components/Footer'
import OptimizedImage from '../../components/shared/OptimizedImage'
import { useAuthUser } from '../../hooks/useAuthUser'
import { useAuthContext } from '../../context/AuthContext'
import {
  useRestaurantVenue,
  type RestaurantVenueDetail,
} from '../../hooks/useRestaurantVenues'
import {
  useMyRestaurantVenues,
  useUpdateOwnRestaurantVenue,
  type RestaurantVenueUpdate,
} from '../../hooks/useRestaurantActions'
import { locationText } from './RestaurantPageBits'
import '../RestaurantsPage.css'
import './RestaurantPages.css'
import './RestaurantOwnerPages.css'

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type DayKey = (typeof DAY_KEYS)[number]

const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

const DAY_ALIASES: Record<DayKey, string[]> = {
  mon: ['mon', 'monday'],
  tue: ['tue', 'tuesday'],
  wed: ['wed', 'wednesday'],
  thu: ['thu', 'thursday'],
  fri: ['fri', 'friday'],
  sat: ['sat', 'saturday'],
  sun: ['sun', 'sunday'],
}

interface DayHours {
  open: string
  close: string
  closed: boolean
}

type WeekHours = Record<DayKey, DayHours>

function emptyWeek(): WeekHours {
  return Object.fromEntries(
    DAY_KEYS.map((day) => [day, { open: '', close: '', closed: true }]),
  ) as WeekHours
}

function asTime(value: unknown): string {
  const text = String(value ?? '').trim()
  const match = text.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return ''
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

function parseRange(value: unknown): { open: string; close: string } | null {
  if (Array.isArray(value) && value.length >= 2) {
    const open = asTime(value[0])
    const close = asTime(value[1])
    return open && close ? { open, close } : null
  }
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>
    if (row.open || row.close) {
      return { open: asTime(row.open), close: asTime(row.close) }
    }
    return null
  }
  if (typeof value === 'string') {
    const parts = value.split(/\s*(?:-|–|—|to)\s*/i)
    if (parts.length >= 2) {
      const open = asTime(parts[0])
      const close = asTime(parts[1])
      return open && close ? { open, close } : null
    }
  }
  return null
}

function readHours(hours: Record<string, unknown> | null): WeekHours {
  const week = emptyWeek()
  if (!hours) return week

  for (const day of DAY_KEYS) {
    for (const alias of DAY_ALIASES[day]) {
      if (!(alias in hours)) continue
      const ranges = hours[alias]
      // The catalogue stores a list of ranges; this editor handles the first
      // service and shows the remaining ones as read-only context.
      const first = Array.isArray(ranges) && Array.isArray(ranges[0]) ? ranges[0] : ranges
      const range = parseRange(first)
      if (range && range.open && range.close) {
        week[day] = { ...range, closed: false }
        break
      }
    }
  }

  return week
}

function buildHours(week: WeekHours): Record<string, string[][]> {
  return Object.fromEntries(
    DAY_KEYS.map((day) => {
      const row = week[day]
      const closed = row.closed || !row.open || !row.close
      return [day, closed ? [] : [[row.open, row.close]]]
    }),
  )
}

function commaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function toAbsoluteUrl(value: string): string | null {
  const text = value.trim()
  if (!text) return null
  return /^https?:\/\//i.test(text) ? text : `https://${text}`
}

interface ManageForm {
  description: string
  phone: string
  website: string
  menuUrl: string
  cuisines: string
  dietary: string
  amenities: string
  mealTypes: string
  hours: WeekHours
}

function formFromVenue(venue: RestaurantVenueDetail): ManageForm {
  return {
    description: venue.description ?? '',
    phone: venue.phone ?? '',
    website: venue.website ?? '',
    menuUrl: venue.menuUrl ?? '',
    cuisines: venue.cuisines.join(', '),
    dietary: venue.dietary.join(', '),
    amenities: venue.amenities.join(', '),
    mealTypes: (venue.mealTypes ?? []).join(', '),
    hours: readHours(venue.hours),
  }
}

function buildUpdate(form: ManageForm, original: RestaurantVenueDetail): RestaurantVenueUpdate {
  const update: RestaurantVenueUpdate = {
    description: form.description.trim(),
    cuisines: commaList(form.cuisines),
    dietary: commaList(form.dietary).map((item) => item.toLowerCase()),
    amenities: commaList(form.amenities),
    mealTypes: commaList(form.mealTypes).map((item) => item.toLowerCase()),
    hours: buildHours(form.hours),
  }

  if (form.phone.trim() !== (original.phone ?? '')) update.phone = form.phone.trim()
  if (toAbsoluteUrl(form.website) !== (original.website ?? null)) {
    update.website = toAbsoluteUrl(form.website) ?? undefined
  }
  if (toAbsoluteUrl(form.menuUrl) !== (original.menuUrl ?? null)) {
    update.menuUrl = toAbsoluteUrl(form.menuUrl)
  }

  return update
}

function VenueManager({ venue }: { venue: RestaurantVenueDetail }) {
  const [form, setForm] = useState<ManageForm>(() => formFromVenue(venue))
  const update = useUpdateOwnRestaurantVenue(venue.slug)

  const set = <K extends keyof ManageForm>(key: K, value: ManageForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const setDay = (day: DayKey, patch: Partial<DayHours>) =>
    setForm((current) => ({
      ...current,
      hours: { ...current.hours, [day]: { ...current.hours[day], ...patch } },
    }))

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await update.mutateAsync(buildUpdate(form, venue))
      toast.success('Listing details saved.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'We could not save those details.')
    }
  }

  return (
    <div className="rvo-layout">
      <form className="rvo-form" onSubmit={(event) => void onSubmit(event)}>
        <section className="rvo-section">
          <div className="rvo-section__head">
            <span className="rvo-step">01</span>
            <div>
              <h2>The story diners read</h2>
              <p>Keep it concrete: the food, the room and what makes this place yours.</p>
            </div>
          </div>
          <label>
            Description
            <textarea
              aria-label="Description"
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              maxLength={3000}
              rows={6}
              placeholder="Tell diners what makes this restaurant worth visiting."
            />
          </label>
          <small>{form.description.length} / 3000 characters</small>
        </section>

        <section className="rvo-section">
          <div className="rvo-section__head">
            <span className="rvo-step">02</span>
            <div>
              <h2>Contact &amp; links</h2>
              <p>These are the details a diner uses to check a table or read the menu.</p>
            </div>
          </div>
          <div className="rvo-row">
            <label>
              Phone
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => set('phone', event.target.value)}
                maxLength={40}
                placeholder="+233 20 000 0000"
              />
            </label>
            <label>
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
          <div className="rvo-row">
            <label>
              Menu link
              <input
                type="url"
                value={form.menuUrl}
                onChange={(event) => set('menuUrl', event.target.value)}
                maxLength={500}
                placeholder="https://your-restaurant.com/menu"
              />
              <small>Use the restaurant&rsquo;s own menu page. Leave blank to hide the menu section.</small>
            </label>
          </div>
        </section>

        <section className="rvo-section">
          <div className="rvo-section__head">
            <span className="rvo-step">03</span>
            <div>
              <h2>Food &amp; features</h2>
              <p>Separate values with commas. These power the directory filters.</p>
            </div>
          </div>
          <div className="rvo-row">
            <label>
              Cuisines
              <input
                value={form.cuisines}
                onChange={(event) => set('cuisines', event.target.value)}
                placeholder="Ghanaian, Seafood"
              />
            </label>
            <label>
              Dietary options
              <input
                value={form.dietary}
                onChange={(event) => set('dietary', event.target.value)}
                placeholder="Vegetarian, Vegan"
              />
            </label>
          </div>
          <div className="rvo-row">
            <label>
              Meals served
              <input
                value={form.mealTypes}
                onChange={(event) => set('mealTypes', event.target.value)}
                placeholder="Breakfast, Lunch, Dinner"
              />
              <small>Shown in the menu &amp; meal service section.</small>
            </label>
            <label>
              Amenities
              <input
                value={form.amenities}
                onChange={(event) => set('amenities', event.target.value)}
                placeholder="Outdoor seating, Wheelchair accessible"
              />
            </label>
          </div>
        </section>

        <section className="rvo-section">
          <div className="rvo-section__head">
            <span className="rvo-step">04</span>
            <div>
              <h2>Opening hours</h2>
              <p>Use a 24-hour clock. One service per day; mark the day closed when it does not open.</p>
            </div>
          </div>
          <div className="rvo-hours">
            {DAY_KEYS.map((day) => {
              const row = form.hours[day]
              return (
                <div key={day} className="rvo-hours__row">
                  <strong>{DAY_LABELS[day]}</strong>
                  <input
                    type="time"
                    aria-label={`${DAY_LABELS[day]} opening time`}
                    value={row.open}
                    disabled={row.closed}
                    onChange={(event) => setDay(day, { open: event.target.value })}
                  />
                  <span className="rvo-hours__dash" aria-hidden="true">
                    –
                  </span>
                  <input
                    type="time"
                    aria-label={`${DAY_LABELS[day]} closing time`}
                    value={row.close}
                    disabled={row.closed}
                    onChange={(event) => setDay(day, { close: event.target.value })}
                  />
                  <label className="rvo-hours__closed">
                    <input
                      type="checkbox"
                      checked={row.closed}
                      onChange={(event) => setDay(day, { closed: event.target.checked })}
                    />
                    Closed
                  </label>
                </div>
              )
            })}
          </div>
          <small className="rvo-hours__note">
            <Clock3 size={13} aria-hidden="true" /> Times are shown in the restaurant&rsquo;s local timezone.
          </small>
        </section>

        <section className="rvo-section">
          <div className="rvo-section__head">
            <span className="rvo-step">05</span>
            <div>
              <h2>Photos</h2>
              <p>The Travio team reviews new photos before they appear on the listing.</p>
            </div>
          </div>
          {venue.photos.length > 0 ? (
            <div className="rvo-photos">
              {venue.photos.slice(0, 6).map((photo) => (
                <OptimizedImage key={photo} src={photo} alt="" width={140} height={100} fit="crop" />
              ))}
            </div>
          ) : (
            <p className="rvo-photo-note">
              <Image size={16} aria-hidden="true" /> No photos on this listing yet.
            </p>
          )}
          <p className="rvo-photo-note">
            <Sparkles size={16} aria-hidden="true" /> Need a new cover shot? Send it to the Travio
            team and we will add it after review.
          </p>
        </section>

        <div className="rvo-submit">
          <span>
            <ShieldCheck size={15} aria-hidden="true" /> Changes go live as soon as you save.
          </span>
          <button type="submit" disabled={update.isPending}>
            <Save size={15} aria-hidden="true" />
            {update.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <aside className="rvo-aside">
        <section className="rvo-side">
          <span className="rvo-side__label">Listing access</span>
          <div className="rvo-side__identity">
            <span>
              <BadgeCheck size={19} aria-hidden="true" />
            </span>
            <div>
              <strong>Verified owner</strong>
              <small>Owner tools active</small>
            </div>
          </div>
          <p>Your edits are tied to your account and logged for the Travio team.</p>
        </section>

        <section className="rvo-side">
          <h2>What you control</h2>
          <ul>
            <li>
              <BadgeCheck size={15} aria-hidden="true" /> The description and story
            </li>
            <li>
              <BadgeCheck size={15} aria-hidden="true" /> Phone, website and menu link
            </li>
            <li>
              <BadgeCheck size={15} aria-hidden="true" /> Cuisines, dietary and amenities
            </li>
            <li>
              <BadgeCheck size={15} aria-hidden="true" /> Opening hours and meal services
            </li>
          </ul>
        </section>

        <section className="rvo-side rvo-side--dark">
          <span className="rvo-side__label">What stays with Travio</span>
          <h2>Ratings are not editable</h2>
          <p>
            Travio ratings, review moderation, rank and outside-source scores cannot be changed from
            this page. Those stay with diners and the sources that produced them.
          </p>
        </section>

        <section className="rvo-side">
          <h2>Check the public page</h2>
          <p>See exactly what diners see before you save your next change.</p>
          <Link className="rvo-side__link" to={`/restaurants/${venue.slug}`}>
            View listing <ExternalLink size={13} aria-hidden="true" />
          </Link>
        </section>
      </aside>
    </div>
  )
}

function SignedOutGate({ returnTo }: { returnTo: string }) {
  const { promptSignIn } = useAuthContext()
  return (
    <div className="rvo-gate">
      <div className="rvo-gate__copy">
        <span>
          <LockKeyhole size={20} aria-hidden="true" />
        </span>
        <h2>Sign in to manage your listing</h2>
        <p>
          Owner tools are tied to the account that claimed the restaurant. Sign in with that account
          to update the page diners see.
        </p>
        <button type="button" onClick={() => promptSignIn(returnTo)}>
          Sign in to continue
        </button>
      </div>
      <ul className="rvo-unlock">
        <li>
          <UtensilsCrossed size={17} aria-hidden="true" /> Keep the menu and service times current
        </li>
        <li>
          <Clock3 size={17} aria-hidden="true" /> Fix hours before a diner travels
        </li>
        <li>
          <ShieldCheck size={17} aria-hidden="true" /> Every edit is logged and reversible
        </li>
      </ul>
    </div>
  )
}

function SingleVenueManage({ slug }: { slug: string }) {
  const user = useAuthUser()
  const venuesQuery = useMyRestaurantVenues(Boolean(user))
  const venueQuery = useRestaurantVenue(slug)
  const membership = useMemo(
    () => venuesQuery.data?.venues.find((item) => item.venue.slug === slug)?.membership,
    [venuesQuery.data, slug],
  )

  if (!user) {
    return (
      <>
        <header className="rvo-hero">
          <div>
            <span className="rvo-eyebrow">Owner tools</span>
            <h1>Manage your restaurant</h1>
            <p>Update the story, contact details, hours and food service diners see.</p>
          </div>
          <aside className="rvo-hero__note">
            <span>
              <ShieldCheck size={17} aria-hidden="true" />
            </span>
            <div>
              <strong>Owner access only</strong>
              <small>Only an approved claim can open these tools.</small>
            </div>
          </aside>
        </header>
        <SignedOutGate returnTo={`/restaurants/${slug}/manage`} />
      </>
    )
  }

  if (venuesQuery.isPending || venueQuery.isPending) return <div className="restaurant-skeleton" />

  if (venuesQuery.isError) {
    return (
      <div className="rvo-state">
        <h1>We could not load your restaurants</h1>
        <p>{venuesQuery.error instanceof Error ? venuesQuery.error.message : 'Try again.'}</p>
        <button type="button" onClick={() => void venuesQuery.refetch()}>
          Try again
        </button>
      </div>
    )
  }

  if (!membership) {
    return (
      <div className="rvo-state">
        <LockKeyhole size={22} aria-hidden="true" />
        <h1>You do not manage this restaurant</h1>
        <p>An admin must approve a claim before owner tools open.</p>
        <Link to={`/restaurants/${slug}/claim`}>View claim options</Link>
      </div>
    )
  }

  if (venueQuery.isError || !venueQuery.data) {
    return (
      <div className="rvo-state">
        <h1>We could not load this listing</h1>
        <p>Check the link and try again.</p>
        <Link to="/restaurants/manage">My restaurants</Link>
      </div>
    )
  }

  const venue = venueQuery.data
  return (
    <>
      <nav className="rh-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <Link to="/restaurants/manage">My restaurants</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span>{venue.name}</span>
      </nav>

      <header className="rvo-hero">
        <div>
          <span className="rvo-eyebrow">Owner tools</span>
          <h1>{venue.name}</h1>
          <p>
            Keep the listing current. Ratings, rank and outside scores stay with Travio and the
            sources that produced them.
          </p>
        </div>
        <aside className="rvo-hero__note">
          <span>
            <BadgeCheck size={17} aria-hidden="true" />
          </span>
          <div>
            <strong>Verified owner</strong>
            <small>{membership.role.toLowerCase()} access · changes are logged</small>
          </div>
        </aside>
      </header>

      <article className="rvo-venue">
        {venue.coverPhoto || venue.photos[0] ? (
          <OptimizedImage
            src={venue.coverPhoto || venue.photos[0]}
            alt=""
            width={180}
            height={130}
            fit="crop"
            priority
          />
        ) : (
          <span className="rvo-venue__placeholder">
            <Image size={22} />
          </span>
        )}
        <div className="rvo-venue__copy">
          <div className="rvo-venue__badges">
            <span>{membership.role.toLowerCase()}</span>
            {venue.rating != null && <span>{venue.rating.toFixed(1)} Travio</span>}
            {venue.reviewCount > 0 && <span>{venue.reviewCount} reviews</span>}
          </div>
          <strong>{venue.name}</strong>
          <span>{locationText(venue) || 'Ghana'}</span>
        </div>
        <Link to={`/restaurants/${venue.slug}`}>
          View listing <ExternalLink size={13} aria-hidden="true" />
        </Link>
      </article>

      <VenueManager venue={venue} />
    </>
  )
}

function MyRestaurants() {
  const user = useAuthUser()
  const venuesQuery = useMyRestaurantVenues(Boolean(user))

  if (!user) {
    return (
      <>
        <header className="rvo-hero">
          <div>
            <span className="rvo-eyebrow">Owner tools</span>
            <h1>My restaurants</h1>
            <p>Open a restaurant to update its public details.</p>
          </div>
          <aside className="rvo-hero__note">
            <span>
              <ShieldCheck size={17} aria-hidden="true" />
            </span>
            <div>
              <strong>Owner access only</strong>
              <small>Sign in with the account that claimed your restaurant.</small>
            </div>
          </aside>
        </header>
        <SignedOutGate returnTo="/restaurants/manage" />
      </>
    )
  }

  return (
    <>
      <nav className="rh-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <Link to="/restaurants">Restaurants</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span>My restaurants</span>
      </nav>

      <header className="rvo-hero">
        <div>
          <span className="rvo-eyebrow">Owner tools</span>
          <h1>My restaurants</h1>
          <p>Open a restaurant to update its public details.</p>
        </div>
        <aside className="rvo-hero__note">
          <span>
            <BadgeCheck size={17} aria-hidden="true" />
          </span>
          <div>
            <strong>Your approved listings</strong>
            <small>Only claims an admin has approved appear here.</small>
          </div>
        </aside>
      </header>

      {venuesQuery.isPending && <div className="restaurant-skeleton" />}

      {venuesQuery.isError && (
        <div className="rvo-state">
          <h2>We could not load your restaurants</h2>
          <p>{venuesQuery.error instanceof Error ? venuesQuery.error.message : 'Try again.'}</p>
          <button type="button" onClick={() => void venuesQuery.refetch()}>
            Try again
          </button>
        </div>
      )}

      {venuesQuery.data?.venues.length === 0 && (
        <div className="rvo-state">
          <h2>No approved claims yet</h2>
          <p>Claim a restaurant and wait for an admin to review your evidence.</p>
          <Link to="/restaurants">Find your restaurant</Link>
        </div>
      )}

      {venuesQuery.data && venuesQuery.data.venues.length > 0 && (
        <div className="rvo-list">
          {venuesQuery.data.venues.map(({ venue, membership }) => (
            <article key={venue.id} className="rvo-list__card">
              {venue.coverPhoto || venue.photos[0] ? (
                <OptimizedImage
                  src={venue.coverPhoto || venue.photos[0]}
                  alt=""
                  width={140}
                  height={110}
                  fit="crop"
                />
              ) : (
                <div className="rvo-list__placeholder">{venue.name.charAt(0)}</div>
              )}
              <div className="rvo-list__copy">
                <h2>{venue.name}</h2>
                <p>{locationText(venue) || 'Ghana'}</p>
                <span>
                  <BadgeCheck size={13} aria-hidden="true" /> {membership.role.toLowerCase()}
                </span>
              </div>
              <Link to={`/restaurants/${venue.slug}/manage`}>Manage</Link>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

export default function RestaurantManagePage() {
  const { slug } = useParams<{ slug?: string }>()

  return (
    <div className="restaurants-page">
      <SEO title={slug ? 'Manage restaurant' : 'My restaurants'} robots="noindex" />
      <main className="restaurants-page__main rvo-page">
        {slug ? <SingleVenueManage slug={slug} /> : <MyRestaurants />}
      </main>
      <Footer />
    </div>
  )
}
