import type {
  DashboardSummary,
  PolicyStatus,
  ProviderCategory,
  RiskBand,
} from '@shadowscan/shared';
import { buildRecommendations, type Recommendation } from '../../engine/recommendations.js';
import { scoreActor, scoreOrg } from '../../engine/risk.js';
import { Provider } from '../../models/Provider.js';
import { AiEvent } from '../../models/AiEvent.js';
import { getRiskSettings } from '../../models/RiskSettings.js';
import { Upload } from '../../models/Upload.js';

// ANALYTICS Every dashboard number comes from a single `$facet` aggregation.
export const UNCLASSIFIED_KEY = 'unclassified-ai';

export const UNCLASSIFIED_NAME = 'Unrecognised AI service';

export interface Window {
  from: Date;
  to: Date;
  days: number;
}

export function resolveWindow(days: number, reference = new Date()): Window {
  const to = new Date(reference);
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to, days };
}

interface FacetResult {
  totals: Array<{
    aiRequests: number;
    shadowAiRequests: number;
    approvedRequests: number;
    sensitiveHits: number;
    uniqueActors: number;
  }>;
  byTool: Array<{
    _id: { key: string | null; name: string | null; policy: PolicyStatus; category: ProviderCategory | null };
    requests: number;
  }>;
  byCategory: Array<{ _id: ProviderCategory | null; requests: number }>;
  byPolicy: Array<{ _id: PolicyStatus; requests: number }>;
  daily: Array<{ _id: string; aiRequests: number; shadowAiRequests: number; approvedRequests: number }>;
  byActor: Array<{
    _id: string;
    requests: number;
    shadowRequests: number;
    sensitiveHits: number;
    rawScore: number;
  }>;
  uniqueProviders: Array<{ count: number }>;
}

const EMPTY_FACET: FacetResult = {
  totals: [],
  byTool: [],
  byCategory: [],
  byPolicy: [],
  daily: [],
  byActor: [],
  uniqueProviders: [],
};

async function runFacet(window: Window): Promise<FacetResult> {
  const [result] = await AiEvent.aggregate<FacetResult>([
    { $match: { occurredAt: { $gte: window.from, $lte: window.to } } },
    {
      // Computed once and reused by four sub-pipelines. `sensitiveHits` is an
      // array of {class, count}; summing it here avoids repeating the reduce.
      $addFields: {
        sensitiveCount: { $sum: '$sensitiveHits.count' },
        isShadow: { $cond: [{ $eq: ['$policy', 'approved'] }, 0, 1] },
        isApproved: { $cond: [{ $eq: ['$policy', 'approved'] }, 1, 0] },
      },
    },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              aiRequests: { $sum: 1 },
              shadowAiRequests: { $sum: '$isShadow' },
              approvedRequests: { $sum: '$isApproved' },
              sensitiveHits: { $sum: { $cond: [{ $gt: ['$sensitiveCount', 0] }, 1, 0] } },
              actors: { $addToSet: '$actorHash' },
            },
          },
          {
            $project: {
              _id: 0,
              aiRequests: 1,
              shadowAiRequests: 1,
              approvedRequests: 1,
              sensitiveHits: 1,
              uniqueActors: { $size: '$actors' },
            },
          },
        ],
        byTool: [
          {
            $group: {
              _id: {
                key: '$providerKey',
                name: '$providerName',
                policy: '$policy',
                category: '$providerCategory',
              },
              requests: { $sum: 1 },
            },
          },
          { $sort: { requests: -1 } },
          { $limit: 12 },
        ],
        byCategory: [
          { $group: { _id: '$providerCategory', requests: { $sum: 1 } } },
          { $sort: { requests: -1 } },
        ],
        byPolicy: [{ $group: { _id: '$policy', requests: { $sum: 1 } } }],
        daily: [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt', timezone: 'UTC' } },
              aiRequests: { $sum: 1 },
              shadowAiRequests: { $sum: '$isShadow' },
              approvedRequests: { $sum: '$isApproved' },
            },
          },
          { $sort: { _id: 1 } },
        ],
        byActor: [
          {
            $group: {
              _id: '$actor',
              requests: { $sum: 1 },
              shadowRequests: { $sum: '$isShadow' },
              sensitiveHits: { $sum: '$sensitiveCount' },
              rawScore: { $sum: '$riskScore' },
            },
          },
          { $sort: { rawScore: -1 } },
          { $limit: 10 },
        ],
        uniqueProviders: [
          { $group: { _id: '$providerKey' } },
          { $count: 'count' },
        ],
      },
    },
  ]);

  return result ?? EMPTY_FACET;
}

export interface Snapshot {
  window: Window;
  aiRequests: number;
  shadowAiRequests: number;
  approvedRequests: number;
  sensitiveHits: number;
  uniqueActors: number;
  uniqueProviders: number;
  usageByTool: Array<{
    key: string;
    name: string;
    requests: number;
    policy: PolicyStatus;
    category: ProviderCategory;
  }>;
  usageByCategory: Array<{ category: ProviderCategory; requests: number }>;
  policyBreakdown: Array<{ policy: PolicyStatus; requests: number }>;
  dailyUsage: Array<{
    date: string;
    aiRequests: number;
    shadowAiRequests: number;
    approvedRequests: number;
  }>;
  highRiskActors: Array<{
    actor: string;
    requests: number;
    shadowRequests: number;
    sensitiveHits: number;
    score: number;
    band: RiskBand;
  }>;
  riskScore: number;
  riskBand: RiskBand;
}

export async function buildSnapshot(window: Window): Promise<Snapshot> {
  const [facet, settings] = await Promise.all([runFacet(window), getRiskSettings()]);

  const totals = facet.totals[0] ?? {
    aiRequests: 0,
    shadowAiRequests: 0,
    approvedRequests: 0,
    sensitiveHits: 0,
    uniqueActors: 0,
  };

  const highRiskActors = facet.byActor.map((entry) => {
    const { score, band } = scoreActor(entry.rawScore, settings);
    return {
      actor: entry._id,
      requests: entry.requests,
      shadowRequests: entry.shadowRequests,
      sensitiveHits: entry.sensitiveHits,
      score,
      band,
    };
  });

  const org = scoreOrg({
    aiRequests: totals.aiRequests,
    shadowAiRequests: totals.shadowAiRequests,
    sensitiveHits: totals.sensitiveHits,
    topActorScores: highRiskActors.map((actor) => actor.score),
  });

  return {
    window,
    aiRequests: totals.aiRequests,
    shadowAiRequests: totals.shadowAiRequests,
    approvedRequests: totals.approvedRequests,
    sensitiveHits: totals.sensitiveHits,
    uniqueActors: totals.uniqueActors,
    uniqueProviders: facet.uniqueProviders[0]?.count ?? 0,
    usageByTool: facet.byTool.map((entry) => ({
      key: entry._id.key ?? UNCLASSIFIED_KEY,
      name: entry._id.name ?? UNCLASSIFIED_NAME,
      requests: entry.requests,
      policy: entry._id.policy,
      category: entry._id.category ?? 'other',
    })),
    usageByCategory: facet.byCategory.map((entry) => ({
      category: entry._id ?? 'other',
      requests: entry.requests,
    })),
    policyBreakdown: facet.byPolicy.map((entry) => ({
      policy: entry._id,
      requests: entry.requests,
    })),
    dailyUsage: fillDailyGaps(facet.daily, window),
    highRiskActors,
    riskScore: org.score,
    riskBand: org.band,
  };
}

/**
 * Runs the recommendation rules over a snapshot.
 *
 * Lives here rather than in the reports module because both the dashboard and the
 * PDF need it, and they must never disagree - a finding shown on screen has to be
 * the same finding that lands in the report.
 *
 * The extra query is unavoidable: the rules need vendor attributes (jurisdiction,
 * training posture) that events do not carry. Keyed on the tools that actually
 * appeared rather than loading the whole registry.
 */
export async function buildFindings(snapshot: Snapshot): Promise<Recommendation[]> {
  const keys = snapshot.usageByTool.map((tool) => tool.key).filter((key) => key !== UNCLASSIFIED_KEY);

  const docs = await Provider.find({ key: { $in: keys } })
    .select('key dataRegion trainsOnUserData')
    .lean();
  const metadata = new Map(docs.map((doc) => [doc.key, doc]));

  return buildRecommendations({
    aiRequests: snapshot.aiRequests,
    shadowAiRequests: snapshot.shadowAiRequests,
    approvedRequests: snapshot.approvedRequests,
    sensitiveHits: snapshot.sensitiveHits,
    uniqueActors: snapshot.uniqueActors,
    uniqueProviders: snapshot.uniqueProviders,
    providers: snapshot.usageByTool.map((tool) => ({
      key: tool.key,
      name: tool.name,
      requests: tool.requests,
      policy: tool.policy,
      dataRegion: metadata.get(tool.key)?.dataRegion ?? 'unknown',
      trainsOnUserData: metadata.get(tool.key)?.trainsOnUserData ?? false,
      isHeuristic: tool.key === UNCLASSIFIED_KEY,
    })),
    actors: snapshot.highRiskActors.map((actor) => ({
      actor: actor.actor,
      score: actor.score,
      band: actor.band,
    })),
  });
}

export async function buildDashboard(days: number): Promise<DashboardSummary> {
  const window = resolveWindow(days);
  const previous = {
    from: new Date(window.from.getTime() - days * 24 * 60 * 60 * 1000),
    to: window.from,
    days,
  };

  const [current, prior, uploadStats] = await Promise.all([
    buildSnapshot(window),
    buildSnapshot(previous),
    Upload.aggregate<{ uploads: number; totalEvents: number }>([
      { $match: { createdAt: { $gte: window.from, $lte: window.to }, status: 'completed' } },
      { $group: { _id: null, uploads: { $sum: 1 }, totalEvents: { $sum: '$rowsParsed' } } },
      { $project: { _id: 0, uploads: 1, totalEvents: 1 } },
    ]),
  ]);

  const uploads = uploadStats[0] ?? { uploads: 0, totalEvents: 0 };

  // Sequential rather than in the Promise.all above because it needs the snapshot.
  const findings = await buildFindings(current);

  return {
    window: { from: window.from.toISOString(), to: window.to.toISOString(), days },
    cards: {
      uploads: uploads.uploads,
      totalEvents: uploads.totalEvents,
      aiRequests: current.aiRequests,
      shadowAiRequests: current.shadowAiRequests,
      approvedRequests: current.approvedRequests,
      sensitiveHits: current.sensitiveHits,
      riskScore: current.riskScore,
      riskBand: current.riskBand,
    },
    trends: {
      aiRequests: percentChange(prior.aiRequests, current.aiRequests),
      shadowAiRequests: percentChange(prior.shadowAiRequests, current.shadowAiRequests),
      riskScore: percentChange(prior.riskScore, current.riskScore),
    },
    usageByTool: current.usageByTool,
    usageByCategory: current.usageByCategory,
    dailyUsage: current.dailyUsage,
    policyBreakdown: current.policyBreakdown,
    findings,
    highRiskActors: current.highRiskActors,
  };
}

// Returns `null` rather than 0 or Infinity when the prior period had no activity.
function percentChange(before: number, after: number): number | null {
  if (before === 0) return null;
  return Math.round(((after - before) / before) * 100);
}

// Inserts zero rows for days with no activity.
function fillDailyGaps(
  rows: Array<{ _id: string; aiRequests: number; shadowAiRequests: number; approvedRequests: number }>,
  window: Window,
): Snapshot['dailyUsage'] {
  const byDate = new Map(rows.map((row) => [row._id, row]));
  const output: Snapshot['dailyUsage'] = [];

  const cursor = new Date(
    Date.UTC(window.from.getUTCFullYear(), window.from.getUTCMonth(), window.from.getUTCDate()),
  );

  const end = Date.UTC(window.to.getUTCFullYear(), window.to.getUTCMonth(), window.to.getUTCDate());

  // Hard stop at 400 iterations: the window is validated to 365 days upstream,
  // and an unbounded `while` over a date cursor is a hang waiting to happen.
  for (let guard = 0; cursor.getTime() <= end && guard < 400; guard += 1) {
    const key = cursor.toISOString().slice(0, 10);
    const row = byDate.get(key);
    output.push({
      date: key,
      aiRequests: row?.aiRequests ?? 0,
      shadowAiRequests: row?.shadowAiRequests ?? 0,
      approvedRequests: row?.approvedRequests ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return output;
}
