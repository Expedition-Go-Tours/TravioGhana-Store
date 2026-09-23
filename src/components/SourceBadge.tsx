interface SourceBadgeProps {
  source: string
  url?: string
}

export default function SourceBadge({ source, url }: SourceBadgeProps) {
  const Tag = url ? 'a' : 'span'
  const linkProps = url ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : {}

  if (source === 'TRIPADVISOR') {
    return (
      <Tag className="ext-source-badge ext-source-badge--tripadvisor" {...linkProps}>
        <svg className="ext-source-badge__icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="32" fill="#34E0A1" />
          <g transform="translate(10, 14)">
            {/* Left eye */}
            <circle cx="10" cy="14" r="8" fill="#000" />
            <circle cx="10" cy="14" r="5" fill="#34E0A1" />
            <circle cx="10" cy="14" r="2.5" fill="#000" />
            {/* Right eye */}
            <circle cx="34" cy="14" r="8" fill="#000" />
            <circle cx="34" cy="14" r="5" fill="#34E0A1" />
            <circle cx="34" cy="14" r="2.5" fill="#000" />
            {/* Beak */}
            <path d="M22 18 L20 24 L24 24 Z" fill="#000" />
            {/* Ears/tufts */}
            <path d="M4 8 L8 2 L12 8" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M32 8 L36 2 L40 8" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
            {/* Head outline */}
            <path d="M4 8 Q4 28 22 28 Q40 28 40 8" fill="none" stroke="#000" strokeWidth="2" />
          </g>
        </svg>
        <span className="ext-source-badge__text">View on TripAdvisor</span>
      </Tag>
    )
  }

  if (source === 'GETYOURGUIDE') {
    return (
      <Tag className="ext-source-badge ext-source-badge--gyg" {...linkProps}>
        <svg className="ext-source-badge__icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="8" fill="#E63C2F" />
          <text x="32" y="28" textAnchor="middle" fill="#fff" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="16" letterSpacing="-0.5">GET</text>
          <text x="32" y="44" textAnchor="middle" fill="#fff" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="16" letterSpacing="-0.5">YOUR</text>
          <text x="32" y="58" textAnchor="middle" fill="#fff" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="13" letterSpacing="-0.5">GUIDE</text>
        </svg>
        <span className="ext-source-badge__text">View on GetYourGuide</span>
      </Tag>
    )
  }

  if (source === 'GOOGLE') {
    return (
      <Tag className="ext-source-badge ext-source-badge--google" {...linkProps}>
        <svg className="ext-source-badge__icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="12" fill="#fff" stroke="#e5e7eb" strokeWidth="1" />
          <path d="M32 16c4.2 0 7.6 1.4 10.4 4.1l-4.3 4.3c-1.6-1.6-3.5-2.4-6.1-2.4-5.2 0-9.4 4.3-9.4 9.5s4.2 9.5 9.4 9.5c4.5 0 7.5-2.6 8.3-6.3H32v-5.6h14.8c.2.9.3 1.9.3 3.1 0 8.2-5.5 14.1-15.1 14.1C22.6 46.3 16 39.7 16 31.4S22.6 16.5 32 16.5z" fill="#4285F4"/>
          <path d="M32 16c4.2 0 7.6 1.4 10.4 4.1l-4.3 4.3c-1.6-1.6-3.5-2.4-6.1-2.4" fill="#EA4335"/>
          <path d="M16.9 31.4c0-2.8.8-5.4 2.1-7.6l-5.1-4C11.3 23.2 10 27.1 10 31.4s1.3 8.2 3.9 11.6l5.1-4c-1.3-2.2-2.1-4.8-2.1-7.6z" fill="#FBBC05"/>
          <path d="M32 16c4.2 0 7.6 1.4 10.4 4.1l-4.3 4.3c-1.6-1.6-3.5-2.4-6.1-2.4" fill="#EA4335"/>
          <path d="M46.8 20.1C49.6 22.9 51.2 26.8 51.2 31c0 3.5-1.1 6.4-2.8 8.8" fill="#34A853" opacity="0"/>
        </svg>
        <span className="ext-source-badge__text">View on Google</span>
      </Tag>
    )
  }

  return null
}
