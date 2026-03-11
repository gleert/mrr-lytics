/**
 * WHMCS MRRlytics API Response Types
 * Based on the addon we created earlier
 */

export interface WhmcsApiResponse {
  success: boolean
  meta: WhmcsMeta
  data: WhmcsData
  error?: {
    code: number
    message: string
  }
}

export interface WhmcsMeta {
  whmcs_version: string
  php_version: string
  timezone: string
  exported_at: string
  pagination: {
    limit: number
    offset: number
  }
  filters: {
    since: string | null
  }
  record_counts: {
    hosting: number
    domains: number
    products: number
    product_groups: number
    billable_items: number
    invoices: number
    invoice_items: number
    clients: number
    cancellation_requests: number
  }
}

export interface WhmcsData {
  hosting: WhmcsHosting[]
  domains: WhmcsDomain[]
  products: WhmcsProduct[]
  product_groups: WhmcsProductGroup[]
  billable_items: WhmcsBillableItem[]
  invoices: WhmcsInvoice[]
  invoice_items: WhmcsInvoiceItem[]
  clients: WhmcsClient[]
  cancellation_requests: WhmcsCancellationRequest[]
}

export interface WhmcsHosting {
  id: number
  userid: number
  orderid?: number
  packageid?: number
  server?: number
  regdate?: string
  domain?: string
  paymentmethod?: string
  firstpaymentamount?: number
  amount?: number
  billingcycle?: string
  nextduedate?: string
  nextinvoicedate?: string
  domainstatus?: string
  terminationdate?: string      // Date when service was terminated/cancelled
  username?: string
  dedicatedip?: string
  assignedips?: string
  notes?: string
  subscriptionid?: string
  suspendreason?: string        // Reason for suspension
  overideautosuspend?: number   // Override auto-suspend setting
  overidesuspenduntil?: string  // Suspend override until date
  created_at?: string
  updated_at?: string
}

export interface WhmcsDomain {
  id: number
  userid: number
  orderid?: number
  type?: string
  registrationdate?: string
  domain?: string
  firstpaymentamount?: number
  recurringamount?: number
  registrationperiod?: number
  expirydate?: string
  nextduedate?: string
  nextinvoicedate?: string
  paymentmethod?: string
  status?: string
  dnsmanagement?: number
  emailforwarding?: number
  idprotection?: number
  donotrenew?: number
  created_at?: string
  updated_at?: string
}

export interface WhmcsProduct {
  id: number
  gid?: number
  type?: string
  name?: string
  description?: string
  hidden?: number
  paytype?: string
  tax?: number
  order?: number
  retired?: number
  is_featured?: number
  created_at?: string
  updated_at?: string
}

export interface WhmcsProductGroup {
  id: number
  name?: string
  slug?: string
  headline?: string
  tagline?: string
  hidden?: number
  order?: number
  created_at?: string
  updated_at?: string
}

export interface WhmcsBillableItem {
  id: number
  userid: number
  description?: string
  hours?: number
  amount?: number
  recur?: number
  recurcycle?: string
  recurfor?: number
  invoiceaction?: number
  duedate?: string
  invoicecount?: number
  created_at?: string
  updated_at?: string
}

export interface WhmcsInvoice {
  id: number
  userid: number
  invoicenum?: string
  date?: string
  duedate?: string
  datepaid?: string
  subtotal?: number
  credit?: number
  tax?: number
  tax2?: number
  total?: number
  taxrate?: number
  taxrate2?: number
  status?: string
  paymentmethod?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface WhmcsInvoiceItem {
  id: number
  invoiceid: number
  userid?: number
  type?: string
  relid?: number
  description?: string
  amount?: number
  taxed?: number
  duedate?: string
  paymentmethod?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface WhmcsClient {
  id: number
  firstname?: string            // Client first name
  lastname?: string             // Client last name
  companyname?: string          // Company name if applicable
  email?: string                // Client email address
  currency?: number
  defaultgateway?: string       // Default payment method
  groupid?: number              // Client group ID
  datecreated?: string
  status?: string
  lastlogin?: string            // Last login date (activity indicator)
  credit?: number               // Account credit balance
  latefeeoveride?: number       // Late fee override setting
  overideduenotices?: number    // Due notice override
  billingcid?: number           // Billing contact ID
  language?: string             // Client language preference
  created_at?: string
  updated_at?: string
}

export interface WhmcsCancellationRequest {
  id: number
  relid: number                 // Related hosting ID
  reason?: string               // Cancellation reason
  type?: string                 // 'Immediate' or 'End of Billing Period'
  created_at?: string           // When request was created
  updated_at?: string
}
