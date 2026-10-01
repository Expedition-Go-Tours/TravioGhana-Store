import type { ReactNode } from 'react'
import { COMPANY_URL } from '../../lib/support'

interface CompanyLinkProps {
  /**
   * Link text. Defaults to the registered name; pass
   * "Expedition-Go Tours" for the trading-name mentions.
   */
  children?: ReactNode
}

/**
 * Inline backlink to the operating company's site, for legal documents and
 * policy pages that name Expedition-Go Tours Ltd. Opens in a new tab so a
 * reader does not lose their place in a policy, matching the company links
 * used elsewhere on the site.
 */
export default function CompanyLink({ children = 'Expedition-Go Tours Ltd' }: CompanyLinkProps) {
  return (
    <a href={COMPANY_URL} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}
