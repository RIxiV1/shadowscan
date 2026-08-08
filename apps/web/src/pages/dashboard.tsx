import { AlertTriangle, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DailyUsageChart } from '@/components/charts/daily-usage-chart';
import { PolicyDonut } from '@/components/charts/policy-donut';
import { UsageByToolChart } from '@/components/charts/usage-by-tool-chart';
import { Meter } from '@/components/console';
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

const BAND_BAR = {
  low: 'bg-risk-low',
  medium: 'bg-risk-medium',
  high: 'bg-risk-high',
  critical: 'bg-risk-critical',
} as const;

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

      {/* Score and volume as one instrument strip. The score gets a track and its
          three inputs get bars, so the number is shown rather than asserted. */}
      <div className="raised mb-2 flex flex-col rounded-[5px] border border-line bg-surface xl:flex-row">
        <div className="border-line px-4 py-3 xl:w-[340px] xl:border-r">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Organisation risk</p>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span
                  className={cn('tabular text-[40px] font-semibold leading-none', BAND_TEXT[cards.riskBand])}
                  style={{ textShadow: '0 0 24px currentColor', opacity: 0.999 }}
                >
                  {cards.riskScore}
                </span>
                <span className="text-[12px] text-fg-subtle">/100</span>
              </div>
            </div>
            <RiskBandBadge band={cards.riskBand} />
          </div>

          <div className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-elevated">
            <div
              className={cn('h-full rounded-full', BAND_BAR[cards.riskBand])}
              style={{ width: `${Math.min(100, cards.riskScore)}%` }}
            />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <Meter
              label="Unmanaged"
              detail={`${shadowShare}%`}
              ratio={shadowShare / 100}
              weight="40%"
              tone={shadowShare > 50 ? 'high' : 'medium'}
            />
            <Meter
              label="Exposure"
              detail={formatNumber(cards.sensitiveHits)}
              // Matches the engine: 20% of requests carrying content saturates.
              ratio={cards.aiRequests === 0 ? 0 : (cards.sensitiveHits / cards.aiRequests) * 5}
              weight="35%"
              tone={cards.sensitiveHits > 0 ? 'critical' : 'muted'}
            />
            <Meter
              label="Concentration"
              detail={`${elevated} ${elevated === 1 ? 'person' : 'people'}`}
              ratio={data.highRiskActors.length === 0 ? 0 : elevated / data.highRiskActors.length}
              weight="25%"
              tone={elevated > 0 ? 'high' : 'muted'}
            />
          </div>
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
