import * as React from 'react'
import { cn } from '@/shared/lib/utils'

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Material Symbols icon name (e.g., 'dashboard', 'settings') */
  name: string
  /** Icon size preset */
  size?: IconSize
  /** Use filled variant */
  filled?: boolean
  /** Custom font weight (100-700) */
  weight?: number
  /** Optical size (20-48) */
  opticalSize?: number
  /** Grade (-50 to 200) */
  grade?: number
}

const sizeClasses: Record<IconSize, string> = {
  xs: 'text-base',      // 16px
  sm: 'text-lg',        // 18px
  md: 'text-xl',        // 20px
  lg: 'text-2xl',       // 24px
  xl: 'text-3xl',       // 30px
  '2xl': 'text-4xl',    // 36px
}

const sizePixels: Record<IconSize, number> = {
  xs: 16,
  sm: 18,
  md: 20,
  lg: 24,
  xl: 30,
  '2xl': 36,
}

/**
 * Material Symbols Icon component
 * 
 * @example
 * <Icon name="dashboard" size="lg" />
 * <Icon name="settings" filled />
 * <Icon name="search" size="sm" className="text-muted" />
 */
export const Icon = React.forwardRef<HTMLSpanElement, IconProps>(
  (
    {
      name,
      size = 'md',
      filled = false,
      weight,
      opticalSize,
      grade,
      className,
      style,
      ...props
    },
    ref
  ) => {
    // Build font-variation-settings for customization
    const variationSettings: string[] = []
    
    if (filled) {
      variationSettings.push("'FILL' 1")
    }
    
    // Default weight to 200 for light style
    variationSettings.push(`'wght' ${weight ?? 200}`)
    
    if (opticalSize !== undefined) {
      variationSettings.push(`'opsz' ${opticalSize}`)
    } else {
      // Auto-set optical size based on display size
      variationSettings.push(`'opsz' ${sizePixels[size]}`)
    }
    if (grade !== undefined) {
      variationSettings.push(`'GRAD' ${grade}`)
    }

    const customStyle: React.CSSProperties = {
      ...style,
      fontSize: `${sizePixels[size]}px`,
      fontVariationSettings: variationSettings.length > 0 
        ? variationSettings.join(', ') 
        : undefined,
    }

    return (
      <span
        ref={ref}
        className={cn(
          'material-symbols-outlined',
          'select-none leading-none',
          sizeClasses[size],
          className
        )}
        style={customStyle}
        aria-hidden="true"
        {...props}
      >
        {name}
      </span>
    )
  }
)

Icon.displayName = 'Icon'
