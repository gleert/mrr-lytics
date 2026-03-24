import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useFilters } from '@/app/providers'

// ============================================================================
// TYPES
// ============================================================================

export type WebhookEventType = 
  | 'client.new'
  | 'client.churned'
  | 'subscription.cancelled'
  | 'sync.completed'
  | 'sync.failed'

export const WEBHOOK_EVENTS: WebhookEventType[] = [
  'client.new',
  'client.churned',
  'subscription.cancelled',
  'sync.completed',
  'sync.failed',
]

export interface Connector {
  id: string
  type: 'webhook' | 'slack' | 'discord'
  name: string
  config: {
    url?: string
    secret?: string // Only present on create
    has_secret?: boolean
    headers?: Record<string, string>
  }
  events: WebhookEventType[]
  enabled: boolean
  created_at: string
  updated_at: string
  total_events?: number
  failed_events?: number
  last_event_at?: string | null
}

// ============================================================================
// SLACK CONNECTOR TYPES
// ============================================================================

export interface SlackConnector {
  id: string
  type: 'slack'
  name: string
  config: {
    /** Masked URL returned by API (e.g. https://hooks.slack.com/...) */
    webhook_url: string
    channel?: string | null
    has_webhook_url: boolean
  }
  events: WebhookEventType[]
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface CreateSlackConnectorData {
  name: string
  webhook_url: string
  channel?: string
  events: WebhookEventType[]
}

export interface UpdateSlackConnectorData {
  name?: string
  webhook_url?: string
  channel?: string
  events?: WebhookEventType[]
  enabled?: boolean
}

// ============================================================================
// EMAIL CONNECTOR TYPES
// ============================================================================

export interface EmailConnector {
  id: string
  type: 'email'
  name: string
  config: {
    host: string
    port: number
    secure: boolean
    user: string
    from: string
    to: string
    has_password: boolean
    // password is never returned by the API
  }
  events: WebhookEventType[]
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface CreateEmailConnectorData {
  name: string
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from: string
  to: string
  events: WebhookEventType[]
}

export interface UpdateEmailConnectorData {
  name?: string
  host?: string
  port?: number
  secure?: boolean
  user?: string
  password?: string
  from?: string
  to?: string
  events?: WebhookEventType[]
  enabled?: boolean
}

// ============================================================================
// HUBSPOT CONNECTOR TYPES
// ============================================================================

export interface HubspotConnector {
  id: string
  type: 'hubspot'
  name: string
  config: {
    access_token: string
    portal_id?: string | null
    has_access_token: boolean
    actions: {
      create_contacts: boolean
      update_lifecycle: boolean
      log_notes: boolean
    }
  }
  events: WebhookEventType[]
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface CreateHubspotConnectorData {
  name: string
  access_token: string
  portal_id?: string
  events: WebhookEventType[]
  actions: {
    create_contacts: boolean
    update_lifecycle: boolean
    log_notes: boolean
  }
}

export interface UpdateHubspotConnectorData {
  name?: string
  access_token?: string
  portal_id?: string
  events?: WebhookEventType[]
  enabled?: boolean
  actions?: {
    create_contacts: boolean
    update_lifecycle: boolean
    log_notes: boolean
  }
}

export interface ConnectorLimit {
  current: number
  max: number
  can_create: boolean
  plan: string
}

export interface ConnectorEvent {
  id: string
  event_type: WebhookEventType
  event_id: string
  status: 'pending' | 'sent' | 'failed'
  response_code: number | null
  error_message: string | null
  attempts: number
  sent_at: string | null
  created_at: string
}

export interface CreateConnectorData {
  name: string
  url: string
  events: WebhookEventType[]
  headers?: Record<string, string>
}

export interface UpdateConnectorData {
  name?: string
  url?: string
  events?: WebhookEventType[]
  headers?: Record<string, string>
  enabled?: boolean
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

interface ConnectorsResponse {
  success: boolean
  data: {
    connectors: Connector[]
    limit: ConnectorLimit | null
  }
}

interface ConnectorResponse {
  success: boolean
  data: {
    connector: Connector
  }
}

interface ConnectorEventsResponse {
  success: boolean
  data: {
    events: ConnectorEvent[]
    limit: number
  }
}

interface TestWebhookResponse {
  success: boolean
  data: {
    event_id: string
    status: string
    response_code: number | null
    error_message: string | null
    message: string
  }
}

interface SlackConnectorsResponse {
  success: boolean
  data: {
    connectors: SlackConnector[]
  }
}

interface SlackConnectorResponse {
  success: boolean
  data: {
    connector: SlackConnector
  }
}

interface TestSlackResponse {
  success: boolean
  data: {
    message: string
  }
}

interface EmailConnectorsResponse {
  success: boolean
  data: {
    connectors: EmailConnector[]
  }
}

interface EmailConnectorResponse {
  success: boolean
  data: {
    connector: EmailConnector
  }
}

interface TestEmailResponse {
  success: boolean
  data: {
    message: string
    messageId?: string
  }
}

interface HubspotConnectorsResponse {
  success: boolean
  data: {
    connectors: HubspotConnector[]
  }
}

interface HubspotConnectorResponse {
  success: boolean
  data: {
    connector: HubspotConnector
  }
}

interface TestHubspotResponse {
  success: boolean
  data: {
    message: string
  }
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to fetch all connectors for the current tenant
 */
export function useConnectors() {
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useQuery({
    queryKey: ['connectors', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant selected')
      
      const response = await api.get<ConnectorsResponse>(
        `/api/tenants/${tenantId}/connectors`
      )
      return {
        connectors: response.data.connectors,
        limit: response.data.limit,
      }
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Hook to fetch a single connector
 */
export function useConnector(connectorId: string) {
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useQuery({
    queryKey: ['connectors', tenantId, connectorId],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant selected')
      
      const response = await api.get<ConnectorResponse>(
        `/api/tenants/${tenantId}/connectors/${connectorId}`
      )
      return response.data.connector
    },
    enabled: !!tenantId && !!connectorId,
  })
}

/**
 * Hook to fetch events for a connector
 */
export function useConnectorEvents(connectorId: string, limit = 50) {
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useQuery({
    queryKey: ['connectors', tenantId, connectorId, 'events', limit],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant selected')
      
      const response = await api.get<ConnectorEventsResponse>(
        `/api/tenants/${tenantId}/connectors/${connectorId}/events`,
        { limit }
      )
      return response.data.events
    },
    enabled: !!tenantId && !!connectorId,
    staleTime: 10 * 1000, // 10 seconds
  })
}

/**
 * Hook to create a new connector
 */
export function useCreateConnector() {
  const queryClient = useQueryClient()
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useMutation({
    mutationFn: async (data: CreateConnectorData) => {
      if (!tenantId) throw new Error('No tenant selected')
      
      const response = await api.post<ConnectorResponse>(
        `/api/tenants/${tenantId}/connectors`,
        data
      )
      return response.data.connector
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectors', tenantId] })
    },
  })
}

/**
 * Hook to update a connector
 */
export function useUpdateConnector() {
  const queryClient = useQueryClient()
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useMutation({
    mutationFn: async ({ 
      connectorId, 
      data 
    }: { 
      connectorId: string
      data: UpdateConnectorData 
    }) => {
      if (!tenantId) throw new Error('No tenant selected')
      
      const response = await api.patch<ConnectorResponse>(
        `/api/tenants/${tenantId}/connectors/${connectorId}`,
        data
      )
      return response.data.connector
    },
    onSuccess: (_, { connectorId }) => {
      queryClient.invalidateQueries({ queryKey: ['connectors', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['connectors', tenantId, connectorId] })
    },
  })
}

/**
 * Hook to delete a connector
 */
export function useDeleteConnector() {
  const queryClient = useQueryClient()
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useMutation({
    mutationFn: async (connectorId: string) => {
      if (!tenantId) throw new Error('No tenant selected')
      
      await api.delete(`/api/tenants/${tenantId}/connectors/${connectorId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectors', tenantId] })
    },
  })
}

/**
 * Hook to test a connector
 */
export function useTestConnector() {
  const queryClient = useQueryClient()
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useMutation({
    mutationFn: async (connectorId: string) => {
      if (!tenantId) throw new Error('No tenant selected')
      
      const response = await api.post<TestWebhookResponse>(
        `/api/tenants/${tenantId}/connectors/${connectorId}/test`
      )
      return response.data
    },
    onSuccess: (_, connectorId) => {
      // Invalidate events to show the test event
      queryClient.invalidateQueries({ 
        queryKey: ['connectors', tenantId, connectorId, 'events'] 
      })
      // Also refresh connector list for updated stats
      queryClient.invalidateQueries({ queryKey: ['connectors', tenantId] })
    },
  })
}

// ============================================================================
// EMAIL CONNECTOR HOOKS
// ============================================================================

/**
 * Hook to fetch all email connectors for the current tenant
 */
export function useEmailConnectors() {
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useQuery({
    queryKey: ['email-connectors', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant selected')
      const response = await api.get<EmailConnectorsResponse>(
        `/api/tenants/${tenantId}/email-connectors`
      )
      return response.data.connectors
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  })
}

/**
 * Hook to create a new email connector
 */
export function useCreateEmailConnector() {
  const queryClient = useQueryClient()
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useMutation({
    mutationFn: async (data: CreateEmailConnectorData) => {
      if (!tenantId) throw new Error('No tenant selected')
      const response = await api.post<EmailConnectorResponse>(
        `/api/tenants/${tenantId}/email-connectors`,
        data
      )
      return response.data.connector
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-connectors', tenantId] })
    },
  })
}

/**
 * Hook to update an email connector
 */
export function useUpdateEmailConnector() {
  const queryClient = useQueryClient()
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useMutation({
    mutationFn: async ({
      connectorId,
      data,
    }: {
      connectorId: string
      data: UpdateEmailConnectorData
    }) => {
      if (!tenantId) throw new Error('No tenant selected')
      const response = await api.patch<EmailConnectorResponse>(
        `/api/tenants/${tenantId}/email-connectors/${connectorId}`,
        data
      )
      return response.data.connector
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-connectors', tenantId] })
    },
  })
}

/**
 * Hook to delete an email connector
 */
export function useDeleteEmailConnector() {
  const queryClient = useQueryClient()
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useMutation({
    mutationFn: async (connectorId: string) => {
      if (!tenantId) throw new Error('No tenant selected')
      await api.delete(`/api/tenants/${tenantId}/email-connectors/${connectorId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-connectors', tenantId] })
    },
  })
}

/**
 * Hook to send a test email through a connector
 */
export function useTestEmailConnector() {
  return useMutation({
    mutationFn: async ({
      tenantId,
      connectorId,
    }: {
      tenantId: string
      connectorId: string
    }) => {
      const response = await api.post<TestEmailResponse>(
        `/api/tenants/${tenantId}/email-connectors/${connectorId}/test`
      )
      return response.data
    },
  })
}

// ============================================================================
// SLACK CONNECTOR HOOKS
// ============================================================================

/**
 * Hook to fetch all Slack connectors for the current tenant
 */
export function useSlackConnectors() {
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useQuery({
    queryKey: ['slack-connectors', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant selected')
      const response = await api.get<SlackConnectorsResponse>(
        `/api/tenants/${tenantId}/slack-connectors`
      )
      return response.data.connectors
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  })
}

/**
 * Hook to create a new Slack connector
 */
export function useCreateSlackConnector() {
  const queryClient = useQueryClient()
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useMutation({
    mutationFn: async (data: CreateSlackConnectorData) => {
      if (!tenantId) throw new Error('No tenant selected')
      const response = await api.post<SlackConnectorResponse>(
        `/api/tenants/${tenantId}/slack-connectors`,
        data
      )
      return response.data.connector
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack-connectors', tenantId] })
    },
  })
}

/**
 * Hook to update a Slack connector
 */
export function useUpdateSlackConnector() {
  const queryClient = useQueryClient()
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useMutation({
    mutationFn: async ({
      connectorId,
      data,
    }: {
      connectorId: string
      data: UpdateSlackConnectorData
    }) => {
      if (!tenantId) throw new Error('No tenant selected')
      const response = await api.patch<SlackConnectorResponse>(
        `/api/tenants/${tenantId}/slack-connectors/${connectorId}`,
        data
      )
      return response.data.connector
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack-connectors', tenantId] })
    },
  })
}

/**
 * Hook to delete a Slack connector
 */
export function useDeleteSlackConnector() {
  const queryClient = useQueryClient()
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useMutation({
    mutationFn: async (connectorId: string) => {
      if (!tenantId) throw new Error('No tenant selected')
      await api.delete(`/api/tenants/${tenantId}/slack-connectors/${connectorId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack-connectors', tenantId] })
    },
  })
}

/**
 * Hook to send a test message to a Slack connector
 */
export function useTestSlackConnector() {
  return useMutation({
    mutationFn: async ({
      tenantId,
      connectorId,
    }: {
      tenantId: string
      connectorId: string
    }) => {
      const response = await api.post<TestSlackResponse>(
        `/api/tenants/${tenantId}/slack-connectors/${connectorId}/test`
      )
      return response.data
    },
  })
}

// ============================================================================
// HUBSPOT CONNECTOR HOOKS
// ============================================================================

/**
 * Hook to fetch all HubSpot connectors for the current tenant
 */
export function useHubspotConnectors() {
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useQuery({
    queryKey: ['hubspot-connectors', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant selected')
      const response = await api.get<HubspotConnectorsResponse>(
        `/api/tenants/${tenantId}/hubspot-connectors`
      )
      return response.data.connectors
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  })
}

/**
 * Hook to create a new HubSpot connector
 */
export function useCreateHubspotConnector() {
  const queryClient = useQueryClient()
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useMutation({
    mutationFn: async (data: CreateHubspotConnectorData) => {
      if (!tenantId) throw new Error('No tenant selected')
      const response = await api.post<HubspotConnectorResponse>(
        `/api/tenants/${tenantId}/hubspot-connectors`,
        data
      )
      return response.data.connector
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubspot-connectors', tenantId] })
    },
  })
}

/**
 * Hook to update a HubSpot connector
 */
export function useUpdateHubspotConnector() {
  const queryClient = useQueryClient()
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useMutation({
    mutationFn: async ({
      connectorId,
      data,
    }: {
      connectorId: string
      data: UpdateHubspotConnectorData
    }) => {
      if (!tenantId) throw new Error('No tenant selected')
      const response = await api.patch<HubspotConnectorResponse>(
        `/api/tenants/${tenantId}/hubspot-connectors/${connectorId}`,
        data
      )
      return response.data.connector
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubspot-connectors', tenantId] })
    },
  })
}

/**
 * Hook to delete a HubSpot connector
 */
export function useDeleteHubspotConnector() {
  const queryClient = useQueryClient()
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  return useMutation({
    mutationFn: async (connectorId: string) => {
      if (!tenantId) throw new Error('No tenant selected')
      await api.delete(`/api/tenants/${tenantId}/hubspot-connectors/${connectorId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubspot-connectors', tenantId] })
    },
  })
}

/**
 * Hook to test a HubSpot connector connection
 */
export function useTestHubspotConnector() {
  return useMutation({
    mutationFn: async ({
      tenantId,
      connectorId,
    }: {
      tenantId: string
      connectorId: string
    }) => {
      const response = await api.post<TestHubspotResponse>(
        `/api/tenants/${tenantId}/hubspot-connectors/${connectorId}/test`
      )
      return response.data
    },
  })
}
