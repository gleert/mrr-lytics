import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { useCurrency } from '@/shared/hooks/use-currency'
import { cn } from '@/shared/lib/utils'
import type { ReportRow, ReportColumn } from '../hooks/use-report-export'

interface ReportPreviewTableProps {
  rows: ReportRow[]
  columns: ReportColumn[]
  isLoading: boolean
  totalRows: number
  isAtLimit: boolean
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton({ columnCount }: { columnCount: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-elevated/50">
            {Array.from({ length: columnCount }).map((_, i) => (
              <th key={i} className="px-3 py-2.5">
                <div className="h-3 w-16 rounded bg-surface-elevated animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: columnCount }).map((_, colIdx) => (
                <td key={colIdx} className="px-3 py-2.5">
                  <div
                    className="h-3 rounded bg-surface-elevated animate-pulse"
                    style={{ width: `${50 + ((rowIdx * 3 + colIdx * 7) % 40)}%`, animationDelay: `${(rowIdx + colIdx) * 60}ms` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Cell formatter ───────────────────────────────────────────────────────────

function formatCell(
  value: unknown,
  format: string | undefined,
  formatCurrencyFn: (n: number) => string
): string {
  if (value === null || value === undefined) return '—'
  if (format === 'boolean') return value ? 'Yes' : 'No'
  if (format === 'currency') return formatCurrencyFn(Number(value))
  if (format === 'percent') return `${Number(value).toFixed(1)}%`
  if (format === 'number') return Number(value).toLocaleString()
  return String(value)
}

// ─── % of total helper ────────────────────────────────────────────────────────

function computeColumnTotal(rows: ReportRow[], key: string): number {
  return rows.reduce((sum, row) => {
    const val = (row as unknown as Record<string, unknown>)[key]
    return sum + (typeof val === 'number' ? val : 0)
  }, 0)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReportPreviewTable({ rows, columns, isLoading, totalRows, isAtLimit }: ReportPreviewTableProps) {
  const { t } = useTranslation()
  const { formatCurrency } = useCurrency()

  // Pre-compute column totals for % of total
  const columnTotals = Object.fromEntries(
    columns
      .filter(c => c.format === 'currency' || c.format === 'number')
      .map(c => [c.key, computeColumnTotal(rows, c.key)])
  )

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="h-3 w-32 rounded bg-surface-elevated animate-pulse" />
          <div className="h-3 w-24 rounded bg-surface-elevated animate-pulse" />
        </div>
        <TableSkeleton columnCount={columns.length || 5} />
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted">
        <Icon name="inbox" size="xl" className="mb-2 opacity-50" />
        <p className="text-sm">{t('reports.noData')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Limit warning */}
      {isAtLimit && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300">
          <Icon name="warning" size="sm" className="mt-0.5 flex-shrink-0" />
          <p className="text-xs leading-relaxed">{t('reports.limitWarning')}</p>
        </div>
      )}

      {/* Row count */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted">
          {t('reports.previewDesc', { count: rows.length })}
        </p>
        <p className="text-xs font-medium text-foreground">
          {t('reports.rowsFound', { count: totalRows })}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-surface-elevated/50">
              {columns.map(col => {
                const isNumeric = col.format === 'currency' || col.format === 'number' || col.format === 'percent'
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'px-3 py-2.5 font-medium text-muted uppercase tracking-wider whitespace-nowrap',
                      isNumeric ? 'text-right' : 'text-left'
                    )}
                  >
                    {t(col.labelKey)}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-surface-elevated/40 transition-colors">
                {columns.map(col => {
                  const value = (row as unknown as Record<string, unknown>)[col.key]
                  const isNumeric = col.format === 'currency' || col.format === 'number' || col.format === 'percent'
                  const colTotal = columnTotals[col.key]
                  const numVal = typeof value === 'number' ? value : 0
                  const pct = colTotal > 0 && (col.format === 'currency' || col.format === 'number')
                    ? (numVal / colTotal) * 100
                    : null

                  return (
                    <td
                      key={col.key}
                      className={cn(
                        'px-3 py-2.5 whitespace-nowrap',
                        isNumeric
                          ? 'text-right tabular-nums font-medium text-foreground'
                          : 'text-left text-foreground'
                      )}
                    >
                      {formatCell(value, col.format, formatCurrency)}
                      {pct !== null && (
                        <span className="ml-1.5 text-muted font-normal">
                          {pct.toFixed(0)}%
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* More rows indicator */}
        {totalRows > rows.length && (
          <div className="flex items-center justify-center py-3 border-t border-border bg-surface text-xs text-muted">
            <Icon name="more_horiz" size="sm" className="mr-1.5" />
            {t('reports.moreRows', { count: totalRows - rows.length })}
          </div>
        )}
      </div>
    </div>
  )
}
