import { supabase } from './supabase'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Debug flag - set to true to log API calls
const DEBUG_API = import.meta.env.DEV

interface ApiOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>
}

interface ApiError {
  error: string
  message: string
  statusCode: number
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
      if (DEBUG_API) {
        console.log('[API] Using session token, expires:', new Date(session.expires_at! * 1000).toISOString())
      }
    } else {
      if (DEBUG_API) {
        console.warn('[API] No session token available')
      }
    }

    return headers
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(path, this.baseUrl)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    return url.toString()
  }

  async request<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options
    const url = this.buildUrl(path, params)
    const headers = await this.getAuthHeaders()

    if (DEBUG_API) {
      console.log(`[API] ${fetchOptions.method || 'GET'} ${url}`)
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...headers,
        ...fetchOptions.headers,
      },
    })

    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({
        error: 'Unknown error',
        message: response.statusText,
        statusCode: response.status,
      }))

      if (DEBUG_API) {
        console.error(`[API] Error ${response.status}:`, errorData)
      }

      // Handle 401 - session might be expired
      if (response.status === 401) {
        console.warn('[API] Unauthorized - session may be expired or missing')
        // Try to refresh the session
        const { error } = await supabase.auth.refreshSession()
        if (error) {
          console.error('[API] Failed to refresh session:', error.message)
        }
      }

      throw new ApiRequestError(
        errorData.message || errorData.error,
        response.status,
        errorData
      )
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T
    }

    return response.json()
  }

  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>(path, { method: 'GET', params })
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async patch<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' })
  }
}

export class ApiRequestError extends Error {
  status: number
  data: ApiError

  constructor(message: string, status: number, data: ApiError) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.data = data
  }
}

export const api = new ApiClient(API_BASE_URL)
