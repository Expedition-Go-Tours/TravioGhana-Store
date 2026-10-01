/**
 * Cross-storefront session handoff.
 *
 * expeditiongotours.com and travioghana.com are separate apex domains, so
 * neither can read the other's localStorage and no cookie can be scoped across
 * both. Identity is already shared server-side — one `User` table, and an
 * access token whose only claim is `{ userId }` — so what is missing is purely
 * the trip across the origin boundary.
 *
 * That trip is a one-time ticket: minted by the site you are leaving,
 * exchanged by the site you arrive at, and dead in two minutes. It lives in
 * the URL *fragment* rather than the query string because browsers never send
 * a fragment to a server, so it stays out of access logs, Referer headers and
 * the analytics page-view payload (which reports `pathname + search`).
 *
 * One mint covers a whole page: every surface on it shares the same
 * destination, and the in-flight map plus the cache mean twenty cards on screen
 * produce exactly one request. The ticket is consumed by navigating, so a page
 * load that needs another one mints again.
 *
 * This file exists in both storefronts — identical in each — so that `auth.ts`
 * and this module stay byte-identical across the two repositories.
 */
import { useEffect, useState } from 'react'
import {
  adoptSession,
  fetchCurrentUser,
  getApiBaseUrl,
  getStoredAuthTokens,
  type AuthUser,
} from './auth'
import { fetchWithAuth } from './api'

/** The ticket is valid for 120s server-side; cache it a little under that. */
const CACHE_MS = 110_000

/** `href` → ticket, so several destinations could coexist. */
const tickets = new Map<string, { ticket: string; expiresAt: number }>()
/** Destination → in-flight mint, so a grid of cards does not stampede. */
const pending = new Map<string, Promise<string | null>>()

function destinationOf(href: string): string | null {
  try {
    return new URL(href, window.location.origin).origin
  } catch {
    return null
  }
}

function peek(destination: string): string | null {
  const entry = tickets.get(destination)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    tickets.delete(destination)
    return null
  }
  return entry.ticket
}

function withTicket(href: string, ticket: string): string {
  return `${href}#sso=${encodeURIComponent(ticket)}`
}

async function mint(destination: string): Promise<string | null> {
  // Signed out? Nothing to hand over, and no reason to spend a request
  // discovering that on every page with a tour card on it.
  const { accessToken } = getStoredAuthTokens()
  if (!accessToken) return null

  let res: Response
  try {
    // fetchWithAuth handles the expired-access-token case: it refreshes once
    // and retries, so a long browsing session does not silently lose handoffs.
    res = await fetchWithAuth('/sso/mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination }),
    })
  } catch {
    return null
  }
  if (!res.ok) return null

  let ticket: unknown
  try {
    const payload = await res.json()
    ticket = payload?.data?.ticket
  } catch {
    return null
  }
  if (typeof ticket !== 'string' || !ticket) return null

  tickets.set(destination, { ticket, expiresAt: Date.now() + CACHE_MS })
  return ticket
}

/**
 * The destination URL with a ticket appended, if one is warm right now.
 * Never waits, never mints — safe during render.
 */
export function handoffHref(href: string): string {
  const destination = destinationOf(href)
  if (!destination) return href
  const ticket = peek(destination)
  return ticket ? withTicket(href, ticket) : href
}

/**
 * The destination URL, guaranteeing a ticket when the user is signed in.
 *
 * Falls back to `href` unchanged whenever a ticket cannot be had — a tour click
 * must never fail because authentication was slow.
 */
export async function ensureHandoff(href: string): Promise<string> {
  const destination = destinationOf(href)
  if (!destination) return href

  const warm = peek(destination)
  if (warm) return withTicket(href, warm)

  let inFlight = pending.get(destination)
  if (!inFlight) {
    inFlight = mint(destination)
    pending.set(destination, inFlight)
    // Settled either way — clear so a later page can mint again.
    inFlight.then(() => pending.delete(destination)).catch(() => pending.delete(destination))
  }

  try {
    const ticket = await inFlight
    return ticket ? withTicket(href, ticket) : href
  } catch {
    return href
  }
}

/**
 * A link destination that upgrades itself to include a handoff ticket.
 *
 * Without this, an anchor renders once with a plain URL: by the time the mint
 * resolves, copy-link and middle-click would still produce a ticketless
 * destination. The hook re-renders the link once the ticket lands, so every
 * navigation affordance — same tab, new tab, copy link — carries it.
 *
 * Signed-out visitors make no request at all and keep the plain URL.
 */
export function useHandoffHref(href: string): string {
  // Lazy initialiser rather than a setState inside the effect: a warm ticket
  // is known synchronously, and the lint rule against synchronous setState in
  // an effect exists for a reason. The async path below covers the rest.
  const [current, setCurrent] = useState(() => handoffHref(href))

  useEffect(() => {
    let alive = true
    void ensureHandoff(href).then((resolved) => {
      if (alive) setCurrent(resolved)
    })
    return () => {
      alive = false
    }
  }, [href])

  return current
}

/** `POST /sso/exchange` response body. */
type ExchangePayload = {
  accessToken?: string
  refreshToken?: string
  user?: AuthUser | null
} | null

/** The exchange response, or null when it could not be read. */
async function requestExchange(ticket: string): Promise<ExchangePayload> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/sso/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, destination: window.location.origin }),
    })
    if (!res.ok) return null
    const payload = await res.json()
    return (payload?.data ?? null) as ExchangePayload
  } catch {
    return null
  }
}

/**
 * Redeem a ticket found in the URL fragment and store the resulting session.
 *
 * Returns false when there was no ticket or the exchange failed — the caller
 * then carries on exactly as it would for a signed-out arrival.
 */
export async function consumeHandoff(): Promise<boolean> {
  const match = /(?:^#|&)sso=([^&]+)/.exec(window.location.hash || '')
  const encoded = match?.[1]
  if (!encoded) return false

  let ticket: string
  try {
    ticket = decodeURIComponent(encoded)
  } catch {
    return false
  }

  // Clear the fragment before anything can report it. The ticket is in the
  // hash, not the query, so analytics already cannot see it — but the browser
  // history should not keep it either, and a second attempt must be impossible.
  window.history.replaceState(null, '', window.location.pathname + window.location.search)

  const data = await requestExchange(ticket)
  if (!data) return false

  const accessToken = data?.accessToken
  const refreshToken = data?.refreshToken
  if (!accessToken || !refreshToken) return false

  // The exchange already returns the user; if it did not, resolve it once
  // rather than storing a half-known session.
  let user = data?.user ?? null
  if (!user) {
    try {
      user = await fetchCurrentUser(accessToken)
    } catch {
      return false
    }
  }

  adoptSession({ accessToken, refreshToken, user })
  return true
}

/** Drop any warm ticket — tests, and logout. */
export function resetHandoff(): void {
  tickets.clear()
  pending.clear()
}
