// WHMCS API Client
export { WhmcsClient, createWhmcsClient, type WhmcsClientOptions, type FetchOptions } from './client'

// Sync functionality
export { syncTenantInstances, type SyncResult } from './sync'

// Types (excluding WhmcsClient which is already exported from client)
export type {
  WhmcsApiResponse,
  WhmcsMeta,
  WhmcsData,
  WhmcsHosting,
  WhmcsDomain,
  WhmcsProduct,
  WhmcsProductGroup,
  WhmcsBillableItem,
  WhmcsInvoice,
  WhmcsInvoiceItem,
  WhmcsClient as WhmcsClientData, // Rename to avoid conflict
} from './types'
