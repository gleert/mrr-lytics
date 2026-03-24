export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          instance_id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[] | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          instance_id: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[] | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          instance_id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      category_mappings: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          instance_id: string
          mapping_type: string
          whmcs_id: number
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          instance_id: string
          mapping_type: string
          whmcs_id: number
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          instance_id?: string
          mapping_type?: string
          whmcs_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_mappings_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_events: {
        Row: {
          attempts: number
          connector_id: string
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          max_attempts: number
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          response_code: number | null
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          connector_id: string
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          payload: Json
          response_body?: string | null
          response_code?: number | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          connector_id?: string
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_code?: number | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_events_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connectors"
            referencedColumns: ["id"]
          },
        ]
      }
      connectors: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          events: string[]
          id: string
          name: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          events?: string[]
          id?: string
          name: string
          tenant_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          events?: string[]
          id?: string
          name?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connectors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_daily: {
        Row: {
          active_clients: number | null
          active_domains: number | null
          active_services: number | null
          amount_overdue: number | null
          amount_paid_day: number | null
          amount_unpaid: number | null
          arpu: number | null
          arr: number | null
          churn_rate: number | null
          churned_clients_day: number | null
          churned_mrr: number | null
          churned_services_day: number | null
          closed_clients: number | null
          created_at: string | null
          date: string
          expiring_domains_30d: number | null
          id: string
          inactive_clients: number | null
          instance_id: string
          mrr: number | null
          mrr_by_cycle: Json | null
          mrr_by_product_group: Json | null
          new_clients_day: number | null
          new_services_day: number | null
          overdue_invoices: number | null
          paid_invoices_day: number | null
          revenue_day: number | null
          revenue_mtd: number | null
          suspended_services: number | null
          top_products: Json | null
          total_clients: number | null
          total_domains: number | null
          unpaid_invoices: number | null
          updated_at: string | null
        }
        Insert: {
          active_clients?: number | null
          active_domains?: number | null
          active_services?: number | null
          amount_overdue?: number | null
          amount_paid_day?: number | null
          amount_unpaid?: number | null
          arpu?: number | null
          arr?: number | null
          churn_rate?: number | null
          churned_clients_day?: number | null
          churned_mrr?: number | null
          churned_services_day?: number | null
          closed_clients?: number | null
          created_at?: string | null
          date: string
          expiring_domains_30d?: number | null
          id?: string
          inactive_clients?: number | null
          instance_id: string
          mrr?: number | null
          mrr_by_cycle?: Json | null
          mrr_by_product_group?: Json | null
          new_clients_day?: number | null
          new_services_day?: number | null
          overdue_invoices?: number | null
          paid_invoices_day?: number | null
          revenue_day?: number | null
          revenue_mtd?: number | null
          suspended_services?: number | null
          top_products?: Json | null
          total_clients?: number | null
          total_domains?: number | null
          unpaid_invoices?: number | null
          updated_at?: string | null
        }
        Update: {
          active_clients?: number | null
          active_domains?: number | null
          active_services?: number | null
          amount_overdue?: number | null
          amount_paid_day?: number | null
          amount_unpaid?: number | null
          arpu?: number | null
          arr?: number | null
          churn_rate?: number | null
          churned_clients_day?: number | null
          churned_mrr?: number | null
          churned_services_day?: number | null
          closed_clients?: number | null
          created_at?: string | null
          date?: string
          expiring_domains_30d?: number | null
          id?: string
          inactive_clients?: number | null
          instance_id?: string
          mrr?: number | null
          mrr_by_cycle?: Json | null
          mrr_by_product_group?: Json | null
          new_clients_day?: number | null
          new_services_day?: number | null
          overdue_invoices?: number | null
          paid_invoices_day?: number | null
          revenue_day?: number | null
          revenue_mtd?: number | null
          suspended_services?: number | null
          top_products?: Json | null
          total_clients?: number | null
          total_domains?: number | null
          unpaid_invoices?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metrics_daily_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_snapshots: {
        Row: {
          active_clients: number
          active_services: number
          arr: number
          attempt_count: number | null
          churn_rate: number | null
          churned_mrr: number | null
          churned_services: number | null
          closed_clients: number
          created_at: string | null
          id: string
          inactive_clients: number
          instance_id: string
          mrr: number
          mrr_by_cycle: Json | null
          paid_invoices: number | null
          revenue_day: number | null
          snapshot_at: string
          snapshot_date: string
          total_clients: number
          unpaid_invoices: number | null
          updated_at: string | null
        }
        Insert: {
          active_clients?: number
          active_services?: number
          arr?: number
          attempt_count?: number | null
          churn_rate?: number | null
          churned_mrr?: number | null
          churned_services?: number | null
          closed_clients?: number
          created_at?: string | null
          id?: string
          inactive_clients?: number
          instance_id: string
          mrr?: number
          mrr_by_cycle?: Json | null
          paid_invoices?: number | null
          revenue_day?: number | null
          snapshot_at?: string
          snapshot_date: string
          total_clients?: number
          unpaid_invoices?: number | null
          updated_at?: string | null
        }
        Update: {
          active_clients?: number
          active_services?: number
          arr?: number
          attempt_count?: number | null
          churn_rate?: number | null
          churned_mrr?: number | null
          churned_services?: number | null
          closed_clients?: number
          created_at?: string | null
          id?: string
          inactive_clients?: number
          instance_id?: string
          mrr?: number
          mrr_by_cycle?: Json | null
          paid_invoices?: number | null
          revenue_day?: number | null
          snapshot_at?: string
          snapshot_date?: string
          total_clients?: number
          unpaid_invoices?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metrics_snapshots_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshot_attempts: {
        Row: {
          attempt_at: string | null
          attempt_date: string
          attempt_number: number
          created_at: string | null
          error_message: string | null
          id: string
          instance_id: string
          mrr_calculated: number | null
          next_retry_at: string | null
          status: string
          was_selected: boolean | null
        }
        Insert: {
          attempt_at?: string | null
          attempt_date: string
          attempt_number?: number
          created_at?: string | null
          error_message?: string | null
          id?: string
          instance_id: string
          mrr_calculated?: number | null
          next_retry_at?: string | null
          status: string
          was_selected?: boolean | null
        }
        Update: {
          attempt_at?: string | null
          attempt_date?: string
          attempt_number?: number
          created_at?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string
          mrr_calculated?: number | null
          next_retry_at?: string | null
          status?: string
          was_selected?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "snapshot_attempts_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          created_at: string
          event_type: string
          from_plan_id: string | null
          id: string
          metadata: Json | null
          stripe_event_id: string | null
          subscription_id: string | null
          tenant_id: string
          to_plan_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          from_plan_id?: string | null
          id?: string
          metadata?: Json | null
          stripe_event_id?: string | null
          subscription_id?: string | null
          tenant_id: string
          to_plan_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          from_plan_id?: string | null
          id?: string
          metadata?: Json | null
          stripe_event_id?: string | null
          subscription_id?: string | null
          tenant_id?: string
          to_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_from_plan_id_fkey"
            columns: ["from_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_to_plan_id_fkey"
            columns: ["to_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          is_default: boolean
          limits: Json
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          id: string
          is_active?: boolean
          is_default?: boolean
          limits?: Json
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          limits?: Json
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_interval: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json | null
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          trial_end: string | null
          trial_start: string | null
          updated_at: string
        }
        Insert: {
          billing_interval?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Update: {
          billing_interval?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          instance_id: string
          records_synced: Json | null
          started_at: string | null
          status: string | null
          sync_type: string | null
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          instance_id: string
          records_synced?: Json | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          instance_id?: string
          records_synced?: Json | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          currency: string | null
          id: string
          name: string
          settings: Json | null
          slug: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          id?: string
          name: string
          settings?: Json | null
          slug: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_tenants: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whmcs_billable_items: {
        Row: {
          amount: number | null
          client_id: number | null
          description: string | null
          duedate: string | null
          id: string
          instance_id: string
          invoicecount: number | null
          recur: number | null
          recurcycle: string | null
          recurfor: number | null
          synced_at: string | null
          whmcs_id: number
        }
        Insert: {
          amount?: number | null
          client_id?: number | null
          description?: string | null
          duedate?: string | null
          id?: string
          instance_id: string
          invoicecount?: number | null
          recur?: number | null
          recurcycle?: string | null
          recurfor?: number | null
          synced_at?: string | null
          whmcs_id: number
        }
        Update: {
          amount?: number | null
          client_id?: number | null
          description?: string | null
          duedate?: string | null
          id?: string
          instance_id?: string
          invoicecount?: number | null
          recur?: number | null
          recurcycle?: string | null
          recurfor?: number | null
          synced_at?: string | null
          whmcs_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_billable_items_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whmcs_cancellation_requests: {
        Row: {
          created_at: string | null
          id: string
          instance_id: string
          reason: string | null
          relid: number
          synced_at: string | null
          type: string | null
          whmcs_id: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_id: string
          reason?: string | null
          relid: number
          synced_at?: string | null
          type?: string | null
          whmcs_id: number
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_id?: string
          reason?: string | null
          relid?: number
          synced_at?: string | null
          type?: string | null
          whmcs_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_cancellation_requests_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whmcs_clients: {
        Row: {
          companyname: string | null
          created_at: string | null
          credit: number | null
          currency: number | null
          current_mrr: number | null
          datecreated: string | null
          defaultgateway: string | null
          domains_count: number | null
          first_payment_date: string | null
          firstname: string | null
          groupid: number | null
          id: string
          instance_id: string
          language: string | null
          last_payment_date: string | null
          lastlogin: string | null
          lastname: string | null
          services_count: number | null
          status: string | null
          synced_at: string | null
          total_paid: number | null
          updated_at: string | null
          whmcs_id: number
        }
        Insert: {
          companyname?: string | null
          created_at?: string | null
          credit?: number | null
          currency?: number | null
          current_mrr?: number | null
          datecreated?: string | null
          defaultgateway?: string | null
          domains_count?: number | null
          first_payment_date?: string | null
          firstname?: string | null
          groupid?: number | null
          id?: string
          instance_id: string
          language?: string | null
          last_payment_date?: string | null
          lastlogin?: string | null
          lastname?: string | null
          services_count?: number | null
          status?: string | null
          synced_at?: string | null
          total_paid?: number | null
          updated_at?: string | null
          whmcs_id: number
        }
        Update: {
          companyname?: string | null
          created_at?: string | null
          credit?: number | null
          currency?: number | null
          current_mrr?: number | null
          datecreated?: string | null
          defaultgateway?: string | null
          domains_count?: number | null
          first_payment_date?: string | null
          firstname?: string | null
          groupid?: number | null
          id?: string
          instance_id?: string
          language?: string | null
          last_payment_date?: string | null
          lastlogin?: string | null
          lastname?: string | null
          services_count?: number | null
          status?: string | null
          synced_at?: string | null
          total_paid?: number | null
          updated_at?: string | null
          whmcs_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_clients_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whmcs_domains: {
        Row: {
          client_id: number | null
          dnsmanagement: boolean | null
          domain: string | null
          donotrenew: boolean | null
          emailforwarding: boolean | null
          expirydate: string | null
          firstpaymentamount: number | null
          id: string
          idprotection: boolean | null
          instance_id: string
          nextduedate: string | null
          nextinvoicedate: string | null
          orderid: number | null
          paymentmethod: string | null
          recurringamount: number | null
          registrationdate: string | null
          registrationperiod: number | null
          status: string | null
          synced_at: string | null
          type: string | null
          whmcs_id: number
        }
        Insert: {
          client_id?: number | null
          dnsmanagement?: boolean | null
          domain?: string | null
          donotrenew?: boolean | null
          emailforwarding?: boolean | null
          expirydate?: string | null
          firstpaymentamount?: number | null
          id?: string
          idprotection?: boolean | null
          instance_id: string
          nextduedate?: string | null
          nextinvoicedate?: string | null
          orderid?: number | null
          paymentmethod?: string | null
          recurringamount?: number | null
          registrationdate?: string | null
          registrationperiod?: number | null
          status?: string | null
          synced_at?: string | null
          type?: string | null
          whmcs_id: number
        }
        Update: {
          client_id?: number | null
          dnsmanagement?: boolean | null
          domain?: string | null
          donotrenew?: boolean | null
          emailforwarding?: boolean | null
          expirydate?: string | null
          firstpaymentamount?: number | null
          id?: string
          idprotection?: boolean | null
          instance_id?: string
          nextduedate?: string | null
          nextinvoicedate?: string | null
          orderid?: number | null
          paymentmethod?: string | null
          recurringamount?: number | null
          registrationdate?: string | null
          registrationperiod?: number | null
          status?: string | null
          synced_at?: string | null
          type?: string | null
          whmcs_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_domains_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whmcs_hosting: {
        Row: {
          amount: number | null
          billingcycle: string | null
          client_id: number | null
          domain: string | null
          domainstatus: string | null
          firstpaymentamount: number | null
          id: string
          instance_id: string
          monthly_amount: number | null
          nextduedate: string | null
          nextinvoicedate: string | null
          overideautosuspend: number | null
          overidesuspenduntil: string | null
          packageid: number | null
          paymentmethod: string | null
          regdate: string | null
          suspendreason: string | null
          synced_at: string | null
          terminationdate: string | null
          whmcs_id: number
        }
        Insert: {
          amount?: number | null
          billingcycle?: string | null
          client_id?: number | null
          domain?: string | null
          domainstatus?: string | null
          firstpaymentamount?: number | null
          id?: string
          instance_id: string
          monthly_amount?: number | null
          nextduedate?: string | null
          nextinvoicedate?: string | null
          overideautosuspend?: number | null
          overidesuspenduntil?: string | null
          packageid?: number | null
          paymentmethod?: string | null
          regdate?: string | null
          suspendreason?: string | null
          synced_at?: string | null
          terminationdate?: string | null
          whmcs_id: number
        }
        Update: {
          amount?: number | null
          billingcycle?: string | null
          client_id?: number | null
          domain?: string | null
          domainstatus?: string | null
          firstpaymentamount?: number | null
          id?: string
          instance_id?: string
          monthly_amount?: number | null
          nextduedate?: string | null
          nextinvoicedate?: string | null
          overideautosuspend?: number | null
          overidesuspenduntil?: string | null
          packageid?: number | null
          paymentmethod?: string | null
          regdate?: string | null
          suspendreason?: string | null
          synced_at?: string | null
          terminationdate?: string | null
          whmcs_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_hosting_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whmcs_instances: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          last_sync_at: string | null
          name: string
          settings: Json | null
          slug: string
          status: string | null
          sync_enabled: boolean | null
          sync_interval_hours: number | null
          tenant_id: string
          updated_at: string | null
          whmcs_api_identifier: string | null
          whmcs_api_secret: string | null
          whmcs_url: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          name: string
          settings?: Json | null
          slug: string
          status?: string | null
          sync_enabled?: boolean | null
          sync_interval_hours?: number | null
          tenant_id: string
          updated_at?: string | null
          whmcs_api_identifier?: string | null
          whmcs_api_secret?: string | null
          whmcs_url: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          name?: string
          settings?: Json | null
          slug?: string
          status?: string | null
          sync_enabled?: boolean | null
          sync_interval_hours?: number | null
          tenant_id?: string
          updated_at?: string | null
          whmcs_api_identifier?: string | null
          whmcs_api_secret?: string | null
          whmcs_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whmcs_invoice_items: {
        Row: {
          amount: number | null
          client_id: number | null
          description: string | null
          id: string
          instance_id: string
          invoice_id: number | null
          relid: number | null
          synced_at: string | null
          taxed: number | null
          type: string | null
          whmcs_id: number
        }
        Insert: {
          amount?: number | null
          client_id?: number | null
          description?: string | null
          id?: string
          instance_id: string
          invoice_id?: number | null
          relid?: number | null
          synced_at?: string | null
          taxed?: number | null
          type?: string | null
          whmcs_id: number
        }
        Update: {
          amount?: number | null
          client_id?: number | null
          description?: string | null
          id?: string
          instance_id?: string
          invoice_id?: number | null
          relid?: number | null
          synced_at?: string | null
          taxed?: number | null
          type?: string | null
          whmcs_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_invoice_items_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whmcs_invoices: {
        Row: {
          client_id: number | null
          credit: number | null
          date: string | null
          datepaid: string | null
          duedate: string | null
          id: string
          instance_id: string
          invoicenum: string | null
          paymentmethod: string | null
          status: string | null
          subtotal: number | null
          synced_at: string | null
          tax: number | null
          tax2: number | null
          total: number | null
          whmcs_id: number
        }
        Insert: {
          client_id?: number | null
          credit?: number | null
          date?: string | null
          datepaid?: string | null
          duedate?: string | null
          id?: string
          instance_id: string
          invoicenum?: string | null
          paymentmethod?: string | null
          status?: string | null
          subtotal?: number | null
          synced_at?: string | null
          tax?: number | null
          tax2?: number | null
          total?: number | null
          whmcs_id: number
        }
        Update: {
          client_id?: number | null
          credit?: number | null
          date?: string | null
          datepaid?: string | null
          duedate?: string | null
          id?: string
          instance_id?: string
          invoicenum?: string | null
          paymentmethod?: string | null
          status?: string | null
          subtotal?: number | null
          synced_at?: string | null
          tax?: number | null
          tax2?: number | null
          total?: number | null
          whmcs_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_invoices_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whmcs_product_groups: {
        Row: {
          hidden: number | null
          id: string
          instance_id: string
          name: string | null
          slug: string | null
          synced_at: string | null
          whmcs_id: number
        }
        Insert: {
          hidden?: number | null
          id?: string
          instance_id: string
          name?: string | null
          slug?: string | null
          synced_at?: string | null
          whmcs_id: number
        }
        Update: {
          hidden?: number | null
          id?: string
          instance_id?: string
          name?: string | null
          slug?: string | null
          synced_at?: string | null
          whmcs_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_product_groups_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whmcs_products: {
        Row: {
          gid: number | null
          hidden: number | null
          id: string
          instance_id: string
          name: string | null
          paytype: string | null
          retired: number | null
          synced_at: string | null
          type: string | null
          whmcs_id: number
        }
        Insert: {
          gid?: number | null
          hidden?: number | null
          id?: string
          instance_id: string
          name?: string | null
          paytype?: string | null
          retired?: number | null
          synced_at?: string | null
          type?: string | null
          whmcs_id: number
        }
        Update: {
          gid?: number | null
          hidden?: number | null
          id?: string
          instance_id?: string
          name?: string | null
          paytype?: string | null
          retired?: number | null
          synced_at?: string | null
          type?: string | null
          whmcs_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_products_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_client_summary: {
        Row: {
          active_clients: number | null
          closed_clients: number | null
          first_client_date: string | null
          inactive_clients: number | null
          instance_id: string | null
          last_client_date: string | null
          total_clients: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_clients_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_invoice_summary: {
        Row: {
          cancelled_count: number | null
          instance_id: string | null
          paid_count: number | null
          revenue_last_30_days: number | null
          revenue_last_90_days: number | null
          total_paid: number | null
          total_unpaid: number | null
          unpaid_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_invoices_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_mrr_by_cycle: {
        Row: {
          billingcycle: string | null
          instance_id: string | null
          mrr_contribution: number | null
          raw_amount: number | null
          service_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_hosting_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_mrr_current: {
        Row: {
          active_services: number | null
          arr: number | null
          calculated_at: string | null
          instance_id: string | null
          mrr: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_hosting_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_revenue_by_product: {
        Row: {
          active_count: number | null
          instance_id: string | null
          mrr: number | null
          product_id: number | null
          product_name: string | null
          product_type: string | null
          total_raw_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whmcs_hosting_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      v_snapshot_status: {
        Row: {
          active_clients: number | null
          arr: number | null
          attempt_count: number | null
          churn_rate: number | null
          instance_id: string | null
          instance_name: string | null
          mrr: number | null
          snapshot_date: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metrics_snapshots_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whmcs_instances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auto_assign_products_to_categories: {
        Args: { p_tenant_id: string }
        Returns: {
          mappings_created: number
          products_assigned: number
        }[]
      }
      auto_generate_categories_for_tenant: {
        Args: { p_tenant_id: string }
        Returns: {
          category_id: string
          category_name: string
          created: boolean
          product_type: string
        }[]
      }
      calculate_backoff_minutes: {
        Args: { p_attempt: number }
        Returns: number
      }
      calculate_churn: {
        Args: { p_instance_id: string; p_period_days?: number }
        Returns: {
          churn_rate: number
          churned_mrr: number
          churned_services: number
          period_end: string
          period_start: string
        }[]
      }
      calculate_daily_revenue: {
        Args: { p_date: string; p_instance_id: string }
        Returns: number
      }
      check_subscription_limit: {
        Args: {
          p_current_usage?: number
          p_limit_key: string
          p_tenant_id: string
        }
        Returns: {
          allowed: boolean
          current_usage: number
          limit_value: number
          plan_id: string
        }[]
      }
      check_webhook_limit: {
        Args: { p_tenant_id: string }
        Returns: {
          allowed: boolean
          current_count: number
          max_count: number
          plan_id: string
        }[]
      }
      create_all_daily_snapshots: {
        Args: { p_date?: string }
        Returns: {
          error_message: string
          instance_id: string
          instance_name: string
          snapshot_id: string
          success: boolean
        }[]
      }
      create_daily_snapshot: {
        Args: { p_date?: string; p_instance_id: string }
        Returns: string
      }
      current_instance_id: { Args: never; Returns: string }
      get_attempt_count: {
        Args: { p_date: string; p_instance_id: string }
        Returns: number
      }
      get_churned_services: {
        Args: { p_instance_id: string; p_period_days?: number }
        Returns: {
          amount: number
          billingcycle: string
          cancellation_reason: string
          cancellation_type: string
          domain: string
          hosting_id: string
          mrr_lost: number
          product_name: string
          status: string
          termination_date: string
          whmcs_id: number
        }[]
      }
      get_connector_events: {
        Args: { p_connector_id: string; p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          error_message: string
          event_id: string
          event_type: string
          id: string
          response_code: number
          sent_at: string
          status: string
        }[]
      }
      get_default_category_config: {
        Args: { product_type: string }
        Returns: {
          cat_color: string
          cat_description: string
          cat_name: string
          cat_slug: string
          cat_sort_order: number
        }[]
      }
      get_last_sync: { Args: { p_instance_id: string }; Returns: string }
      get_metrics_for_date: {
        Args: { p_date?: string; p_instance_ids: string[] }
        Returns: {
          active_clients: number
          active_services: number
          amount_unpaid: number
          arpu: number
          arr: number
          churn_rate: number
          closed_clients: number
          date: string
          inactive_clients: number
          mrr: number
          revenue_day: number
          total_clients: number
          unpaid_invoices: number
        }[]
      }
      get_metrics_history: {
        Args: { p_days?: number; p_instance_id: string }
        Returns: {
          active_clients: number
          active_services: number
          arr: number
          churn_rate: number
          churned_mrr: number
          churned_services: number
          mrr: number
          revenue_day: number
          snapshot_date: string
          total_clients: number
        }[]
      }
      get_metrics_history_aggregated: {
        Args: { p_days?: number; p_instance_ids: string[] }
        Returns: {
          active_clients: number
          active_services: number
          arr: number
          churn_rate: number
          churned_mrr: number
          churned_services: number
          mrr: number
          revenue_day: number
          snapshot_date: string
          total_clients: number
        }[]
      }
      get_metrics_range: {
        Args: {
          p_end_date?: string
          p_instance_ids: string[]
          p_start_date: string
        }
        Returns: {
          active_clients: number
          active_services: number
          arpu: number
          arr: number
          churn_rate: number
          date: string
          mrr: number
          revenue_day: number
          total_clients: number
        }[]
      }
      get_mrr_by_cycle_json: { Args: { p_instance_id: string }; Returns: Json }
      get_pending_webhook_retries: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          connector_config: Json
          connector_id: string
          event_id: string
          event_type: string
          payload: Json
        }[]
      }
      get_tenant_connectors: {
        Args: { p_tenant_id: string }
        Returns: {
          config: Json
          created_at: string
          enabled: boolean
          events: string[]
          failed_events: number
          id: string
          last_event_at: string
          name: string
          total_events: number
          type: string
          updated_at: string
        }[]
      }
      get_tenant_instances: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: {
          instance_id: string
          instance_name: string
          instance_slug: string
          last_sync_at: string
          status: string
          whmcs_url: string
        }[]
      }
      get_tenant_subscription: {
        Args: { p_tenant_id: string }
        Returns: {
          billing_interval: string
          cancel_at_period_end: boolean
          current_period_end: string
          features: Json
          limits: Json
          plan_id: string
          plan_name: string
          status: string
          subscription_id: string
          trial_end: string
        }[]
      }
      get_tenant_usage: {
        Args: { p_tenant_id: string }
        Returns: {
          instances_count: number
          oldest_snapshot_date: string
          team_members_count: number
        }[]
      }
      get_top_clients_by_mrr: {
        Args: { p_instance_id: string; p_limit?: number }
        Returns: {
          client_id: number
          current_mrr: number
          domains_count: number
          services_count: number
          status: string
          tenure_days: number
          total_paid: number
        }[]
      }
      get_user_tenants: {
        Args: { p_user_id: string }
        Returns: {
          currency: string
          is_default: boolean
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          tenant_name: string
          tenant_slug: string
        }[]
      }
      normalize_to_monthly: {
        Args: { p_amount: number; p_cycle: string }
        Returns: number
      }
      populate_metrics_daily: {
        Args: { p_date?: string; p_instance_id: string }
        Returns: string
      }
      process_pending_snapshot_retries: { Args: never; Returns: number }
      refresh_metrics_views: { Args: never; Returns: undefined }
      setup_default_categories_for_tenant: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      update_all_client_metrics: {
        Args: { p_instance_id: string }
        Returns: number
      }
      update_client_metrics: {
        Args: { p_client_id?: number; p_instance_id: string }
        Returns: undefined
      }
      user_has_instance_access: {
        Args: { p_instance_id: string; p_user_id: string }
        Returns: boolean
      }
      user_has_tenant_access: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "admin" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      user_role: ["admin", "viewer"],
    },
  },
} as const

