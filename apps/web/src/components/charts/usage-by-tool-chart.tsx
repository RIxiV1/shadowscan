import type { DashboardSummary } from '@shadowscan/shared';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { AXIS_STYLE, ChartTooltip, POLICY_FILL, POLICY_LABEL, PolicyLegend } from './chart-primitives';
import { formatNumber } from '@/lib/format';

// AI usage by tool - horizontal bars.
export function UsageByToolChart({ data }: { data: DashboardSummary['usageByTool'] }): JSX.Element {
  const top = data.slice(0, 8);
  const presentPolicies = Array.from(new Set(top.map((tool) => tool.policy)));

  return (
    <div className="space-y-3">
      <PolicyLegend items={presentPolicies.map((policy) => ({ policy }))} />
      <div style={{ height: Math.max(160, top.length * 26 + 12) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }} barCategoryGap={6}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              {...AXIS_STYLE}
              width={124}
              tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }}
            />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--color-elevated)', opacity: 0.5 }} />
            <Bar dataKey="requests" radius={[0, 2, 2, 0]} maxBarSize={14} fillOpacity={0.82} isAnimationActive={false}>
              {top.map((tool) => (
                <Cell key={tool.key} fill={POLICY_FILL[tool.policy]} />
              ))}
              {/* Direct labels: the value is the point of the chart, and reading
                  it should not require hovering or counting gridlines. */}
              <LabelList
                dataKey="requests"
                position="right"
                offset={8}
                formatter={(value: number) => formatNumber(value)}
                style={{ fill: 'var(--color-fg-muted)', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function renderTooltip({ active, payload }: TooltipProps<number, string>): JSX.Element | null {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload as DashboardSummary['usageByTool'][number] | undefined;
  if (!datum) return null;

  return (
    <ChartTooltip
      title={datum.name}
      rows={[
        { label: 'Requests', value: formatNumber(datum.requests) },
        { label: 'Status', value: POLICY_LABEL[datum.policy], colour: POLICY_FILL[datum.policy] },
        { label: 'Category', value: datum.category },
      ]}
    />
  );
}
