import { NextRequest, NextResponse } from 'next/server'
import { validateApiKeyEdge, validateAdminKeyEdge, extractBearerToken, isJwtToken, validateJwtEdge, validateJwtAuthOnly } from '@/lib/auth/api-key-edge'
import { createAdminClient } from '@/lib/supabase/admin'

// Paths that don't require authentication
const PUBLIC_PATHS = ['/api/health', '/api/contact']

// Paths that require admin key instead of tenant key
const ADMIN_PATHS = ['/api/tenants']

// Paths that use cron secret
const CRON_PATHS = ['/api/cron']

// Paths that require JWT auth only (user-specific endpoints)
const USER_PATHS = ['/api/user', '/api/admin']

// Allowed CORS origins (comma-separated in env) - also allow the marketing site
const ALLOWED_ORIGINS = [
  ...(process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map(origin => origin.trim()),
  'https://mrrlytics.com',
  'https://www.mrrlytics.com',
]

/**
 * Check if the origin is allowed for CORS
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  return ALLOWED_ORIGINS.includes(origin)
}

/**
 * Get CORS headers for the response
 */
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0]
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  }
}

/**
 * Add CORS headers to a response
 */
function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  const corsHeaders = getCorsHeaders(origin)
  
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const origin = request.headers.get('origin')

  // Skip non-API routes
  if (!pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 })
    return addCorsHeaders(response, origin)
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'))) {
    const response = NextResponse.next()
    return addCorsHeaders(response, origin)
  }

  // Extract bearer token
  const authHeader = request.headers.get('authorization')
  const token = extractBearerToken(authHeader)

  if (!token) {
    const response = NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authorization header. Use: Authorization: Bearer <api_key>',
        },
      },
      { status: 401 }
    )
    return addCorsHeaders(response, origin)
  }

  // Handle cron paths
  if (CRON_PATHS.some((path) => pathname.startsWith(path))) {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || token !== cronSecret) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid cron secret',
          },
        },
        { status: 401 }
      )
      return addCorsHeaders(response, origin)
    }
    const response = NextResponse.next()
    return addCorsHeaders(response, origin)
  }

  // Handle user-specific paths (JWT only, no tenant required)
  if (USER_PATHS.some((path) => pathname.startsWith(path))) {
    if (!isJwtToken(token)) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'This endpoint requires user authentication (JWT)',
          },
        },
        { status: 401 }
      )
      return addCorsHeaders(response, origin)
    }

    try {
      // Use auth-only validation for /api/user/* paths
      // The user might not have a tenant yet (e.g. /api/user/setup)
      const authUser = await validateJwtAuthOnly(token)
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-auth-id', authUser.id)
      requestHeaders.set('x-auth-type', 'jwt')
      requestHeaders.set('x-user-email', authUser.email)

      const response = NextResponse.next({
        request: { headers: requestHeaders },
      })
      return addCorsHeaders(response, origin)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid JWT'
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message,
          },
        },
        { status: 401 }
      )
      return addCorsHeaders(response, origin)
    }
  }

  // Handle admin paths (tenant management)
  if (ADMIN_PATHS.some((path) => pathname.startsWith(path))) {
    // First try admin key
    if (validateAdminKeyEdge(token)) {
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-is-admin', 'true')
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      })
      return addCorsHeaders(response, origin)
    }

    // Then try JWT with admin role
    if (isJwtToken(token)) {
      try {
        const jwtUser = await validateJwtEdge(token)
        if (!jwtUser.scopes.includes('admin')) {
          const response = NextResponse.json(
            {
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Admin role required for this endpoint',
              },
            },
            { status: 403 }
          )
          return addCorsHeaders(response, origin)
        }

        const requestHeaders = new Headers(request.headers)
        requestHeaders.set('x-tenant-id', jwtUser.tenant_id)
        requestHeaders.set('x-tenant-scopes', JSON.stringify(jwtUser.scopes))
        requestHeaders.set('x-auth-id', jwtUser.id)
        requestHeaders.set('x-auth-type', 'jwt')

        const response = NextResponse.next({
          request: { headers: requestHeaders },
        })
        return addCorsHeaders(response, origin)
      } catch {
        // Fall through to try API key
      }
    }

    // Then try tenant API key with admin scope
    try {
      const apiKey = await validateApiKeyEdge(token)
      if (!apiKey.scopes.includes('admin')) {
        const response = NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Admin scope required for this endpoint',
            },
          },
          { status: 403 }
        )
        return addCorsHeaders(response, origin)
      }

      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-tenant-id', apiKey.tenant_id)
      requestHeaders.set('x-tenant-scopes', JSON.stringify(apiKey.scopes))
      requestHeaders.set('x-auth-id', apiKey.id)
      requestHeaders.set('x-auth-type', 'api_key')

      const response = NextResponse.next({
        request: { headers: requestHeaders },
      })
      return addCorsHeaders(response, origin)
    } catch {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid credentials',
          },
        },
        { status: 401 }
      )
      return addCorsHeaders(response, origin)
    }
  }

  // Handle regular tenant API paths
  // Support both API keys (mrr_...) and Supabase JWTs
  try {
    let tenantId: string
    let scopes: string[]
    let authId: string
    let authType: 'api_key' | 'jwt'

    if (isJwtToken(token)) {
      // Validate as Supabase JWT
      const jwtUser = await validateJwtEdge(token)
      tenantId = jwtUser.tenant_id
      scopes = jwtUser.scopes
      authId = jwtUser.id
      authType = 'jwt'
    } else {
      // Validate as API key
      const apiKey = await validateApiKeyEdge(token)
      tenantId = apiKey.tenant_id
      scopes = apiKey.scopes
      authId = apiKey.id
      authType = 'api_key'
    }

    // Check if tenant is suspended
    try {
      const supabase = createAdminClient()
      const { data: tenant } = await supabase
        .from('tenants')
        .select('status')
        .eq('id', tenantId)
        .single()

      if (tenant?.status === 'suspended') {
        const response = NextResponse.json(
          {
            success: false,
            error: {
              code: 'TENANT_SUSPENDED',
              message: 'Your account has been suspended. Please contact support.',
            },
          },
          { status: 403 }
        )
        return addCorsHeaders(response, origin)
      }
    } catch {
      // If we can't check tenant status, allow the request through
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-tenant-id', tenantId)
    requestHeaders.set('x-tenant-scopes', JSON.stringify(scopes))
    requestHeaders.set('x-auth-id', authId)
    requestHeaders.set('x-auth-type', authType)

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    })
    return addCorsHeaders(response, origin)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid credentials'
    const response = NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message,
        },
      },
      { status: 401 }
    )
    return addCorsHeaders(response, origin)
  }
}

export const config = {
  matcher: '/api/:path*',
}
