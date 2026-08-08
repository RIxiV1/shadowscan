import { createHash } from 'node:crypto';
import type { PolicyStatus, ProviderCategory, RiskBand, RiskFactor, SensitiveClass } from '@shadowscan/shared';
import type { ProviderIndex } from './detector.js';
import { findConfidentialKeywords, inspectContent } from './redaction.js';
import { scoreEvent, type RiskWeights } from './risk.js';
import { decodeQueryText, normaliseUrl } from './url.js';
import type { RawRecord } from './parsers/types.js';

// INGESTION PIPELINE raw record -> normalise URL -> detect provider -> inspect content -> score -> redacted, scored event

export interface ScoredEvent {
  actor: string;
  actorHash: string;
  host: string;
  path: string;
  occurredAt: Date;
  providerId: string | null;
  providerKey: string | null;
  providerName: string | null;
  providerCategory: ProviderCategory | null;
  detectionSource: string;
  policy: PolicyStatus;
  riskScore: number;
  riskBand: RiskBand;
  riskFactors: RiskFactor[];
  sensitiveHits: Array<{ class: SensitiveClass; count: number }>;
}

export interface IngestOptions {
  index: ProviderIndex;
  weights: RiskWeights;
  confidentialKeywords: readonly string[];
  // Applied to rows whose source carried no parseable timestamp.
  fallbackTimestamp: Date;
}

export interface IngestOutcome {
  events: ScoredEvent[];
  // Rows that yielded a valid destination, AI or not.
  rowsParsed: number;
  rowsRejected: number;
  aiRequests: number;
  shadowAiRequests: number;
  approvedRequests: number;
}

export function ingestRecords(records: readonly RawRecord[], options: IngestOptions): IngestOutcome {
  const events: ScoredEvent[] = [];
  let rowsParsed = 0;
  let rowsRejected = 0;
  let shadowAiRequests = 0;
  let approvedRequests = 0;

  for (const record of records) {
    const url = normaliseUrl(record.url);
    if (!url) {
      rowsRejected += 1;
      continue;
    }
    rowsParsed += 1;

    const detection = options.index.detect(url.host, url.path);
    if (!detection.matched) continue;

    const occurredAt = record.occurredAt ?? options.fallbackTimestamp;
    const inspectable = [decodeQueryText(url.query), record.content]
      .filter(Boolean)
      .join(' ')
      .slice(0, 8192);

    const inspection = inspectContent(inspectable);
    const keywordMatches = findConfidentialKeywords(
      inspection.redacted,
      options.confidentialKeywords,
    );

    const scored = scoreEvent(
      {
        provider: detection.provider,
        policy: detection.policy,
        hourOfDay: occurredAt.getHours(),
        keywordMatches,
        identifierFindings: inspection.findings,
      },
      options.weights,
    );

    const sensitiveHits: Array<{ class: SensitiveClass; count: number }> = [
      ...inspection.findings.map((finding) => ({ class: finding.class, count: finding.count })),
    ];
    if (keywordMatches.length > 0) {
      sensitiveHits.push({ class: 'keyword', count: new Set(keywordMatches).size });
    }

    const actor = normaliseActor(record.actor);

    events.push({
      actor,
      actorHash: hashActor(actor),
      host: url.host,
      // The path is kept but the query string is not: it has already been
      // scanned, and it is the part most likely to contain the prompt itself.
      path: url.path,
      occurredAt,
      providerId: detection.provider?.id ?? null,
      providerKey: detection.provider?.key ?? null,
      providerName: detection.provider?.name ?? null,
      providerCategory: detection.provider?.category ?? null,
      detectionSource: detection.source,
      policy: detection.policy,
      riskScore: scored.score,
      riskBand: scored.band,
      riskFactors: scored.factors,
      sensitiveHits,
    });

    if (detection.policy === 'approved') approvedRequests += 1;
    else shadowAiRequests += 1;
  }

  return {
    events,
    rowsParsed,
    rowsRejected,
    aiRequests: events.length,
    shadowAiRequests,
    approvedRequests,
  };
}

/**
 * Reduces an actor value to a stable, low-cardinality label.
 *
 * Email addresses collapse to the local part: `priya.sharma@acme.com` and
 * `priya.sharma@acme.co.in` are the same person in almost every export, and the
 * domain adds no investigative value while widening the amount of PII stored.
 */
export function normaliseActor(raw: string): string {
  const trimmed = raw?.trim();
  if (!trimmed) return 'unattributed';

  const withoutDomain = trimmed.includes('@') ? (trimmed.split('@')[0] ?? trimmed) : trimmed;
  // Strip a Windows domain prefix: `CORP\priya` -> `priya`.
  const withoutRealm = withoutDomain.includes('\\')
    ? (withoutDomain.split('\\').pop() ?? withoutDomain)
    : withoutDomain;

  return withoutRealm.toLowerCase().slice(0, 190) || 'unattributed';
}

// Stable pseudonym for grouping.
export function hashActor(actor: string): string {
  return createHash('sha256').update(actor).digest('hex');
}
