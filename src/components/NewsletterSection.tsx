import { useState, type FormEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Mail } from 'lucide-react'
import newsletterImg from '../assets/newsletter-square.jpg'
import './NewsletterSection.css'

export default function NewsletterSection() {
  const [email, setEmail] = useState('')
  const reduce = useReducedMotion()

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
          <motion.div
            className="newsletter-image-wrap"
            initial={reduce ? undefined : { opacity: 0, x: -30 }}
            whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <img
              src={newsletterImg}
              alt="Aerial view of Black Star Square and Independence Arch in Accra"
              className="newsletter-image"
              loading="lazy"
            />
          </motion.div>

          <motion.div
            className="newsletter-content"
            initial={reduce ? undefined : { opacity: 0, x: 30 }}
            whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <h2 className="newsletter-title">
              Never Miss a Deal or Destination
            </h2>
            <p className="newsletter-sub">
              Get exclusive travel tips, early-bird offers, and curated Ghana experiences
              delivered straight to your inbox. No spam, just adventures.
            </p>

            <form className="newsletter-form" onSubmit={handleSubmit}>
              <div className="newsletter-input-wrap">
                <input
                  type="email"
                  className="newsletter-input"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Email address"
                />
                <Mail className="newsletter-input-icon" size={20} />
                <button
                  type="submit"
                  className="newsletter-btn"
                  aria-label="Sign up"
                >
                  Sign up
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
