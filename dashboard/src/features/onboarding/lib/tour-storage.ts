import { supabase } from '@/shared/lib/supabase'
import type { AuthUser } from '@/app/providers/auth-provider'
import type { TourId } from './tour-steps'

const STORAGE_PREFIX = 'mrrlytics-tour-'
const WELCOME_KEY = 'mrrlytics-tour-welcome-shown'

/** Check if a specific tour has been completed */
export function isTourCompleted(tourId: TourId, user: AuthUser | null): boolean {
  if (localStorage.getItem(STORAGE_PREFIX + tourId) === 'true') return true
  const completed = user?.user_metadata?.tours_completed as string[] | undefined
  if (completed?.includes(tourId)) return true
  return false
}

/** Check if the welcome modal has already been shown (first-time onboarding) */
export function isWelcomeShown(user: AuthUser | null): boolean {
  if (localStorage.getItem(WELCOME_KEY) === 'true') return true
  if (user?.user_metadata?.onboarding_completed) return true
  return false
}

/** Mark a specific tour as completed */
export async function markTourCompleted(tourId: TourId): Promise<void> {
  localStorage.setItem(STORAGE_PREFIX + tourId, 'true')

  // Also sync to user_metadata
  const { data } = await supabase.auth.getUser().catch(() => ({ data: null }))
  const existing = (data?.user?.user_metadata?.tours_completed as string[]) ?? []
  if (!existing.includes(tourId)) {
    await supabase.auth.updateUser({
      data: { tours_completed: [...existing, tourId] },
    }).catch(() => {})
  }
}

/** Mark the welcome modal as shown */
export async function markWelcomeShown(): Promise<void> {
  localStorage.setItem(WELCOME_KEY, 'true')
  await supabase.auth.updateUser({
    data: { onboarding_completed: true },
  }).catch(() => {})
}

/** Reset all tour completions */
export function resetAllTours(): void {
  // Clear all tour keys from localStorage
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key)
  }
  keys.forEach((key) => localStorage.removeItem(key))
  localStorage.removeItem(WELCOME_KEY)

  // Sync to user_metadata
  supabase.auth.updateUser({
    data: { tours_completed: [], onboarding_completed: false },
  }).catch(() => {})
}
