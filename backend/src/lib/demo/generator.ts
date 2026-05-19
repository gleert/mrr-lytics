import type {
  WhmcsApiResponse,
  WhmcsClient,
  WhmcsHosting,
  WhmcsDomain,
  WhmcsProduct,
  WhmcsProductGroup,
  WhmcsInvoice,
  WhmcsInvoiceItem,
  WhmcsBillableItem,
  WhmcsCancellationRequest,
  WhmcsClientClosure,
} from '@/lib/whmcs/types'
import { LATEST_MODULE_VERSION } from '@/lib/module/latest-version'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const FIRST_NAMES = [
  'Alex', 'María', 'Juan', 'Sara', 'Mark', 'Lisa', 'Tom', 'Ana', 'David', 'Elena',
  'Carlos', 'Nora', 'Pedro', 'Laura', 'Mike', 'Sofía', 'James', 'Emma', 'Luis', 'Olivia',
  'Pablo', 'Marta', 'Andrew', 'Lucía', 'Diego', 'Clara', 'Hugo', 'Iris', 'Daniel', 'Júlia',
]

const LAST_NAMES = [
  'García', 'Smith', 'Johnson', 'Pérez', 'Williams', 'Brown', 'López', 'Davis', 'Martínez',
  'Miller', 'González', 'Wilson', 'Rodríguez', 'Anderson', 'Sánchez', 'Taylor', 'Romero',
  'Thomas', 'Hernández', 'Moore', 'Castro', 'Jackson', 'Ortega', 'Harris', 'Vega',
  'Clark', 'Navarro', 'Lewis', 'Iglesias', 'Walker',
]

const COMPANIES = [
  'Acme Corp', 'Globex Hosting', 'Initech', 'Hooli', 'Pied Piper', 'Stark Industries',
  'Wonka Web', 'Umbrella Cloud', 'Soylent SaaS', 'Wayne Hosting', 'Cyberdyne Net',
  'Massive Dynamic', 'Vandelay Web', 'Tyrell Cloud', 'Aperture Net', 'Black Mesa',
  'Dunder Mifflin', 'Vehement Hosting', 'Sterling Cooper', 'Hyperion Web', 'Strickland',
  'Octan Cloud', 'Paper Street', 'Los Pollos', 'Blue Sun',
]

const COUNTRIES_LANG = [
  'spanish', 'english', 'english', 'spanish', 'french', 'english', 'english', 'spanish',
  'portuguese-br', 'german',
]

const PRODUCT_GROUPS: { id: number; name: string; slug: string }[] = [
  { id: 1, name: 'Web Hosting', slug: 'web-hosting' },
  { id: 2, name: 'Reseller Hosting', slug: 'reseller-hosting' },
  { id: 3, name: 'VPS', slug: 'vps' },
  { id: 4, name: 'Cloud Servers', slug: 'cloud-servers' },
  { id: 5, name: 'Dedicated Servers', slug: 'dedicated-servers' },
  { id: 6, name: 'Email & Productivity', slug: 'email' },
  { id: 7, name: 'SSL Certificates', slug: 'ssl' },
  { id: 8, name: 'Backups & Add-ons', slug: 'addons' },
]

const PRODUCT_CATALOG: { id: number; gid: number; name: string; price: number; type: string }[] = [
  { id: 1, gid: 1, name: 'Hosting Starter', price: 4.99, type: 'hostingaccount' },
  { id: 2, gid: 1, name: 'Hosting Plus', price: 9.99, type: 'hostingaccount' },
  { id: 3, gid: 1, name: 'Hosting Business', price: 19.99, type: 'hostingaccount' },
  { id: 4, gid: 1, name: 'Hosting Premium', price: 39.99, type: 'hostingaccount' },
  { id: 5, gid: 2, name: 'Reseller M', price: 24.99, type: 'reselleraccount' },
  { id: 6, gid: 2, name: 'Reseller L', price: 49.99, type: 'reselleraccount' },
  { id: 7, gid: 3, name: 'VPS Cloud 2', price: 14.99, type: 'server' },
  { id: 8, gid: 3, name: 'VPS Cloud 4', price: 29.99, type: 'server' },
  { id: 9, gid: 3, name: 'VPS Cloud 8', price: 59.99, type: 'server' },
  { id: 10, gid: 4, name: 'Cloud Compute S', price: 18.0, type: 'server' },
  { id: 11, gid: 4, name: 'Cloud Compute M', price: 38.0, type: 'server' },
  { id: 12, gid: 4, name: 'Cloud Compute L', price: 78.0, type: 'server' },
  { id: 13, gid: 5, name: 'Dedicated Bronze', price: 89.0, type: 'server' },
  { id: 14, gid: 5, name: 'Dedicated Silver', price: 149.0, type: 'server' },
  { id: 15, gid: 5, name: 'Dedicated Gold', price: 249.0, type: 'server' },
  { id: 16, gid: 6, name: 'Email Pro 5GB', price: 2.5, type: 'other' },
  { id: 17, gid: 6, name: 'Email Pro 25GB', price: 4.99, type: 'other' },
  { id: 18, gid: 6, name: 'Workspace Suite', price: 8.99, type: 'other' },
  { id: 19, gid: 7, name: 'SSL Domain', price: 9.0, type: 'other' },
  { id: 20, gid: 7, name: 'SSL Wildcard', price: 79.0, type: 'other' },
  { id: 21, gid: 7, name: 'SSL EV', price: 149.0, type: 'other' },
  { id: 22, gid: 8, name: 'Daily Backups', price: 3.0, type: 'other' },
  { id: 23, gid: 8, name: 'CDN Boost', price: 5.0, type: 'other' },
  { id: 24, gid: 8, name: 'WAF Protection', price: 12.0, type: 'other' },
  { id: 25, gid: 8, name: 'Priority Support', price: 19.0, type: 'other' },
]

const TLDS = ['.com', '.net', '.org', '.io', '.co', '.es', '.tech', '.dev']
const BILLING_CYCLES = ['Monthly', 'Monthly', 'Monthly', 'Monthly', 'Quarterly', 'Quarterly', 'Annually']
const PAYMENT_METHODS = ['stripe', 'paypal', 'banktransfer']

function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickFromPool<T>(pool: T[], rand: () => number): T {
  return pool[Math.floor(rand() * pool.length)]
}

function intBetween(rand: () => number, min: number, maxInclusive: number): number {
  return Math.floor(rand() * (maxInclusive - min + 1)) + min
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateTime(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d)
  r.setUTCMonth(r.getUTCMonth() + months)
  return r
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY)
}

interface GenerateOptions {
  seed: number
  startDate: Date
  today: Date
}

interface GeneratedDataset {
  product_groups: WhmcsProductGroup[]
  products: WhmcsProduct[]
  clients: WhmcsClient[]
  hosting: WhmcsHosting[]
  domains: WhmcsDomain[]
  invoices: WhmcsInvoice[]
  invoice_items: WhmcsInvoiceItem[]
  billable_items: WhmcsBillableItem[]
  cancellation_requests: WhmcsCancellationRequest[]
  client_closures: WhmcsClientClosure[]
}

function buildDataset({ seed, startDate, today }: GenerateOptions): GeneratedDataset {
  const rand = mulberry32(seed)
  const startMs = startDate.getTime()
  const todayMs = today.getTime()
  const totalDays = Math.max(1, Math.floor((todayMs - startMs) / MS_PER_DAY))

  // Product groups (static)
  const product_groups: WhmcsProductGroup[] = PRODUCT_GROUPS.map((g, i) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    headline: g.name,
    tagline: '',
    hidden: 0,
    order: i + 1,
    created_at: formatDateTime(startDate),
    updated_at: formatDateTime(startDate),
  }))

  // Products (static)
  const products: WhmcsProduct[] = PRODUCT_CATALOG.map((p, i) => ({
    id: p.id,
    gid: p.gid,
    type: p.type,
    name: p.name,
    description: `${p.name} — bundled hosting plan`,
    hidden: 0,
    paytype: 'recurring',
    tax: 1,
    order: i + 1,
    retired: 0,
    is_featured: i < 3 ? 1 : 0,
    created_at: formatDateTime(startDate),
    updated_at: formatDateTime(startDate),
  }))

  // Clients: 50 clients with datecreated spread across [startDate, today]
  const NUM_CLIENTS = 50
  const clients: WhmcsClient[] = []
  for (let i = 0; i < NUM_CLIENTS; i++) {
    const clientId = 1001 + i
    const offsetDay = Math.floor((i / NUM_CLIENTS) * totalDays)
    const dateCreated = addDays(startDate, offsetDay)
    const isClosed = rand() < 0.05
    const status = isClosed ? 'Closed' : 'Active'
    const lastLogin = isClosed ? null : addDays(today, -intBetween(rand, 0, 30))

    clients.push({
      id: clientId,
      firstname: pickFromPool(FIRST_NAMES, rand),
      lastname: pickFromPool(LAST_NAMES, rand),
      companyname: rand() < 0.6 ? pickFromPool(COMPANIES, rand) : '',
      currency: 1,
      defaultgateway: pickFromPool(PAYMENT_METHODS, rand),
      groupid: 0,
      datecreated: formatDate(dateCreated),
      status,
      lastlogin: lastLogin ? formatDateTime(lastLogin) : undefined,
      credit: rand() < 0.1 ? Math.round(rand() * 4000) / 100 : 0,
      language: pickFromPool(COUNTRIES_LANG, rand),
      created_at: formatDateTime(dateCreated),
      updated_at: formatDateTime(addDays(dateCreated, intBetween(rand, 0, 30))),
    })
  }

  // Hosting: 1-3 services per active client, occasional cancellations
  const hosting: WhmcsHosting[] = []
  let hostingId = 5001
  const cancellation_requests: WhmcsCancellationRequest[] = []

  for (const client of clients) {
    if (client.status === 'Closed') continue
    const numServices = intBetween(rand, 1, 3)
    for (let s = 0; s < numServices; s++) {
      const product = PRODUCT_CATALOG[intBetween(rand, 0, PRODUCT_CATALOG.length - 1)]
      const clientCreated = client.datecreated ? new Date(`${client.datecreated}T00:00:00Z`) : startDate
      const minRegMs = clientCreated.getTime()
      const regDate = new Date(minRegMs + Math.floor(rand() * (todayMs - minRegMs)))
      const cycle = pickFromPool(BILLING_CYCLES, rand)
      const cycleMonths = cycle === 'Annually' ? 12 : cycle === 'Quarterly' ? 3 : 1
      const cycleAmount =
        cycle === 'Annually' ? product.price * 10 : cycle === 'Quarterly' ? product.price * 3 : product.price

      const r = rand()
      let domainstatus = 'Active'
      let terminationdate: string | undefined
      if (r < 0.05) domainstatus = 'Cancelled'
      else if (r < 0.1) domainstatus = 'Suspended'

      const tld = pickFromPool(TLDS, rand)
      const domainName = `${(client.companyname || `${client.firstname}${client.lastname}`)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 20) || 'demo'}-${hostingId}${tld}`

      // Next due date = regDate + N cycles into the future
      let nextDue = new Date(regDate)
      while (nextDue.getTime() < todayMs) nextDue = addMonths(nextDue, cycleMonths)

      if (domainstatus === 'Cancelled') {
        terminationdate = formatDate(addDays(regDate, intBetween(rand, 30, totalDays)))
        cancellation_requests.push({
          id: 8000 + cancellation_requests.length + 1,
          relid: hostingId,
          reason: pickFromPool(['Migrating away', 'No longer needed', 'Price', 'Performance'], rand),
          type: rand() < 0.7 ? 'End of Billing Period' : 'Immediate',
          created_at: formatDateTime(addDays(regDate, intBetween(rand, 30, totalDays - 1))),
          updated_at: formatDateTime(addDays(regDate, intBetween(rand, 30, totalDays))),
        })
      }

      hosting.push({
        id: hostingId,
        userid: client.id,
        orderid: hostingId,
        packageid: product.id,
        regdate: formatDate(regDate),
        domain: domainName,
        paymentmethod: client.defaultgateway,
        firstpaymentamount: cycleAmount,
        amount: cycleAmount,
        billingcycle: cycle,
        nextduedate: formatDate(nextDue),
        nextinvoicedate: formatDate(nextDue),
        domainstatus,
        terminationdate,
        username: domainName.split('.')[0],
        created_at: formatDateTime(regDate),
        updated_at: formatDateTime(addDays(regDate, intBetween(rand, 0, 30))),
      })
      hostingId++
    }
  }

  // Domains: 0-2 per active client
  const domains: WhmcsDomain[] = []
  let domainId = 7001
  for (const client of clients) {
    if (client.status === 'Closed') continue
    const n = intBetween(rand, 0, 2)
    for (let d = 0; d < n; d++) {
      const tld = pickFromPool(TLDS, rand)
      const dn = `${pickFromPool(COMPANIES, rand)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')}-${domainId}${tld}`
      const clientCreated = client.datecreated ? new Date(`${client.datecreated}T00:00:00Z`) : startDate
      const regDate = new Date(clientCreated.getTime() + Math.floor(rand() * (todayMs - clientCreated.getTime())))
      const period = pickFromPool([1, 1, 1, 2, 3], rand)
      const expiry = addDays(regDate, period * 365)
      const recurring = period === 1 ? 12 : period === 2 ? 22 : 30

      domains.push({
        id: domainId,
        userid: client.id,
        type: 'Register',
        registrationdate: formatDate(regDate),
        domain: dn,
        firstpaymentamount: recurring,
        recurringamount: recurring,
        registrationperiod: period,
        expirydate: formatDate(expiry),
        nextduedate: formatDate(expiry),
        nextinvoicedate: formatDate(addDays(expiry, -30)),
        paymentmethod: client.defaultgateway,
        status: 'Active',
        dnsmanagement: 1,
        emailforwarding: 0,
        idprotection: rand() < 0.5 ? 1 : 0,
        donotrenew: 0,
        created_at: formatDateTime(regDate),
        updated_at: formatDateTime(regDate),
      })
      domainId++
    }
  }

  // Invoices: monthly invoices per active recurring service from regdate to today
  const invoices: WhmcsInvoice[] = []
  const invoice_items: WhmcsInvoiceItem[] = []
  let invoiceId = 9001
  let invoiceItemId = 90001
  let invoiceNum = 1

  for (const h of hosting) {
    if (h.domainstatus === 'Cancelled') {
      // Stop invoicing once cancelled (assume cancelled at 75% of life)
      const regDate = h.regdate ? new Date(`${h.regdate}T00:00:00Z`) : startDate
      const cancelDate = h.terminationdate ? new Date(`${h.terminationdate}T00:00:00Z`) : today
      pushInvoicesFor(regDate, cancelDate)
      continue
    }
    const regDate = h.regdate ? new Date(`${h.regdate}T00:00:00Z`) : startDate
    pushInvoicesFor(regDate, today)

    function pushInvoicesFor(from: Date, until: Date) {
      const cycleMonths = h.billingcycle === 'Annually' ? 12 : h.billingcycle === 'Quarterly' ? 3 : 1
      let cursor = new Date(from)
      while (cursor.getTime() <= until.getTime()) {
        const periodEnd = addMonths(cursor, cycleMonths)
        const isCurrent = periodEnd.getTime() > todayMs
        const status = isCurrent ? (rand() < 0.5 ? 'Unpaid' : 'Paid') : 'Paid'
        const datepaid =
          status === 'Paid' ? formatDateTime(addDays(cursor, intBetween(rand, 0, 5))) : undefined

        const taxAmount = Math.round((h.amount ?? 0) * 0.21 * 100) / 100
        const total = Math.round(((h.amount ?? 0) + taxAmount) * 100) / 100

        const inv: WhmcsInvoice = {
          id: invoiceId,
          userid: h.userid,
          invoicenum: `INV-${String(invoiceNum).padStart(5, '0')}`,
          date: formatDate(cursor),
          duedate: formatDate(addDays(cursor, 7)),
          datepaid,
          subtotal: h.amount,
          credit: 0,
          tax: taxAmount,
          tax2: 0,
          total,
          taxrate: 21,
          taxrate2: 0,
          status,
          paymentmethod: h.paymentmethod,
          created_at: formatDateTime(cursor),
          updated_at: formatDateTime(datepaid ? new Date(datepaid.replace(' ', 'T') + 'Z') : cursor),
        }
        invoices.push(inv)

        invoice_items.push({
          id: invoiceItemId++,
          invoiceid: invoiceId,
          userid: h.userid,
          type: 'Hosting',
          relid: h.id,
          description: `${h.domain} — ${h.billingcycle}`,
          amount: h.amount,
          taxed: 1,
          duedate: formatDate(addDays(cursor, 7)),
          paymentmethod: h.paymentmethod,
          created_at: formatDateTime(cursor),
          updated_at: formatDateTime(cursor),
        })

        invoiceId++
        invoiceNum++
        cursor = periodEnd
      }
    }
  }

  // Billable items: 5 scattered across active clients
  const billable_items: WhmcsBillableItem[] = []
  const activeClients = clients.filter((c) => c.status === 'Active')
  for (let i = 0; i < 5 && activeClients.length > 0; i++) {
    const client = activeClients[intBetween(rand, 0, activeClients.length - 1)]
    const amount = Math.round(rand() * 9000 + 500) / 100
    const due = addDays(today, intBetween(rand, -90, 30))
    billable_items.push({
      id: 11001 + i,
      userid: client.id,
      description: pickFromPool(
        ['Custom development', 'Migration assistance', 'Performance tuning', 'SSL renewal', 'Backup restore'],
        rand,
      ),
      hours: rand() < 0.4 ? Math.round(rand() * 80) / 10 : 0,
      amount,
      recur: rand() < 0.3 ? 1 : 0,
      recurcycle: 'Monthly',
      recurfor: rand() < 0.3 ? intBetween(rand, 1, 12) : 0,
      invoiceaction: 1,
      duedate: formatDate(due),
      invoicecount: rand() < 0.5 ? intBetween(rand, 0, 3) : 0,
      created_at: formatDateTime(addDays(due, -intBetween(rand, 5, 30))),
      updated_at: formatDateTime(addDays(due, -intBetween(rand, 0, 5))),
    })
  }

  // Client closures: one entry per closed client
  const client_closures: WhmcsClientClosure[] = []
  let closureId = 13001
  for (const client of clients) {
    if (client.status !== 'Closed') continue
    const created = client.created_at
      ? new Date(client.created_at.replace(' ', 'T') + 'Z')
      : startDate
    const closedAt = addDays(created, intBetween(rand, 30, totalDays))
    client_closures.push({
      id: closureId++,
      userid: client.id,
      date: formatDateTime(closedAt),
      description: 'Client Status changed to Closed',
    })
  }

  return {
    product_groups,
    products,
    clients,
    hosting,
    domains,
    invoices,
    invoice_items,
    billable_items,
    cancellation_requests,
    client_closures,
  }
}

function timestampOf(row: { created_at?: string; updated_at?: string }): number {
  const raw = row.updated_at || row.created_at
  if (!raw) return 0
  return new Date(raw.replace(' ', 'T') + 'Z').getTime()
}

function applySinceFilter<T extends { created_at?: string; updated_at?: string }>(
  rows: T[],
  sinceMs: number | null,
): T[] {
  if (sinceMs === null) return rows
  return rows.filter((r) => timestampOf(r) >= sinceMs)
}

interface ResponseOptions extends GenerateOptions {
  since?: string
  limit: number
  offset: number
}

export function generateDemoState(opts: ResponseOptions): WhmcsApiResponse {
  const dataset = buildDataset(opts)
  const sinceMs = opts.since ? new Date(opts.since).getTime() : null

  const filtered = {
    product_groups: applySinceFilter(dataset.product_groups, sinceMs),
    products: applySinceFilter(dataset.products, sinceMs),
    clients: applySinceFilter(dataset.clients, sinceMs),
    hosting: applySinceFilter(dataset.hosting, sinceMs),
    domains: applySinceFilter(dataset.domains, sinceMs),
    invoices: applySinceFilter(dataset.invoices, sinceMs),
    invoice_items: applySinceFilter(dataset.invoice_items, sinceMs),
    billable_items: applySinceFilter(dataset.billable_items, sinceMs),
    cancellation_requests: applySinceFilter(dataset.cancellation_requests, sinceMs),
    client_closures: dataset.client_closures.filter(
      (c) => sinceMs === null || new Date(c.date.replace(' ', 'T') + 'Z').getTime() >= sinceMs,
    ),
  }

  const slice = <T,>(arr: T[]) => arr.slice(opts.offset, opts.offset + opts.limit)

  const data = {
    hosting: slice(filtered.hosting),
    domains: slice(filtered.domains),
    products: slice(filtered.products),
    product_groups: slice(filtered.product_groups),
    billable_items: slice(filtered.billable_items),
    invoices: slice(filtered.invoices),
    invoice_items: slice(filtered.invoice_items),
    clients: slice(filtered.clients),
    cancellation_requests: slice(filtered.cancellation_requests),
    client_closures: slice(filtered.client_closures),
  }

  return {
    success: true,
    meta: {
      module_version: LATEST_MODULE_VERSION,
      whmcs_version: '8.10.1',
      php_version: '8.2.0',
      timezone: 'UTC',
      exported_at: new Date().toISOString(),
      pagination: { limit: opts.limit, offset: opts.offset },
      filters: { since: opts.since ?? null },
      record_counts: {
        hosting: data.hosting.length,
        domains: data.domains.length,
        products: data.products.length,
        product_groups: data.product_groups.length,
        billable_items: data.billable_items.length,
        invoices: data.invoices.length,
        invoice_items: data.invoice_items.length,
        clients: data.clients.length,
        cancellation_requests: data.cancellation_requests.length,
        client_closures: data.client_closures.length,
      },
    },
    data,
  }
}
