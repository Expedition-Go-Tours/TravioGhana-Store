import { useCurrency } from '../contexts/CurrencyContext'

interface FormattedPriceProps {
  usdPrice: number
  className?: string
}

export default function FormattedPrice({ usdPrice, className }: FormattedPriceProps) {
  const { currency, convertPrice, loading } = useCurrency()

  if (loading) {
    return <span className={className}>{currency.symbol}{Math.round(usdPrice).toLocaleString()}</span>
  }

  return <span className={className}>{currency.symbol}{Math.round(convertPrice(usdPrice)).toLocaleString()}</span>
}
