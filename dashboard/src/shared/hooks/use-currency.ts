import { useCallback } from 'react'
import { useFilters, type Currency, CURRENCY_CONFIG } from '@/app/providers'

/**
 * Hook to get current currency settings and formatting function
 * 
 * Usage:
 * ```tsx
 * const { currency, locale, formatCurrency } = useCurrency()
 * 
 * // Format a value
 * <span>{formatCurrency(1234.56)}</span>
 * ```
 */
export function useCurrency() {
  const { getCurrentCurrency, getCurrentLocale } = useFilters()
  
  const currency = getCurrentCurrency()
  const locale = getCurrentLocale()
  
  const formatCurrency = useCallback((
    amount: number,
    options?: {
      minimumFractionDigits?: number
      maximumFractionDigits?: number
    }
  ): string => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: options?.minimumFractionDigits ?? 0,
      maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    }).format(amount)
  }, [currency, locale])

  const formatCurrencyCompact = useCallback((amount: number): string => {
    // For large numbers, show abbreviated (e.g., 1.2k, 1.5M)
    if (Math.abs(amount) >= 1000000) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(amount)
    }
    if (Math.abs(amount) >= 1000) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(amount)
    }
    return formatCurrency(amount)
  }, [currency, locale, formatCurrency])

  const formatCurrencyWithSign = useCallback((amount: number): string => {
    const formatted = formatCurrency(Math.abs(amount))
    if (amount > 0) return `+${formatted}`
    if (amount < 0) return `-${formatted}`
    return formatted
  }, [formatCurrency])

  return {
    currency,
    locale,
    symbol: CURRENCY_CONFIG[currency].symbol,
    formatCurrency,
    formatCurrencyCompact,
    formatCurrencyWithSign,
  }
}

export type { Currency }
