import * as React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './theme-provider'
import { QueryProvider } from './query-provider'
import { AuthProvider } from './auth-provider'
import { FiltersProvider } from './filters-provider'
import { ToastProvider } from '@/shared/components/ui/toast'
import '@/shared/lib/i18n'

interface AppProvidersProps {
  children: React.ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <BrowserRouter>
      <QueryProvider>
        <ThemeProvider defaultTheme="dark">
          <AuthProvider>
            <FiltersProvider>
              <ToastProvider>{children}</ToastProvider>
            </FiltersProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryProvider>
    </BrowserRouter>
  )
}

export { useTheme } from './theme-provider'
export { useAuth } from './auth-provider'
export { useToast } from '@/shared/components/ui/toast'
export { 
  useFilters, 
  PERIOD_PRESETS, 
  ALL_INSTANCES_ID,
  CURRENCY_CONFIG,
  type PeriodPreset, 
  type WhmcsInstance,
  type TenantWithInstances,
  type Currency,
} from './filters-provider'
