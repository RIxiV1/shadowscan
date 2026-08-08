import type { DashboardSummary, PolicyStatus } from '@shadowscan/shared';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipProps } from 'recharts';
import { ChartTooltip, POLICY_FILL, POLICY_LABEL, PolicyLegend } from './chart-primitives';
import { formatNumber, formatPercent } from '@/lib/format';

// Governance split - a donut.
export function PolicyDonut({ data }: { data: DashboardSummary['policyBreakdown'] }): JSX.Element {
  const ordered: PolicyStatus[] = ['approved', 'unknown', 'blocked'];
  const byPolicy = new Map(data.map((entry) => [entry.policy, entry.requests]));
  const slices = ordered
    .map((policy) => ({ policy, requests: byPolicy.get(policy) ?? 0 }))
    .filter((slice) => slice.requests > 0);

  const total = slices.reduce((sum, slice) => sum + slice.requests, 0);

  if (total === 0) {
    return (
      <p className="py-10 text-center text-meta text-fg-subtle">
        No AI requests were detected in this period.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="requests"
              nameKey="policy"
              innerRadius="66%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              stroke="var(--color-surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.policy} fill={POLICY_FILL[slice.policy]} />
              ))}
            </Pie>
            <Tooltip content={(props: TooltipProps<number, string>) => renderTooltip(props, total)} />
          </PieChart>
        </ResponsiveContainer>

        {/*
          The centre labels the WHOLE, not one of the parts.
          It used to repeat the shadow-AI percentage, which the score panel's
          driver bar already states about 400px to the left at similar visual
          weight. A donut centre restating one slice is the classic version of
          this mistake; the total is what the ring actually adds up to.

          Aria-hidden because the legend below states every value as text and a
          screen reader should hear them once.
        */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
          <span className="tabular text-stat font-semibold text-fg">{formatNumber(total)}</span>
          <span className="mt-0.5 text-micro uppercase tracking-wider text-fg-subtle">Requests</span>
        </div>
      </div>

      <PolicyLegend
        className="justify-center"
        items={slices.map((slice) => ({ policy: slice.policy, value: slice.requests }))}
      />
    </div>
  );
}

function renderTooltip(
  { active, payload }: TooltipProps<number, string>,
  total: number,
): JSX.Element | null {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload as { policy: PolicyStatus; requests: number } | undefined;
  if (!datum) return null;

  return (
    <ChartTooltip
      title={POLICY_LABEL[datum.policy]}
      rows={[
        { label: 'Requests', value: formatNumber(datum.requests), colour: POLICY_FILL[datum.policy] },
        { label: 'Share', value: formatPercent((datum.requests / total) * 100, 1) },
      ]}
    />
  );
}
