import { cn } from '@/lib/utils'
import type { Severity } from '@/types'

const severityConfig: Record<Severity, { label: string; className: string }> = {
  critical: {
    label: 'Critical',
    className: 'bg-severity-critical/10 text-severity-critical border-severity-critical/20',
  },
  high: {
    label: 'High',
    className: 'bg-severity-high/10 text-severity-high border-severity-high/20',
  },
  medium: {
    label: 'Medium',
    className: 'bg-severity-medium/10 text-severity-medium border-severity-medium/20',
  },
  low: {
    label: 'Low',
    className: 'bg-severity-low/10 text-severity-low border-severity-low/20',
  },
}

interface SeverityBadgeProps {
  severity: Severity
  className?: string
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = severityConfig[severity]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
