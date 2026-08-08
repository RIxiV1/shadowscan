import { useState } from 'react';
import { EmptyState, ErrorState, LoadingRows, PageHeader, Pagination } from '@/components/layout-parts';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import { useAuditLog } from '@/lib/queries';

// Audit trail.
export function AuditPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const audit = useAuditLog(page);

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Every sign-in, policy change, upload and export. Append-only, retained for one year."
      />

      <Card className="overflow-hidden">
        {audit.isPending ? (
          <LoadingRows rows={10} />
        ) : audit.isError ? (
          <ErrorState message={(audit.error as Error).message} onRetry={() => void audit.refetch()} />
        ) : audit.data.items.length === 0 ? (
          <EmptyState title="No activity recorded" description="Actions will appear here as they happen." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Source IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.data.items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs text-fg-muted">
                      {formatDateTime(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={entry.action.includes('failure') ? 'critical' : 'neutral'}>
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{entry.actorEmail}</TableCell>
                    <TableCell className="max-w-64 truncate font-mono text-xs text-fg-muted">
                      {entry.target || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-fg-subtle">{entry.ip}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination {...audit.data} onPageChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
