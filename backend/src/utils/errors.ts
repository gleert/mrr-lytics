/**
 * Custom API Error Classes
 */

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized', details?: Record<string, unknown>) {
    super('UNAUTHORIZED', message, 401, details)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden', details?: Record<string, unknown>) {
    super('FORBIDDEN', message, 403, details)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Not found', details?: Record<string, unknown>) {
    super('NOT_FOUND', message, 404, details)
    this.name = 'NotFoundError'
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad request', details?: Record<string, unknown>) {
    super('BAD_REQUEST', message, 400, details)
    this.name = 'BadRequestError'
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = 'Conflict', details?: Record<string, unknown>) {
    super('CONFLICT', message, 409, details)
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends ApiError {
  constructor(retryAfter?: number) {
    super('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded', 429, { retry_after: retryAfter })
    this.name = 'RateLimitError'
  }
}

export class InternalError extends ApiError {
  constructor(message: string = 'Internal server error', details?: Record<string, unknown>) {
    super('INTERNAL_ERROR', message, 500, details)
    this.name = 'InternalError'
  }
}
