import type { RiskBand } from '@shadowscan/shared';
import { ArrowRight, FileText, Upload } from 'lucide-react';
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

/*
 * Composed around the order a security lead actually asks things on a Monday:
 *
 *   1. are we OK            the score, large, banded, over its own track
 *   2. why that number      the three weighted drivers, as bars
 *   3. what is worst        findings from the recommendation rules
 *   4. how much of it       volume strip
 *   5. is it getting worse  daily trend
 *   6. which tools, who     inventory and people
 *
 * The findings panel is the part that matters. A wall of metrics leaves the reader
 * to draw the conclusion; this states it, using the same rules that produce the
 * PDF so the screen and the report can never disagree.
 */

const WINDOWS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '12 months' },
];

const BAND_TEXT: Record<RiskBand, string> = {
  low: 'text-risk-low',
  medium: 'text-risk-medium',
  high: 'text-risk-high',
  critical: 'text-risk-critical',
};

const BAND_BAR: Record<RiskBand, string> = {
  low: 'bg-risk-low',
  medium: 'bg-risk-medium',
  high: 'bg-risk-high',
  critical: 'bg-risk-critical',
};

const BAND_EDGE: Record<RiskBand, string> = {
  low: 'border-l-risk-low',
  medium: 'border-l-risk-medium',
  high: 'border-l-risk-high',
  critical: 'border-l-risk-critical',
};

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
        <LoadingRows rows={8} className="rounded-[5px] border border-line bg-surface" />
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

  const { cards, trends, findings } = data;

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

  const shadowShare =
    cards.aiRequests === 0 ? 0 : Math.round((cards.shadowAiRequests / cards.aiRequests) * 100);
  const elevated = data.highRiskActors.filter((a) => a.band === 'high' || a.band === 'critical').length;
  const headline = findings[0];
  const rest = findings.slice(1, 5);

  return (
    <>
      <PageHeader
        title="Overview"
        actions={
          <>
            {picker}
            <Button asChild variant="secondary" size="md">
              <Link to="/reports">
                <FileText />
                Reports
              </Link>
            </Button>
          </>
        }
      />

      {/* -------------------------------------------------------- 1 verdict --- */}
      <div className="raised mb-2 grid rounded-[5px] border border-line bg-surface lg:grid-cols-[300px_1fr]">
        <div className="border-line px-4 py-3.5 lg:border-r">
          <p className="eyebrow">Organisation risk</p>

          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <span
                className={cn('tabular text-[44px] font-semibold leading-none', BAND_TEXT[cards.riskBand])}
                style={{ textShadow: '0 0 28px currentColor' }}
              >
                {cards.riskScore}
              </span>
              <span className="text-[12px] text-fg-subtle">/100</span>
            </div>
            <RiskBandBadge band={cards.riskBand} className="mb-1" />
          </div>

          <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-elevated">
            <div
              className={cn('h-full rounded-full transition-[width] duration-500', BAND_BAR[cards.riskBand])}
              style={{ width: `${Math.max(2, Math.min(100, cards.riskScore))}%` }}
            />
          </div>

          <div className="mt-3.5 grid grid-cols-3 gap-3">
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
              // Mirrors the engine: 20% of requests carrying content saturates.
              ratio={cards.aiRequests === 0 ? 0 : (cards.sensitiveHits / cards.aiRequests) * 5}
              weight="35%"
              tone={cards.sensitiveHits > 0 ? 'critical' : 'muted'}
            />
            <Meter
              label="Concentration"
              detail={String(elevated)}
              ratio={data.highRiskActors.length === 0 ? 0 : elevated / data.highRiskActors.length}
              weight="25%"
              tone={elevated > 0 ? 'high' : 'muted'}
            />
          </div>
        </div>

        {/* The single most important sentence on the screen. */}
        <div className="flex flex-col justify-center gap-2 px-4 py-3.5">
          {headline ? (
            <>
              <div className="flex items-center gap-2">
                <RiskBandBadge band={headline.severity} />
                <span className="eyebrow">top finding</span>
              </div>
              <p className="text-[17px] font-semibold leading-snug text-fg">{headline.title}</p>
              <p className="max-w-3xl text-[12px] leading-relaxed text-fg-muted">{headline.detail}</p>
            </>
          ) : (
            <p className="text-[13px] text-fg-muted">No findings for this period.</p>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------- 2 volume --- */}
      <div className="raised mb-2 flex flex-wrap rounded-[5px] border border-line bg-surface">
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

      {/* ------------------------------------------- 3 findings + governance --- */}
      <div className="mb-2 grid gap-2 lg:grid-cols-[1fr_320px]">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>What needs attention</CardTitle>
            <span className="text-[10px] normal-case tracking-normal text-fg-subtle">
              rule-based, same as the report
            </span>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {rest.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-fg-subtle">
                Nothing further to action for this period.
              </p>
            ) : (
              rest.map((finding, index) => (
                <div
                  key={index}
                  className={cn(
                    'border-b border-l-2 border-line/70 px-3 py-2.5 last:border-b-0',
                    BAND_EDGE[finding.severity],
                  )}
                >
                  <div className="flex items-baseline gap-2">
                    <span className={cn('text-[10px] font-semibold uppercase', BAND_TEXT[finding.severity])}>
                      {finding.severity}
                    </span>
                    <p className="text-[13px] font-medium text-fg">{finding.title}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-fg-subtle">{finding.detail}</p>
                </div>
              ))
            )}
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

      {/* ---------------------------------------------------------- 4 trend --- */}
      <Card className="mb-2">
        <CardHeader>
          <CardTitle>Daily activity</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyUsageChart data={data.dailyUsage} />
        </CardContent>
      </Card>

      {/* ----------------------------------------------- 5 tools and people --- */}
      <div className="grid gap-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Services in use</CardTitle>
            <Link to="/registry" className="text-[10px] normal-case tracking-normal text-accent hover:underline">
              registry
            </Link>
          </CardHeader>
          <CardContent>
            <UsageByToolChart data={data.usageByTool} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Highest-risk individuals</CardTitle>
            <Link
              to="/events?band=critical"
              className="flex items-center gap-1 text-[10px] normal-case tracking-normal text-accent hover:underline"
            >
              investigate
              <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          {data.highRiskActors.length === 0 ? (
            <EmptyState
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
                  <TableHead className="w-28">Risk</TableHead>
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
