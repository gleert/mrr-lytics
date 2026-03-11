import { NextResponse } from 'next/server'
import type { ApiResponse, ApiError as ApiErrorType, ApiMeta } from '@/types/api'
import { ApiError } from './errors'

/**
 * Create a successful API response
 */
export function success<T>(
  data: T,
  meta?: Partial<ApiMeta>,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
    { status }
  )
}

/**
 * Create an error API response
 */
export function error(
  err: ApiError | Error | string,
  status?: number
): NextResponse<ApiResponse<never>> {
  let errorResponse: ApiErrorType
  let statusCode: number

  if (err instanceof ApiError) {
    errorResponse = {
      code: err.code,
      message: err.message,
      details: err.details,
    }
    statusCode = status ?? err.statusCode
  } else if (err instanceof Error) {
    errorResponse = {
      code: 'INTERNAL_ERROR',
      message: err.message,
    }
    statusCode = status ?? 500
  } else {
    errorResponse = {
      code: 'INTERNAL_ERROR',
      message: err,
    }
    statusCode = status ?? 500
  }

  return NextResponse.json(
    {
      success: false,
      error: errorResponse,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status: statusCode }
  )
}

/**
 * Create a 201 Created response
 */
export function created<T>(data: T, meta?: Partial<ApiMeta>): NextResponse<ApiResponse<T>> {
  return success(data, meta, 201)
}

/**
 * Create a 204 No Content response
 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/**
 * Wrap an async handler with error handling
 */
export function withErrorHandling<T>(
  handler: () => Promise<NextResponse<ApiResponse<T>>>
): Promise<NextResponse<ApiResponse<T>>> {
  return handler().catch((err) => {
    console.error('API Error:', err)
    return error(err)
  })
}
