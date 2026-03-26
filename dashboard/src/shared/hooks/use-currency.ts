import { useCallback } from 'react'
import { useFilters, type Currency, CURRENCY_CONFIG } from '@/app/providers'

/**
 * Hook to get current currency settings and locale-aware formatting functions.
 * All formatters use Intl.NumberFormat with the tenant's locale and currency.
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

  const formatNumber = useCallback((
    value: number,
    options?: Intl.NumberFormatOptions
  ): string => {
    return new Intl.NumberFormat(locale, options).format(value)
  }, [locale])

  const formatPercent = useCallback((
    value: number,
    options?: { decimals?: number; sign?: boolean }
  ): string => {
    const decimals = options?.decimals ?? 1
    const sign = options?.sign ?? false
    const formatted = new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value / 100)
    if (sign && value > 0) return `+${formatted}`
    return formatted
  }, [locale])

  return {
    currency,
    locale,
    symbol: CURRENCY_CONFIG[currency].symbol,
    formatCurrency,
    formatCurrencyCompact,
    formatCurrencyWithSign,
    formatNumber,
    formatPercent,
  }
}

export type { Currency }
