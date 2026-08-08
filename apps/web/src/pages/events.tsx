import type { AiEventDto, EventListQuery, PolicyStatus, RiskBand } from '@shadowscan/shared';
import { POLICY_STATUSES, RISK_BANDS } from '@shadowscan/shared';
import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PolicyBadge, RiskBandBadge } from '@/components/indicators';
import { Strip, StripStat, Toolbar } from '@/components/console';
import { EmptyState, ErrorState, LoadingRows, PageHeader, Pagination } from '@/components/layout-parts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useEvents } from '@/lib/queries';

const ALL = '__all__';

// The detection table - the investigation surface.
export function EventsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<AiEventDto | null>(null);
  const [searchDraft, setSearchDraft] = useState(searchParams.get('search') ?? '');

  const filters = useMemo<EventListQuery>(
    () => ({
      page: Number(searchParams.get('page') ?? 1),
      pageSize: 25,
      search: searchParams.get('search') || undefined,
      policy: (searchParams.get('policy') as PolicyStatus | null) ?? undefined,
      band: (searchParams.get('band') as RiskBand | null) ?? undefined,
      actor: searchParams.get('actor') || undefined,
      sort: 'occurredAt',
      order: 'desc',
    }),
    [searchParams],
  );

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useEvents(filters);

  function setParam(key: string, value: string | undefined): void {
    const next = new URLSearchParams(searchParams);
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    // Any filter change invalidates the current page number.
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  }

  const activeFilters = ['search', 'policy', 'band', 'actor'].filter((key) => searchParams.get(key));

  return (
    <>
      <PageHeader title="Detections" description="every AI request found in your logs" />

      {/* Tallies double as filters. Clicking a band is the fastest route into
          the subset it counts, which is what an analyst is doing anyway. */}
      {data ? (
        <Strip>
          <StripStat label="Matching" value={data.total} />
          <StripStat label="People" value={data.counts.actors} tone="muted" />
          <StripStat
            label="Confidential"
            value={data.counts.sensitive}
            tone={data.counts.sensitive > 0 ? 'critical' : 'muted'}
          />
          {RISK_BANDS.slice()
            .reverse()
            .map((band) => (
              <StripStat
                key={band}
                label={band}
                value={data.counts.byBand[band]}
                tone={band}
                active={searchParams.get('band') === band}
                onClick={() => setParam('band', searchParams.get('band') === band ? undefined : band)}
              />
            ))}
        </Strip>
      ) : null}

      <Toolbar>
        <div className="contents">
          <form
            className="relative min-w-56 flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              setParam('search', searchDraft.trim() || undefined);
            }}
          >
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-fg-subtle" />
            <Input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="host, person or tool"
              className="pl-7"
              aria-label="Search detections"
            />
          </form>

          <Select value={searchParams.get('policy') ?? ALL} onValueChange={(value) => setParam('policy', value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any status</SelectItem>
              {POLICY_STATUSES.map((policy) => (
                <SelectItem key={policy} value={policy}>
                  {policy === 'unknown' ? 'Not assessed' : policy}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={searchParams.get('band') ?? ALL} onValueChange={(value) => setParam('band', value)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Any risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any risk</SelectItem>
              {RISK_BANDS.map((band) => (
                <SelectItem key={band} value={band}>
                  {band}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFilters.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchDraft('');
                setSearchParams(new URLSearchParams(), { replace: true });
              }}
            >
              <X />
              Clear
            </Button>
          ) : null}
        </div>

        {searchParams.get('actor') ? (
          <span className="text-[11px] text-fg-subtle">
            actor <span className="font-mono text-fg-muted">{searchParams.get('actor')}</span>
          </span>
        ) : null}
      </Toolbar>

      <Card className="overflow-hidden">
        {isPending ? (
          <LoadingRows rows={8} />
        ) : isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        ) : data.items.length === 0 ? (
          <EmptyState
            title="No detections match"
            description={
              activeFilters.length > 0
                ? 'Try widening the filters, or clear them to see every detection.'
                : 'Upload a log file to start detecting AI usage.'
            }
          />
        ) : (
          <>
            <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Individual</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Signals</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((event) => (
                    <TableRow
                      key={event.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(event)}
                      tabIndex={0}
                      onKeyDown={(keyEvent) => {
                        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                          keyEvent.preventDefault();
                          setSelected(event);
                        }
                      }}
                    >
                      <TableCell className="whitespace-nowrap text-xs text-fg-muted">
                        {formatDateTime(event.occurredAt)}
                      </TableCell>
                      <TableCell className="text-sm">{event.actor}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">
                          {event.provider?.name ?? 'Unrecognised AI service'}
                        </p>
                        <p className="font-mono text-[11px] text-fg-subtle">{event.host}</p>
                      </TableCell>
                      <TableCell>
                        <PolicyBadge policy={event.policy} />
                      </TableCell>
                      <TableCell>
                        {event.sensitiveHits.length === 0 ? (
                          <span className="text-xs text-fg-subtle">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {event.sensitiveHits.slice(0, 3).map((hit) => (
                              <span
                                key={hit.class}
                                className="rounded border border-risk-critical/30 bg-risk-critical/10 px-1.5 py-0.5 text-[10px] text-risk-critical"
                              >
                                {hit.class}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="tabular text-right text-sm">{event.riskScore}</TableCell>
                      <TableCell>
                        <RiskBandBadge band={event.riskBand} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination {...data} onPageChange={(page) => setParam('page', String(page))} />
          </>
        )}
      </Card>

      <EventDetailDialog event={selected} onClose={() => setSelected(null)} />
    </>
  );
}

// Score explanation.
function EventDetailDialog({
  event,
  onClose,
}: {
  event: AiEventDto | null;
  onClose: () => void;
}): JSX.Element {
  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        {event ? (
          <>
            <DialogHeader>
              <DialogTitle>{event.provider?.name ?? 'Unrecognised AI service'}</DialogTitle>
              <DialogDescription>
                {event.actor} · {formatDateTime(event.occurredAt)}
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-5">
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <Field label="Destination" value={`${event.host}${event.path}`} mono />
                <Field label="Governance status" value={<PolicyBadge policy={event.policy} />} />
                <Field label="Category" value={event.provider?.category ?? 'unclassified'} />
                <Field label="Risk" value={<RiskBandBadge band={event.riskBand} />} />
              </dl>

              <div>
                <p className="mb-2 text-xs font-medium text-fg">
                  Risk score breakdown ·{' '}
                  <span className="tabular text-fg-muted">{event.riskScore} points</span>
                </p>
                <ul className="divide-y divide-line rounded-md border border-line">
                  {event.riskFactors.map((factor, index) => (
                    <li key={index} className="flex items-start justify-between gap-4 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs text-fg">{factor.label}</p>
                        <p className="text-[10px] uppercase tracking-wide text-fg-subtle">{factor.kind}</p>
                      </div>
                      <span className="tabular shrink-0 text-xs font-medium text-fg">
                        +{factor.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {event.sensitiveHits.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-fg">Sensitive content detected</p>
                  <div className="flex flex-wrap gap-1.5">
                    {event.sensitiveHits.map((hit) => (
                      <span
                        key={hit.class}
                        className="rounded border border-risk-critical/30 bg-risk-critical/10 px-2 py-1 text-[11px] text-risk-critical"
                      >
                        {hit.class} × {formatNumber(hit.count)}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-fg-subtle">
                    ShadowScan records that content of this class was present. The matched values themselves
                    are discarded at ingestion and are never stored, so they cannot be recovered from here.
                  </p>
                </div>
              ) : null}
            </DialogBody>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}): JSX.Element {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className={`mt-1 break-all text-xs text-fg ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
