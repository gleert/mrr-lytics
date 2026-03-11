import * as React from 'react'
import { cn } from '@/shared/lib/utils'

type ImageLoadingStatus = 'loading' | 'loaded' | 'error'

const AvatarContext = React.createContext<ImageLoadingStatus>('error')

const Avatar = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, children, ...props }, ref) => {
  const [imageStatus, setImageStatus] = React.useState<ImageLoadingStatus>('error')

  return (
    <AvatarContext.Provider value={imageStatus}>
      <span
        ref={ref}
        className={cn(
          'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
          className
        )}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement<AvatarImageProps>(child) && child.type === AvatarImage) {
            return React.cloneElement(child, { _onStatusChange: setImageStatus } as Partial<AvatarImageProps>)
          }
          return child
        })}
      </span>
    </AvatarContext.Provider>
  )
})
Avatar.displayName = 'Avatar'

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  _onStatusChange?: (status: ImageLoadingStatus) => void
}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, src, _onStatusChange, ...props }, ref) => {
    const [status, setStatus] = React.useState<ImageLoadingStatus>(
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
      _onStatusChange?.(status)
    }, [status, _onStatusChange])

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
>(({ className, ...props }, ref) => {
  const imageStatus = React.useContext(AvatarContext)

  // Only show fallback when there is no image or image failed to load
  if (imageStatus === 'loaded') {
    return null
  }

  return (
    <span
      ref={ref}
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-primary-500/20 text-primary-400 text-sm font-semibold uppercase tracking-wide',
        className
      )}
      {...props}
    />
  )
})
AvatarFallback.displayName = 'AvatarFallback'

export { Avatar, AvatarImage, AvatarFallback }
