import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { api } from '@/shared/lib/api'
import { useFilters } from '@/app/providers'

export type ReportType = 'mrr' | 'revenue' | 'clients' | 'domains' | 'churn' | 'products'

// ─── Row types ────────────────────────────────────────────────────────────────

export interface MrrRow {
  month: string
  starting_mrr: number
  new_mrr: number
  expansion_mrr: number
  contraction_mrr: number
  churned_mrr: number
  ending_mrr: number
  net_change: number
}

export interface RevenueRow {
  date: string
  invoice: string
  client: string
  product: string
  category: string
  type: string
  amount: number
}

export interface ClientRow {
  client_id: number
  name: string
  status: string
  mrr: number
  services: number
  domains: number
  join_date: string
}

export interface DomainRow {
  domain: string
  tld: string
  client: string
  status: string
  registration_date: string
  expiry_date: string
  renewal_price: number
  do_not_renew: boolean
}

export interface ChurnRow {
  client: string
  item: string
  mrr_loss: number
  churn_date: string
  days_until_churn: number
}

export interface ProductRow {
  name: string
  group: string
  active_services: number
  mrr: number
  percentage: number
}

export type ReportRow = MrrRow | RevenueRow | ClientRow | DomainRow | ChurnRow | ProductRow

// ─── Column definitions ───────────────────────────────────────────────────────

export interface ReportColumn {
  key: string
  labelKey: string
  format?: 'currency' | 'percent' | 'number' | 'text' | 'boolean'
}

export const REPORT_COLUMNS: Record<ReportType, ReportColumn[]> = {
  mrr: [
    { key: 'month',           labelKey: 'reports.columns.month' },
    { key: 'starting_mrr',    labelKey: 'reports.columns.startingMrr',  format: 'currency' },
    { key: 'new_mrr',         labelKey: 'reports.columns.newMrr',       format: 'currency' },
    { key: 'expansion_mrr',   labelKey: 'reports.columns.expansion',    format: 'currency' },
    { key: 'contraction_mrr', labelKey: 'reports.columns.contraction',  format: 'currency' },
    { key: 'churned_mrr',     labelKey: 'reports.columns.churn',        format: 'currency' },
    { key: 'ending_mrr',      labelKey: 'reports.columns.endingMrr',    format: 'currency' },
    { key: 'net_change',      labelKey: 'reports.columns.netChange',    format: 'currency' },
  ],
  revenue: [
    { key: 'date',     labelKey: 'reports.columns.date' },
    { key: 'invoice',  labelKey: 'reports.columns.invoice' },
    { key: 'client',   labelKey: 'reports.columns.client' },
    { key: 'product',  labelKey: 'reports.columns.product' },
    { key: 'category', labelKey: 'reports.columns.category' },
    { key: 'type',     labelKey: 'reports.columns.type' },
    { key: 'amount',   labelKey: 'reports.columns.amount',  format: 'currency' },
  ],
  clients: [
    { key: 'client_id',  labelKey: 'reports.columns.clientId',  format: 'number' },
    { key: 'name',       labelKey: 'reports.columns.name' },
    { key: 'status',     labelKey: 'reports.columns.status' },
    { key: 'mrr',        labelKey: 'reports.columns.mrr',        format: 'currency' },
    { key: 'services',   labelKey: 'reports.columns.services',   format: 'number' },
    { key: 'domains',    labelKey: 'reports.columns.domains',    format: 'number' },
    { key: 'join_date',  labelKey: 'reports.columns.joinDate' },
  ],
  domains: [
    { key: 'domain',            labelKey: 'reports.columns.domain' },
    { key: 'tld',               labelKey: 'reports.columns.tld' },
    { key: 'client',            labelKey: 'reports.columns.client' },
    { key: 'status',            labelKey: 'reports.columns.status' },
    { key: 'registration_date', labelKey: 'reports.columns.registrationDate' },
    { key: 'expiry_date',       labelKey: 'reports.columns.expiryDate' },
    { key: 'renewal_price',     labelKey: 'reports.columns.renewalPrice',    format: 'currency' },
    { key: 'do_not_renew',      labelKey: 'reports.columns.doNotRenew',      format: 'boolean' },
  ],
  churn: [
    { key: 'client',           labelKey: 'reports.columns.client' },
    { key: 'item',             labelKey: 'reports.columns.item' },
    { key: 'mrr_loss',         labelKey: 'reports.columns.mrrLoss',        format: 'currency' },
    { key: 'churn_date',       labelKey: 'reports.columns.churnDate' },
    { key: 'days_until_churn', labelKey: 'reports.columns.daysUntilChurn', format: 'number' },
  ],
  products: [
    { key: 'name',            labelKey: 'reports.columns.name' },
    { key: 'active_services', labelKey: 'reports.columns.activeServices', format: 'number' },
    { key: 'mrr',             labelKey: 'reports.columns.mrr',            format: 'currency' },
    { key: 'percentage',      labelKey: 'reports.columns.percentage',     format: 'percent' },
  ],
}

// ─── Status filter types ──────────────────────────────────────────────────────

export type ClientStatusFilter = 'Active' | 'all'
export type DomainStatusFilter = 'Active' | 'Expired' | 'all'

// ─── Data fetching ─────────────────────────────────────────────────────────────

function useReportData(type: ReportType, statusFilter?: ClientStatusFilter | DomainStatusFilter) {
  const { period, getSelectedInstanceIds, allInstances } = useFilters()
  const instanceIds = getSelectedInstanceIds()

  return useQuery({
    queryKey: ['reports', type, instanceIds.join(','), period, statusFilter ?? 'default'],
    queryFn: async (): Promise<ReportRow[]> => {
      const base: Record<string, string> = { period }
      if (instanceIds.length > 0) base.instance_ids = instanceIds.join(',')

      if (type === 'mrr') {
        const res = await api.get<{ success: boolean; data: { movement_data: Array<{
          month: string; starting_mrr: number; new_mrr: number; churned_mrr: number
          expansion_mrr: number; contraction_mrr: number; ending_mrr: number; net_change: number
        }> } }>('/api/metrics/mrr-movement', { ...base, months: '12' })
        return res.data.movement_data.map(m => ({
          month: m.month,
          starting_mrr: m.starting_mrr,
          new_mrr: m.new_mrr,
          expansion_mrr: m.expansion_mrr,
          contraction_mrr: m.contraction_mrr,
          churned_mrr: m.churned_mrr,
          ending_mrr: m.ending_mrr,
          net_change: m.net_change,
        })) as MrrRow[]
      }

      if (type === 'revenue') {
        const res = await api.get<{ success: boolean; data: { transactions: Array<{
          date: string; invoice_num: string; client_name: string; product_name: string
          category: string; type: string; amount: number
        }>; pagination: { total: number } } }>('/api/revenue/transactions', { ...base, limit: '5000', page: '1' })
        return res.data.transactions.map(t => ({
          date: t.date,
          invoice: t.invoice_num || '',
          client: t.client_name || '',
          product: t.product_name || '',
          category: t.category || '',
          type: t.type || '',
          amount: t.amount,
        })) as RevenueRow[]
      }

      if (type === 'clients') {
        const clientStatus = (statusFilter as ClientStatusFilter) ?? 'Active'
        const clientParams: Record<string, string> = { ...base, limit: '5000', page: '1' }
        if (clientStatus !== 'all') clientParams.status = clientStatus
        const res = await api.get<{ success: boolean; data: { clients: Array<{
          whmcs_id: number; firstname: string | null; lastname: string | null
          companyname: string | null; status: string; current_mrr: number
          services_count: number; domains_count: number; datecreated: string | null
        }>} }>('/api/clients', clientParams)
        return res.data.clients.map(c => ({
          client_id: c.whmcs_id,
          name: c.companyname || [c.firstname, c.lastname].filter(Boolean).join(' ') || '',
          status: c.status,
          mrr: c.current_mrr,
          services: c.services_count,
          domains: c.domains_count,
          join_date: c.datecreated || '',
        })) as ClientRow[]
      }

      if (type === 'domains') {
        const domainParams: Record<string, string> = { ...base, limit: '5000', page: '1' }
        const domainStatus = statusFilter as DomainStatusFilter | undefined
        if (domainStatus && domainStatus !== 'all') domainParams.status = domainStatus
        const res = await api.get<{ success: boolean; data: { domains: Array<{
          domain: string; status: string; client_name: string | null
          registrationdate: string | null; expirydate: string | null
          recurringamount: number; donotrenew: boolean
        }>} }>('/api/domains', domainParams)
        return res.data.domains.map(d => ({
          domain: d.domain,
          tld: '.' + d.domain.split('.').slice(-1)[0],
          client: d.client_name || '',
          status: d.status,
          registration_date: d.registrationdate || '',
          expiry_date: d.expirydate || '',
          renewal_price: Number(d.recurringamount) || 0,
          do_not_renew: d.donotrenew,
        })) as DomainRow[]
      }

      if (type === 'churn') {
        const res = await api.get<{ success: boolean; data: { cancellations: Array<{
          client_name: string; item_name: string; mrr_loss: number
          churn_date: string; days_until_churn: number
        }>} }>('/api/metrics/pending-cancellations', { ...base, limit: '50' })
        return res.data.cancellations.map(c => ({
          client: c.client_name,
          item: c.item_name,
          mrr_loss: c.mrr_loss,
          churn_date: c.churn_date,
          days_until_churn: c.days_until_churn,
        })) as ChurnRow[]
      }

      if (type === 'products') {
        const res = await api.get<{ success: boolean; data: { products: Array<{
          name: string; active_services: number; mrr: number; percentage: number
        }>} }>('/api/metrics/top-products', { ...base, limit: '50' })
        return res.data.products.map(p => ({
          name: p.name,
          active_services: p.active_services,
          mrr: p.mrr,
          percentage: p.percentage,
        })) as ProductRow[]
      }

      return []
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

// ─── CSV generation ───────────────────────────────────────────────────────────

function rowToValues(row: ReportRow, columns: ReportColumn[]): string[] {
  return columns.map(col => {
    const val = (row as unknown as Record<string, unknown>)[col.key]
    if (val === null || val === undefined) return ''
    if (col.format === 'boolean') return val ? 'Yes' : 'No'
    if (col.format === 'currency') return Number(val).toFixed(2)
    if (col.format === 'percent') return Number(val).toFixed(2) + '%'
    return String(val)
  })
}

function generateCsv(rows: ReportRow[], columns: ReportColumn[], headers: string[]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const headerLine = headers.map(escape).join(',')
  const dataLines = rows.map(row => rowToValues(row, columns).map(escape).join(','))
  return [headerLine, ...dataLines].join('\n')
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// ─── Excel generation ─────────────────────────────────────────────────────────

function rowToXlsxRow(row: ReportRow, columns: ReportColumn[]): (string | number | boolean)[] {
  return columns.map(col => {
    const val = (row as unknown as Record<string, unknown>)[col.key]
    if (val === null || val === undefined) return ''
    if (col.format === 'boolean') return val ? 'Yes' : 'No'
    if (col.format === 'currency' || col.format === 'number' || col.format === 'percent') {
      return Number(val)
    }
    return String(val)
  })
}

function generateXlsx(
  rows: ReportRow[],
  columns: ReportColumn[],
  headers: string[],
  sheetName: string
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  // Build data array: header row + data rows
  const data: (string | number | boolean)[][] = [
    headers,
    ...rows.map(row => rowToXlsxRow(row, columns)),
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Style header row bold via cell metadata
  headers.forEach((_, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx })
    if (!ws[cellRef]) ws[cellRef] = {}
    ws[cellRef].s = { font: { bold: true }, fill: { fgColor: { rgb: 'E2E8F0' } } }
  })

  // Apply number formats to numeric columns
  columns.forEach((col, colIdx) => {
    if (col.format === 'currency') {
      for (let rowIdx = 1; rowIdx <= rows.length; rowIdx++) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })
        if (ws[cellRef]) ws[cellRef].z = '#,##0.00'
      }
    } else if (col.format === 'percent') {
      for (let rowIdx = 1; rowIdx <= rows.length; rowIdx++) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })
        if (ws[cellRef]) ws[cellRef].z = '0.00%'
      }
    }
  })

  // Auto column widths based on content
  const colWidths = headers.map((h, colIdx) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map(row => {
        const val = rowToXlsxRow(row, columns)[colIdx]
        return String(val).length
      })
    )
    return { wch: Math.min(maxLen + 2, 40) }
  })
  ws['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return wb
}

function downloadXlsxFile(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename)
}

// ─── Public hook ──────────────────────────────────────────────────────────────

export function useReportExport(type: ReportType, statusFilter?: ClientStatusFilter | DomainStatusFilter) {
  const [isDownloading, setIsDownloading] = useState(false)
  const { period } = useFilters()
  const { data: rows = [], isLoading } = useReportData(type, statusFilter)
  const columns = REPORT_COLUMNS[type]

  const baseFilename = `mrrlytics-${type}-${period}-${new Date().toISOString().split('T')[0]}`

  const download = (columnHeaders: string[]) => {
    if (!rows.length) return
    setIsDownloading(true)
    try {
      const csv = generateCsv(rows, columns, columnHeaders)
      downloadCsv(csv, `${baseFilename}.csv`)
    } finally {
      setIsDownloading(false)
    }
  }

  const downloadExcel = (columnHeaders: string[]) => {
    if (!rows.length) return
    setIsDownloading(true)
    try {
      const sheetName = type.charAt(0).toUpperCase() + type.slice(1)
      const wb = generateXlsx(rows, columns, columnHeaders, sheetName)
      downloadXlsxFile(wb, `${baseFilename}.xlsx`)
    } finally {
      setIsDownloading(false)
    }
  }

  const totalRows = rows.length
  const isAtLimit = totalRows >= 5000

  return {
    rows,
    columns,
    isLoading,
    isDownloading,
    download,
    downloadExcel,
    previewRows: rows.slice(0, 10),
    totalRows,
    isAtLimit,
  }
}
