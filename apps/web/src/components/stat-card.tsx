import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

// KPI tile.
export interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  trend?: number | null;
  // Set when a rising number is bad, so the arrow colour flips.
  invertTrend?: boolean;
  tone?: 'default' | 'low' | 'medium' | 'high' | 'critical';
  footer?: ReactNode;
}

const TONE_STYLES = {
  default: { value: 'text-fg', icon: 'text-fg-subtle bg-elevated' },
  low: { value: 'text-risk-low', icon: 'text-risk-low bg-risk-low/10' },
  medium: { value: 'text-risk-medium', icon: 'text-risk-medium bg-risk-medium/10' },
  high: { value: 'text-risk-high', icon: 'text-risk-high bg-risk-high/10' },
  critical: { value: 'text-risk-critical', icon: 'text-risk-critical bg-risk-critical/10' },
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  invertTrend = false,
  tone = 'default',
  footer,
}: StatCardProps): JSX.Element {
  const styles = TONE_STYLES[tone];

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{label}</p>
          <p className={cn('tabular mt-1.5 text-2xl font-semibold leading-none', styles.value)}>
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>
        </div>
        <span className={cn('rounded-lg p-2', styles.icon)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px]">
        {trend !== undefined ? <TrendPill trend={trend} invert={invertTrend} /> : null}
        {hint ? <span className="truncate text-fg-subtle">{hint}</span> : null}
      </div>

      {footer ? <div className="mt-3">{footer}</div> : null}
    </Card>
  );
}

function TrendPill({ trend, invert }: { trend: number | null; invert: boolean }): JSX.Element {
  if (trend === null) {
    return (
      <span className="flex items-center gap-1 text-fg-subtle">
        <ArrowRight className="size-3" aria-hidden />
        No prior data
      </span>
    );
  }

  const rising = trend > 0;
  const flat = trend === 0;
  const bad = invert ? rising : !rising && !flat;
  const Icon = flat ? ArrowRight : rising ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        'flex items-center gap-1 font-medium',
        flat ? 'text-fg-subtle' : bad ? 'text-risk-high' : 'text-risk-low',
      )}
    >
      <Icon className="size-3" aria-hidden />
      <span className="tabular">{formatPercent(Math.abs(trend))}</span>
      <span className="font-normal text-fg-subtle">vs previous period</span>
    </span>
  );
}
