/**
 * API Request/Response Types
 */

// Standard API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: ApiMeta
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ApiMeta {
  tenant_id?: string
  tenant_ids?: string[]
  instance_id?: string
  instance_ids?: string[]
  timestamp: string
  request_id?: string
}

// Tenant types
export interface CreateTenantRequest {
  name: string
  slug: string
  whmcs_url: string
  whmcs_api_key: string
}

export interface UpdateTenantRequest {
  name?: string
  whmcs_url?: string
  whmcs_api_key?: string
  status?: 'active' | 'inactive' | 'suspended'
  settings?: Record<string, unknown>
}

export interface TenantResponse {
  id: string
  name: string
  slug: string
  whmcs_url: string
  status: string
  created_at: string
  updated_at: string
}

// API Key types
export interface CreateApiKeyRequest {
  name: string
  scopes?: string[]
  expires_in_days?: number
}

export interface ApiKeyResponse {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  created_at: string
  expires_at: string | null
  last_used_at: string | null
}

export interface ApiKeyCreatedResponse extends ApiKeyResponse {
  key: string // Only returned on creation
}

// Sync types
export interface SyncRequest {
  type?: 'full' | 'incremental'
}

export interface SyncStatusResponse {
  id: string
  status: string
  sync_type: string
  started_at: string
  completed_at: string | null
  records_synced: Record<string, number>
  error_message: string | null
  duration_ms: number | null
}

// Metrics types
export interface MrrMetrics {
  mrr: number
  arr: number
  active_services: number
  mrr_by_cycle: {
    cycle: string
    count: number
    mrr: number
  }[]
  calculated_at: string
}

export interface ChurnCategoryBreakdown {
  churned_services: number
  churned_mrr: number
  churn_rate: number
}

export interface ChurnMetrics {
  period_days: number
  period_start: string
  period_end: string
  /**
   * Count of churned services. Not tracked in events mode (the KPI is
   * MRR-weighted), so when `source.mode` is 'events' or 'mixed' this only
   * reflects proxy-mode instances and undercounts — use `churned_mrr` /
   * `churn_rate` as the source of truth.
   */
  churned_services: number
  churned_mrr: number
  churn_rate: number
  breakdown?: {
    hosting: ChurnCategoryBreakdown
    billable: ChurnCategoryBreakdown
    domains: ChurnCategoryBreakdown
  }
  /** Provenance of the figures: observed events vs legacy date proxies, per instance. */
  source?: {
    mode: 'events' | 'proxy' | 'mixed'
    per_instance?: Record<string, 'events' | 'proxy'>
  }
}

export interface RevenueByProduct {
  product_id: number
  product_name: string
  product_type: string | null
  active_count: number
  mrr: number
  percentage: number
}

export interface MetricsSummary {
  mrr: MrrMetrics
  churn: ChurnMetrics
  revenue_by_product: RevenueByProduct[]
  clients: {
    active: number
    inactive: number
    closed: number
    total: number
  }
  invoices: {
    paid_count: number
    unpaid_count: number
    total_paid: number
    total_unpaid: number
    revenue_last_30_days: number
  }
}

// Scopes
export type ApiScope = 'read' | 'write' | 'sync' | 'admin'

// Auth context passed through headers
export interface AuthContext {
  tenant_id: string
  scopes: ApiScope[]
  api_key_id: string
}
