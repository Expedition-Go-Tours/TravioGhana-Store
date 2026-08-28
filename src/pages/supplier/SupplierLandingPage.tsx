/**
 * Public "become a supplier" landing page (/supplier/list-experience).
 * Explains how the supplier platform works and answers common questions
 * via an FAQ accordion. Signed-out visitors land here from the navbar's
 * "List an Experience" link before being asked to sign in; the CTA on this
 * page routes signed-in users straight to the application form
 * (/supplier/register) and signed-out users through the sign-in flow first.
 *
 * @see components/Navbar.tsx (entry point)
 * @see pages/supplier/SupplierRegisterPage.tsx (application form)
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, animate } from 'framer-motion'
import {
  ClipboardList, BadgeCheck, Wallet, Rocket,
  ShieldCheck, Plane, LifeBuoy,
  Megaphone, ChevronDown,
} from 'lucide-react'
import image01Src from '../../assets/Image01.webp'
import image02Src from '../../assets/Image02.webp'
import image03Src from '../../assets/Image03.webp'
import image04Src from '../../assets/Image04.webp'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import AnimatedWave from '../../components/ui/AnimatedWave'
import { useAuthUser } from '../../hooks/useAuthUser'
import { setAuthReturnTo } from '../../lib/auth'
import './SupplierLandingPage.css'

const CAROUSEL_IMAGES = [
  { src: image01Src, alt: 'Travelers exploring a destination' },
  { src: image02Src, alt: 'Guided tour experience' },
  { src: image03Src, alt: 'African landscape adventure' },
  { src: image04Src, alt: 'Cultural experience' },
]

function ImageCarousel() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const goTo = useCallback((i: number) => {
    setIndex(((i % CAROUSEL_IMAGES.length) + CAROUSEL_IMAGES.length) % CAROUSEL_IMAGES.length)
  }, [])

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length)
    }, 4500)
    return () => window.clearInterval(id)
  }, [paused])

  return (
    <div
      className="supplier-landing-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div
        className="supplier-landing-carousel-track"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {CAROUSEL_IMAGES.map((img, i) => (
          <div className="supplier-landing-carousel-slide" key={img.src}>
            <img src={img.src} alt={img.alt} loading={i === 0 ? 'eager' : 'lazy'} />
          </div>
        ))}
      </div>

      <div className="supplier-landing-carousel-dots">
        {CAROUSEL_IMAGES.map((img, i) => (
          <button
            key={img.src}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            className={`supplier-landing-carousel-dot${i === index ? ' active' : ''}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  )
}

interface SupplierLandingPageProps {
  onOpenAuth?: (mode: 'signin' | 'signup') => void
}

const HOW_IT_WORKS = [
  {
    icon: ClipboardList,
    title: 'Sign up & list your activity',
    desc: 'Create your account and add your tour or experience — our system guides you through every step.',
  },
  {
    icon: BadgeCheck,
    title: 'Get reviewed & approved',
    desc: 'Our team checks every listing for quality and safety before it goes live, so travelers can book with confidence.',
  },
  {
    icon: Rocket,
    title: 'Go live & get discovered',
    desc: 'Your activity is promoted across our site and partner channels to a global audience of travelers.',
  },
  {
    icon: Wallet,
    title: 'Get paid on your schedule',
    desc: 'Receive consolidated payouts monthly or bi-weekly for every completed booking, minus our commission.',
  },
]

const WHY_SELL = [
  {
    icon: Plane,
    title: 'Reach travelers worldwide',
    desc: 'Get discovered by a global audience of adventure travelers actively looking for unique experiences.',
  },
  {
    icon: Megaphone,
    title: 'We handle the marketing',
    desc: 'Social media and email campaigns put your activity in front of the right travelers — all done for you.',
  },
  {
    icon: ShieldCheck,
    title: 'Registered & regulated',
    desc: 'Fully registered with the Ghana Tourism Authority (GTA), so you partner with a compliant, trustworthy platform.',
  },
  {
    icon: LifeBuoy,
    title: 'Support when you need it',
    desc: 'A dedicated team is on hand to help you get set up, resolve issues fast, and keep your listings running smoothly.',
  },
]

interface FaqItem {
  question: string
  answer: string
}

const FAQ_GROUPS: { heading: string; items: FaqItem[] }[] = [
  {
    heading: 'Getting Started',
    items: [
      {
        question: 'What is Travio Ghana Tours?',
        answer: 'Travio Ghana Tours is an online marketplace for tours, activities, and attractions. It connects travelers with local tour operators and activity providers in destinations around the world, making it easy for people to discover and book unique travel experiences.',
      },
      {
        question: 'Is Travio Ghana Tours Ltd registered and regulated?',
        answer: 'Yes! Travio Ghana Tours Ltd is fully registered and regulated with the Ghana Tourism Authority (GTA). We comply with all local tourism laws and regulations to ensure that our tours meet the highest standards of safety, professionalism, and quality. As a partner, you can be confident that you\u2019re working with a reputable, compliant platform that prioritizes the integrity of your business.',
      },
      {
        question: 'Who can register?',
        answer: 'We collaborate with both companies and independent operators who are registered, legally compliant, and provide high-quality travel activities. We only onboard responsible, socially just, and environmentally sustainable activities, from walking tours and culinary experiences to cruises, day trips, and hop-on hop-off buses. The list of restricted activities can be found in our platform guidelines.',
      },
      {
        question: 'Will my activity be accepted?',
        answer: 'To ensure only high-quality experiences make it onto our platform, our experts will conduct a thorough review. This process protects your brand by maintaining standards that travelers trust and value.',
      },
      {
        question: 'What happens when I sign up?',
        answer: 'After signing up, simply confirm your email to receive access to your in-portal page, where you can add your activity to our platform. The system will guide you through the process and ensure a seamless experience so your activity goes online as soon as possible. Follow our email instructions and also fill out your key business documentation information right away — without it, we\u2019re unable to process payments and you may experience payment delays after you receive bookings.',
      },
      {
        question: 'Are there any obligations on my side?',
        answer: 'You are not obligated in any way. You have the freedom to deactivate your activity or account at any time. We also provide you with complete control over your availability and pricing, which you can modify as desired.',
      },
    ],
  },
  {
    heading: 'Pricing & Payments',
    items: [
      {
        question: 'How much does it cost?',
        answer: 'There is no cost for adding and maintaining an activity on the platform. You will only be charged a commission fee for bookings that are successful.',
      },
      {
        question: 'What is the commission fee?',
        answer: 'It\u2019s a flat 10% commission fee on every tour booked through the platform \u2014 you keep the remaining 90% of each booking. The fee covers platform management, tools, insights, and promoting your activities across dozens of marketing channels.',
      },
      {
        question: 'How and when do I get paid?',
        answer: 'You can choose to receive either monthly payments at no extra cost, or bi-monthly payments with a small surcharge. In each pay run we pay all fulfilled bookings, minus the commission fee. We\u2019ll need some key business information from you beforehand in order to pay you on-time, such as your company registration number, tax identification number, and bank details.',
      },
      {
        question: 'How are client payments handled?',
        answer: 'We consolidate all client payments for the tours booked through our platform and distribute them to you on a monthly or bi-weekly basis, depending on your preference. This streamlined process ensures that you receive payments on time, without the hassle of managing multiple transactions.',
      },
      {
        question: 'How fast can I expect to receive payments for my tours?',
        answer: 'We understand the importance of timely payments for your business, so we offer fast payment processing. Once your tours are booked, payments are consolidated and disbursed to you on a monthly or bi-weekly basis, ensuring you receive your earnings quickly and can reinvest in your business.',
      },
    ],
  },
  {
    heading: 'Growing Your Business',
    items: [
      {
        question: 'How will selling on Travio Ghana Tours Ltd help grow my business?',
        answer: 'By listing your tours on Travio Ghana Tours Ltd, you gain exposure to a global audience of adventure travelers who may not have found your business otherwise. Our marketing team actively promotes all our partners\u2019 tours, helping to drive more traffic and potential customers to your offerings. You\u2019ll also benefit from our established reputation, trust, and ongoing customer support.',
      },
      {
        question: 'What makes Travio Ghana Tours Ltd different from other platforms?',
        answer: 'Unlike other platforms, Travio Ghana Tours Ltd specializes in adventure travel and bespoke expeditions, making us the go-to choice for travelers seeking unique, off-the-beaten-path experiences. We provide personalized support to our partners and ensure your tours are showcased to the right audience with minimal effort on your part.',
      },
      {
        question: 'Do I need any special technical skills to sell my tours?',
        answer: 'Not at all! Our platform is designed to be easy to use, even for those with limited technical experience. Once you register as a partner, you\u2019ll have access to a simple dashboard where you can easily upload, manage, and update your tours, with support along the way.',
      },
      {
        question: 'Do you collaborate with other major tourism platforms?',
        answer: 'Absolutely! We work with some of the best global partners in the tourism industry, including Viator, TripAdvisor, and GetYourGuide. These well-known platforms help expand your reach and increase bookings by connecting you with millions of potential travelers worldwide.',
      },
      {
        question: 'How does Travio Ghana Tours Ltd help promote my tours?',
        answer: 'We provide comprehensive marketing support to help your tours reach a wider audience \u2014 targeted digital marketing campaigns, social media promotions, and email newsletters. We also feature partner tours on our website, blog, and in promotional materials, ensuring your offerings get the visibility they deserve.',
      },
      {
        question: 'Will I be featured on social media and other marketing channels?',
        answer: 'Yes! As a partner, your tours will be promoted across our social media platforms (Facebook, Instagram, Twitter, etc.), as well as through paid advertisements and our travel blog. We regularly highlight our partners\u2019 tours through eye-catching posts, storytelling, and customer testimonials to generate bookings.',
      },
      {
        question: 'Why should I choose Travio Ghana Tours Ltd over other platforms?',
        answer: 'As Ghana\u2019s first open tour platform, Travio Ghana Tours Ltd offers something no other platform can: a local, authentic experience backed by global reach. We combine local expertise with international marketing strategies to ensure your tours stand out.',
      },
    ],
  },
]

function FaqAccordion({ groups }: { groups: typeof FAQ_GROUPS }) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  return (
    <div className="supplier-faq-groups">
      {groups.map((group) => (
        <div key={group.heading} className="supplier-faq-group">
          <h3 className="supplier-faq-group-heading">{group.heading}</h3>
          <div className="supplier-faq-list">
            {group.items.map((item, i) => {
              const key = `${group.heading}-${i}`
              const isOpen = openKey === key
              return (
                <div key={key} className={`supplier-faq-item${isOpen ? ' supplier-faq-item-open' : ''}`}>
                  <button
                    type="button"
                    className="supplier-faq-question"
                    onClick={() => setOpenKey(isOpen ? null : key)}
                    aria-expanded={isOpen}
                  >
                    <span>{item.question}</span>
                    <ChevronDown size={18} className="supplier-faq-chevron" strokeWidth={2.2} />
                  </button>
                  <motion.div
                    className="supplier-faq-answer-wrap"
                    initial={false}
                    animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    <p className="supplier-faq-answer">{item.answer}</p>
                  </motion.div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SupplierLandingPage({ onOpenAuth }: SupplierLandingPageProps) {
  const navigate = useNavigate()
  const user = useAuthUser()

  const handleBecomeSupplier = () => {
    if (!user) {
      setAuthReturnTo('/supplier/register')
    }
    navigate('/supplier/register')
  }

  const handleReadFaq = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const target = document.getElementById('supplier-landing-faq')
    if (!target) return
    const start = window.scrollY
    const end = target.getBoundingClientRect().top + window.scrollY
    animate(start, end, {
      duration: 0.8,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate: (value) => window.scrollTo(0, value),
    })
  }

  return (
    <AnimatePresence>
      <motion.div
        key="supplier-landing"
        className="supplier-landing-page"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
      <Navbar onOpenAuth={onOpenAuth} />

      {/* Hero */}
      <section className="supplier-landing-hero">
        <AnimatedWave
          colorFrom="#1ba845"
          colorTo="#0f2418"
          speed={0.8}
          amplitude={30}
          wireframe
          showParticles
          particleSize={4}
          resolution={60}
          opacity={0.35}
          cameraX={0}
          cameraY={160}
          cameraZ={250}
          className="z-0"
        />
        <div className="supplier-landing-hero-inner">
          <div className="supplier-landing-hero-copy">
            <h1 className="supplier-landing-hero-title">
              Share your experience with travelers around the world
            </h1>
            <p className="supplier-landing-hero-subtitle">
              List your tours and activities on Travio Ghana Tours and reach adventure travelers
              actively searching for their next unforgettable trip.
            </p>
            <div className="supplier-landing-hero-actions">
              <button type="button" className="supplier-landing-cta-primary" onClick={handleBecomeSupplier}>
                Become a Supplier
              </button>
              <a href="#supplier-landing-faq" className="supplier-landing-cta-secondary" onClick={handleReadFaq}>
                Read the FAQ
              </a>
            </div>
          </div>
          <ImageCarousel />
        </div>
      </section>

      {/* How it works */}
      <section className="supplier-landing-section">
        <div className="supplier-landing-container">
          <div className="supplier-landing-section-head">
            <span className="supplier-landing-eyebrow">How it works</span>
            <h2 className="supplier-landing-section-title">From sign-up to your first booking</h2>
          </div>
          <div className="supplier-landing-steps">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} className="supplier-landing-step-card">
                <span className="supplier-landing-step-number">{i + 1}</span>
                <div className="supplier-landing-step-icon">
                  <step.icon size={22} strokeWidth={1.8} />
                </div>
                <h3 className="supplier-landing-step-title">{step.title}</h3>
                <p className="supplier-landing-step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why sell with us */}
      <section className="supplier-landing-section supplier-landing-section-alt">
        <div className="supplier-landing-container">
          <div className="supplier-landing-section-head">
            <span className="supplier-landing-eyebrow">Why Travio Ghana Tours</span>
            <h2 className="supplier-landing-section-title">Built to help your business grow</h2>
          </div>
          <div className="supplier-landing-why-grid">
            {WHY_SELL.map((item) => (
              <div key={item.title} className="supplier-landing-why-card">
                <div className="supplier-landing-why-icon">
                  <item.icon size={22} strokeWidth={1.8} />
                </div>
                <h3 className="supplier-landing-why-title">{item.title}</h3>
                <p className="supplier-landing-why-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="supplier-landing-section" id="supplier-landing-faq">
        <div className="supplier-landing-container supplier-landing-faq-container">
          <div className="supplier-landing-section-head">
            <span className="supplier-landing-eyebrow">FAQ</span>
            <h2 className="supplier-landing-section-title">Frequently asked questions</h2>
            <p className="supplier-landing-section-desc">
              Everything you need to know before you list your first experience.
            </p>
          </div>
          <FaqAccordion groups={FAQ_GROUPS} />
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="supplier-landing-cta-band">
        <div className="supplier-landing-cta-band-inner">
          <h2>Ready to list your experience?</h2>
          <p>Join Travio Ghana Tours today — it only takes a few minutes to get started.</p>
          <button type="button" className="supplier-landing-cta-primary" onClick={handleBecomeSupplier}>
            Become a Supplier
          </button>
        </div>
      </section>

      <Footer />
      </motion.div>
    </AnimatePresence>
  )
}
