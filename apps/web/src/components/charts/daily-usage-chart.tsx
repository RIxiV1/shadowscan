import type { DashboardSummary } from '@shadowscan/shared';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { AXIS_STYLE, ChartTooltip, GRID_STYLE, POLICY_FILL, PolicyLegend } from './chart-primitives';
import { formatAxisDate, formatCompact, formatDate, formatNumber } from '@/lib/format';

// Daily AI usage, stacked by governance status.
export function DailyUsageChart({ data }: { data: DashboardSummary['dailyUsage'] }): JSX.Element {
  const totals = data.reduce(
    (accumulator, day) => ({
      approved: accumulator.approved + day.approvedRequests,
      shadow: accumulator.shadow + day.shadowAiRequests,
    }),
    { approved: 0, shadow: 0 },
  );

  return (
    <div className="space-y-3">
      <PolicyLegend
        items={[
          { policy: 'approved', value: totals.approved, label: 'Approved' },
          // Not "Blocked": this band stacks unassessed and blocked together, and
          // labelling it Blocked contradicts the blocked count in the donut.
          { policy: 'blocked', value: totals.shadow, label: 'Shadow AI' },
        ]}
      />
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="fill-approved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={POLICY_FILL.approved} stopOpacity={0.28} />
                <stop offset="100%" stopColor={POLICY_FILL.approved} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fill-shadow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={POLICY_FILL.blocked} stopOpacity={0.28} />
                <stop offset="100%" stopColor={POLICY_FILL.blocked} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid {...GRID_STYLE} />
            <XAxis
              dataKey="date"
              {...AXIS_STYLE}
              tickFormatter={formatAxisDate}
              minTickGap={28}
              interval="preserveStartEnd"
            />
            <YAxis {...AXIS_STYLE} width={52} tickFormatter={formatCompact} allowDecimals={false} />
            <Tooltip
              content={renderTooltip}
              cursor={{ stroke: 'var(--color-line-strong)', strokeWidth: 1 }}
            />

            {/* Shadow sits on top so the governed baseline reads as the floor. */}
            <Area
              type="monotone"
              dataKey="approvedRequests"
              name="Approved"
              stackId="usage"
              stroke={POLICY_FILL.approved}
              strokeWidth={2}
              fill="url(#fill-approved)"
              // 2px surface stroke between stacked bands keeps the boundary visible without colour doing the work.
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
            />
            <Area
              type="monotone"
              dataKey="shadowAiRequests"
              name="Shadow AI"
              stackId="usage"
              stroke={POLICY_FILL.blocked}
              strokeWidth={2}
              fill="url(#fill-shadow)"
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function renderTooltip({ active, payload, label }: TooltipProps<number, string>): JSX.Element | null {
  if (!active || !payload?.length) return null;

  const approved = Number(payload.find((entry) => entry.dataKey === 'approvedRequests')?.value ?? 0);
  const shadow = Number(payload.find((entry) => entry.dataKey === 'shadowAiRequests')?.value ?? 0);

  return (
    <ChartTooltip
      title={formatDate(String(label))}
      rows={[
        { label: 'Approved', value: formatNumber(approved), colour: POLICY_FILL.approved },
        { label: 'Shadow AI', value: formatNumber(shadow), colour: POLICY_FILL.blocked },
      ]}
      footer={`Total ${formatNumber(approved + shadow)} requests`}
    />
  );
}
