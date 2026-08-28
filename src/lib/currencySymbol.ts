const SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  CNY: '¥',
  INR: '₹',
  SGD: 'S$',
  HKD: 'HK$',
  THB: '฿',
  GHS: 'GH₵',
  NGN: '₦',
}

export function currencySymbol(currency?: string): string {
  if (!currency) return '$'
  return SYMBOLS[currency.toUpperCase()] ?? currency
}
