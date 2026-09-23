import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import './BackToHelpCentre.css'

/**
 * Shared navigation state token. The Help Centre hub attaches it to every
 * outbound link so destination pages can offer a context-aware return path
 * without showing a "back to Help Centre" affordance to visitors who arrived
 * from the navbar, footer or a search engine.
 */
export const HELP_CENTRE_STATE = { from: 'help-centre' } as const

/** True when the current history entry was created by the Help Centre hub. */
export function cameFromHelpCentre(state: unknown): boolean {
  return (state as { from?: string } | null)?.from === 'help-centre'
}

interface BackToHelpCentreProps {
  className?: string
  /**
   * Render only the back arrow (no label). The labelled chip communicates the
   * destination; the icon-only variant trades that for a compact circular
   * control in tight rails like the sticky FAQ nav.
   */
  iconOnly?: boolean
  /**
   * Render only when the user navigated here from the Help Centre. Used on
   * standalone marketing pages (About, Partnerships) that are also reachable
   * from the navbar and footer.
   */
  requireOrigin?: boolean
}

export default function BackToHelpCentre({ className, iconOnly = false, requireOrigin = false }: BackToHelpCentreProps) {
  const { t } = useTranslation()
  const location = useLocation()

  if (requireOrigin && !cameFromHelpCentre(location.state)) return null

  return (
    <Link
      to="/help-centre"
      className={`sh-back${className ? ` ${className}` : ''}${iconOnly ? ' sh-back--icon' : ''}`}
      aria-label={iconOnly ? t('support.backToHelp') : undefined}
    >
      <ArrowLeft size={iconOnly ? 18 : 16} aria-hidden="true" />
      {!iconOnly && t('support.backToHelp')}
    </Link>
  )
}
