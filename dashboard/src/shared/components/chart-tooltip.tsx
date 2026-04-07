/**
 * Shared styled tooltip for Recharts charts.
 * Matches the design system in both dark and light modes.
 */
export interface ChartTooltipItem {
  dataKey: string
  value: number
  color: string
  name?: string
}

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string; name?: string }>
  label?: string
  labelFormatter?: (label: string) => string
  valueFormatter?: (value: number, key: string) => string
  showTotal?: boolean
  totalKey?: string
  totalLabel?: string
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  showTotal = false,
  totalKey,
  totalLabel,
}: ChartTooltipProps) {
  if (!active || !payload?.length || label === undefined) return null

  const formattedLabel = labelFormatter ? labelFormatter(String(label)) : String(label)

  const regularItems = totalKey ? payload.filter(p => p.dataKey !== totalKey) : payload
  const pinnedItem = totalKey ? payload.find(p => p.dataKey === totalKey) : null
  const total = regularItems.reduce((s, p) => s + (Number(p.value) || 0), 0)

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        padding: '10px 14px',
        minWidth: 160,
        fontSize: 13,
      }}
    >
      <p
        style={{
          color: 'var(--color-foreground)',
          fontWeight: 500,
          marginBottom: 8,
          fontSize: 12,
        }}
      >
        {formattedLabel}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {regularItems.map((p) => {
          const label = p.name ?? p.dataKey
          const val = valueFormatter
            ? valueFormatter(Number(p.value) || 0, p.dataKey)
            : String(Number(p.value) || 0)
          return (
            <div
              key={p.dataKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: p.color,
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                />
                <span style={{ color: 'var(--color-muted)' }}>{label}</span>
              </span>
              <span style={{ color: 'var(--color-foreground)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                {val}
              </span>
            </div>
          )
        })}

        {pinnedItem && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              borderTop: '1px solid var(--color-border)',
              paddingTop: 6,
              marginTop: 2,
            }}
          >
            <span style={{ color: 'var(--color-muted)' }}>
              {totalLabel ?? pinnedItem.name ?? pinnedItem.dataKey}
            </span>
            <span style={{ color: 'var(--color-foreground)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {valueFormatter ? valueFormatter(Number(pinnedItem.value) || 0, pinnedItem.dataKey) : String(pinnedItem.value)}
            </span>
          </div>
        )}

        {showTotal && regularItems.length > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              borderTop: '1px solid var(--color-border)',
              paddingTop: 6,
              marginTop: 2,
            }}
          >
            <span style={{ color: 'var(--color-muted)' }}>Total</span>
            <span style={{ color: 'var(--color-foreground)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {valueFormatter ? valueFormatter(total, 'total') : String(total)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
