import * as React from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth, useFilters } from '@/app/providers'
import { tours, routeToTourId } from '../lib/tour-steps'
import {
  isTourCompleted,
  isWelcomeShown,
  markTourCompleted,
  markWelcomeShown,
  resetAllTours,
} from '../lib/tour-storage'
import { WelcomeModal } from './welcome-modal'
import { TourOverlay } from './tour-overlay'
import type { TourStep, TourId } from '../lib/tour-steps'

interface TourContextValue {
  isActive: boolean
  activeTourId: TourId | null
  currentStep: number
  totalSteps: number
  startTour: (tourId: TourId) => void
  restartAllTours: () => void
}

const TourContext = React.createContext<TourContextValue | undefined>(undefined)

interface TourProviderProps {
  children: React.ReactNode
  onOpenSidebar?: () => void
}

export function TourProvider({ children, onOpenSidebar }: TourProviderProps) {
  const { user } = useAuth()
  const { userRole } = useFilters()
  const location = useLocation()

  const [showWelcome, setShowWelcome] = React.useState(false)
  const [activeTourId, setActiveTourId] = React.useState<TourId | null>(null)
  const [currentStep, setCurrentStep] = React.useState(0)

  const isAdmin = userRole === 'admin'

  // Get filtered steps for the active tour
  const activeSteps = React.useMemo<TourStep[]>(() => {
    if (!activeTourId) return []
    const tourDef = tours[activeTourId]
    if (!tourDef) return []
    return tourDef.steps.filter((s) => !s.adminOnly || isAdmin)
  }, [activeTourId, isAdmin])

  // Auto-show welcome modal for brand new users (only on dashboard)
  React.useEffect(() => {
    if (!user || isWelcomeShown(user)) return
    if (location.pathname !== '/') return

    const timer = setTimeout(() => {
      setShowWelcome(true)
    }, 1000)
    return () => clearTimeout(timer)
  }, [user, location.pathname])

  // Auto-trigger page tours when navigating to a page for the first time
  React.useEffect(() => {
    if (!user || activeTourId || showWelcome) return

    const tourId = routeToTourId[location.pathname]
    if (!tourId) return

    const tourDef = tours[tourId]
    if (tourDef.adminOnly && !isAdmin) return
    if (isTourCompleted(tourId, user)) return

    // Don't auto-trigger dashboard tour — it's handled by welcome modal
    if (tourId === 'dashboard' && !isWelcomeShown(user)) return

    const timer = setTimeout(() => {
      setActiveTourId(tourId)
      setCurrentStep(0)
    }, 800)
    return () => clearTimeout(timer)
  }, [user, location.pathname, activeTourId, showWelcome, isAdmin])

  const startTour = React.useCallback((tourId: TourId) => {
    setShowWelcome(false)
    setActiveTourId(tourId)
    setCurrentStep(0)
  }, [])

  const handleWelcomeStart = React.useCallback(() => {
    markWelcomeShown()
    startTour('dashboard')
  }, [startTour])

  const handleWelcomeSkip = React.useCallback(() => {
    setShowWelcome(false)
    markWelcomeShown()
    markTourCompleted('dashboard')
  }, [])

  const endTour = React.useCallback(() => {
    if (activeTourId) {
      markTourCompleted(activeTourId)
    }
    setActiveTourId(null)
    setCurrentStep(0)
  }, [activeTourId])

  const nextStep = React.useCallback(() => {
    if (currentStep >= activeSteps.length - 1) {
      endTour()
      return
    }

    const nextIdx = currentStep + 1
    const nextStepDef = activeSteps[nextIdx]

    if (nextStepDef.isSidebar && onOpenSidebar) {
      onOpenSidebar()
      setTimeout(() => setCurrentStep(nextIdx), 350)
    } else {
      setCurrentStep(nextIdx)
    }
  }, [currentStep, activeSteps, endTour, onOpenSidebar])

  const backStep = React.useCallback(() => {
    if (currentStep <= 0) return

    const prevIdx = currentStep - 1
    const prevStepDef = activeSteps[prevIdx]

    if (prevStepDef.isSidebar && onOpenSidebar) {
      onOpenSidebar()
      setTimeout(() => setCurrentStep(prevIdx), 350)
    } else {
      setCurrentStep(prevIdx)
    }
  }, [currentStep, activeSteps, onOpenSidebar])

  const restartAllTours = React.useCallback(() => {
    resetAllTours()
    // Start with the tour for the current page, or dashboard
    const tourId = routeToTourId[location.pathname] ?? 'dashboard'
    startTour(tourId)
  }, [location.pathname, startTour])

  // Open sidebar for sidebar steps
  React.useEffect(() => {
    if (activeTourId && activeSteps[currentStep]?.isSidebar && onOpenSidebar) {
      onOpenSidebar()
    }
  }, [activeTourId, currentStep, activeSteps, onOpenSidebar])

  const value = React.useMemo<TourContextValue>(
    () => ({
      isActive: !!activeTourId,
      activeTourId,
      currentStep,
      totalSteps: activeSteps.length,
      startTour,
      restartAllTours,
    }),
    [activeTourId, currentStep, activeSteps.length, startTour, restartAllTours]
  )

  return (
    <TourContext.Provider value={value}>
      {children}

      {showWelcome && (
        <WelcomeModal onStart={handleWelcomeStart} onSkip={handleWelcomeSkip} />
      )}

      {activeTourId && activeSteps[currentStep] && (
        <TourOverlay
          step={activeSteps[currentStep]}
          currentStep={currentStep}
          totalSteps={activeSteps.length}
          onNext={nextStep}
          onBack={backStep}
          onSkip={endTour}
        />
      )}
    </TourContext.Provider>
  )
}

export function useTour() {
  const context = React.useContext(TourContext)
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider')
  }
  return context
}
