import { useState } from 'react'
import { cn } from '@/shared/lib/utils'

interface DomainFaviconProps {
  domain: string
  size?: number
  className?: string
}

export function DomainFavicon({ domain, size = 16, className }: DomainFaviconProps) {
  const [error, setError] = useState(false)

  // Extract root domain (strip subdomains for better favicon match)
  const rootDomain = domain.split('.').slice(-2).join('.')
  const fallbackLetter = domain.charAt(0).toUpperCase()

  if (error) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-sm bg-white/10 text-muted font-medium flex-shrink-0',
          className
        )}
        style={{ width: size, height: size, fontSize: size * 0.6 }}
      >
        {fallbackLetter}
      </span>
    )
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${rootDomain}&sz=${size}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setError(true)}
      className={cn('rounded-sm flex-shrink-0', className)}
    />
  )
}
