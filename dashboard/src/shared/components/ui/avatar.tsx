import * as React from 'react'
import { cn } from '@/shared/lib/utils'

const Avatar = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
      className
    )}
    {...props}
  />
))
Avatar.displayName = 'Avatar'

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  onLoadingStatusChange?: (status: 'loading' | 'loaded' | 'error') => void
}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, src, onLoadingStatusChange, ...props }, ref) => {
    const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>(
      src ? 'loading' : 'error'
    )

    React.useEffect(() => {
      if (!src) {
        setStatus('error')
        return
      }
      setStatus('loading')
    }, [src])

    React.useEffect(() => {
      onLoadingStatusChange?.(status)
    }, [status, onLoadingStatusChange])

    // Don't render if no src or if load failed
    if (!src || status === 'error') {
      return null
    }

    return (
      <img
        ref={ref}
        src={src}
        className={cn('aspect-square h-full w-full object-cover', className)}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        {...props}
      />
    )
  }
)
AvatarImage.displayName = 'AvatarImage'

const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-primary-500/20 text-primary-400 text-sm font-semibold uppercase tracking-wide',
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = 'AvatarFallback'

export { Avatar, AvatarImage, AvatarFallback }
