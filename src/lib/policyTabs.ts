/**
 * The policy-pill rail shared by every legal page. Kept in one place so the
 * rail can never drift from the routes and footer again — the Refund Policy
 * pill went missing because four pages each carried their own copy of this
 * list.
 */
export const POLICY_TABS = [
  { key: 'supplier-terms', label: 'Supplier Terms', to: '/supplier-terms' },
  { key: 'terms', label: 'Terms & Conditions', to: '/terms-and-conditions' },
  { key: 'privacy', label: 'Privacy Policy', to: '/privacy-policy' },
  { key: 'cookies', label: 'Cookies Policy', to: '/cookies-policy' },
  { key: 'refund', label: 'Refund Policy', to: '/refund-policy' },
] as const

export type PolicyTabKey = (typeof POLICY_TABS)[number]['key']
