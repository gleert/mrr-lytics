import { Skeleton } from './skeleton'

interface ChartSkeletonProps {
  height?: number
  bars?: number
}

export function ChartSkeleton({ height = 320, bars = 7 }: ChartSkeletonProps) {
  return (
    <div className="flex items-end gap-2 px-4 pb-4 pt-8" style={{ height }}>
      {Array.from({ length: bars }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-t-sm"
          style={{
            height: `${30 + Math.random() * 60}%`,
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-12 w-full"
          style={{ animationDelay: `${i * 75}ms` }}
        />
      ))}
    </div>
  )
}

export function BarSkeleton({ height = 128 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <Skeleton className="h-8 w-full mx-4 rounded-full" />
    </div>
  )
}
