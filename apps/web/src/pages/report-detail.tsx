import type { RiskBand } from '@shadowscan/shared';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PolicyBadge, RiskBandBadge, ScoreMeter } from '@/components/indicators';
import { ErrorState, LoadingRows, PageHeader } from '@/components/layout-parts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadFile } from '@/lib/api-client';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { useReport } from '@/lib/queries';
import { cn } from '@/lib/utils';

const SEVERITY_STYLES: Record<RiskBand, string> = {
  critical: 'border-l-risk-critical',
  high: 'border-l-risk-high',
  medium: 'border-l-risk-medium',
  low: 'border-l-risk-low',
};

export function ReportDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { data: report, isPending, isError, error, refetch } = useReport(id);
  const [downloading, setDownloading] = useState(false);

  if (isPending) {
    return (
      <>
        <PageHeader title="Report" />
        <LoadingRows rows={8} className="rounded-xl border border-line bg-surface" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Report" />
        <Card>
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  async function handleDownload(): Promise<void> {
    if (!id) return;
    setDownloading(true);
    try {
      await downloadFile(`/reports/${id}/pdf`, `shadowscan-report-${id}.pdf`);
    } catch (caught) {
      toast.error('Download failed', { description: (caught as Error).message });
    } finally {
      setDownloading(false);
    }
  }

  const summary = report.summary;
  const unmanagedShare =
    summary.aiRequests === 0 ? 0 : Math.round((summary.shadowAiRequests / summary.aiRequests) * 100);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/reports">
          <ArrowLeft />
          All reports
        </Link>
      </Button>

      <PageHeader
        title={report.title}
        description={`${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)} · generated ${formatDateTime(report.createdAt)}${report.generatedBy ? ` by ${report.generatedBy.name}` : ''}`}
        actions={
          <Button variant="primary" size="sm" disabled={downloading} onClick={() => void handleDownload()}>
            {downloading ? <Loader2 className="animate-spin" /> : <Download />}
            Export PDF
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-8 pt-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Risk score</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="tabular text-3xl font-semibold leading-none">{report.score}</span>
              <span className="text-sm text-fg-subtle">/ 100</span>
              <RiskBandBadge band={report.band} className="ml-1" />
            </div>
          </div>

          <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
            <Metric label="Log rows" value={formatNumber(summary.totalEvents)} />
            <Metric label="AI requests" value={formatNumber(summary.aiRequests)} />
            <Metric label="Shadow AI" value={`${formatNumber(summary.shadowAiRequests)} (${unmanagedShare}%)`} />
            <Metric label="Approved" value={formatNumber(summary.approvedRequests)} />
            <Metric label="People" value={formatNumber(summary.uniqueActors)} />
            <Metric label="Services" value={formatNumber(summary.uniqueProviders)} />
            <Metric label="Confidential hits" value={formatNumber(summary.sensitiveHits)} />
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Recommended actions</CardTitle>
          <p className="text-xs text-fg-subtle">
            Produced by deterministic rules over the numbers above — no language model is involved, so the
            same period always yields the same findings.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.recommendations.map((recommendation, index) => (
            <div
              key={index}
              className={cn('rounded-r-md border-l-2 bg-elevated/40 px-4 py-3', SEVERITY_STYLES[recommendation.severity])}
            >
              <div className="mb-1 flex items-center gap-2">
                <RiskBandBadge band={recommendation.severity} />
                <p className="text-sm font-medium text-fg">{recommendation.title}</p>
              </div>
              <p className="text-xs leading-relaxed text-fg-muted">{recommendation.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>AI services detected</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Requests</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.topProviders.map((provider) => (
                <TableRow key={provider.key}>
                  <TableCell className="text-sm font-medium">{provider.name}</TableCell>
                  <TableCell>
                    <PolicyBadge policy={provider.policy} />
                  </TableCell>
                  <TableCell className="tabular text-right text-sm">
                    {formatNumber(provider.requests)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Highest-risk individuals</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Individual</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.topActors.map((actor) => (
                <TableRow key={actor.actor}>
                  <TableCell className="text-sm font-medium">{actor.actor}</TableCell>
                  <TableCell className="tabular text-right text-sm text-fg-muted">
                    {formatNumber(actor.requests)}
                  </TableCell>
                  <TableCell>
                    <ScoreMeter score={actor.score} band={actor.band} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className="tabular mt-0.5 text-sm font-medium text-fg">{value}</dd>
    </div>
  );
}
