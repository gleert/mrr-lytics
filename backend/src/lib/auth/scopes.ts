import type { ApiScope } from '@/types/api'
import { ForbiddenError } from '@/utils/errors'

/**
 * Scope definitions and their implied permissions
 */
const SCOPE_HIERARCHY: Record<ApiScope, ApiScope[]> = {
  admin: ['admin', 'write', 'sync', 'read'],
  sync: ['sync', 'read'],
  write: ['write', 'read'],
  read: ['read'],
}

/**
 * Check if the given scopes include the required scope
 */
export function hasScope(userScopes: ApiScope[], requiredScope: ApiScope): boolean {
  return userScopes.some((scope) => {
    const allowedScopes = SCOPE_HIERARCHY[scope] || []
    return allowedScopes.includes(requiredScope)
  })
}

/**
 * Require a specific scope, throw ForbiddenError if not present
 */
export function requireScope(userScopes: ApiScope[], requiredScope: ApiScope): void {
  if (!hasScope(userScopes, requiredScope)) {
    throw new ForbiddenError(`Insufficient permissions. Required scope: ${requiredScope}`)
  }
}

/**
 * Check if scopes include admin permission
 */
export function isAdmin(scopes: ApiScope[]): boolean {
  return hasScope(scopes, 'admin')
}

/**
 * Validate that scopes array contains only valid scopes
 */
export function validateScopes(scopes: string[]): scopes is ApiScope[] {
  const validScopes: ApiScope[] = ['read', 'write', 'sync', 'admin']
  return scopes.every((scope) => validScopes.includes(scope as ApiScope))
}
