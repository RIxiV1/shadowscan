import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileWarning,
  Gauge,
  ShieldAlert,
  Upload,
} from 'lucide-react';
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

const WINDOWS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];
export function DashboardPage(): JSX.Element {
  const [days, setDays] = useState('30');
  const { data, isPending, isError, error, refetch } = useDashboard(Number(days));

  const filter = (
    <Select value={days} onValueChange={setDays}>
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WINDOWS.map((window) => (
          <SelectItem key={window.value} value={window.value}>
            {window.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (isPending) {
    return (
      <>
        <PageHeader title="Overview" description="AI exposure across your organisation." actions={filter} />
        <LoadingRows rows={8} className="rounded-xl border border-line bg-surface" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Overview" actions={filter} />
        <Card>
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  const { cards, trends } = data;
  const hasData = cards.aiRequests > 0 || cards.uploads > 0;

  if (!hasData) {
    return (
      <>
        <PageHeader title="Overview" description="AI exposure across your organisation." actions={filter} />
        <Card>
          <EmptyState
            icon={Upload}
            title="No telemetry yet"
            description="Upload a browser history export, proxy log or CASB report to start detecting AI usage. ShadowScan parses CSV, JSON, NDJSON and plain-text access logs."
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

  return (
    <>
      <PageHeader
        title="Overview"
        description={`AI exposure across your organisation for the ${data.window.days}-day window.`}
        actions={filter}
      />

      {/* Posture first: one number, banded, with the components that produced it. */}
      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-6 p-5">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-line bg-elevated">
              <Gauge className="size-7 text-accent" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                Organisation risk score
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="tabular text-3xl font-semibold leading-none">{cards.riskScore}</span>
                <span className="text-sm text-fg-subtle">/ 100</span>
                <RiskBandBadge band={cards.riskBand} className="ml-1" />
              </div>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
            <ScoreComponent label="Unmanaged share" value={`${shadowShare}%`} weight="40%" />
            <ScoreComponent
              label="Confidential exposure"
              value={formatNumber(cards.sensitiveHits)}
              weight="35%"
            />
            <ScoreComponent
              label="Risk concentration"
              value={`${data.highRiskActors.filter((actor) => actor.band === 'high' || actor.band === 'critical').length} people`}
              weight="25%"
            />
          </div>
        </div>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Log rows ingested" value={cards.totalEvents} icon={Database} hint={`${formatNumber(cards.uploads)} uploads`} />
        <StatCard label="AI requests" value={cards.aiRequests} icon={Activity} trend={trends.aiRequests} />
        <StatCard
          label="Shadow AI"
          value={cards.shadowAiRequests}
          icon={ShieldAlert}
          tone={cards.shadowAiRequests > 0 ? 'high' : 'low'}
          trend={trends.shadowAiRequests}
          invertTrend
        />
        <StatCard label="Approved usage" value={cards.approvedRequests} icon={CheckCircle2} tone="low" />
        <StatCard
          label="Confidential hits"
          value={cards.sensitiveHits}
          icon={FileWarning}
          tone={cards.sensitiveHits > 0 ? 'critical' : 'low'}
          hint="Requests carrying regulated content"
        />
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily AI activity</CardTitle>
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

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI services in use</CardTitle>
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
              description="The uploaded logs carried no user column, so requests could not be attributed to individuals. Proxy and CASB exports usually include one."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Individual</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Shadow</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.highRiskActors.map((actor) => (
                  <TableRow key={actor.actor}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/events?actor=${encodeURIComponent(actor.actor)}`}
                        className="hover:text-accent hover:underline"
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

function ScoreComponent({
  label,
  value,
  weight,
}: {
  label: string;
  value: string;
  weight: string;
}): JSX.Element {
  return (
    <div>
      <p className="text-[11px] text-fg-subtle">
        {label} <span className="text-fg-subtle/70">· {weight} of score</span>
      </p>
      <p className="tabular mt-0.5 text-sm font-medium text-fg">{value}</p>
    </div>
  );
}
