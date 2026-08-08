import { ArrowDown, ArrowUp } from 'lucide-react';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  trend?: number | null;
  // Set when a rising number is bad, so the arrow colour flips.
  invertTrend?: boolean;
  tone?: 'default' | 'low' | 'medium' | 'high' | 'critical';
}

const TONE = {
  default: 'text-fg',
  low: 'text-risk-low',
  medium: 'text-risk-medium',
  high: 'text-risk-high',
  critical: 'text-risk-critical',
} as const;

// A figure with a label. No icon, no card chrome of its own - these sit in a
// single bordered strip so they read as one instrument panel rather than five
// floating tiles.
export function StatCard({
  label,
  value,
  hint,
  trend,
  invertTrend = false,
  tone = 'default',
}: StatCardProps): JSX.Element {
  return (
    <div className="min-w-0 flex-1 border-line px-3 py-2.5 not-first:border-l">
      <p className="eyebrow truncate">{label}</p>
      <p className={cn('tabular mt-1.5 text-[22px] font-semibold leading-none', TONE[tone])}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      <div className="mt-1.5 flex h-3 items-center gap-1.5 text-[11px] leading-none">
        {trend !== undefined ? <Trend trend={trend} invert={invertTrend} /> : null}
        {hint ? <span className="truncate text-fg-subtle">{hint}</span> : null}
      </div>
    </div>
  );
}

function Trend({ trend, invert }: { trend: number | null; invert: boolean }): JSX.Element {
  if (trend === null) return <span className="text-fg-subtle">no prior data</span>;
  if (trend === 0) return <span className="text-fg-subtle">no change</span>;

  const rising = trend > 0;
  const bad = invert ? rising : !rising;
  const Icon = rising ? ArrowUp : ArrowDown;

  return (
    <span className={cn('flex items-center gap-0.5', bad ? 'text-risk-high' : 'text-risk-low')}>
      <Icon className="size-3" aria-hidden />
      <span className="tabular">{formatPercent(Math.abs(trend))}</span>
    </span>
  );
}
