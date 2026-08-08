import type { PolicyStatus, UpsertProviderRequest } from '@shadowscan/shared';
import { POLICY_STATUSES, PROVIDER_CATEGORIES } from '@shadowscan/shared';
import { Globe, Plus, Search, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { PolicyBadge } from '@/components/indicators';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '@/components/layout-parts';
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
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { useCreateProvider, useDeleteProvider, useProviders, useUpdateProviderPolicy } from '@/lib/queries';

const ALL = '__all__';

/**
 * The AI registry - identification data and governance policy on one row.
 *
 * Merging "which domains are this tool" with "may we use it" into a single record
 * is the point: two separate screens would let a domain exist with no policy, and
 * "no policy" silently reads as "allowed" in every system that works that way.
 */
export function RegistryPage(): JSX.Element {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [policyFilter, setPolicyFilter] = useState<string>(ALL);
  const [createOpen, setCreateOpen] = useState(false);

  const providers = useProviders({
    search: search || undefined,
    policy: policyFilter === ALL ? undefined : (policyFilter as PolicyStatus),
  });

  const updatePolicy = useUpdateProviderPolicy();
  const deleteProvider = useDeleteProvider();

  return (
    <>
      <PageHeader
        title="AI registry"
        description="known AI services and your policy for each"
        actions={
          isAdmin ? (
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              Add service
            </Button>
          ) : null
        }
      />

      <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-[3px] border border-line bg-surface px-2 py-1.5">
        <div className="contents">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-fg-subtle" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="name, vendor or domain"
              className="pl-7"
              aria-label="Search registry"
            />
          </div>
          <Select value={policyFilter} onValueChange={setPolicyFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Every status</SelectItem>
              {POLICY_STATUSES.map((policy) => (
                <SelectItem key={policy} value={policy}>
                  {policy === 'unknown' ? 'Not assessed' : policy}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {providers.isPending ? (
          <LoadingRows rows={8} />
        ) : providers.isError ? (
          <ErrorState message={(providers.error as Error).message} onRetry={() => void providers.refetch()} />
        ) : providers.data.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No services match"
            description="Adjust the search or filter. The built-in registry ships with the major AI providers pre-loaded."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Domains</TableHead>
                <TableHead>Region</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="w-44">Policy</TableHead>
                {isAdmin ? <TableHead className="w-10" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.data.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell>
                    <p className="text-sm font-medium">{provider.name}</p>
                    <p className="text-[11px] text-fg-subtle">
                      {provider.vendor} · {provider.category}
                      {provider.trainsOnUserData ? ' · trains on submitted data' : ''}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {provider.domains.slice(0, 3).map((domain) => (
                        <span
                          key={domain}
                          className="rounded border border-line bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-fg-muted"
                        >
                          {domain}
                        </span>
                      ))}
                      {provider.domains.length > 3 ? (
                        <span className="px-1 py-0.5 text-[10px] text-fg-subtle">
                          +{provider.domains.length - 3}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-fg-muted">{provider.dataRegion}</TableCell>
                  <TableCell className="tabular text-right text-sm">{provider.riskWeight}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Select
                        value={provider.policy}
                        onValueChange={(policy) =>
                          updatePolicy.mutate(
                            { id: provider.id, policy: policy as PolicyStatus },
                            {
                              onSuccess: (updated) =>
                                toast.success(`${updated.name} is now ${updated.policy}`),
                              onError: (error) => toast.error((error as Error).message),
                            },
                          )
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="unknown">Not assessed</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <PolicyBadge policy={provider.policy} />
                    )}
                  </TableCell>
                  {isAdmin ? (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${provider.name}`}
                        disabled={provider.isBuiltIn}
                        title={
                          provider.isBuiltIn
                            ? 'Built-in services cannot be deleted — set the policy to blocked instead.'
                            : undefined
                        }
                        onClick={() => {
                          if (!window.confirm(`Remove "${provider.name}" from the registry?`)) return;
                          deleteProvider.mutate(provider.id, {
                            onSuccess: () => toast.success(`${provider.name} removed`),
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
        )}
      </Card>

      <CreateProviderDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

const EMPTY_FORM: UpsertProviderRequest = {
  name: '',
  vendor: '',
  category: 'assistant',
  domains: [],
  riskWeight: 2,
  policy: 'unknown',
  dataRegion: 'unknown',
  trainsOnUserData: false,
  notes: '',
};

function CreateProviderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const createProvider = useCreateProvider();
  const [form, setForm] = useState<UpsertProviderRequest>(EMPTY_FORM);
  const [domainsText, setDomainsText] = useState('');
  const [error, setError] = useState<ApiRequestError | null>(null);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setError(null);

    const domains = domainsText
      .split(/[\s,]+/)
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean);

    createProvider.mutate(
      { ...form, domains },
      {
        onSuccess: (provider) => {
          toast.success(`${provider.name} added to the registry`);
          setForm(EMPTY_FORM);
          setDomainsText('');
          onOpenChange(false);
        },
        onError: (caught) => {
          if (caught instanceof ApiRequestError) setError(caught);
          else toast.error('Could not save the service.');
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add an AI service</DialogTitle>
            <DialogDescription>
              Register a tool the built-in catalogue does not cover — an internal LLM gateway, a
              regional vendor, or a service you saw flagged as unassessed.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Service name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Acme Assistant"
                  aria-invalid={Boolean(error?.fieldError('name'))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  required
                  value={form.vendor}
                  onChange={(event) => setForm({ ...form, vendor: event.target.value })}
                  placeholder="Acme Corp"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domains">Domains</Label>
              <Textarea
                id="domains"
                required
                value={domainsText}
                onChange={(event) => setDomainsText(event.target.value)}
                placeholder="acme.ai, chat.acme.ai"
                aria-invalid={Boolean(error?.fieldError('domains'))}
              />
              <p className="text-[11px] text-fg-subtle">
                Bare hostnames, comma or newline separated. Matching is suffix-based, so
                <span className="font-mono"> acme.ai </span>
                also covers every subdomain.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm({ ...form, category: value as typeof form.category })}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="policy">Policy</Label>
                <Select
                  value={form.policy}
                  onValueChange={(value) => setForm({ ...form, policy: value as PolicyStatus })}
                >
                  <SelectTrigger id="policy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="unknown">Not assessed</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="weight">Risk weight</Label>
                <Input
                  id="weight"
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  value={form.riskWeight}
                  onChange={(event) => setForm({ ...form, riskWeight: Number(event.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="region">Processing region</Label>
                <Input
                  id="region"
                  value={form.dataRegion}
                  onChange={(event) => setForm({ ...form, dataRegion: event.target.value })}
                  placeholder="IN, US, EU, unknown"
                />
              </div>
              <label className="flex items-center gap-2 pb-2">
                <Switch
                  checked={form.trainsOnUserData}
                  onCheckedChange={(checked) => setForm({ ...form, trainsOnUserData: checked })}
                />
                <span className="text-xs text-fg-muted">Trains on submitted data</span>
              </label>
            </div>

            {error ? (
              <p role="alert" className="text-xs text-risk-critical">
                {error.message}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={createProvider.isPending}>
              Add to registry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
