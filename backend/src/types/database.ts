/**
 * Supabase Database Types
 * 
 * This file should be regenerated using:
 * npx supabase gen types typescript --local > src/types/database.ts
 * 
 * For now, we define the types manually based on our migrations.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          whmcs_url: string
          whmcs_api_key: string
          status: 'active' | 'inactive' | 'suspended'
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          whmcs_url: string
          whmcs_api_key: string
          status?: 'active' | 'inactive' | 'suspended'
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          whmcs_url?: string
          whmcs_api_key?: string
          status?: 'active' | 'inactive' | 'suspended'
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      api_keys: {
        Row: {
          id: string
          tenant_id: string
          name: string
          key_hash: string
          key_prefix: string
          scopes: string[]
          last_used_at: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          key_hash: string
          key_prefix: string
          scopes?: string[]
          last_used_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          key_hash?: string
          key_prefix?: string
          scopes?: string[]
          last_used_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
      }
      whmcs_clients: {
        Row: {
          id: string
          tenant_id: string
          whmcs_id: number
          currency: number | null
          status: string | null
          datecreated: string | null
          synced_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          whmcs_id: number
          currency?: number | null
          status?: string | null
          datecreated?: string | null
          synced_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          whmcs_id?: number
          currency?: number | null
          status?: string | null
          datecreated?: string | null
          synced_at?: string
        }
      }
      whmcs_hosting: {
        Row: {
          id: string
          tenant_id: string
          whmcs_id: number
          client_id: number | null
          packageid: number | null
          domain: string | null
          paymentmethod: string | null
          firstpaymentamount: number | null
          amount: number | null
          billingcycle: string | null
          nextduedate: string | null
          nextinvoicedate: string | null
          domainstatus: string | null
          regdate: string | null
          synced_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          whmcs_id: number
          client_id?: number | null
          packageid?: number | null
          domain?: string | null
          paymentmethod?: string | null
          firstpaymentamount?: number | null
          amount?: number | null
          billingcycle?: string | null
          nextduedate?: string | null
          nextinvoicedate?: string | null
          domainstatus?: string | null
          regdate?: string | null
          synced_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          whmcs_id?: number
          client_id?: number | null
          packageid?: number | null
          domain?: string | null
          paymentmethod?: string | null
          firstpaymentamount?: number | null
          amount?: number | null
          billingcycle?: string | null
          nextduedate?: string | null
          nextinvoicedate?: string | null
          domainstatus?: string | null
          regdate?: string | null
          synced_at?: string
        }
      }
      whmcs_domains: {
        Row: {
          id: string
          tenant_id: string
          whmcs_id: number
          client_id: number | null
          domain: string | null
          firstpaymentamount: number | null
          recurringamount: number | null
          registrationperiod: number | null
          expirydate: string | null
          nextduedate: string | null
          status: string | null
          synced_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          whmcs_id: number
          client_id?: number | null
          domain?: string | null
          firstpaymentamount?: number | null
          recurringamount?: number | null
          registrationperiod?: number | null
          expirydate?: string | null
          nextduedate?: string | null
          status?: string | null
          synced_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          whmcs_id?: number
          client_id?: number | null
          domain?: string | null
          firstpaymentamount?: number | null
          recurringamount?: number | null
          registrationperiod?: number | null
          expirydate?: string | null
          nextduedate?: string | null
          status?: string | null
          synced_at?: string
        }
      }
      whmcs_invoices: {
        Row: {
          id: string
          tenant_id: string
          whmcs_id: number
          client_id: number | null
          invoicenum: string | null
          date: string | null
          duedate: string | null
          datepaid: string | null
          subtotal: number | null
          credit: number | null
          tax: number | null
          tax2: number | null
          total: number | null
          status: string | null
          paymentmethod: string | null
          synced_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          whmcs_id: number
          client_id?: number | null
          invoicenum?: string | null
          date?: string | null
          duedate?: string | null
          datepaid?: string | null
          subtotal?: number | null
          credit?: number | null
          tax?: number | null
          tax2?: number | null
          total?: number | null
          status?: string | null
          paymentmethod?: string | null
          synced_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          whmcs_id?: number
          client_id?: number | null
          invoicenum?: string | null
          date?: string | null
          duedate?: string | null
          datepaid?: string | null
          subtotal?: number | null
          credit?: number | null
          tax?: number | null
          tax2?: number | null
          total?: number | null
          status?: string | null
          paymentmethod?: string | null
          synced_at?: string
        }
      }
      whmcs_invoice_items: {
        Row: {
          id: string
          tenant_id: string
          whmcs_id: number
          invoice_id: number | null
          client_id: number | null
          type: string | null
          relid: number | null
          description: string | null
          amount: number | null
          taxed: number | null
          synced_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          whmcs_id: number
          invoice_id?: number | null
          client_id?: number | null
          type?: string | null
          relid?: number | null
          description?: string | null
          amount?: number | null
          taxed?: number | null
          synced_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          whmcs_id?: number
          invoice_id?: number | null
          client_id?: number | null
          type?: string | null
          relid?: number | null
          description?: string | null
          amount?: number | null
          taxed?: number | null
          synced_at?: string
        }
      }
      whmcs_billable_items: {
        Row: {
          id: string
          tenant_id: string
          whmcs_id: number
          client_id: number | null
          description: string | null
          amount: number | null
          recur: number | null
          recurcycle: string | null
          recurfor: number | null
          duedate: string | null
          invoicecount: number | null
          synced_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          whmcs_id: number
          client_id?: number | null
          description?: string | null
          amount?: number | null
          recur?: number | null
          recurcycle?: string | null
          recurfor?: number | null
          duedate?: string | null
          invoicecount?: number | null
          synced_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          whmcs_id?: number
          client_id?: number | null
          description?: string | null
          amount?: number | null
          recur?: number | null
          recurcycle?: string | null
          recurfor?: number | null
          duedate?: string | null
          invoicecount?: number | null
          synced_at?: string
        }
      }
      whmcs_products: {
        Row: {
          id: string
          tenant_id: string
          whmcs_id: number
          gid: number | null
          name: string | null
          type: string | null
          paytype: string | null
          hidden: number | null
          retired: number | null
          synced_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          whmcs_id: number
          gid?: number | null
          name?: string | null
          type?: string | null
          paytype?: string | null
          hidden?: number | null
          retired?: number | null
          synced_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          whmcs_id?: number
          gid?: number | null
          name?: string | null
          type?: string | null
          paytype?: string | null
          hidden?: number | null
          retired?: number | null
          synced_at?: string
        }
      }
      sync_logs: {
        Row: {
          id: string
          tenant_id: string
          started_at: string
          completed_at: string | null
          status: 'running' | 'completed' | 'failed'
          sync_type: 'full' | 'incremental'
          records_synced: Json
          error_message: string | null
          duration_ms: number | null
          triggered_by: 'manual' | 'cron' | 'webhook'
        }
        Insert: {
          id?: string
          tenant_id: string
          started_at?: string
          completed_at?: string | null
          status?: 'running' | 'completed' | 'failed'
          sync_type?: 'full' | 'incremental'
          records_synced?: Json
          error_message?: string | null
          duration_ms?: number | null
          triggered_by?: 'manual' | 'cron' | 'webhook'
        }
        Update: {
          id?: string
          tenant_id?: string
          started_at?: string
          completed_at?: string | null
          status?: 'running' | 'completed' | 'failed'
          sync_type?: 'full' | 'incremental'
          records_synced?: Json
          error_message?: string | null
          duration_ms?: number | null
          triggered_by?: 'manual' | 'cron' | 'webhook'
        }
      }
    }
    Views: {
      mv_client_summary: {
        Row: {
          tenant_id: string
          active_clients: number
          inactive_clients: number
          closed_clients: number
          total_clients: number
        }
      }
      mv_invoice_summary: {
        Row: {
          tenant_id: string
          paid_count: number
          unpaid_count: number
          total_paid: number
          total_unpaid: number
          revenue_last_30_days: number
        }
      }
      mv_mrr_summary: {
        Row: {
          tenant_id: string
          current_mrr: number
          hosting_mrr: number
          domains_mrr: number
          billable_mrr: number
        }
      }
    }
    Functions: {
      set_config: {
        Args: {
          setting: string
          value: string
          is_local: boolean
        }
        Returns: void
      }
      refresh_metrics_views: {
        Args: Record<string, never>
        Returns: void
      }
    }
    Enums: {
      tenant_status: 'active' | 'inactive' | 'suspended'
      sync_status: 'running' | 'completed' | 'failed'
      sync_type: 'full' | 'incremental'
      trigger_type: 'manual' | 'cron' | 'webhook'
    }
  }
}

// Helper types
export type Tenant = Database['public']['Tables']['tenants']['Row']
export type TenantInsert = Database['public']['Tables']['tenants']['Insert']
export type TenantUpdate = Database['public']['Tables']['tenants']['Update']

export type ApiKey = Database['public']['Tables']['api_keys']['Row']
export type ApiKeyInsert = Database['public']['Tables']['api_keys']['Insert']

export type SyncLog = Database['public']['Tables']['sync_logs']['Row']
export type SyncLogInsert = Database['public']['Tables']['sync_logs']['Insert']

// WHMCS Instance types
export interface WhmcsInstance {
  id: string
  tenant_id: string
  name: string
  whmcs_url: string
  whmcs_api_identifier: string | null
  whmcs_api_secret: string | null
  status: 'active' | 'inactive' | 'error'
  color: string
  sync_enabled: boolean
  sync_interval_hours: number
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

// Metrics Snapshot types
export interface MetricsSnapshot {
  id: string
  instance_id: string
  snapshot_date: string
  snapshot_at: string
  mrr: number
  arr: number
  active_services: number
  active_clients: number
  inactive_clients: number
  closed_clients: number
  total_clients: number
  churned_services: number
  churned_mrr: number
  churn_rate: number
  revenue_day: number
  paid_invoices: number
  unpaid_invoices: number
  mrr_by_cycle: MrrByCycle[]
  attempt_count: number
  created_at: string
  updated_at: string
}

export interface MrrByCycle {
  cycle: string
  count: number
  mrr: number
}

// Snapshot Attempt types
export interface SnapshotAttempt {
  id: string
  instance_id: string
  attempt_date: string
  attempt_at: string
  attempt_number: number
  status: 'success' | 'failed' | 'superseded' | 'pending'
  mrr_calculated: number | null
  error_message: string | null
  was_selected: boolean
  next_retry_at: string | null
  created_at: string
}

// Metrics History types (for API responses)
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
