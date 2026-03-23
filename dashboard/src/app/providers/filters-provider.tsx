import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useAuth } from './auth-provider'

// Period presets
export type PeriodPreset = 'today' | '7d' | '30d' | '90d' | '180d' | '365d' | '730d' | 'ytd'

export const PERIOD_PRESETS: { value: PeriodPreset; labelKey: string }[] = [
  { value: 'today', labelKey: 'filters.today' },
  { value: '7d',   labelKey: 'filters.7d' },
  { value: '30d',  labelKey: 'filters.30d' },
  { value: '90d',  labelKey: 'filters.90d' },
  { value: '180d', labelKey: 'filters.180d' },
  { value: '365d', labelKey: 'filters.365d' },
  { value: '730d', labelKey: 'filters.730d' },
  { value: 'ytd',  labelKey: 'filters.ytd' },
]

// WHMCS Instance type
export interface WhmcsInstance {
  instance_id: string
  instance_name: string
  instance_slug: string
  whmcs_url: string
  status: string
  last_sync_at: string | null
}

// Supported currencies
export type Currency = 'EUR' | 'USD' | 'GBP'

export const CURRENCY_CONFIG: Record<Currency, { locale: string; symbol: string; name: string }> = {
  EUR: { locale: 'es-ES', symbol: '€', name: 'Euro' },
  USD: { locale: 'en-US', symbol: '$', name: 'US Dollar' },
  GBP: { locale: 'en-GB', symbol: '£', name: 'British Pound' },
}

// Tenant (organization) with its instances
export interface TenantWithInstances {
  tenant_id: string
  tenant_name: string
  tenant_slug: string
  role: 'admin' | 'viewer'
  is_default: boolean
  currency: Currency
  company_name: string | null
  instances: WhmcsInstance[]
}

// Special value for "All instances"
export const ALL_INSTANCES_ID = 'all'

interface FiltersState {
  // Tenants & Instances
  tenants: TenantWithInstances[]
  allInstances: WhmcsInstance[] // Flat list of all instances across tenants
  currentInstance: WhmcsInstance | null // null means "all instances"
  isLoadingTenants: boolean
  hasMultipleInstances: boolean
  
  // Period
  period: PeriodPreset

  // Account state
  isTenantDeleted: boolean
  
  // Actions
  setCurrentInstance: (instance: WhmcsInstance | null) => void
  setPeriod: (period: PeriodPreset) => void
  
  // Helpers
  getSelectedInstanceIds: () => string[] // Returns array of instance IDs for API calls
  
  // Tenant helpers (for categories which are tenant-level)
  getCurrentTenantId: () => string | null // Returns current tenant ID (or first tenant if multiple)
  
  // Currency helpers
  getCurrentCurrency: () => Currency
  getCurrentLocale: () => string
  getCurrentTenant: () => TenantWithInstances | null
  userRole: 'admin' | 'viewer'
}

const FiltersContext = React.createContext<FiltersState | undefined>(undefined)

interface FiltersProviderProps {
  children: React.ReactNode
}

const STORAGE_KEY_INSTANCE = 'mrrlytics-current-instance'
const STORAGE_KEY_PERIOD = 'mrrlytics-current-period'

export function FiltersProvider({ children }: FiltersProviderProps) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [isSettingUp, setIsSettingUp] = React.useState(false)

  // Load initial period from localStorage
  const [period, setPeriodState] = React.useState<PeriodPreset>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_PERIOD)
    if (stored && PERIOD_PRESETS.some(p => p.value === stored)) {
      return stored as PeriodPreset
    }
    return '30d'
  })

  // null means "all instances" selected
  const [currentInstance, setCurrentInstanceState] = React.useState<WhmcsInstance | null>(null)
  const [initialized, setInitialized] = React.useState(false)

  // Fetch user's tenants with instances
  const { data: tenantsResponse, isLoading: isLoadingTenants } = useQuery({
    queryKey: ['user', 'tenants'],
    queryFn: async () => {
      const response = await api.get<{ 
        success: boolean
        data: { 
          tenants: TenantWithInstances[]
          total_instances: number 
        } 
      }>('/api/user/tenants')
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: isAuthenticated,
  })

  // Auto-provision tenant for new users (no tenants yet)
  // BUT: skip if the user's account was deleted by superadmin (tenant_deleted flag)
  const { user } = useAuth()
  const isTenantDeleted = user?.user_metadata?.tenant_deleted === true

  React.useEffect(() => {
    if (
      isAuthenticated &&
      !isLoadingTenants &&
      tenantsResponse &&
      tenantsResponse.tenants.length === 0 &&
      !isSettingUp &&
      !isTenantDeleted // Don't recreate if tenant was deleted
    ) {
      setIsSettingUp(true)
      api.post('/api/user/setup')
        .then(() => {
          // Refetch tenants after setup
          queryClient.invalidateQueries({ queryKey: ['user', 'tenants'] })
        })
        .catch((err) => {
          console.error('Auto-setup failed:', err)
        })
        .finally(() => {
          setIsSettingUp(false)
        })
    }
  }, [isAuthenticated, isLoadingTenants, tenantsResponse, isSettingUp, isTenantDeleted, queryClient])

  const tenants = tenantsResponse?.tenants || []
  
  // Flatten all instances from all tenants
  const allInstances = React.useMemo(() => {
    return tenants.flatMap(t => t.instances)
  }, [tenants])
  
  const hasMultipleInstances = allInstances.length > 1

  // Set current instance when data loads
  React.useEffect(() => {
    if (allInstances.length > 0 && !initialized) {
      // Try to restore from localStorage
      const storedInstanceId = localStorage.getItem(STORAGE_KEY_INSTANCE)
      
      // If stored "all" and user has multiple instances, set to null (all)
      if (storedInstanceId === ALL_INSTANCES_ID && hasMultipleInstances) {
        setCurrentInstanceState(null)
      } else {
        const storedInstance = allInstances.find(i => i.instance_id === storedInstanceId)
        if (storedInstance) {
          setCurrentInstanceState(storedInstance)
        } else if (hasMultipleInstances) {
          // Default to "all" for users with multiple instances
          setCurrentInstanceState(null)
        } else {
          // Single instance user - use that instance
          setCurrentInstanceState(allInstances[0])
        }
      }
      setInitialized(true)
    }
  }, [allInstances, hasMultipleInstances, initialized])

  // Save instance to localStorage when changed
  const setCurrentInstance = React.useCallback((instance: WhmcsInstance | null) => {
    setCurrentInstanceState(instance)
    localStorage.setItem(STORAGE_KEY_INSTANCE, instance?.instance_id || ALL_INSTANCES_ID)
  }, [])

  // Save period to localStorage when changed
  const setPeriod = React.useCallback((newPeriod: PeriodPreset) => {
    setPeriodState(newPeriod)
    localStorage.setItem(STORAGE_KEY_PERIOD, newPeriod)
  }, [])

  // Get instance IDs for API calls
  const getSelectedInstanceIds = React.useCallback(() => {
    if (currentInstance) {
      return [currentInstance.instance_id]
    }
    // "All" selected - return all instance IDs
    return allInstances.map(i => i.instance_id)
  }, [currentInstance, allInstances])

  // Get current tenant (helper)
  const getCurrentTenant = React.useCallback((): TenantWithInstances | null => {
    if (currentInstance) {
      // Find which tenant this instance belongs to
      return tenants.find(t => 
        t.instances.some(i => i.instance_id === currentInstance.instance_id)
      ) || null
    }
    // If "all instances" selected, return the default tenant or first tenant
    const defaultTenant = tenants.find(t => t.is_default)
    return defaultTenant || tenants[0] || null
  }, [currentInstance, tenants])

  // Get current tenant ID (for tenant-level operations like categories)
  const getCurrentTenantId = React.useCallback(() => {
    return getCurrentTenant()?.tenant_id || null
  }, [getCurrentTenant])

  // Get current currency (from tenant settings)
  const getCurrentCurrency = React.useCallback((): Currency => {
    const tenant = getCurrentTenant()
    return tenant?.currency || 'EUR'
  }, [getCurrentTenant])

  // Get current locale based on currency
  const getCurrentLocale = React.useCallback((): string => {
    const currency = getCurrentCurrency()
    return CURRENCY_CONFIG[currency].locale
  }, [getCurrentCurrency])

  const value = React.useMemo(
    () => ({
      tenants,
      allInstances,
      currentInstance,
      isLoadingTenants,
      hasMultipleInstances,
      isTenantDeleted,
      period,
      setCurrentInstance,
      setPeriod,
      getSelectedInstanceIds,
      getCurrentTenantId,
      getCurrentCurrency,
      getCurrentLocale,
      getCurrentTenant,
      userRole: (getCurrentTenant()?.role || 'viewer') as 'admin' | 'viewer',
    }),
    [tenants, allInstances, currentInstance, isLoadingTenants, hasMultipleInstances, isTenantDeleted, period, setCurrentInstance, setPeriod, getSelectedInstanceIds, getCurrentTenantId, getCurrentCurrency, getCurrentLocale, getCurrentTenant]
  )

  return (
    <FiltersContext.Provider value={value}>
      {children}
    </FiltersContext.Provider>
  )
}

export function useFilters() {
  const context = React.useContext(FiltersContext)
  if (context === undefined) {
    throw new Error('useFilters must be used within a FiltersProvider')
  }
  return context
}
