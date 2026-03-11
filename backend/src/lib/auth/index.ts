// Server-side API key functions (Node.js only - uses node:crypto)
export {
  validateApiKey,
  validateAdminKey,
  extractBearerToken,
  createApiKey,
  getAuthContext,
  type ValidatedApiKey,
} from './api-key'

// Edge-compatible API key functions (middleware, edge functions)
export {
  validateApiKeyEdge,
  validateAdminKeyEdge,
  extractBearerToken as extractBearerTokenEdge,
} from './api-key-edge'

// Scope utilities
export * from './scopes'
