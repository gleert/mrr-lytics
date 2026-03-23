// API Response types matching the backend

export interface Tenant {
  id: string
  name: string
  whmcs_url: string
  whmcs_api_identifier: string
  is_active: boolean
  sync_enabled: boolean
  sync_interval_hours: number
  created_at: string
  updated_at: string
}

export interface ApiKey {
  id: string
  tenant_id: string
  key_prefix: string
  name: string
  is_active: boolean
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

export interface SyncLog {
  id: string
  tenant_id?: string
  instance_id?: string
  instance_name?: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  started_at: string
  completed_at: string | null
  records_processed?: number
  records_synced?: number
  error_message: string | null
  sync_type: 'manual' | 'scheduled'
  metadata?: Record<string, unknown> | null
}

// MRR metrics from /api/metrics/mrr
export interface MRRMetrics {
  mrr: number
  arr: number
  active_services: number
  mrr_by_cycle: Array<{
    cycle: string
    count: number
    mrr: number
  }>
  calculated_at: string
  // Comparison values (vs previous period)
  mrr_change?: number
  arr_change?: number
}

// Churn metrics from /api/metrics/churn
export interface ChurnMetrics {
  period_days: number
  period_start: string
  period_end: string
  churned_services: number
  churned_mrr: number
  churn_rate: number
  // Comparison value (vs previous period)
  churn_rate_change?: number
}

// Revenue by product from /api/metrics
export interface RevenueByProduct {
  product_id: number
  product_name: string
  product_type: string
  active_count: number
  mrr: number
  percentage: number
}

// Client summary
export interface ClientSummary {
  active: number
  inactive: number
  closed: number
  total: number
  // Comparison value (vs previous period)
  active_change?: number
}

// Invoice summary
export interface InvoiceSummary {
  paid_count: number
  unpaid_count: number
  total_paid: number
  total_unpaid: number
  revenue_last_30_days: number
}

// Combined metrics from /api/metrics
export interface AllMetrics {
  mrr: MRRMetrics
  churn: ChurnMetrics
  revenue_by_product: RevenueByProduct[]
  clients: ClientSummary
  invoices: InvoiceSummary
}

export interface SyncStatus {
  tenant_id: string
  last_sync: SyncLog | null
  is_syncing: boolean
  next_scheduled_sync: string | null
}

// Client stats from /api/clients/stats
export interface ClientTrendPoint {
  date: string
  count: number
}

export interface ClientStats {
  total_clients: number
  active_clients: number
  inactive_clients: number
  closed_clients: number
  new_clients: number
  churned_clients: number
  mrr: number
  arr: number
  arpu: number
  ltv: number
  revenue_in_period: number
  clients_with_revenue: number
  retention_rate: number
  net_growth: number
  avg_client_age_months: number
  clients_without_services: number
  revenue_concentration: number
  new_clients_trend: ClientTrendPoint[]
  churned_clients_trend: ClientTrendPoint[]
  bucket_type: 'daily' | 'weekly' | 'monthly'
  period: {
    type: string
    start_date: string
    end_date: string
    days: number
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    total_pages: number
  }
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

// Metrics History types (for charts)
export interface MetricsHistoryPoint {
  snapshot_date: string
  mrr: number
  arr: number
  active_services: number
  active_clients: number
  total_clients: number
  churned_services: number
  churned_mrr: number
  churn_rate: number
  revenue_day: number
}

export interface MetricsHistorySummary {
  days_requested: number
  days_available: number
  latest_date: string | null
  oldest_date: string | null
  current_mrr: number
  mrr_change: number
  mrr_change_percent: number
}

export interface MetricsHistoryResponse {
  data: MetricsHistoryPoint[]
  summary: MetricsHistorySummary
  instance_ids: string[]
}
