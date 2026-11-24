import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BadgeCheck, ChevronRight, Clock3, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import SEO from '../../components/SEO'
import Footer from '../../components/Footer'
import { useAuthUser } from '../../hooks/useAuthUser'
import { useAuthContext } from '../../context/AuthContext'
import { useRestaurantVenue } from '../../hooks/useRestaurantVenues'
import { useMyRestaurantClaim, useSubmitRestaurantClaim } from '../../hooks/useRestaurantActions'
import { formatDate, locationText } from './RestaurantPageBits'
import '../RestaurantsPage.css'
import './RestaurantPages.css'

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
      <main className="restaurants-page__main rf-page">
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

        <div className="rf-shell">
          <div className="rf-main">
            <span className="rf-eyebrow">Owner tools</span>
            <h1>Claim this restaurant</h1>
            <p className="rf-intro">
              Tell us how you are connected to the business and share something we can check. A
              Travio admin reviews every claim before anyone gets access to the listing.
            </p>

            {venueQuery.isPending && <div className="restaurant-skeleton" />}

            {venueQuery.isError || (!venueQuery.isPending && !venue) ? (
              <div className="rf-state">
                <h2>We could not find this restaurant</h2>
                <p>Check the link, or browse the restaurant directory.</p>
                <Link to="/restaurants">Browse restaurants</Link>
              </div>
            ) : null}

            {venue && (
              <div className="rf-venue-card">
                <strong>{venue.name}</strong>
                <span>{locationText(venue) || 'Ghana'}</span>
                <Link to={`/restaurants/${venue.slug}`}>View listing</Link>
              </div>
            )}

            {!user && (
              <div className="rf-state rf-state--gate">
                <ShieldCheck size={22} aria-hidden="true" />
                <h2>Sign in to claim a listing</h2>
                <p>We link each claim to an account so the review trail stays clear.</p>
                <button type="button" onClick={() => promptSignIn(`/restaurants/${slug}/claim`)}>
                  Sign in
                </button>
              </div>
            )}

            {user && claimQuery.isPending && <div className="restaurant-skeleton" />}

            {user && claimQuery.isError && (
              <div className="rf-state">
                <h2>We could not load your claim</h2>
                <p>{claimQuery.error instanceof Error ? claimQuery.error.message : 'Try again.'}</p>
                <button type="button" onClick={() => void claimQuery.refetch()}>
                  Try again
                </button>
              </div>
            )}

            {user && membership && (
              <div className="rf-state rf-state--success">
                <BadgeCheck size={22} aria-hidden="true" />
                <h2>You already manage this restaurant</h2>
                <p>You can update the details that describe the business.</p>
                <Link to={`/restaurants/${slug}/manage`}>Open owner tools</Link>
              </div>
            )}

            {user && !membership && claim?.status === 'PENDING' && (
              <div className="rf-state rf-state--pending">
                <Clock3 size={22} aria-hidden="true" />
                <h2>Your claim is waiting for review</h2>
                <p>Sent {formatDate(claim.createdAt)}. We will let you know what we decide.</p>
                {claim.message && <blockquote>{claim.message}</blockquote>}
              </div>
            )}

            {user && canSubmit && (
              <form className="rf-form" onSubmit={(event) => void onSubmit(event)}>
                {claim?.status === 'REJECTED' && (
                  <div className="rf-form__notice">
                    <strong>Your earlier claim was not approved.</strong>
                    {claim.reviewNote ? <span>{claim.reviewNote}</span> : null}
                    <span>You can send a new claim with clearer evidence.</span>
                  </div>
                )}

                <div className="rf-field-row">
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

                <div className="rf-field-row">
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

                <div className="rf-form__actions">
                  <button type="submit" disabled={submitClaim.isPending}>
                    {submitClaim.isPending ? 'Sending…' : 'Send claim'}
                  </button>
                  <span>Submitting a claim does not grant access.</span>
                </div>
              </form>
            )}
          </div>

          <aside className="rf-aside">
            <h2>What happens next</h2>
            <ol>
              <li>We check the details you send against the listing.</li>
              <li>An admin approves or rejects the claim.</li>
              <li>Approved owners can edit the listing description, contact details and hours.</li>
            </ol>
            <p>
              Owners cannot change Travio ratings, ranking inputs or outside scores. Those stay
              with Travio.
            </p>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}
