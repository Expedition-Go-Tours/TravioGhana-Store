import type { StripeElementsOptionsClientSecret } from '@stripe/stripe-js'

/**
 * Single source of truth for the Stripe Payment Element appearance. Values
 * mirror the storefront design tokens (bookingTheme.css / index.css) so the
 * Stripe iframe feels native to the checkout page instead of like a demo.
 */
export function checkoutElementsOptions(
  clientSecret: string,
  customerSessionClientSecret?: string,
): StripeElementsOptionsClientSecret {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return {
    clientSecret,
    // Required for the Payment Element to list the customer's saved cards.
    ...(customerSessionClientSecret ? { customerSessionClientSecret } : {}),
    appearance: {
      theme: 'stripe',
      labels: 'floating',
      variables: {
        colorPrimary: '#16a34a',
        colorPrimaryText: '#ffffff',
        colorText: '#101828',
        colorTextSecondary: '#667085',
        colorDanger: '#dc2626',
        colorBackground: '#ffffff',
        fontFamily: '"DM Sans", "Manrope", sans-serif',
        fontSizeBase: '15px',
        borderRadius: '10px',
        spacingUnit: '3px',
        focusBoxShadow: 'none',
      },
      rules: {
        '.Input': { backgroundColor: '#ffffff' },
        '.Input:focus': { borderColor: '#c2c8d1' },
        '.Tab, .Input, .Block': { boxShadow: 'none' },
        '.Tab:hover': { color: '#101828' },
        '.Label': { color: '#344054' },
      },
    },
    // Fonts are served from our own origin (copied to /public/fonts) so the
    // Payment Element iframe can load the brand typefaces.
    fonts: [{ cssSrc: `${origin}/fonts/checkout-fonts.css` }],
  }
}
