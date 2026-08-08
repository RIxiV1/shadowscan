import { Download, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { RiskBandBadge } from '@/components/indicators';
import { EmptyState, ErrorState, LoadingRows, PageHeader, Pagination } from '@/components/layout-parts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadFile } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { useDeleteReport, useGenerateReport, useReports } from '@/lib/queries';

// Reports.
export function ReportsPage(): JSX.Element {
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const reports = useReports(page);
  const deleteReport = useDeleteReport();

  async function handleDownload(id: string): Promise<void> {
    setDownloading(id);
    try {
      await downloadFile(`/reports/${id}/pdf`, `shadowscan-report-${id}.pdf`);
    } catch (error) {
      toast.error('Download failed', { description: (error as Error).message });
    } finally {
      setDownloading(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="point-in-time snapshots, exportable as PDF"
        actions={
          <Button variant="primary" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus />
            Generate report
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {reports.isPending ? (
          <LoadingRows rows={6} />
        ) : reports.isError ? (
          <ErrorState message={(reports.error as Error).message} onRetry={() => void reports.refetch()} />
        ) : reports.data.items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No reports yet"
            description="Generate one to capture the current posture, the tools in use, the highest-risk individuals and the recommended actions."
            action={
              <Button variant="primary" size="sm" onClick={() => setDialogOpen(true)}>
                Generate the first report
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">AI requests</TableHead>
                  <TableHead className="text-right">Shadow AI</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.data.items.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <Link to={`/reports/${report.id}`} className="text-sm font-medium hover:text-accent hover:underline">
                        {report.title}
                      </Link>
                      <p className="text-[11px] text-fg-subtle">
                        Generated {formatDateTime(report.createdAt)}
                        {report.generatedBy ? ` by ${report.generatedBy.name}` : ''}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-fg-muted">
                      {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
                    </TableCell>
                    <TableCell className="tabular text-right text-sm">
                      {formatNumber(report.summary.aiRequests)}
                    </TableCell>
                    <TableCell className="tabular text-right text-sm">
                      {formatNumber(report.summary.shadowAiRequests)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="tabular text-sm font-medium">{report.score}</span>
                        <RiskBandBadge band={report.band} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Download PDF"
                          disabled={downloading === report.id}
                          onClick={() => void handleDownload(report.id)}
                        >
                          {downloading === report.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Download className="text-fg-subtle" />
                          )}
                        </Button>
                        {isAdmin ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete report"
                            onClick={() => {
                              if (!window.confirm(`Delete "${report.title}"?`)) return;
                              deleteReport.mutate(report.id, {
                                onSuccess: () => toast.success('Report deleted'),
                                onError: (error) => toast.error((error as Error).message),
                              });
                            }}
                          >
                            <Trash2 className="text-fg-subtle" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination {...reports.data} onPageChange={setPage} />
          </>
        )}
      </Card>

      <GenerateReportDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

function GenerateReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const generate = useGenerateReport();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const [title, setTitle] = useState('');
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            generate.mutate(
              {
                title: title.trim() || undefined,
                // End of the selected day, so a same-day report is not empty.
                from: new Date(`${from}T00:00:00`).toISOString(),
                to: new Date(`${to}T23:59:59`).toISOString(),
              },
              {
                onSuccess: (report) => {
                  toast.success('Report generated', {
                    description: `Score ${report.score}/100 · ${report.recommendations.length} recommendations.`,
                  });
                  onOpenChange(false);
                },
                onError: (error) => toast.error((error as Error).message),
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Generate a governance report</DialogTitle>
            <DialogDescription>
              Captures the posture for the selected period and freezes the numbers. Findings and
              recommendations are produced by deterministic rules, so the same period always produces the
              same report.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="report-title">Title (optional)</Label>
              <Input
                id="report-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Q1 AI governance review"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="from">From</Label>
                <Input id="from" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">To</Label>
                <Input id="to" type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} />
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={generate.isPending}>
              {generate.isPending ? <Loader2 className="animate-spin" /> : null}
              Generate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
