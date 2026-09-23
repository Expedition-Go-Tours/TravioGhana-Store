import { useState, useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../Footer'
import '../../styles/LegalPage.css'

interface TOCItem {
  id: string
  num: string
  label: string
}

interface LegalPageShellProps {
  eyebrow: string
  title: string
  description: string
  updated: string
  summary: { icon: string; text: string }[]
  toc: TOCItem[]
  /** The active tab on the policy-tab bar. */
  activeTab: 'supplier-terms' | 'terms' | 'privacy' | 'cookies'
  children: ReactNode
}

const POLICY_TABS = [
  { key: 'supplier-terms' as const, label: 'Supplier Terms', to: '/supplier-terms' },
  { key: 'terms' as const, label: 'Terms & Conditions', to: '/terms-and-conditions' },
  { key: 'privacy' as const, label: 'Privacy Policy', to: '/privacy-policy' },
  { key: 'cookies' as const, label: 'Cookies Policy', to: '/cookies-policy' },
]

/**
 * Shared layout for legal/policy pages — the green hero card, policy-tab bar,
 * sticky TOC sidebar (with scroll-spy + help box) and the content slot. Renders
 * the app's Footer and a back-to-top button. Matches the standalone prototype.
 */
export default function LegalPageShell({
  eyebrow,
  title,
  description,
  updated,
  summary,
  toc,
  activeTab,
  children,
}: LegalPageShellProps) {
  const [activeTOC, setActiveTOC] = useState<string | null>(null)
  const [showToTop, setShowToTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowToTop(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll-spy: highlight the TOC item for the section currently in view.
  useEffect(() => {
    const sections = toc
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveTOC(entry.target.id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )

    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [toc])

  return (
    <main style={{ paddingTop: 80, background: '#f7f7f3' }}>
      {/* Hero card */}
      <section className="leg-wrap leg-hero">
        <div>
          <div className="leg-kicker">{eyebrow}</div>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="leg-updated"><i></i>{updated}</div>
        </div>
        <aside className="leg-summary">
          <h2>Important</h2>
          <ul>
            {summary.map((s, i) => (
              <li key={i}><i>{s.icon}</i>{s.text}</li>
            ))}
          </ul>
        </aside>
      </section>

      {/* Policy-tab bar */}
      <div style={{ padding: '18px 0' }}>
        <div className="leg-wrap leg-tabs">
          {POLICY_TABS.map((tab) => (
            <Link
              key={tab.key}
              to={tab.to}
              className={tab.key === activeTab ? 'active' : ''}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* TOC sidebar + content */}
      <div className="leg-wrap leg-layout">
        <aside className="leg-sidebar">
          <div className="leg-label">On this page</div>
          <nav className="leg-toc">
            {toc.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={activeTOC === item.id ? 'current' : ''}
                onClick={() => setActiveTOC(item.id)}
              >
                <span className="leg-toc-num">{item.num}</span>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="leg-helpbox">
            <b>Need help?</b>
            <p>Questions about this document or your relationship with Travio Ghana?</p>
            <Link to="/contact-us">Contact support →</Link>
          </div>
        </aside>

        <div className="leg-content">
          {children}
        </div>
      </div>

      <Footer />

      <button
        type="button"
        className={`leg-to-top${showToTop ? ' show' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
      >
        ↑
      </button>
    </main>
  )
}
