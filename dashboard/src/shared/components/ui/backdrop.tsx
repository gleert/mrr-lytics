import * as React from 'react'
import { cn } from '@/shared/lib/utils'

interface BackdropProps {
  open: boolean
  onClose: () => void
  className?: string
}

export function Backdrop({ open, onClose, className }: BackdropProps) {
  // Prevent body scroll when backdrop is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm',
        'animate-in fade-in duration-200',
        className
      )}
      onClick={onClose}
      aria-hidden="true"
    />
  )
}
