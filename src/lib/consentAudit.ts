/**
 * Records a consent decision on the server so the choice is demonstrable, not
 * just remembered in the visitor's browser.
 *
 * Best-effort by design: the local record is the source of truth for the app,
 * and a failed audit write must never block or break the banner. Uses
 * `keepalive` so the request survives the navigation that often follows a
 * choice.
 */

import { getApiBaseUrl, getAuthToken } from './auth'
import type { ConsentRecord } from './cookieConsent'

export async function recordConsentOnServer(record: ConsentRecord): Promise<void> {
  try {
    const base = getApiBaseUrl()
    if (!base) return
    const token = await getAuthToken().catch(() => null)
    await fetch(`${base}/consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        version: record.version,
        necessary: record.necessary,
        functional: record.functional,
        analytics: record.analytics,
        marketing: record.marketing,
        source: record.source,
        decidedAt: new Date(record.updatedAt).toISOString(),
        policyPath: '/cookies-policy',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }),
      keepalive: true,
    })
  } catch {
    /* the audit trail is a nice-to-have; the local record already stands */
  }
}
