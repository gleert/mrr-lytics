import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NoInstancesGuard } from '@/shared/components/no-instances-guard'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters'
import { ReportSelector } from '../components/report-selector'
import { ReportPreviewTable } from '../components/report-preview-table'
import { ReportExportBar } from '../components/report-export-bar'
import { useReportExport, REPORT_COLUMNS } from '../hooks/use-report-export'
import type { ReportType, ClientStatusFilter, DomainStatusFilter } from '../hooks/use-report-export'

// ─── Status filter segmented control ─────────────────────────────────────────

type AnyStatusFilter = ClientStatusFilter | DomainStatusFilter

interface StatusFilterBarProps {
  options: { value: AnyStatusFilter; labelKey: string }[]
  value: AnyStatusFilter
  onChange: (v: AnyStatusFilter) => void
}

function StatusFilterBar({ options, value, onChange }: StatusFilterBarProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-elevated border border-border">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1 rounded-md text-xs font-medium transition-all',
            value === opt.value
              ? 'bg-primary-500 text-white shadow-sm'
              : 'text-muted hover:text-foreground hover:bg-surface'
          )}
        >
          {t(opt.labelKey)}
        </button>
      ))}
    </div>
  )
}

// ─── Report content panel ─────────────────────────────────────────────────────

interface ReportContentProps {
  type: ReportType
  statusFilter: AnyStatusFilter
}

function ReportContent({ type, statusFilter }: ReportContentProps) {
  const { t } = useTranslation()
  const { columns, isLoading, isDownloading, download, downloadExcel, previewRows, totalRows, isAtLimit } =
    useReportExport(type, statusFilter)

  const columnHeaders = REPORT_COLUMNS[type].map(col => t(col.labelKey))

  return (
    <div className="space-y-4">
      {/* Export bar */}
      <ReportExportBar
        type={type}
        totalRows={totalRows}
        isLoading={isLoading}
        isDownloading={isDownloading}
        onDownloadCsv={() => download(columnHeaders)}
        onDownloadXlsx={() => downloadExcel(columnHeaders)}
      />

      {/* Preview */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
          <Icon name="table_view" size="lg" className="text-muted" />
          <p className="text-sm font-medium text-foreground">{t('reports.preview')}</p>
        </div>
        <div className="p-4">
          <ReportPreviewTable
            rows={previewRows}
            columns={columns}
            isLoading={isLoading}
            totalRows={totalRows}
            isAtLimit={isAtLimit}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Status filter options per report type ────────────────────────────────────

const CLIENT_STATUS_OPTIONS: { value: ClientStatusFilter; labelKey: string }[] = [
  { value: 'Active', labelKey: 'reports.statusFilter.active' },
  { value: 'all',    labelKey: 'reports.statusFilter.all' },
]

const DOMAIN_STATUS_OPTIONS: { value: DomainStatusFilter; labelKey: string }[] = [
  { value: 'Active',  labelKey: 'reports.statusFilter.active' },
  { value: 'Expired', labelKey: 'reports.statusFilter.expired' },
  { value: 'all',     labelKey: 'reports.statusFilter.all' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const { t } = useTranslation()
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null)
  const [clientStatus, setClientStatus] = useState<ClientStatusFilter>('Active')
  const [domainStatus, setDomainStatus] = useState<DomainStatusFilter>('Active')

  // Derive the active status filter for the currently selected report
  const activeStatusFilter: AnyStatusFilter =
    selectedReport === 'clients' ? clientStatus
    : selectedReport === 'domains' ? domainStatus
    : 'all'

  // Fetch data for badge in selector (only when a report is selected)
  const { totalRows: selectedTotalRows, isLoading: selectedIsLoading } =
    useReportExport(selectedReport ?? 'mrr', activeStatusFilter)
  const badgeTotalRows = selectedReport ? selectedTotalRows : null
  const badgeIsLoading = selectedReport ? selectedIsLoading : false

  const handleSelectReport = (type: ReportType) => {
    setSelectedReport(type)
  }

  return (
    <NoInstancesGuard>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('reports.title')}</h1>
          <p className="text-muted">{t('reports.subtitle')}</p>
        </div>
        <DashboardFilters />
      </div>

      {/* Single-column layout */}
      <div className="space-y-6">

        {/* Selector */}
        <div className="space-y-3">
          <ReportSelector
            selected={selectedReport}
            onSelect={handleSelectReport}
            selectedTotalRows={badgeTotalRows}
            selectedIsLoading={badgeIsLoading}
          />

          {/* Status filter — shown below selector when applicable */}
          {selectedReport === 'clients' && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">{t('reports.columns.status')}:</span>
              <StatusFilterBar
                options={CLIENT_STATUS_OPTIONS}
                value={clientStatus}
                onChange={v => setClientStatus(v as ClientStatusFilter)}
              />
            </div>
          )}
          {selectedReport === 'domains' && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">{t('reports.columns.status')}:</span>
              <StatusFilterBar
                options={DOMAIN_STATUS_OPTIONS}
                value={domainStatus}
                onChange={v => setDomainStatus(v as DomainStatusFilter)}
              />
            </div>
          )}
        </div>

        {/* Preview / Empty state */}
        {selectedReport ? (
          <ReportContent
            key={`${selectedReport}-${activeStatusFilter}`}
            type={selectedReport}
            statusFilter={activeStatusFilter}
          />
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 px-8 rounded-xl border border-dashed border-border text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500/10 border border-primary-500/20 mb-5">
              <Icon name="description" size="2xl" className="text-primary-400" />
            </div>
            <p className="text-base font-semibold text-foreground mb-1.5">
              {t('reports.selectReport')}
            </p>
            <p className="text-sm text-muted max-w-xs leading-relaxed">
              {t('reports.selectReportDesc')}
            </p>
           </div>
        )}
      </div>
    </div>
    </NoInstancesGuard>
  )
}
