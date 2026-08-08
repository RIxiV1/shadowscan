import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

// Title and actions on one line. The old version had a paragraph of
// explanatory copy under every heading, which is fine on a marketing page and
// just noise on a screen you look at forty times a day.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2.5">
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="text-title font-semibold text-fg">{title}</h1>
        {description ? (
          <p className="hidden truncate text-meta text-fg-subtle lg:block">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// Empty state.
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <Icon className="size-4 text-fg-subtle" aria-hidden />
      <p className="text-body text-fg">{title}</p>
      <p className="mx-auto max-w-sm text-meta leading-relaxed text-fg-subtle">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <AlertTriangle className="size-4 text-risk-high" aria-hidden />
      <div>
        <p className="text-body text-fg">Could not load this view</p>
        <p className="mx-auto max-w-md text-meta text-fg-subtle">{message}</p>
      </div>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingRows({ rows = 5, className }: { rows?: number; className?: string }): JSX.Element {
  return (
    <div className={cn('space-y-1.5 p-3', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-6 w-full" />
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }): JSX.Element {
  return <Loader2 className={cn('size-4 animate-spin', className)} aria-hidden />;
}

// Offset pagination footer, shared by every paged table.
export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}): JSX.Element | null {
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-line px-3 py-1.5">
      <p className="tabular text-meta text-fg-subtle">
        {formatNumber(first)}–{formatNumber(last)} of {formatNumber(total)}
      </p>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <span className="tabular px-1.5 text-meta text-fg-muted">
          {page} / {totalPages}
        </span>
        <Button
          size="icon"
          variant="ghost"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
