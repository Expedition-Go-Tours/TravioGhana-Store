import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import newsletterImg from '../assets/newsletter-square-card.webp'
import './NewsletterSection.css'

export default function NewsletterSection() {
  const [email, setEmail] = useState('')

  // The mailing-list API isn't wired up yet, so submitting is deliberately a
  // no-op. The button is NOT marked `.is-coming-soon`: that dims it to 55%
  // opacity and shows a not-allowed cursor, which reads as broken on a
  // marketing section. It looks and behaves like a normal button that simply
  // does nothing yet.
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
  }

  return (
    <section className="newsletter-section">
      <div className="newsletter-container">
        <div className="newsletter-card">
          <div className="newsletter-image-wrap">
            {/* The image half is hidden below 769px (see NewsletterSection.css).
                <picture> keeps the eager load to the breakpoint where it is
                actually shown, instead of downloading it for phones too. */}
            <picture>
              <source media="(min-width: 769px)" srcSet={newsletterImg} />
              <img
                alt="Aerial view of Black Star Square and Independence Arch in Accra"
                className="newsletter-image"
                decoding="async"
              />
            </picture>
          </div>

          <div className="newsletter-content">
            <h2 className="newsletter-title">
              Your travel journey starts here
            </h2>
            <p className="newsletter-sub">
              Sign up now for travel tips, personalised itineraries and holiday
              inspiration straight to your inbox.
            </p>

            <form className="newsletter-form" onSubmit={handleSubmit}>
              <div className="newsletter-input-wrap">
                <input
                  type="email"
                  className="newsletter-input"
                  placeholder="EMAIL"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Email address"
                />
                <Mail
                  className="newsletter-input-icon"
                  size={20}
                  aria-hidden="true"
                />
              </div>
              <button
                type="submit"
                className="newsletter-btn"
                aria-label="Sign up"
              >
                Sign up
              </button>
            </form>

            <p className="newsletter-legal">
              By signing up, you agree to receive promotional emails on
              activities and insider tips. You can unsubscribe or withdraw your
              consent at any time with future effect. For more information, read
              our <Link to="/privacy-policy">Privacy policy</Link>.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
