import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import Footer from '../components/Footer'
import './RestaurantsPage.css'

/** Placeholder so the Restaurants switch has a real URL before the catalogue ships. */
export default function RestaurantsPage() {
  return (
    <div className="restaurants-page">
      <SEO
        title="Restaurants in Ghana"
        description="Travio's guide to restaurants in Ghana is on the way. Tours and activities across the country are available to book now."
        keywords="Ghana restaurants, where to eat in Ghana, Accra restaurants"
      />
      <main className="restaurants-page__main">
        <span className="restaurants-page__eyebrow">Travio Ghana</span>
        <h1>Restaurants</h1>
        <p>
          Our restaurant guide is still being built. Tours and activities are live now,
          including days out in Accra, Cape Coast and beyond.
        </p>
        <Link className="restaurants-page__cta" to="/">Browse tours and activities</Link>
      </main>
      <Footer />
    </div>
  )
}
