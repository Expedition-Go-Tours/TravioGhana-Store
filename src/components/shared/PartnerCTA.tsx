import type { ReactNode } from 'react'
import RevealOnScroll from './RevealOnScroll'

interface PartnerCTAProps {
  eyebrow?: string
  heading: ReactNode
  description: string
  buttonLabel: string
  buttonHref?: string
  onButtonClick?: () => void
  /** Accent colour for the CTA background (default: forest green). */
  accent?: string
}

/**
 * Closing CTA block shared by all partner landing pages.
 * Matches the `.cta` / `.closing` pattern in the HTML templates.
 */
export default function PartnerCTA({
  eyebrow,
  heading,
  description,
  buttonLabel,
  buttonHref,
  onButtonClick,
  accent,
}: PartnerCTAProps) {
  const Tag = buttonHref ? 'a' : 'button'
  return (
    <div className="wrap" style={{ paddingTop: 20 }}>
      <RevealOnScroll>
        <div className="eg-cta" style={accent ? { background: accent } : undefined}>
          {eyebrow && <div className="eg-cta-eyebrow">{eyebrow}</div>}
          <h2>{heading}</h2>
          <p>{description}</p>
          <Tag
            className="eg-cta-btn"
            href={buttonHref}
            onClick={onButtonClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 11,
              padding: '16px 22px',
              background: '#fff',
              color: accent ? '#fff' : '#15201d',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
              marginTop: 28,
              position: 'relative',
              zIndex: 2,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {buttonLabel}
          </Tag>
        </div>
      </RevealOnScroll>
    </div>
  )
}