import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { TourPopover } from './tour-popover'
import type { TourStep } from '../lib/tour-steps'

interface TourOverlayProps {
  step: TourStep
  currentStep: number
  totalSteps: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const PADDING = 8
const POPOVER_GAP = 12
const POPOVER_WIDTH = 320

export function TourOverlay({
  step,
  currentStep,
  totalSteps,
  onNext,
  onBack,
  onSkip,
}: TourOverlayProps) {
  const { t } = useTranslation()
  const [targetRect, setTargetRect] = useState<Rect | null>(null)

  const measure = useCallback(() => {
    const el = document.querySelector(step.targetSelector)
    if (!el) {
      setTargetRect(null)
      return
    }
    const rect = el.getBoundingClientRect()
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    })
  }, [step.targetSelector])

  // Measure on mount + watch for element to appear
  useEffect(() => {
    measure()

    // If element not found yet, poll briefly (async loading)
    const el = document.querySelector(step.targetSelector)
    if (!el) {
      const interval = setInterval(() => {
        const found = document.querySelector(step.targetSelector)
        if (found) {
          found.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Wait for scroll to settle
          setTimeout(measure, 300)
          clearInterval(interval)
        }
      }, 100)
      return () => clearInterval(interval)
    }

    // Scroll into view if needed
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setTimeout(measure, 300)

    const handleResize = () => measure()
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
    }
  }, [step.targetSelector, measure])

  if (!targetRect) return null

  // Calculate highlight box with padding
  const highlight = {
    top: targetRect.top - PADDING,
    left: targetRect.left - PADDING,
    width: targetRect.width + PADDING * 2,
    height: targetRect.height + PADDING * 2,
  }

  // Calculate popover position
  const popoverStyle = calculatePopoverPosition(step.placement, highlight)

  return createPortal(
    <>
      {/* Highlight element with massive box-shadow as backdrop */}
      <div
        className="fixed z-[65] rounded-xl pointer-events-none transition-all duration-300 ease-out"
        style={{
          top: highlight.top,
          left: highlight.left,
          width: highlight.width,
          height: highlight.height,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.82)',
        }}
      />

      {/* Clickable backdrop layer to catch clicks outside */}
      <div
        className="fixed inset-0 z-[64]"
        onClick={(e) => {
          // Only skip if clicking truly outside
          const clickX = e.clientX
          const clickY = e.clientY
          const inHighlight =
            clickX >= highlight.left &&
            clickX <= highlight.left + highlight.width &&
            clickY >= highlight.top &&
            clickY <= highlight.top + highlight.height
          if (!inHighlight) {
            onSkip()
          }
        }}
      />

      {/* Popover */}
      <TourPopover
        title={t(step.titleKey)}
        description={t(step.descriptionKey)}
        currentStep={currentStep}
        totalSteps={totalSteps}
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
        style={popoverStyle}
      />
    </>,
    document.body
  )
}

function calculatePopoverPosition(
  placement: TourStep['placement'],
  highlight: Rect
): React.CSSProperties {
  const vw = window.innerWidth
  const vh = window.innerHeight

  let top: number
  let left: number

  switch (placement) {
    case 'bottom':
      top = highlight.top + highlight.height + POPOVER_GAP
      left = highlight.left + highlight.width / 2 - POPOVER_WIDTH / 2
      break
    case 'top':
      top = highlight.top - POPOVER_GAP - 200 // approximate popover height
      left = highlight.left + highlight.width / 2 - POPOVER_WIDTH / 2
      break
    case 'right':
      top = highlight.top + highlight.height / 2 - 100
      left = highlight.left + highlight.width + POPOVER_GAP
      break
    case 'left':
      top = highlight.top + highlight.height / 2 - 100
      left = highlight.left - POPOVER_WIDTH - POPOVER_GAP
      break
  }

  // Keep within viewport
  if (left + POPOVER_WIDTH > vw - 16) left = vw - POPOVER_WIDTH - 16
  if (left < 16) left = 16
  if (top < 16) top = 16
  if (top > vh - 220) top = vh - 220

  return { top, left }
}
