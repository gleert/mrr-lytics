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
        buster: 'v1', // Change this to bust cache
      })
    }
    return browserQueryClient
  }
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
