/**
 * Props for a control whose feature has not been built yet.
 *
 * Spread onto the element and add the `is-coming-soon` class:
 *
 *   const comingSoon = useComingSoon()
 *   <button {...comingSoon} className="my-btn is-coming-soon">Save</button>
 *
 * The control deliberately keeps the `disabled` attribute OFF: a disabled
 * button does not fire mouse events in Chrome/Safari, so its `title` tooltip
 * would never show. Instead it stays hoverable, intercepts its own click, and
 * announces itself as disabled via `aria-disabled`.
 *
 * @see index.css (.is-coming-soon)
 */
import { useTranslation } from 'react-i18next'

export interface ComingSoonProps {
  title: string
  'aria-disabled': true
}

export function useComingSoon(): ComingSoonProps {
  const { t } = useTranslation()
  return {
    title: t('partnerships.comingSoon', 'Coming soon'),
    'aria-disabled': true,
  }
}
