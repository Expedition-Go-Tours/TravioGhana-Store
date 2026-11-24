import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  BadgeCheck,
  ChevronRight,
  ExternalLink,
  LockKeyhole,
  Save,
  ShieldCheck,
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

function commaList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

interface ManageForm {
  description: string
  phone: string
  website: string
  cuisines: string
  dietary: string
  amenities: string
  hours: string
}

function formFromVenue(venue: RestaurantVenueDetail): ManageForm {
  return {
    description: venue.description ?? '',
    phone: venue.phone ?? '',
    website: venue.website ?? '',
    cuisines: venue.cuisines.join(', '),
    dietary: venue.dietary.join(', '),
    amenities: venue.amenities.join(', '),
    hours: venue.hours ? JSON.stringify(venue.hours, null, 2) : '',
  }
}

function buildUpdate(form: ManageForm, original: RestaurantVenueDetail): RestaurantVenueUpdate {
  const update: RestaurantVenueUpdate = {
    description: form.description.trim(),
    cuisines: commaList(form.cuisines),
    dietary: commaList(form.dietary).map((item) => item.toLowerCase()),
    amenities: commaList(form.amenities),
  }

  if (form.phone.trim() !== (original.phone ?? '')) update.phone = form.phone.trim()
  if (form.website.trim() !== (original.website ?? '')) update.website = form.website.trim()

  if (form.hours.trim()) {
    try {
      const parsed = JSON.parse(form.hours)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Opening hours must be a JSON object.')
      }
      update.hours = parsed as Record<string, unknown>
    } catch (error) {
      throw new Error('Opening hours are not valid JSON.', { cause: error })
    }
  }

  return update
}

function VenueManager({ venue }: { venue: RestaurantVenueDetail }) {
  const [form, setForm] = useState<ManageForm>(() => formFromVenue(venue))
  const update = useUpdateOwnRestaurantVenue(venue.slug)

  const set = (key: keyof ManageForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

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
    <form className="rm-form" onSubmit={(event) => void onSubmit(event)}>
      <div className="rm-form__head">
        <div>
          <h2>Edit listing details</h2>
          <p>These fields describe the business. Ratings, rank and outside scores stay with Travio.</p>
        </div>
        <button type="submit" disabled={update.isPending}>
          <Save size={15} aria-hidden="true" />
          {update.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <label>
        Description
        <textarea
          value={form.description}
          onChange={(event) => set('description', event.target.value)}
          maxLength={3000}
          rows={5}
          placeholder="Tell diners what makes this restaurant worth visiting."
        />
      </label>

      <div className="rm-form__row">
        <label>
          Phone
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => set('phone', event.target.value)}
            maxLength={40}
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

      <div className="rm-form__row">
        <label>
          Cuisines
          <input
            value={form.cuisines}
            onChange={(event) => set('cuisines', event.target.value)}
            placeholder="Ghanaian, Seafood"
          />
          <small>Separate values with commas.</small>
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

      <label>
        Amenities
        <input
          value={form.amenities}
          onChange={(event) => set('amenities', event.target.value)}
          placeholder="Outdoor seating, Wheelchair accessible"
        />
      </label>

      <label>
        Opening hours
        <textarea
          className="rm-json"
          value={form.hours}
          onChange={(event) => set('hours', event.target.value)}
          rows={6}
          placeholder={'{\n  "monday": "11:00 – 22:00"\n}'}
        />
        <small>Use a JSON object with one entry per day. Leave empty to keep current hours.</small>
      </label>

      <div className="rm-locked">
        <LockKeyhole size={16} aria-hidden="true" />
        <div>
          <strong>Managed by Travio</strong>
          <p>
            Travio rating, verified review count, rank and outside-source scores cannot be changed
            from this page.
          </p>
        </div>
      </div>
    </form>
  )
}

function SingleVenueManage({ slug }: { slug: string }) {
  const user = useAuthUser()
  const { promptSignIn } = useAuthContext()
  const venuesQuery = useMyRestaurantVenues(Boolean(user))
  const venueQuery = useRestaurantVenue(slug)
  const membership = useMemo(
    () => venuesQuery.data?.venues.find((item) => item.venue.slug === slug)?.membership,
    [venuesQuery.data, slug],
  )

  if (!user) {
    return (
      <div className="rm-state">
        <ShieldCheck size={22} aria-hidden="true" />
        <h1>Sign in to manage listings</h1>
        <p>Only approved restaurant owners can open this page.</p>
        <button type="button" onClick={() => promptSignIn(`/restaurants/${slug}/manage`)}>
          Sign in
        </button>
      </div>
    )
  }

  if (venuesQuery.isPending || venueQuery.isPending) return <div className="restaurant-skeleton" />

  if (venuesQuery.isError) {
    return (
      <div className="rm-state">
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
      <div className="rm-state">
        <LockKeyhole size={22} aria-hidden="true" />
        <h1>You do not manage this restaurant</h1>
        <p>An admin must approve a claim before owner tools open.</p>
        <Link to={`/restaurants/${slug}/claim`}>View claim options</Link>
      </div>
    )
  }

  if (venueQuery.isError || !venueQuery.data) {
    return (
      <div className="rm-state">
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

      <header className="rm-heading">
        <div>
          <span className="rf-eyebrow">Owner tools</span>
          <h1>{venue.name}</h1>
          <p>{locationText(venue) || 'Ghana'}</p>
        </div>
        <div className="rm-heading__actions">
          <span className="rm-role">
            <BadgeCheck size={14} aria-hidden="true" /> {membership.role.toLowerCase()}
          </span>
          <Link to={`/restaurants/${venue.slug}`}>
            View listing <ExternalLink size={13} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {venue.photos.length > 0 && (
        <div className="rm-photos" aria-label="Current listing photos">
          {venue.photos.slice(0, 6).map((photo) => (
            <OptimizedImage key={photo} src={photo} alt="" width={150} height={100} fit="crop" />
          ))}
        </div>
      )}

      <VenueManager venue={venue} />
    </>
  )
}

function MyRestaurants() {
  const user = useAuthUser()
  const { promptSignIn } = useAuthContext()
  const venuesQuery = useMyRestaurantVenues(Boolean(user))

  if (!user) {
    return (
      <div className="rm-state">
        <ShieldCheck size={22} aria-hidden="true" />
        <h1>Sign in to manage listings</h1>
        <p>Only approved restaurant owners can open this page.</p>
        <button type="button" onClick={() => promptSignIn('/restaurants/manage')}>
          Sign in
        </button>
      </div>
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

      <header className="rm-heading">
        <div>
          <span className="rf-eyebrow">Owner tools</span>
          <h1>My restaurants</h1>
          <p>Open a restaurant to update its public details.</p>
        </div>
      </header>

      {venuesQuery.isPending && <div className="restaurant-skeleton" />}

      {venuesQuery.isError && (
        <div className="rm-state">
          <h2>We could not load your restaurants</h2>
          <p>{venuesQuery.error instanceof Error ? venuesQuery.error.message : 'Try again.'}</p>
          <button type="button" onClick={() => void venuesQuery.refetch()}>
            Try again
          </button>
        </div>
      )}

      {venuesQuery.data?.venues.length === 0 && (
        <div className="rm-state">
          <h2>No approved claims yet</h2>
          <p>Claim a restaurant and wait for an admin to review your evidence.</p>
          <Link to="/restaurants">Find your restaurant</Link>
        </div>
      )}

      {venuesQuery.data && venuesQuery.data.venues.length > 0 && (
        <div className="rm-list">
          {venuesQuery.data.venues.map(({ venue, membership }) => (
            <article key={venue.id} className="rm-list__card">
              {venue.coverPhoto || venue.photos[0] ? (
                <OptimizedImage
                  src={venue.coverPhoto || venue.photos[0]}
                  alt=""
                  width={140}
                  height={110}
                  fit="crop"
                />
              ) : (
                <div className="rm-list__placeholder">{venue.name.charAt(0)}</div>
              )}
              <div>
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
      <main className="restaurants-page__main rm-page">
        {slug ? <SingleVenueManage slug={slug} /> : <MyRestaurants />}
      </main>
      <Footer />
    </div>
  )
}
