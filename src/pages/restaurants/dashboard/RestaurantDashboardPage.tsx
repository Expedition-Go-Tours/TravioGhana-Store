import { useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import SEO from '../../../components/SEO'
import Footer from '../../../components/Footer'
import { useAuthUser } from '../../../hooks/useAuthUser'
import { useAuthContext } from '../../../context/AuthContext'
import { dashboardError, useDashboardSession } from '../../../hooks/useRestaurantDashboard'
import '../../RestaurantsPage.css'
import { DashboardSidebar, DashboardTopbar, ErrorBlock, LoadingBlock } from './components'
import './RestaurantDashboard.css'

function SignedOutGate({ returnTo }: { returnTo: string }) {
  const { promptSignIn } = useAuthContext()
  return (
    <div className="rd-gate">
      <span className="rd-gate__icon">
        <LockKeyhole size={22} />
      </span>
      <h1>Sign in to manage this restaurant</h1>
      <p>
        Owner and manager tools are tied to the account that was invited to manage this listing.
        Sign in with that account to continue.
      </p>
      <button type="button" className="rd-button rd-button--primary" onClick={() => promptSignIn(returnTo)}>
        Sign in to continue
      </button>
      <Link to={`/restaurants/${returnTo.split('/')[2]}`}>View the public listing instead</Link>
    </div>
  )
}

function NoAccess() {
  return (
    <div className="rd-gate">
      <span className="rd-gate__icon">
        <LockKeyhole size={22} />
      </span>
      <h1>You do not manage this restaurant</h1>
      <p>
        Ask the restaurant owner to invite you, or claim the listing and wait for an admin to review
        your evidence.
      </p>
      <Link className="rd-button rd-button--secondary" to="/restaurants/manage">
        My restaurants
      </Link>
    </div>
  )
}

export default function RestaurantDashboardPage() {
  const { slug } = useParams<{ slug: string }>()
  const user = useAuthUser()
  const [menuOpen, setMenuOpen] = useState(false)
  const session = useDashboardSession(slug, Boolean(user && slug))

  const returnTo = `/restaurants/${slug || ''}/manage`

  return (
    <div className="restaurants-page">
      <SEO title="Restaurant dashboard" robots="noindex" />
      <main className="restaurants-page__main rd-page">
        {!user ? (
          <SignedOutGate returnTo={returnTo} />
        ) : session.isPending ? (
          <LoadingBlock label="Opening your dashboard…" />
        ) : session.isError ? (
          <ErrorBlock
            message={dashboardError(session.error)}
            onRetry={() => void session.refetch()}
          />
        ) : !session.data ? (
          <NoAccess />
        ) : (
          <div className="rd-shell">
            <DashboardSidebar
              slug={slug!}
              session={session.data}
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
            />
            <div className="rd-main">
              <DashboardTopbar slug={slug!} session={session.data} onMenu={() => setMenuOpen(true)} />
              <div className="rd-content">
                <Outlet context={session.data} />
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
