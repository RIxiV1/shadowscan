import { AlertTriangle, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DailyUsageChart } from '@/components/charts/daily-usage-chart';
import { PolicyDonut } from '@/components/charts/policy-donut';
import { UsageByToolChart } from '@/components/charts/usage-by-tool-chart';
import { RiskBandBadge, ScoreMeter } from '@/components/indicators';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/layout-parts';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNumber } from '@/lib/format';
import { useDashboard } from '@/lib/queries';
import { cn } from '@/lib/utils';

const WINDOWS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '12 months' },
];

const BAND_TEXT = {
  low: 'text-risk-low',
  medium: 'text-risk-medium',
  high: 'text-risk-high',
  critical: 'text-risk-critical',
} as const;

export function DashboardPage(): JSX.Element {
  const [days, setDays] = useState('30');
  const { data, isPending, isError, error, refetch } = useDashboard(Number(days));

  const picker = (
    <Select value={days} onValueChange={setDays}>
      <SelectTrigger className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WINDOWS.map((w) => (
          <SelectItem key={w.value} value={w.value}>
            {w.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (isPending) {
    return (
      <>
        <PageHeader title="Overview" actions={picker} />
        <LoadingRows rows={8} className="rounded-[3px] border border-line bg-surface" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Overview" actions={picker} />
        <Card>
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  const { cards, trends } = data;

  if (cards.aiRequests === 0 && cards.uploads === 0) {
    return (
      <>
        <PageHeader title="Overview" actions={picker} />
        <Card>
          <EmptyState
            icon={Upload}
            title="No telemetry yet"
            description="Upload a browser history export, proxy log or CASB report to start detecting AI usage."
            action={
              <Button asChild variant="primary" size="sm">
                <Link to="/uploads">Upload a log file</Link>
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  const shadowShare = cards.aiRequests === 0 ? 0 : Math.round((cards.shadowAiRequests / cards.aiRequests) * 100);
  const elevated = data.highRiskActors.filter((a) => a.band === 'high' || a.band === 'critical').length;

  return (
    <>
      <PageHeader title="Overview" actions={picker} />

      {/* Score and volume read as one instrument strip rather than six tiles. */}
      <div className="mb-2 flex flex-col rounded-[3px] border border-line bg-surface xl:flex-row">
        <div className="flex items-center gap-4 border-line px-4 py-2.5 xl:w-64 xl:border-r">
          <div>
            <p className="eyebrow">Risk score</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={cn('tabular text-[34px] font-semibold leading-none', BAND_TEXT[cards.riskBand])}>
                {cards.riskScore}
              </span>
              <span className="text-[12px] text-fg-subtle">/100</span>
            </div>
            <div className="mt-1.5">
              <RiskBandBadge band={cards.riskBand} />
            </div>
          </div>
          {/* The three inputs to the score, weighted 40/35/25. Shown next to it
              so the number is never just asserted. */}
          <dl className="ml-auto grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-fg-subtle">Unmanaged</dt>
            <dd className="tabular text-right font-medium text-fg-muted">{shadowShare}%</dd>
            <dt className="text-fg-subtle">Exposure</dt>
            <dd className="tabular text-right font-medium text-fg-muted">
              {formatNumber(cards.sensitiveHits)}
            </dd>
            <dt className="text-fg-subtle">People at risk</dt>
            <dd className="tabular text-right font-medium text-fg-muted">{elevated}</dd>
          </dl>
        </div>

        <div className="flex flex-1 flex-wrap border-t border-line xl:border-t-0">
          <StatCard label="Log rows" value={cards.totalEvents} hint={`${formatNumber(cards.uploads)} uploads`} />
          <StatCard label="AI requests" value={cards.aiRequests} trend={trends.aiRequests} />
          <StatCard
            label="Shadow AI"
            value={cards.shadowAiRequests}
            tone={cards.shadowAiRequests > 0 ? 'high' : 'low'}
            trend={trends.shadowAiRequests}
            invertTrend
          />
          <StatCard label="Approved" value={cards.approvedRequests} tone="low" />
          <StatCard
            label="Confidential"
            value={cards.sensitiveHits}
            tone={cards.sensitiveHits > 0 ? 'critical' : 'low'}
          />
        </div>
      </div>

      <div className="mb-2 grid gap-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily activity</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyUsageChart data={data.dailyUsage} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Governance split</CardTitle>
          </CardHeader>
          <CardContent>
            <PolicyDonut data={data.policyBreakdown} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Services in use</CardTitle>
          </CardHeader>
          <CardContent>
            <UsageByToolChart data={data.usageByTool} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Highest-risk individuals</CardTitle>
          </CardHeader>
          {data.highRiskActors.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="No attributable activity"
              description="The uploaded logs had no user column, so requests could not be tied to individuals."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Individual</TableHead>
                  <TableHead className="text-right">Reqs</TableHead>
                  <TableHead className="text-right">Shadow</TableHead>
                  <TableHead className="w-32">Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.highRiskActors.map((actor) => (
                  <TableRow key={actor.actor}>
                    <TableCell>
                      <Link
                        to={`/events?actor=${encodeURIComponent(actor.actor)}`}
                        className="font-mono text-[12px] hover:text-accent hover:underline"
                      >
                        {actor.actor}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular text-right text-fg-muted">
                      {formatNumber(actor.requests)}
                    </TableCell>
                    <TableCell className="tabular text-right text-fg-muted">
                      {formatNumber(actor.shadowRequests)}
                    </TableCell>
                    <TableCell>
                      <ScoreMeter score={actor.score} band={actor.band} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
