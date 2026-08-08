import { bandForScore, type PolicyStatus, type RiskBand, type RiskFactor } from '@shadowscan/shared';
import type { ContentFinding } from './redaction.js';
import type { IndexedProvider } from './detector.js';

// Scoring happens at three levels: per event, per person, per org.
// Event scores are additive so we can show an analyst where every point came
// from. The other two normalise, otherwise the numbers just track volume.

// Raw event score that counts as "as bad as it gets" when picking a band.
// Tuned so an approved tool is low, an unassessed one medium, a blocked one
// high, and anything with confidential content in it critical.
export const EVENT_SATURATION_SCORE = 20;

const ELEVATED_DATA_REGIONS = new Set(['CN', 'RU', 'IR', 'KP', 'unknown']);

export interface RiskWeights {
  unknownProviderWeight: number;
  blockedProviderMultiplier: number;
  sensitiveKeywordWeight: number;
  sensitiveIdentifierWeight: number;
  offHoursWeight: number;
  offHoursStart: number;
  offHoursEnd: number;
  actorSaturationScore: number;
}

export interface EventScoreInput {
  /** `null` when the host matched a heuristic rather than the registry. */
  provider: IndexedProvider | null;
  policy: PolicyStatus;
  /** Local hour of day (0-23) the request occurred at. */
  hourOfDay: number;
  /** Confidential terms found in the prompt or query string. */
  keywordMatches: string[];
  /** Structured identifier classes found by the redaction pass. */
  identifierFindings: ContentFinding[];
}

export interface EventScore {
  /** Unbounded additive points. Stored on the event. */
  score: number;
  band: RiskBand;
  factors: RiskFactor[];
}

export function scoreEvent(input: EventScoreInput, weights: RiskWeights): EventScore {
  const factors: RiskFactor[] = [];

  /* ---------------------------------------------------- provider baseline --- */
  const base = input.provider ? input.provider.riskWeight : weights.unknownProviderWeight;
  factors.push({
    kind: 'provider-base',
    label: input.provider
      ? `${input.provider.name} base weight`
      : 'Unrecognised AI service (no vendor assessment on file)',
    points: base,
  });

  /* ------------------------------------------------------ policy posture --- */
  if (input.policy === 'blocked') {
    // Multiply rather than add a flat bonus, so a blocked heavyweight still
    // outranks a blocked lightweight.
    const uplift = base * (weights.blockedProviderMultiplier - 1);
    if (uplift > 0) {
      factors.push({
        kind: 'policy-blocked',
        label: `Policy violation — this tool is explicitly blocked (x${weights.blockedProviderMultiplier})`,
        points: round1(uplift),
      });
    }
  } else if (input.policy === 'unknown' && input.provider) {
    factors.push({
      kind: 'policy-unknown',
      label: 'Tool is in the registry but has not been approved or blocked',
      points: 1,
    });
  }

  /* ------------------------------------------------------ data residency --- */
  if (input.provider && ELEVATED_DATA_REGIONS.has(input.provider.dataRegion)) {
    factors.push({
      kind: 'data-residency',
      label:
        input.provider.dataRegion === 'unknown'
          ? 'Processing jurisdiction is undisclosed'
          : `Cross-border transfer to ${input.provider.dataRegion}`,
      points: 2,
    });
  }

  /* --------------------------------------------------- sensitive content --- */
  if (input.keywordMatches.length > 0) {
    const unique = Array.from(new Set(input.keywordMatches));
    factors.push({
      kind: 'sensitive-content',
      label: `Confidential terms in submitted content: ${unique.slice(0, 5).join(', ')}`,
      points: unique.length * weights.sensitiveKeywordWeight,
    });
  }

  if (input.identifierFindings.length > 0) {
    const classes = input.identifierFindings.map((finding) => finding.class);
    factors.push({
      kind: 'sensitive-content',
      label: `Structured identifiers detected: ${classes.join(', ')}`,
      points: classes.length * weights.sensitiveIdentifierWeight,
    });
  }

  /* -------------------------------------------------------------- timing --- */
  if (weights.offHoursWeight > 0 && isOffHours(input.hourOfDay, weights)) {
    factors.push({
      kind: 'off-hours',
      label: 'Activity outside configured working hours',
      points: weights.offHoursWeight,
    });
  }

  const score = round1(factors.reduce((sum, factor) => sum + factor.points, 0));
  const band = bandForScore((score / EVENT_SATURATION_SCORE) * 100);

  return { score, band, factors };
}

/** Handles windows that wrap midnight (e.g. 21:00 -> 06:00). */
export function isOffHours(hour: number, weights: Pick<RiskWeights, 'offHoursStart' | 'offHoursEnd'>): boolean {
  const { offHoursStart: start, offHoursEnd: end } = weights;
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

/* ------------------------------------------------------------- actor level --- */

export interface ActorScore {
  score: number;
  band: RiskBand;
}

// 100 * (1 - e^(-raw/k)).
//
// Started out as a ratio with a min(100, ...) clamp. Looked fine until we ran it
// over a month of real logs and every person came out at 100/critical, so the
// table that's meant to tell you who to talk to first was ranking nobody. The
// curve keeps the ordering all the way up.
//
// k is the raw total that lands on ~63. Bigger window, bigger k.
export function scoreActor(rawTotal: number, weights: Pick<RiskWeights, 'actorSaturationScore'>): ActorScore {
  const k = Math.max(1, weights.actorSaturationScore);
  const score = Math.round(100 * (1 - Math.exp(-Math.max(0, rawTotal) / k)));
  return { score, band: bandForScore(score) };
}

/* ---------------------------------------------------------------- org level --- */

export interface OrgScoreInput {
  aiRequests: number;
  shadowAiRequests: number;
  sensitiveHits: number;
  /** Normalised 0-100 scores of the highest-risk individuals. */
  topActorScores: number[];
}

// Org posture 0-100. Ratios not totals, so a 20-person startup and a 2000-person
// company are on the same scale. Weights: 40% how much AI use is ungoverned,
// 35% how often it carries regulated content, 25% how concentrated the risk is.
// The sensitive rate maxes out at 20% of requests. One in five requests leaking
// identifiers is already a disaster, no need for the scale to go further.
export function scoreOrg(input: OrgScoreInput): { score: number; band: RiskBand } {
  if (input.aiRequests <= 0) return { score: 0, band: 'low' };

  const shadowRatio = clamp01(input.shadowAiRequests / input.aiRequests);
  const sensitiveRate = clamp01((input.sensitiveHits / input.aiRequests) * 5);

  const actorPressure =
    input.topActorScores.length === 0
      ? 0
      : clamp01(
          input.topActorScores.slice(0, 5).reduce((sum, value) => sum + value, 0) /
            (Math.min(5, input.topActorScores.length) * 100),
        );

  const score = Math.round(100 * (0.4 * shadowRatio + 0.35 * sensitiveRate + 0.25 * actorPressure));
  return { score, band: bandForScore(score) };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
