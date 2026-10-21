/**
 * Vercel Analytics, mounted only while the visitor has granted analytics
 * consent. It obeys the same rule as GA4 in lib/googleAnalytics.ts: the consent
 * default is denied, so nothing may report before an explicit opt-in, and a
 * withdrawal must unmount the tag again. It used to render unconditionally in
 * main.tsx, which reported every visitor regardless of the choice.
 */
import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { hasConsent, subscribeConsent } from '../lib/cookieConsent'

export default function ConsentGatedAnalytics() {
  const [granted, setGranted] = useState(() => hasConsent('analytics'))
  useEffect(
    () => subscribeConsent(() => setGranted(hasConsent('analytics'))),
    [],
  )
  return granted ? <Analytics /> : null
}
