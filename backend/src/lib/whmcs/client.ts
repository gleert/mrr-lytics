import type { WhmcsApiResponse } from './types'

export interface WhmcsClientOptions {
  baseUrl: string
  apiKey: string
  timeout?: number
}

export interface FetchOptions {
  limit?: number
  offset?: number
  since?: string
}

/**
 * Client for connecting to WHMCS MRRlytics addon
 */
export class WhmcsClient {
  private baseUrl: string
  private apiKey: string
  private timeout: number

  constructor(options: WhmcsClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.apiKey = options.apiKey
    this.timeout = options.timeout || 120000 // 2 minutes default
  }

  /**
   * Fetch data from WHMCS MRRlytics endpoint
   */
  async fetch(options: FetchOptions = {}): Promise<WhmcsApiResponse> {
    const { limit = 500, offset = 0, since } = options

    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })

    if (since) {
      params.append('since', since)
    }

    const url = `${this.baseUrl}?${params.toString()}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-MRRlytics-Key': this.apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(
          errorBody.error?.message || `WHMCS API error: ${response.status} ${response.statusText}`
        )
      }

      const data: WhmcsApiResponse = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'WHMCS API returned unsuccessful response')
      }

      return data
    } catch (err) {
      clearTimeout(timeoutId)

      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('WHMCS API request timed out')
      }

      throw err
    }
  }

  /**
   * Fetch all data with pagination
   */
  async fetchAll(options: Omit<FetchOptions, 'offset'> = {}): Promise<WhmcsApiResponse> {
    const { limit = 500, since } = options
    const allData: WhmcsApiResponse = {
      success: true,
      meta: {
        whmcs_version: '',
        php_version: '',
        timezone: '',
        exported_at: new Date().toISOString(),
        pagination: { limit, offset: 0 },
        filters: { since: since || null },
        record_counts: {
          hosting: 0,
          domains: 0,
          products: 0,
          product_groups: 0,
          billable_items: 0,
          invoices: 0,
          invoice_items: 0,
          clients: 0,
          cancellation_requests: 0,
        },
      },
      data: {
        hosting: [],
        domains: [],
        products: [],
        product_groups: [],
        billable_items: [],
        invoices: [],
        invoice_items: [],
        clients: [],
        cancellation_requests: [],
      },
    }

    let offset = 0
    let hasMore = true

    while (hasMore) {
      const result = await this.fetch({ limit, offset, since })

      // Merge data
      allData.data.hosting.push(...result.data.hosting)
      allData.data.domains.push(...result.data.domains)
      allData.data.products.push(...result.data.products)
      allData.data.product_groups.push(...result.data.product_groups)
      allData.data.billable_items.push(...result.data.billable_items)
      allData.data.invoices.push(...result.data.invoices)
      allData.data.invoice_items.push(...result.data.invoice_items)
      allData.data.clients.push(...result.data.clients)
      allData.data.cancellation_requests.push(...(result.data.cancellation_requests || []))

      // Update meta from last fetch
      allData.meta = {
        ...result.meta,
        record_counts: {
          hosting: allData.data.hosting.length,
          domains: allData.data.domains.length,
          products: allData.data.products.length,
          product_groups: allData.data.product_groups.length,
          billable_items: allData.data.billable_items.length,
          invoices: allData.data.invoices.length,
          invoice_items: allData.data.invoice_items.length,
          clients: allData.data.clients.length,
          cancellation_requests: allData.data.cancellation_requests.length,
        },
      }

      // Check if any table returned data equal to limit (might have more)
      const dataArrays = [
        result.data.hosting,
        result.data.domains,
        result.data.products,
        result.data.product_groups,
        result.data.billable_items,
        result.data.invoices,
        result.data.invoice_items,
        result.data.clients,
        result.data.cancellation_requests || [],
      ]
      
      // If any table has exactly limit records, there might be more
      const anyTableAtLimit = dataArrays.some(arr => arr.length === limit)
      
      if (!anyTableAtLimit) {
        hasMore = false
      } else {
        offset += limit
        console.log(`[WHMCS] Fetching page at offset ${offset}...`)
      }

      // Safety limit to prevent infinite loops
      if (offset > 100000) {
        console.warn('WHMCS fetch: Reached safety limit of 100k records per table')
        hasMore = false
      }
    }

    return allData
  }

  /**
   * Test connection to WHMCS
   */
  async testConnection(): Promise<{ success: boolean; message: string; version?: string }> {
    try {
      const result = await this.fetch({ limit: 1 })
      return {
        success: true,
        message: 'Connection successful',
        version: result.meta.whmcs_version,
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      }
    }
  }
}

/**
 * Create a WHMCS client from tenant configuration
 */
export function createWhmcsClient(whmcsUrl: string, apiKey: string): WhmcsClient {
  return new WhmcsClient({
    baseUrl: whmcsUrl,
    apiKey,
  })
}
