import type { PolicyStatus } from '@shadowscan/shared';
import { CheckCircle2, HelpCircle, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

// SHARED CHART VOCABULARY Every chart in the console draws its colours, axis styling and tooltip from here.

export const POLICY_FILL: Record<PolicyStatus, string> = {
  approved: 'var(--color-chart-approved)',
  unknown: 'var(--color-chart-unknown)',
  blocked: 'var(--color-chart-blocked)',
};

export const POLICY_LABEL: Record<PolicyStatus, string> = {
  approved: 'Approved',
  unknown: 'Not assessed',
  blocked: 'Blocked',
};

export const POLICY_ICON: Record<PolicyStatus, typeof CheckCircle2> = {
  approved: CheckCircle2,
  unknown: HelpCircle,
  blocked: ShieldAlert,
};

export const VOLUME_FILL = 'var(--color-chart-volume)';

// Recessive axis and grid styling - the data should be the loudest thing.
export const AXIS_STYLE = {
  stroke: 'var(--color-line-strong)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--color-fg-subtle)', fontSize: 11 },
} as const;

export const GRID_STYLE = {
  stroke: 'var(--color-line)',
  strokeDasharray: '3 3',
  vertical: false,
} as const;

// Chart surface, matching the value the palette was validated against.
export const CHART_SURFACE = '#0c0e13';

// --------------------------------------------------------------- tooltip ---

export interface TooltipRow {
  label: string;
  value: string;
  colour?: string;
}

export function ChartTooltip({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: TooltipRow[];
  footer?: ReactNode;
}): JSX.Element {
  return (
    <div className="pointer-events-none min-w-40 rounded-lg border border-line-strong bg-overlay/95 px-3 py-2 shadow-xl shadow-black/60 backdrop-blur-sm">
      <p className="mb-1.5 text-xs font-medium text-fg">{title}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-fg-muted">
              {row.colour ? (
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: row.colour }}
                  aria-hidden
                />
              ) : null}
              {row.label}
            </span>
            <span className="tabular font-medium text-fg">{row.value}</span>
          </div>
        ))}
      </div>
      {footer ? <div className="mt-1.5 border-t border-line pt-1.5 text-[11px] text-fg-subtle">{footer}</div> : null}
    </div>
  );
}

export function PolicyLegend({
  items,
  className,
}: {
  // `label` overrides the policy name. The daily chart stacks unassessed and
  // blocked into one "shadow AI" series, and calling that series "Blocked"
  // contradicts the blocked count shown in the donut beside it.
  items: Array<{ policy: PolicyStatus; value?: number; label?: string }>;
  className?: string;
}): JSX.Element {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      {items.map(({ policy, value, label }) => {
        const Icon = POLICY_ICON[policy];
        return (
          <li key={policy} className="flex items-center gap-1.5 text-[11px] text-fg-muted">
            <span
              className="size-2 shrink-0 rounded-[1px]"
              style={{ backgroundColor: POLICY_FILL[policy] }}
              aria-hidden
            />
            <Icon className="size-3 shrink-0 text-fg-subtle" aria-hidden />
            <span>{label ?? POLICY_LABEL[policy]}</span>
            {value !== undefined ? (
              <span className="tabular font-medium text-fg">{formatNumber(value)}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
