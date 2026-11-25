import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  BadgeCheck,
  ChevronRight,
  Clock3,
  ExternalLink,
  Image,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import SEO from '../../components/SEO'
import Footer from '../../components/Footer'
import OptimizedImage from '../../components/shared/OptimizedImage'
import { useAuthUser } from '../../hooks/useAuthUser'
import { useAuthContext } from '../../context/AuthContext'
import { useRestaurantVenue } from '../../hooks/useRestaurantVenues'
import { useMyRestaurantClaim, useSubmitRestaurantClaim } from '../../hooks/useRestaurantActions'
import { formatDate, locationText, priceLabel } from './RestaurantPageBits'
import '../RestaurantsPage.css'
import './RestaurantPages.css'
import './RestaurantClaimPage.css'

export default function RestaurantClaimPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const user = useAuthUser()
  const { promptSignIn } = useAuthContext()
  const venueQuery = useRestaurantVenue(slug)
  const claimQuery = useMyRestaurantClaim(slug, Boolean(user))
  const submitClaim = useSubmitRestaurantClaim(slug)
  const [businessName, setBusinessName] = useState('')
  const [role, setRole] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')

  const email = contactEmail || user?.email || ''
  const venue = venueQuery.data
  const claim = claimQuery.data?.claim
  const membership = claimQuery.data?.membership
  const canSubmit = !membership && (!claim || claim.status === 'REJECTED')
  const venuePhoto = venue?.coverPhoto || venue?.photos[0] || null

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      promptSignIn(`/restaurants/${slug}/claim`)
      return
    }
    try {
      await submitClaim.mutateAsync({
        businessName: businessName.trim(),
        role: role.trim(),
        contactEmail: email.trim(),
        phone: phone.trim(),
        message: message.trim(),
        evidenceUrl: evidenceUrl.trim(),
      })
      toast.success('Claim sent. An admin will review your evidence before access is granted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'We could not send your claim.')
    }
  }

  return (
    <div className="restaurants-page">
      <SEO title={`Claim ${venue?.name ?? 'a restaurant'}`} robots="noindex" />
      <main className="restaurants-page__main rcl-page">
        <nav className="rh-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={13} aria-hidden="true" />
          <Link to="/restaurants">Restaurants</Link>
          <ChevronRight size={13} aria-hidden="true" />
          {venue ? (
            <Link to={`/restaurants/${venue.slug}`}>{venue.name}</Link>
          ) : (
            <span>Restaurant</span>
          )}
          <ChevronRight size={13} aria-hidden="true" />
          <span>Claim</span>
        </nav>

        <header className="rcl-header">
          <span className="rcl-eyebrow">For restaurant owners</span>
          <h1>{venue ? `Claim ${venue.name}` : 'Claim this restaurant'}</h1>
          <p>
            Tell us how you are connected to the business and give us something we can verify. Every
            claim is reviewed by a person before anyone gets access.
          </p>
        </header>

        {venueQuery.isPending && <div className="restaurant-skeleton" />}

        {venueQuery.isError || (!venueQuery.isPending && !venue) ? (
          <div className="rcl-state">
            <h2>We could not find this restaurant</h2>
            <p>Check the link, or browse the restaurant directory.</p>
            <Link to="/restaurants">Browse restaurants</Link>
          </div>
        ) : null}

        {venue && (
          <article className="rcl-venue">
            {venuePhoto ? (
              <OptimizedImage src={venuePhoto} alt="" width={160} height={120} fit="crop" priority />
            ) : (
              <span className="rcl-venue__placeholder">
                <Image size={22} />
              </span>
            )}
            <div className="rcl-venue__copy">
              <div className="rcl-venue__badges">
                {venue.rank && (
                  <span>
                    #{venue.rank.position}
                    {venue.rank.of ? ` of ${venue.rank.of}` : ''} in {venue.city ?? 'Ghana'}
                  </span>
                )}
                {venue.priceBand && <span>{priceLabel(venue.priceBand)}</span>}
              </div>
              <strong>{venue.name}</strong>
              <span>
                <MapPin size={13} aria-hidden="true" /> {locationText(venue) || 'Ghana'}
              </span>
            </div>
            <Link to={`/restaurants/${venue.slug}`}>
              View listing <ExternalLink size={13} aria-hidden="true" />
            </Link>
          </article>
        )}

        {!user && (
          <div className="rcl-state rcl-state--gate">
            <LockKeyhole size={22} aria-hidden="true" />
            <h2>Sign in to claim a listing</h2>
            <p>We link every claim to an account so the review trail stays clear.</p>
            <button type="button" onClick={() => promptSignIn(`/restaurants/${slug}/claim`)}>
              Sign in
            </button>
          </div>
        )}

        {user && claimQuery.isPending && <div className="restaurant-skeleton" />}

        {user && claimQuery.isError && (
          <div className="rcl-state">
            <h2>We could not load your claim</h2>
            <p>{claimQuery.error instanceof Error ? claimQuery.error.message : 'Try again.'}</p>
            <button type="button" onClick={() => void claimQuery.refetch()}>
              Try again
            </button>
          </div>
        )}

        {user && membership && (
          <div className="rcl-state rcl-state--success">
            <BadgeCheck size={22} aria-hidden="true" />
            <h2>You already manage this restaurant</h2>
            <p>You can update the description, hours and contact details diners see.</p>
            <Link to={`/restaurants/${slug}/manage`}>Open owner tools</Link>
          </div>
        )}

        {user && !membership && claim?.status === 'PENDING' && (
          <div className="rcl-state rcl-state--pending">
            <Clock3 size={22} aria-hidden="true" />
            <h2>Your claim is waiting for review</h2>
            <p>Sent {formatDate(claim.createdAt)}. We will let you know what we decide.</p>
            {claim.message && <blockquote>{claim.message}</blockquote>}
          </div>
        )}

        {user && canSubmit && (
          <div className="rcl-shell">
            <form className="rcl-form" onSubmit={(event) => void onSubmit(event)}>
              {claim?.status === 'REJECTED' && (
                <div className="rcl-rejected">
                  <strong>Your earlier claim was not approved.</strong>
                  {claim.reviewNote ? <span>{claim.reviewNote}</span> : null}
                  <span>You can send a new claim with clearer evidence.</span>
                </div>
              )}

              <section className="rcl-section">
                <div className="rcl-section__head">
                  <span className="rcl-step">01</span>
                  <div>
                    <h2>Confirm the business</h2>
                    <p>Use the name diners know and the role you hold.</p>
                  </div>
                </div>
                <div className="rcl-row">
                  <label>
                    Business name
                    <input
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      maxLength={160}
                      placeholder="Registered or trading name"
                    />
                  </label>
                  <label>
                    Your role
                    <input
                      value={role}
                      onChange={(event) => setRole(event.target.value)}
                      maxLength={80}
                      placeholder="Owner, manager, marketing lead"
                    />
                  </label>
                </div>
              </section>

              <section className="rcl-section">
                <div className="rcl-section__head">
                  <span className="rcl-step">02</span>
                  <div>
                    <h2>How we reach you</h2>
                    <p>We use this only to review the claim.</p>
                  </div>
                </div>
                <div className="rcl-row">
                  <label>
                    Contact email <span aria-hidden="true">*</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setContactEmail(event.target.value)}
                      maxLength={200}
                    />
                  </label>
                  <label>
                    Phone number
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      maxLength={40}
                    />
                  </label>
                </div>
              </section>

              <section className="rcl-section">
                <div className="rcl-section__head">
                  <span className="rcl-step">03</span>
                  <div>
                    <h2>Give us something to verify</h2>
                    <p>A public link or a clear explanation is enough to start.</p>
                  </div>
                </div>
                <label>
                  Why should we believe you represent this restaurant? <span aria-hidden="true">*</span>
                  <textarea
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={5}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Mention your role, how long you have worked there, and what you can verify."
                  />
                </label>
                <label>
                  Evidence link
                  <input
                    type="url"
                    value={evidenceUrl}
                    onChange={(event) => setEvidenceUrl(event.target.value)}
                    maxLength={500}
                    placeholder="https://"
                  />
                  <small>A business website, staff directory or other public proof.</small>
                </label>
              </section>

              <div className="rcl-submit">
                <span>
                  <ShieldCheck size={15} aria-hidden="true" /> Submitting a claim does not grant access.
                </span>
                <button type="submit" disabled={submitClaim.isPending}>
                  {submitClaim.isPending ? 'Sending…' : 'Send claim'}
                </button>
              </div>
            </form>

            <aside className="rcl-aside">
              <section>
                <span className="rcl-eyebrow">The review</span>
                <h2>What happens next</h2>
                <ol>
                  <li>We check the details you send against the listing.</li>
                  <li>An admin approves or rejects the claim.</li>
                  <li>Approved owners can edit the presentation fields.</li>
                </ol>
              </section>
              <section>
                <span className="rcl-eyebrow">After approval</span>
                <h2>What you can update</h2>
                <ul>
                  <li>Description and story</li>
                  <li>Hours and contact details</li>
                  <li>Photos and amenities</li>
                </ul>
              </section>
              <p className="rcl-aside__note">
                <Sparkles size={15} aria-hidden="true" /> Owners cannot change Travio ratings, ranking
                inputs or outside scores. Those stay independent.
              </p>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
