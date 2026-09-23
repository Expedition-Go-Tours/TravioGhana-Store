/**
 * Public "become a supplier" landing page (/supplier/list-experience).
 * Explains how the supplier platform works and answers common questions
 * via an FAQ accordion. Signed-out visitors land here from the footer's
 * "As Supplier/tour operator" link; the CTA on this page routes signed-in
 * users straight to the new tour-operator application form
 * (/partners/tour-operators/apply) and signed-out users through the
 * sign-in flow first.
 *
 * @see components/Footer.tsx (entry point)
 * @see pages/partner/PartnerApplyPage.tsx (new application form)
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList, BadgeCheck, Wallet, Rocket,
  ShieldCheck, Plane, LifeBuoy,
  Megaphone, ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react'
import tour1 from '../../assets/tours/tour1.avif'
import tour2 from '../../assets/tours/tour2.avif'
import tour3 from '../../assets/tours/tour3.avif'
import tour4 from '../../assets/tours/tour4.avif'
import tour5 from '../../assets/tours/tour5.avif'
import tour6 from '../../assets/tours/tour6.avif'
import tour7 from '../../assets/tours/tour7.avif'
import tour8 from '../../assets/tours/tour8.avif'
import Footer from '../../components/Footer'
import PhoneShowcaseSection from './PhoneShowcaseSection'
import { useAuthUser } from '../../hooks/useAuthUser'
import { setAuthReturnTo } from '../../lib/auth'
import './SupplierLandingPage.css'

const GALLERY_CARDS = [
  { src: tour1, label: 'Guided Tours' },
  { src: tour2, label: 'Cultural Experiences' },
  { src: tour3, label: 'Adventure & Wildlife' },
  { src: tour4, label: 'Nature Walks' },
  { src: tour5, label: 'City Exploration' },
  { src: tour6, label: 'Beach & Water Sports' },
  { src: tour7, label: 'Historical Tours' },
  { src: tour8, label: 'Food & Culinary' },
]

function GalleryCarousel({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => {
      const container = scrollRef.current
      if (!container || !container.firstChild) return
      const cardWidth = (container.firstChild as HTMLElement).offsetWidth + 16
      if (cardWidth <= 0) return
      const maxScroll = container.scrollWidth - container.clientWidth
      const next = container.scrollLeft + cardWidth
      container.scrollTo({ left: next > maxScroll ? 0 : next, behavior: 'smooth' })
    }, 4000)
    return () => window.clearInterval(id)
  }, [paused, scrollRef])

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollRef.current
    if (!container || !container.firstChild) return
    const cardWidth = (container.firstChild as HTMLElement).offsetWidth + 16
    const scrollAmount = direction === 'left' ? -cardWidth : cardWidth
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }

  return (
    <div className="supplier-landing-gallery-wrapper">
      <button
        type="button"
        className="supplier-landing-gallery-arrow supplier-landing-gallery-arrow--left"
        onClick={() => scroll('left')}
        aria-label="Scroll left"
      >
        <ChevronLeft size={24} />
      </button>
      <div
        className="supplier-landing-gallery-track"
        ref={scrollRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {GALLERY_CARDS.map((card, i) => (
          <div className="supplier-landing-gallery-card" key={card.src}>
            <img src={card.src} alt={card.label} loading={i === 0 ? 'eager' : 'lazy'} />
            <div className="supplier-landing-gallery-logo">
              <img src="/logo.png" alt="Travio Ghana" />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="supplier-landing-gallery-arrow supplier-landing-gallery-arrow--right"
        onClick={() => scroll('right')}
        aria-label="Scroll right"
      >
        <ChevronRight size={24} />
      </button>
    </div>
  )
}

interface ScrollDotsProps {
  count: number
  scrollRef: React.RefObject<HTMLDivElement | null>
  className?: string
}function ScrollDots({ count, scrollRef, className = '' }: ScrollDotsProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft
      const cardWidth = container.firstChild instanceof HTMLElement ? container.firstChild.offsetWidth + 16 : 200
      const newIndex = Math.round(scrollLeft / cardWidth)
      setActiveIndex(Math.min(Math.max(newIndex, 0), count - 1))
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [scrollRef, count])

  const scrollToCard = (index: number) => {
    const container = scrollRef.current
    if (!container || !container.firstChild) return
    const cardWidth = (container.firstChild as HTMLElement).offsetWidth + 16
    container.scrollTo({ left: index * cardWidth, behavior: 'smooth' })
  }

  return (
    <div className={`supplier-landing-scroll-dots ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          className={`supplier-landing-scroll-dot${i === activeIndex ? ' active' : ''}`}
          onClick={() => scrollToCard(i)}
          aria-label={`Go to card ${i + 1}`}
        />
      ))}
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
    desc: 'Create your account and add your tour or experience, and our system guides you through every step.',
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
    desc: 'Social media and email campaigns put your activity in front of the right travelers, all done for you.',
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
        question: 'What is Travio Ghana?',
        answer: 'Travio Ghana is an online marketplace for tours, activities, and attractions. It connects travelers with local tour operators and activity providers in destinations around the world, making it easy for people to discover and book unique travel experiences.',
      },
      {
        question: 'Is Expedition-Go Tours Ltd registered and regulated?',
        answer: 'Yes! Expedition-Go Tours Ltd is fully registered and regulated with the Ghana Tourism Authority (GTA). We comply with all local tourism laws and regulations to ensure that our tours meet the highest standards of safety, professionalism, and quality. As a partner, you can be confident that you\u2019re working with a reputable, compliant platform that prioritizes the integrity of your business.',
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
        answer: 'After signing up, simply confirm your email to receive access to your in-portal page, where you can add your activity to our platform. The system will guide you through the process and ensure a seamless experience so your activity goes online as soon as possible. Follow our email instructions and also fill out your key business documentation information right away, as without it we\u2019re unable to process payments and you may experience payment delays after you receive bookings.',
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
        answer: 'It\u2019s a flat 15% commission fee on every tour booked through the platform, so you keep the remaining 85% of each booking. The fee covers platform management, tools, insights, and promoting your activities across dozens of marketing channels.',
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
        question: 'How will selling on Expedition-Go Tours Ltd help grow my business?',
        answer: 'By listing your tours on Expedition-Go Tours Ltd, you gain exposure to a global audience of adventure travelers who may not have found your business otherwise. Our marketing team actively promotes all our partners\u2019 tours, helping to drive more traffic and potential customers to your offerings. You\u2019ll also benefit from our established reputation, trust, and ongoing customer support.',
      },
      {
        question: 'What makes Expedition-Go Tours Ltd different from other platforms?',
        answer: 'Unlike other platforms, Expedition-Go Tours Ltd specializes in adventure travel and bespoke expeditions, making us the go-to choice for travelers seeking unique, off-the-beaten-path experiences. We provide personalized support to our partners and ensure your tours are showcased to the right audience with minimal effort on your part.',
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
        question: 'How does Expedition-Go Tours Ltd help promote my tours?',
        answer: 'We provide comprehensive marketing support to help your tours reach a wider audience \u2014 targeted digital marketing campaigns, social media promotions, and email newsletters. We also feature partner tours on our website, blog, and in promotional materials, ensuring your offerings get the visibility they deserve.',
      },
      {
        question: 'Will I be featured on social media and other marketing channels?',
        answer: 'Yes! As a partner, your tours will be promoted across our social media platforms (Facebook, Instagram, Twitter, etc.), as well as through paid advertisements and our travel blog. We regularly highlight our partners\u2019 tours through eye-catching posts, storytelling, and customer testimonials to generate bookings.',
      },
      {
        question: 'Why should I choose Expedition-Go Tours Ltd over other platforms?',
        answer: 'As Ghana\u2019s first open tour platform, Expedition-Go Tours Ltd offers something no other platform can: a local, authentic experience backed by global reach. We combine local expertise with international marketing strategies to ensure your tours stand out.',
      },
    ],
  },
]

function FaqAccordion({ groups }: { groups: typeof FAQ_GROUPS }) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  return (
    <div className="supplier-faq-groups">
      {groups.map((group, groupIdx) => (
        <motion.div
          key={group.heading}
          className="supplier-faq-group"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-30px' }}
          transition={{ duration: 0.4, delay: groupIdx * 0.1 }}
        >
          <h3 className="supplier-faq-group-heading">{group.heading}</h3>
          <div className="supplier-faq-list">
            {group.items.map((item, i) => {
              const key = `${group.heading}-${i}`
              const isOpen = openKey === key
              return (
                <motion.div
                  key={key}
                  className={`supplier-faq-item${isOpen ? ' supplier-faq-item-open' : ''}`}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <button
                    type="button"
                    className="supplier-faq-question"
                    onClick={() => setOpenKey(isOpen ? null : key)}
                    aria-expanded={isOpen}
                  >
                    <span>{item.question}</span>
                    <motion.span
                      className="supplier-faq-chevron"
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <ChevronDown size={18} strokeWidth={2.2} />
                    </motion.span>
                  </button>
                  <motion.div
                    className="supplier-faq-answer-wrap"
                    initial={false}
                    animate={{
                      height: isOpen ? 'auto' : 0,
                      opacity: isOpen ? 1 : 0,
                    }}
                    transition={{
                      height: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
                      opacity: { duration: 0.25, ease: 'easeInOut' },
                    }}
                  >
                    <motion.p
                      className="supplier-faq-answer"
                      initial={{ y: -10 }}
                      animate={{ y: isOpen ? 0 : -10 }}
                      transition={{ duration: 0.3, delay: isOpen ? 0.1 : 0 }}
                    >
                      {item.answer}
                    </motion.p>
                  </motion.div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export default function SupplierLandingPage({ onOpenAuth }: SupplierLandingPageProps) {
  const navigate = useNavigate()
  const user = useAuthUser()
  const stepsScrollRef = useRef<HTMLDivElement>(null)
  const whyScrollRef = useRef<HTMLDivElement>(null)
  const galleryScrollRef = useRef<HTMLDivElement>(null)

  const handleBecomeSupplier = () => {
    if (!user) {
      setAuthReturnTo('/partners/tour-operators/apply')
      onOpenAuth?.('signup')
      return
    }
    navigate('/partners/tour-operators/apply')
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
      {/* Phone Showcase — replaces the old hero */}
      <PhoneShowcaseSection onBecomeSupplier={handleBecomeSupplier} />

      {/* How it works */}
      <section className="supplier-landing-section">
        <div className="supplier-landing-container">
          <motion.div
            className="supplier-landing-section-head"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
          >
            <span className="supplier-landing-eyebrow">How it works</span>
            <h2 className="supplier-landing-section-title">From sign-up to your first booking</h2>
          </motion.div>
          <div className="supplier-landing-steps" ref={stepsScrollRef}>
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.title}
                className="supplier-landing-step-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <span className="supplier-landing-step-number">{i + 1}</span>
                <div className="supplier-landing-step-icon">
                  <step.icon size={22} strokeWidth={1.8} />
                </div>
                <h3 className="supplier-landing-step-title">{step.title}</h3>
                <p className="supplier-landing-step-desc">{step.desc}</p>
              </motion.div>
            ))}
          </div>
          <ScrollDots count={HOW_IT_WORKS.length} scrollRef={stepsScrollRef} className="supplier-landing-steps-dots" />
        </div>
      </section>

      {/* Why sell with us */}
      <section className="supplier-landing-section supplier-landing-section-alt">
        <div className="supplier-landing-container">
          <motion.div
            className="supplier-landing-section-head"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
          >
            <span className="supplier-landing-eyebrow">Why Travio Ghana</span>
            <h2 className="supplier-landing-section-title">Built to help your business grow</h2>
          </motion.div>
          <div className="supplier-landing-why-grid" ref={whyScrollRef}>
            {WHY_SELL.map((item, i) => (
              <motion.div
                key={item.title}
                className="supplier-landing-why-card"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div className="supplier-landing-why-icon">
                  <item.icon size={22} strokeWidth={1.8} />
                </div>
                <div className="supplier-landing-why-content">
                  <h3 className="supplier-landing-why-title">{item.title}</h3>
                  <p className="supplier-landing-why-desc">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <ScrollDots count={WHY_SELL.length} scrollRef={whyScrollRef} className="supplier-landing-why-dots" />
        </div>
      </section>

      {/* Gallery carousel */}
      <section className="supplier-landing-section supplier-landing-gallery-section">
        <div className="supplier-landing-container">
          <motion.div
            className="supplier-landing-section-head"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
          >
            <span className="supplier-landing-eyebrow">Gallery</span>
            <h2 className="supplier-landing-section-title">A glimpse of the experiences you can offer</h2>
            <p className="supplier-landing-section-desc">
              From guided tours to adventure and culture, show travelers what they can expect.
            </p>
          </motion.div>
          <GalleryCarousel scrollRef={galleryScrollRef} />
          <ScrollDots count={GALLERY_CARDS.length} scrollRef={galleryScrollRef} className="supplier-landing-gallery-dots" />
        </div>
      </section>

      {/* FAQ */}
      <section className="supplier-landing-section" id="supplier-landing-faq">
        <div className="supplier-landing-container supplier-landing-faq-container">
          <motion.div
            className="supplier-landing-section-head"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
          >
            <span className="supplier-landing-eyebrow">FAQ</span>
            <h2 className="supplier-landing-section-title">Frequently asked questions</h2>
            <p className="supplier-landing-section-desc">
              Everything you need to know before you list your first experience.
            </p>
          </motion.div>
          <FaqAccordion groups={FAQ_GROUPS} />
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="supplier-landing-cta-band">
        <div className="supplier-landing-cta-band-inner">
          <h2>Ready to list your experience?</h2>
          <p>Join Travio Ghana today — it only takes a few minutes to get started.</p>
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
