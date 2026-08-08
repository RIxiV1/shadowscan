import type { UploadResult } from '@shadowscan/shared';
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Trash2, Upload as UploadIcon } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { toast } from 'sonner';
import { PolicyBadge, RiskBandBadge } from '@/components/indicators';
import { EmptyState, ErrorState, LoadingRows, PageHeader, Pagination } from '@/components/layout-parts';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { formatBytes, formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import { useCreateUpload, useDeleteUpload, useUploads } from '@/lib/queries';
import { cn } from '@/lib/utils';

const ACCEPTED = '.csv,.tsv,.json,.ndjson,.jsonl,.txt,.log';
const MAX_BYTES = 10 * 1024 * 1024;
export function UploadsPage(): JSX.Element {
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploads = useUploads(page);
  const createUpload = useCreateUpload();
  const deleteUpload = useDeleteUpload();

  function handleFiles(files: FileList | null): void {
    const file = files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error('File is too large', {
        description: `${formatBytes(file.size)} exceeds the 10 MB limit. Split the export and upload it in parts.`,
      });
      return;
    }

    createUpload.mutate(file, {
      onSuccess: (data) => {
        setResult(data);
        setPage(1);
        toast.success(`Ingested ${formatNumber(data.upload.rowsParsed)} rows`, {
          description: `${formatNumber(data.upload.aiRequests)} AI requests detected, ${formatNumber(data.upload.shadowAiRequests)} outside policy.`,
        });
      },
      onError: (error) => {
        toast.error('Upload failed', {
          description: error instanceof ApiRequestError ? error.message : 'Unexpected error.',
        });
      },
    });

    if (inputRef.current) inputRef.current.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <>
      <PageHeader
        title="Log sources"
        description="parsed in memory, only detections are stored"
      />

      <div className="mb-2">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'flex items-center gap-3 rounded-[3px] border border-dashed px-3 py-2.5',
              dragging ? 'border-accent bg-accent/5' : 'border-line-strong bg-elevated/40',
            )}
          >
            {createUpload.isPending ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden />
            ) : (
              <FileUp className="size-4 shrink-0 text-fg-subtle" aria-hidden />
            )}

            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-fg">
                {createUpload.isPending ? 'Parsing and scoring' : 'Drop a log file here'}
              </p>
              <p className="text-[11px] text-fg-subtle">
                CSV, TSV, JSON, NDJSON, TXT, LOG · 10 MB · 50,000 rows
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="sr-only"
              id="log-file"
              onChange={(event: ChangeEvent<HTMLInputElement>) => handleFiles(event.target.files)}
              disabled={createUpload.isPending}
            />
            <Button
              variant="primary"
              size="sm"
              disabled={createUpload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              <UploadIcon />
              Choose file
            </Button>
          </div>
      </div>

      {result ? <UploadResultPanel result={result} onDismiss={() => setResult(null)} /> : null}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Ingestion history</CardTitle>
        </CardHeader>

        {uploads.isPending ? (
          <LoadingRows />
        ) : uploads.isError ? (
          <ErrorState message={(uploads.error as Error).message} onRetry={() => void uploads.refetch()} />
        ) : uploads.data.items.length === 0 ? (
          <EmptyState
            title="No uploads yet"
            description="Once you ingest a log file it appears here with its parse statistics and detection counts."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">AI requests</TableHead>
                  <TableHead className="text-right">Shadow AI</TableHead>
                  <TableHead>Ingested</TableHead>
                  {isAdmin ? <TableHead className="w-10" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.data.items.map((upload) => (
                  <TableRow key={upload.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {upload.status === 'failed' ? (
                          <AlertTriangle className="size-3.5 shrink-0 text-risk-critical" aria-label="Failed" />
                        ) : (
                          <CheckCircle2 className="size-3.5 shrink-0 text-risk-low" aria-label="Completed" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[13px]">{upload.filename}</p>
                          <p className="text-[11px] text-fg-subtle">
                            {formatBytes(upload.sizeBytes)}
                            {upload.rowsRejected > 0
                              ? ` · ${formatNumber(upload.rowsRejected)} rows rejected`
                              : ''}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-fg-muted">{upload.format}</TableCell>
                    <TableCell className="tabular text-right text-fg-muted">
                      {formatNumber(upload.rowsParsed)}
                    </TableCell>
                    <TableCell className="tabular text-right">{formatNumber(upload.aiRequests)}</TableCell>
                    <TableCell className="tabular text-right">
                      <span className={upload.shadowAiRequests > 0 ? 'text-risk-high' : 'text-fg-muted'}>
                        {formatNumber(upload.shadowAiRequests)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-fg-muted" title={formatDateTime(upload.createdAt)}>
                      {formatRelative(upload.createdAt)}
                    </TableCell>
                    {isAdmin ? (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${upload.filename}`}
                          disabled={deleteUpload.isPending}
                          onClick={() => {
                            // Cascade delete is irreversible and silently changes
                            // every historical number, so it gets a confirmation.
                            if (
                              !window.confirm(
                                `Delete "${upload.filename}" and all ${formatNumber(upload.aiRequests)} detections from it? This cannot be undone.`,
                              )
                            ) {
                              return;
                            }
                            deleteUpload.mutate(upload.id, {
                              onSuccess: (data) =>
                                toast.success('Upload deleted', {
                                  description: `${formatNumber(data.deletedEvents)} detections removed.`,
                                }),
                              onError: (error) => toast.error((error as Error).message),
                            });
                          }}
                        >
                          <Trash2 className="text-fg-subtle" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination {...uploads.data} onPageChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}

function UploadResultPanel({
  result,
  onDismiss,
}: {
  result: UploadResult;
  onDismiss: () => void;
}): JSX.Element {
  const { upload, preview } = result;

  return (
    <Card className="mb-2 overflow-hidden border-accent/40">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Ingestion complete — {upload.filename}</CardTitle>
          <p className="mt-1 text-xs text-fg-subtle">
            {formatNumber(upload.rowsParsed)} rows parsed · {formatNumber(upload.aiRequests)} AI requests ·{' '}
            {formatNumber(upload.shadowAiRequests)} outside policy
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </CardHeader>

      {upload.errors.length > 0 ? (
        <div className="mx-3 mb-2 rounded-[4px] border-l-2 border-risk-medium/30 bg-risk-medium/5 px-3 py-2">
          <p className="mb-1 text-xs font-medium text-risk-medium">Parser notices</p>
          <ul className="space-y-0.5 text-[11px] text-fg-muted">
            {upload.errors.slice(0, 5).map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Highest-risk detections</TableHead>
              <TableHead>Individual</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  <p className="text-sm font-medium">{event.provider?.name ?? 'Unrecognised AI service'}</p>
                  <p className="font-mono text-[11px] text-fg-subtle">{event.host}</p>
                </TableCell>
                <TableCell className="text-sm text-fg-muted">{event.actor}</TableCell>
                <TableCell>
                  <PolicyBadge policy={event.policy} />
                </TableCell>
                <TableCell>
                  <RiskBandBadge band={event.riskBand} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </Card>
  );
}
