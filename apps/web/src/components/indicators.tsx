import type { PolicyStatus, RiskBand } from '@shadowscan/shared';
import { CheckCircle2, HelpCircle, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Risk and policy indicators.

const BAND_TONE: Record<RiskBand, 'low' | 'medium' | 'high' | 'critical'> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
};

export function RiskBandBadge({ band, className }: { band: RiskBand; className?: string }): JSX.Element {
  return (
    <Badge tone={BAND_TONE[band]} className={cn('uppercase tracking-wide', className)}>
      {band}
    </Badge>
  );
}

const POLICY_META: Record<
  PolicyStatus,
  { label: string; tone: 'low' | 'critical' | 'medium'; Icon: typeof CheckCircle2 }
> = {
  approved: { label: 'Approved', tone: 'low', Icon: CheckCircle2 },
  blocked: { label: 'Blocked', tone: 'critical', Icon: ShieldAlert },
  unknown: { label: 'Not assessed', tone: 'medium', Icon: HelpCircle },
};

export function PolicyBadge({ policy, className }: { policy: PolicyStatus; className?: string }): JSX.Element {
  const meta = POLICY_META[policy];
  return (
    <Badge tone={meta.tone} className={className}>
      <meta.Icon className="size-3" aria-hidden />
      {meta.label}
    </Badge>
  );
}

// A 0-100 score rendered as a number plus a proportional bar.
export function ScoreMeter({ score, band }: { score: number; band: RiskBand }): JSX.Element {
  const colour = {
    low: 'bg-risk-low',
    medium: 'bg-risk-medium',
    high: 'bg-risk-high',
    critical: 'bg-risk-critical',
  }[band];

  return (
    <div className="flex items-center gap-2">
      <span className="tabular w-6 text-right text-[12px] text-fg">{score}</span>
      <div
        className="h-1 w-16 overflow-hidden bg-elevated"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Risk score ${score} of 100, ${band}`}
      >
        <div className={cn('h-full', colour)} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
    </div>
  );
}
