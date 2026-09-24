import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  Car, Route, Headset, Check,
  ArrowRight,
} from 'lucide-react'
import heroBg from '../assets/images/IMG_3538.webp'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useAuthUser } from '../hooks/useAuthUser'
import { setAuthReturnTo } from '../lib/auth'
import './TransportPage.css'

interface TransportPageProps {
  onOpenAuth?: (mode: 'signin' | 'signup') => void
}

const INTEGRATION_STEPS = [
  {
    num: 1,
    title: 'List your fleet on our platform',
    points: [
      'Add your vehicles and routes in minutes',
      'Set your own pricing and availability',
      'Reach travelers across all destinations',
    ],
  },
  {
    num: 2,
    title: 'Connect with travelers instantly',
    points: [
      'Receive bookings in real-time',
      'Automated confirmations and notifications',
      'Seamless communication with passengers',
    ],
  },
  {
    num: 3,
    title: 'Grow your transport business',
    points: [
      'Access a global audience of travelers',
      'Benefit from our marketing reach',
      'Get paid reliably on your schedule',
    ],
  },
]

const WHY_JOIN = [
  {
    icon: Car,
    title: 'Expand your reach',
    desc: 'Connect with thousands of travelers actively searching for transport solutions across all destinations.',
  },
  {
    icon: Route,
    title: 'Seamless booking integration',
    desc: 'Our platform integrates directly into your operations. Manage bookings, routes, and schedules from one dashboard.',
  },
  {
    icon: Headset,
    title: 'Dedicated partner support',
    desc: 'Get a dedicated account manager, access to our resource center, and ongoing support to maximize your revenue.',
  },
]

export default function TransportPage({ onOpenAuth }: TransportPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthUser()

  useEffect(() => {
    document.title = `${t('footer.asTransportProvider', 'Transport Providers')} | Travio Ghana`
  }, [t])

  const handleSignUp = () => {
    if (!user) {
      setAuthReturnTo('/partners/transport-providers/apply')
      onOpenAuth?.('signup')
      return
    }
    navigate('/partners/transport-providers/apply')
  }

  return (
    <div className="transport-page">
      <Navbar onOpenAuth={onOpenAuth} />

      {/* Hero — full-width image background */}
      <section className="transport-hero">
        <div className="transport-hero-bg">
          <img src={heroBg} alt="" aria-hidden="true" />
        </div>
        <div className="transport-hero-overlay" />
        <motion.div
          className="transport-hero-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <h1 className="transport-hero-title">
            Partner with us to offer <span className="transport-hero-accent">seamless transport</span> for travelers
          </h1>
          <p className="transport-hero-subtitle">
            Connect your fleet with thousands of travelers looking for reliable transport solutions across every destination.
          </p>
          <button type="button" className="transport-btn transport-btn-primary" onClick={handleSignUp}>
            Sign up for free
          </button>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="transport-stats">
        <div className="transport-container">
          <div className="transport-stats-grid">
            {[
              { value: '18k+', label: 'Destinations covered' },
              { value: '200k+', label: 'Travelers served monthly' },
              { value: '50+', label: 'Countries with active partners' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="transport-stat-item"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <span className="transport-stat-value">{stat.value}</span>
                <span className="transport-stat-label">{stat.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration steps */}
      <section className="transport-integration">
        <div className="transport-container">
          <motion.div
            className="transport-integration-header"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="transport-section-title">Drive revenue via seamless integration</h2>
            <p className="transport-section-desc">
              We make integration easy so our partners can focus on what matters — driving revenue. No engineering required.
            </p>
          </motion.div>
          <div className="transport-integration-grid">
            {INTEGRATION_STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                className="transport-integration-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
              >
                <span className="transport-step-num">{step.num}</span>
                <h3 className="transport-step-title">{step.title}</h3>
                <ul className="transport-step-list">
                  {step.points.map((pt) => (
                    <li key={pt}>
                      <Check size={16} className="transport-check-icon" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Join */}
      <section className="transport-why">
        <div className="transport-container">
          <motion.h2
            className="transport-section-title"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Why partner with Travio Ghana
          </motion.h2>
          <div className="transport-why-grid">
            {WHY_JOIN.map((item, i) => (
              <motion.div
                key={item.title}
                className="transport-why-card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div className="transport-why-icon">
                  <item.icon size={24} />
                </div>
                <h3 className="transport-why-title">{item.title}</h3>
                <p className="transport-why-desc">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About / Contact */}
      <section className="transport-about">
        <div className="transport-container">
          <motion.h2
            className="transport-section-title transport-about-title"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            About the Travio Ghana Partner Program
          </motion.h2>
          <motion.div
            className="transport-about-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <p className="transport-about-card-text">
              For inquiries, contact <strong>info@expeditiongotours.com</strong>
            </p>
            <a href="/contact-us" className="transport-btn transport-btn-contact">
              Contact Us
            </a>
          </motion.div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="transport-cta">
        <div className="transport-container">
          <motion.div
            className="transport-cta-inner"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="transport-cta-title">Ready to grow your transport business?</h2>
            <p className="transport-cta-subtitle">Join our network of transport partners and reach travelers worldwide.</p>
            <button type="button" className="transport-btn transport-btn-primary transport-btn-lg" onClick={handleSignUp}>
              Get started <ArrowRight size={18} />
            </button>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
