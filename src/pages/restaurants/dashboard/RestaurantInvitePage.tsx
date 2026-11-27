import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, LoaderCircle, LockKeyhole, MailCheck } from 'lucide-react'
import SEO from '../../../components/SEO'
import Footer from '../../../components/Footer'
import { useAuthContext } from '../../../context/AuthContext'
import { useAuthUser } from '../../../hooks/useAuthUser'
import { dashboardError, useAcceptTeamInvite } from '../../../hooks/useRestaurantDashboard'
import '../../RestaurantsPage.css'
import './RestaurantDashboard.css'

export default function RestaurantInvitePage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const user = useAuthUser()
  const { promptSignIn } = useAuthContext()
  const queryClient = useQueryClient()
  const accept = useAcceptTeamInvite()
  const [acceptedVenue, setAcceptedVenue] = useState<{ slug: string; name: string } | null>(null)

  const returnTo = `${location.pathname}${location.search}`

  return (
    <div className="restaurants-page">
      <SEO title="Restaurant team invitation" robots="noindex" />
      <main className="restaurants-page__main rd-gate-page">
        {acceptedVenue ? (
          <div className="rd-gate rd-gate--success">
            <span className="rd-gate__icon"><CheckCircle2 size={22} /></span>
            <h1>You joined the team</h1>
            <p>
              You can now manage <strong>{acceptedVenue.name}</strong> on Travio.
            </p>
            <Link className="rd-button rd-button--primary" to={`/restaurants/${acceptedVenue.slug}/manage`}>
              Open dashboard <ArrowRight size={14} />
            </Link>
          </div>
        ) : !user ? (
          <div className="rd-gate">
            <span className="rd-gate__icon"><LockKeyhole size={22} /></span>
            <h1>Sign in to accept this invitation</h1>
            <p>
              Team access is tied to the email address the invitation was sent to. Sign in with that
              account and we will bring you back here.
            </p>
            <button
              type="button"
              className="rd-button rd-button--primary"
              onClick={() => promptSignIn(returnTo)}
            >
              Sign in to continue
            </button>
          </div>
        ) : token.length < 20 ? (
          <div className="rd-gate">
            <span className="rd-gate__icon"><MailCheck size={22} /></span>
            <h1>This invitation link is incomplete</h1>
            <p>Open the full link from the invitation email, or ask the owner to send a new one.</p>
            <Link className="rd-button rd-button--secondary" to="/restaurants/manage">
              My restaurants
            </Link>
          </div>
        ) : (
          <div className="rd-gate">
            <span className="rd-gate__icon"><MailCheck size={22} /></span>
            <h1>Accept the invitation</h1>
            <p>
              Signed in as <strong>{user.email}</strong>. Accepting adds you to the restaurant team with
              manager access.
            </p>
            {accept.isError && <p className="rd-gate__error">{dashboardError(accept.error)}</p>}
            <button
              type="button"
              className="rd-button rd-button--primary"
              disabled={accept.isPending}
              onClick={() =>
                accept.mutate(token, {
                  onSuccess: (data) => {
                    void queryClient.invalidateQueries({ queryKey: ['restaurant-dashboard'] })
                    void queryClient.invalidateQueries({ queryKey: ['restaurant-venue-my-venues'] })
                    setAcceptedVenue(data.venue)
                  },
                })
              }
            >
              {accept.isPending ? <LoaderCircle size={15} className="rd-spin" /> : <CheckCircle2 size={15} />}
              {accept.isPending ? 'Joining…' : 'Accept invitation'}
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
