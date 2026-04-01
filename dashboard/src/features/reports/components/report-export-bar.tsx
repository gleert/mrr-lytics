import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import type { ReportType } from '../hooks/use-report-export'

interface ReportExportBarProps {
  type: ReportType
  totalRows: number
  isLoading: boolean
  isDownloading: boolean
  onDownloadCsv: () => void
  onDownloadXlsx: () => void
}

const REPORT_ICONS: Record<ReportType, string> = {
  mrr:            'trending_up',
  revenue:        'paid',
  clients:        'group',
  domains:        'language',
  churn:          'trending_down',
  products:       'inventory_2',
  billable_items: 'receipt_long',
}

const REPORT_COLORS: Record<ReportType, string> = {
  mrr:            'text-primary-400',
  revenue:        'text-emerald-400',
  clients:        'text-blue-400',
  domains:        'text-cyan-400',
  churn:          'text-red-400',
  products:       'text-amber-400',
  billable_items: 'text-violet-400',
}

export function ReportExportBar({ type, totalRows, isLoading, isDownloading, onDownloadCsv, onDownloadXlsx }: ReportExportBarProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const canDownload = !isLoading && !isDownloading && totalRows > 0

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 rounded-xl border border-border bg-surface">
      {/* Report info */}
      <div className="flex items-center gap-3">
        <Icon name={REPORT_ICONS[type]} size="lg" className={REPORT_COLORS[type]} />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {t(`reports.reportTypes.${type}`)}
          </p>
          <p className="text-xs text-muted">
            {isLoading
              ? t('reports.downloading')
              : t('reports.rowsFound', { count: totalRows })
            }
          </p>
        </div>
      </div>

      {/* Download dropdown */}
      <div className="relative" ref={dropdownRef}>
        {isDownloading ? (
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-surface-elevated text-muted cursor-not-allowed opacity-70">
            <Icon name="sync" size="sm" className="animate-spin" />
            {t('reports.downloading')}
          </div>
        ) : (
          <>
            {/* Split button: main action (CSV) + chevron for dropdown */}
            <div className={cn(
              'inline-flex rounded-lg overflow-hidden transition-all',
              canDownload ? 'shadow-sm' : 'opacity-50 cursor-not-allowed'
            )}>
              {/* Primary: CSV */}
              <button
                onClick={() => canDownload && onDownloadCsv()}
                disabled={!canDownload}
                className={cn(
                  'inline-flex items-center gap-2 pl-4 pr-3 py-2.5 text-sm font-semibold transition-all',
                  canDownload
                    ? 'bg-primary-500 hover:bg-primary-400 text-white active:scale-95'
                    : 'bg-primary-500 text-white'
                )}
              >
                <Icon name="download" size="sm" />
                CSV
              </button>

              {/* Divider */}
              <div className="w-px bg-primary-400/40" />

              {/* Chevron: opens dropdown */}
              <button
                onClick={() => canDownload && setOpen(o => !o)}
                disabled={!canDownload}
                className={cn(
                  'inline-flex items-center px-2 py-2.5 text-sm font-semibold transition-all',
                  canDownload
                    ? 'bg-primary-500 hover:bg-primary-400 text-white active:scale-95'
                    : 'bg-primary-500 text-white'
                )}
                aria-label="More export formats"
              >
                <Icon name={open ? 'expand_less' : 'expand_more'} size="sm" />
              </button>
            </div>

            {/* Dropdown menu */}
            {open && canDownload && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-border bg-surface-elevated shadow-xl z-20 overflow-hidden">
                <button
                  onClick={() => { onDownloadCsv(); setOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-surface-elevated transition-colors"
                >
                  <Icon name="table_rows" size="sm" className="text-muted" />
                  <div className="text-left">
                    <p className="font-medium">{t('reports.formatCsv')}</p>
                    <p className="text-xs text-muted">UTF-8, BOM</p>
                  </div>
                </button>
                <div className="h-px bg-border mx-3" />
                <button
                  onClick={() => { onDownloadXlsx(); setOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-surface-elevated transition-colors"
                >
                  <Icon name="grid_on" size="sm" className="text-emerald-400" />
                  <div className="text-left">
                    <p className="font-medium">{t('reports.formatXlsx')}</p>
                    <p className="text-xs text-muted">Nativo Excel, formatos</p>
                  </div>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
