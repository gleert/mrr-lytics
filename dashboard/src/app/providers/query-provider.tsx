import * as React from 'react'
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'

// Custom localStorage persister
const localStoragePersister = {
  persistClient: (client: unknown) => {
    try {
      localStorage.setItem('mrrlytics-query-cache', JSON.stringify(client))
    } catch {
      // Storage full or unavailable
    }
  },
  restoreClient: () => {
    try {
      const cached = localStorage.getItem('mrrlytics-query-cache')
      return cached ? JSON.parse(cached) : undefined
    } catch {
      return undefined
    }
  },
  removeClient: () => {
    localStorage.removeItem('mrrlytics-query-cache')
  },
}

/**
 * Cache buster, scoped to the impersonated tenant when there is one.
 *
 * An impersonated tab is opened with window.open on the SAME origin, so it
 * shares localStorage with the superadmin's own tab -- including the persisted
 * query cache. Without scoping, the impersonated session restores the
 * superadmin's own ['user','tenants'] payload and renders HIS instance (Demo)
 * instead of the tenant's. Folding the tenant into the buster makes React Query
 * discard the persisted cache whenever the scope changes, which happens at
 * restore time (module init), before any query can be served from it.
 */
function cacheBuster(): string {
  const base = 'v4' // v4: domains "lost" now excludes same-period quick-cancels, symmetric with "gained"
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('impersonating')
    const tenantId = fromUrl || sessionStorage.getItem('impersonating_tenant_id')
    return tenantId ? `${base}-imp-${tenantId}` : base
  } catch {
    return base
  }
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 1 minute
        staleTime: 60 * 1000,
        // Cache data for 30 minutes
        gcTime: 30 * 60 * 1000,
        // Retry failed requests 3 times
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Refetch on window focus
        refetchOnWindowFocus: true,
        // Don't refetch on reconnect automatically
        refetchOnReconnect: 'always',
      },
      mutations: {
        retry: 1,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: use singleton pattern
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient()
      
      // Set up persistence
      persistQueryClient({
        queryClient: browserQueryClient,
        persister: localStoragePersister,
        maxAge: 30 * 60 * 1000, // 30 minutes
        buster: cacheBuster(), // see cacheBuster(): bump the base string to invalidate every client
        dehydrateOptions: {
          // Don't persist module-version: it's the update banner source — must always
          // reflect the live endpoint, not a possibly-stale localStorage snapshot.
          shouldDehydrateQuery: (query) => query.queryKey[0] !== 'module-version',
        },
      })
    }
    return browserQueryClient
  }
}

/**
 * Clear all cached query data and persisted storage.
 * Call this on logout to prevent data leaking between users.
 */
export function clearQueryCache() {
  if (browserQueryClient) {
    browserQueryClient.clear()
  }
  localStoragePersister.removeClient()
}

interface QueryProviderProps {
  children: React.ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
