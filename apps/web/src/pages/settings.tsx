import type { RiskSettingsDto, UpdateRiskSettingsRequest } from '@shadowscan/shared';
import { Info, Plus, RotateCcw, Save, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ErrorState, LoadingRows, PageHeader } from '@/components/layout-parts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { useRiskSettings, useUpdateRiskSettings } from '@/lib/queries';

// Risk engine tuning.
export function SettingsPage(): JSX.Element {
  const { isAdmin } = useAuth();
  const { data, isPending, isError, error, refetch } = useRiskSettings();
  const updateSettings = useUpdateRiskSettings();

  const [form, setForm] = useState<RiskSettingsDto | null>(null);
  const [keywordDraft, setKeywordDraft] = useState('');

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (isPending || !form) {
    return (
      <>
        <PageHeader title="Risk settings" />
        <LoadingRows rows={6} className="rounded-xl border border-line bg-surface" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Risk settings" />
        <Card>
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!form) return;

    const payload: UpdateRiskSettingsRequest = {
      unknownProviderWeight: form.unknownProviderWeight,
      blockedProviderMultiplier: form.blockedProviderMultiplier,
      sensitiveKeywordWeight: form.sensitiveKeywordWeight,
      sensitiveIdentifierWeight: form.sensitiveIdentifierWeight,
      offHoursWeight: form.offHoursWeight,
      offHoursStart: form.offHoursStart,
      offHoursEnd: form.offHoursEnd,
      confidentialKeywords: form.confidentialKeywords,
      actorSaturationScore: form.actorSaturationScore,
    };

    updateSettings.mutate(payload, {
      onSuccess: () => toast.success('Risk settings saved', { description: 'Applies to future ingestion.' }),
      onError: (caught) =>
        toast.error('Could not save', {
          description: caught instanceof ApiRequestError ? caught.message : 'Unexpected error.',
        }),
    });
  }

  function addKeyword(): void {
    const keyword = keywordDraft.trim().toLowerCase();
    if (!form) return;
    if (keyword.length < 3) {
      toast.error('Keywords must be at least 3 characters', {
        description: 'Shorter terms match inside unrelated words and flood the results.',
      });
      return;
    }
    if (form.confidentialKeywords.includes(keyword)) {
      setKeywordDraft('');
      return;
    }
    setForm({ ...form, confidentialKeywords: [...form.confidentialKeywords, keyword].sort() });
    setKeywordDraft('');
  }

  const disabled = !isAdmin;

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader
        title="Risk settings"
        description="applies to future ingestion only"
        actions={
          isAdmin ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => data && setForm(data)}>
                <RotateCcw />
                Revert
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={updateSettings.isPending}>
                <Save />
                Save changes
              </Button>
            </>
          ) : null
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-accent/25 bg-accent/5 px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <p className="text-xs leading-relaxed text-fg-muted">
          Changes apply to <span className="font-medium text-fg">future ingestion only</span>. Events already
          stored keep the score they were given, so a report generated last month still shows the numbers it
          was signed off with. To rescore historical data, delete the upload and ingest it again.
          {disabled ? ' Your account has read-only access to these settings.' : ''}
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Provider weights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <NumberField
              id="unknownProviderWeight"
              label="Unrecognised AI service"
              hint="Points for a host that matched a detection heuristic but is not in the registry. Highest single provider weight by design — an unassessed tool has no data-processing agreement behind it."
              value={form.unknownProviderWeight}
              min={0}
              max={50}
              step={0.5}
              disabled={disabled}
              onChange={(value) => setForm({ ...form, unknownProviderWeight: value })}
            />
            <NumberField
              id="blockedProviderMultiplier"
              label="Blocked-tool multiplier"
              hint="Applied to the provider's own weight when policy is 'blocked'. A multiplier rather than a flat bonus, so a blocked heavyweight still outranks a blocked lightweight."
              value={form.blockedProviderMultiplier}
              min={1}
              max={10}
              step={0.5}
              disabled={disabled}
              onChange={(value) => setForm({ ...form, blockedProviderMultiplier: value })}
            />
            <NumberField
              id="actorSaturationScore"
              label="Individual scoring curve constant"
              hint="Raw point total that maps to about 63 out of 100 on the individual scoring curve. Raise it if you ingest months of logs at a time; lower it for daily imports."
              value={form.actorSaturationScore}
              min={10}
              max={10000}
              step={10}
              disabled={disabled}
              onChange={(value) => setForm({ ...form, actorSaturationScore: value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content and timing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <NumberField
              id="sensitiveKeywordWeight"
              label="Per confidential keyword"
              hint="Points for each distinct keyword found in a prompt or query string."
              value={form.sensitiveKeywordWeight}
              min={0}
              max={100}
              step={1}
              disabled={disabled}
              onChange={(value) => setForm({ ...form, sensitiveKeywordWeight: value })}
            />
            <NumberField
              id="sensitiveIdentifierWeight"
              label="Per structured identifier"
              hint="Points for each class of identifier detected — email, card number, API key, Aadhaar. Lower than a keyword hit because regex matches carry more false positives."
              value={form.sensitiveIdentifierWeight}
              min={0}
              max={100}
              step={1}
              disabled={disabled}
              onChange={(value) => setForm({ ...form, sensitiveIdentifierWeight: value })}
            />
            <div className="grid grid-cols-3 gap-3">
              <NumberField
                id="offHoursWeight"
                label="Off-hours points"
                value={form.offHoursWeight}
                min={0}
                max={20}
                step={0.5}
                disabled={disabled}
                onChange={(value) => setForm({ ...form, offHoursWeight: value })}
              />
              <NumberField
                id="offHoursStart"
                label="From (hour)"
                value={form.offHoursStart}
                min={0}
                max={23}
                step={1}
                disabled={disabled}
                onChange={(value) => setForm({ ...form, offHoursStart: value })}
              />
              <NumberField
                id="offHoursEnd"
                label="To (hour)"
                value={form.offHoursEnd}
                min={0}
                max={23}
                step={1}
                disabled={disabled}
                onChange={(value) => setForm({ ...form, offHoursEnd: value })}
              />
            </div>
            <p className="text-[11px] text-fg-subtle">
              The window may wrap midnight — 21 to 6 means 21:00 through 05:59.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-3">
        <CardHeader>
          <CardTitle>Confidential keyword list</CardTitle>
          <p className="text-xs text-fg-subtle">
            Matched case-insensitively on word boundaries, so <span className="font-mono">nda</span> does not
            fire inside &ldquo;Rwanda&rdquo;. These are checked against URL query strings and any prompt column
            your log source provides.
          </p>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <div className="mb-3 flex gap-2">
              <Input
                value={keywordDraft}
                onChange={(event) => setKeywordDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="Add a term, e.g. board deck"
                className="max-w-xs"
                aria-label="New confidential keyword"
              />
              <Button size="sm" onClick={addKeyword}>
                <Plus />
                Add
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {form.confidentialKeywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-elevated py-1 pl-2.5 pr-1 text-xs text-fg-muted"
              >
                {keyword}
                {isAdmin ? (
                  <button
                    type="button"
                    aria-label={`Remove ${keyword}`}
                    className="rounded-full p-0.5 hover:bg-overlay hover:text-fg"
                    onClick={() =>
                      setForm({
                        ...form,
                        confidentialKeywords: form.confidentialKeywords.filter((item) => item !== keyword),
                      })
                    }
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-fg-subtle">
            {form.confidentialKeywords.length} of 200 terms.
          </p>
        </CardContent>
      </Card>
    </form>
  );
}

function NumberField({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}): JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="max-w-32"
      />
      {hint ? <p className="text-[11px] leading-relaxed text-fg-subtle">{hint}</p> : null}
    </div>
  );
}
