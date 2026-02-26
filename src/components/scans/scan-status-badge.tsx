import { cn } from '@/lib/utils'
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'
import type { ScanStatus } from '@/types'

const statusConfig: Record<
  ScanStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  queued: { label: 'Queued', icon: Clock, className: 'text-muted-foreground' },
  scanning: {
    label: 'Scanning',
    icon: Loader2,
    className: 'text-primary animate-spin',
  },
  completed: { label: 'Completed', icon: CheckCircle2, className: 'text-green-500' },
  failed: { label: 'Failed', icon: XCircle, className: 'text-destructive' },
}

interface ScanStatusBadgeProps {
  status: ScanStatus
  className?: string
}

export function ScanStatusBadge({ status, className }: ScanStatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div className={cn('flex items-center gap-1.5 text-sm', className)}>
      <Icon className={cn('h-4 w-4', config.className)} />
      <span>{config.label}</span>
    </div>
  )
}
