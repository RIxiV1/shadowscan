import type { PolicyStatus, RiskBand } from '@shadowscan/shared';

// RECOMMENDATION ENGINE Deterministic rules over the report summary.

export interface Recommendation {
  severity: RiskBand;
  title: string;
  detail: string;
}

export interface RecommendationInput {
  aiRequests: number;
  shadowAiRequests: number;
  approvedRequests: number;
  sensitiveHits: number;
  uniqueActors: number;
  uniqueProviders: number;
  providers: Array<{
    key: string;
    name: string;
    requests: number;
    policy: PolicyStatus;
    dataRegion: string;
    trainsOnUserData: boolean;
    isHeuristic: boolean;
  }>;
  actors: Array<{ actor: string; score: number; band: RiskBand }>;
}

const ELEVATED_REGIONS = new Set(['CN', 'RU', 'IR', 'KP']);

export function buildRecommendations(input: RecommendationInput): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (input.aiRequests === 0) {
    return [
      {
        severity: 'low',
        title: 'No AI activity detected in this period',
        detail:
          'No request in the uploaded logs resolved to a known or suspected AI service. Confirm that the export covers outbound web traffic and that the period is correct before concluding that AI use is absent — the most common cause of a clean result is an incomplete log source.',
      },
    ];
  }

  // ------------------------------------------------- unmanaged AI exposure ---
  const shadowRatio = input.shadowAiRequests / input.aiRequests;
  if (shadowRatio >= 0.6) {
    recommendations.push({
      severity: 'critical',
      title: `${percent(shadowRatio)} of AI usage is outside governance`,
      detail: `${input.shadowAiRequests.toLocaleString()} of ${input.aiRequests.toLocaleString()} AI requests went to tools that are blocked or have never been assessed. Publish an approved-tool list and route staff to it before enforcing blocks — enforcement without a sanctioned alternative moves the traffic to personal devices, where you cannot see it at all.`,
    });
  } else if (shadowRatio >= 0.3) {
    recommendations.push({
      severity: 'high',
      title: `${percent(shadowRatio)} of AI usage is unsanctioned`,
      detail: `A significant minority of AI traffic is outside policy. Triage the unassessed tools in the inventory below: approve the ones with an acceptable data-processing agreement, block the rest, and leave nothing in "unknown".`,
    });
  }

  const blockedInUse = input.providers.filter(
    (provider) => provider.policy === 'blocked' && provider.requests > 0,
  );
  if (blockedInUse.length > 0) {
    const total = blockedInUse.reduce((sum, provider) => sum + provider.requests, 0);
    recommendations.push({
      severity: 'critical',
      title: 'Explicitly blocked AI tools are still reachable',
      detail: `${total.toLocaleString()} requests reached ${listNames(blockedInUse)} despite a block policy. A policy that is recorded but not enforced at the network or endpoint layer provides documentation, not control. Push these domains to your DNS filter, secure web gateway or endpoint agent, then re-run this report to confirm the traffic has stopped.`,
    });
  }

  // --------------------------------------------------- confidential content ---
  if (input.sensitiveHits > 0) {
    const rate = input.sensitiveHits / input.aiRequests;
    recommendations.push({
      severity: rate >= 0.05 ? 'critical' : 'high',
      title: `${input.sensitiveHits.toLocaleString()} requests carried confidential or regulated content`,
      detail:
        'Content matching confidential keywords or structured identifiers (email addresses, card numbers, API keys) was submitted to AI services. Treat each as a potential disclosure: identify the specific data, determine whether the destination vendor retains it, and check whether the disclosure is notifiable under the DPDP Act or GDPR. Deploy a DLP rule on these destinations as the compensating control.',
    });
  }

  const crossBorder = input.providers.filter(
    (provider) => ELEVATED_REGIONS.has(provider.dataRegion) && provider.requests > 0,
  );
  if (crossBorder.length > 0) {
    recommendations.push({
      severity: 'high',
      title: 'Data is being transferred to elevated-risk jurisdictions',
      detail: `${listNames(crossBorder)} process submitted content in jurisdictions with compelled-disclosure regimes and no adequacy finding. Where a business need exists, replace them with a regionally hosted equivalent; where it does not, block them.`,
    });
  }

  // ------------------------------------------------------- training on data ---
  const trainsOnData = input.providers.filter(
    (provider) => provider.trainsOnUserData && provider.policy !== 'blocked' && provider.requests > 0,
  );
  if (trainsOnData.length > 0) {
    recommendations.push({
      severity: 'medium',
      title: 'Approved tools are training on submitted content',
      detail: `${listNames(trainsOnData)} use submitted content for model improvement on their default tier. Anything pasted into them may surface in a future model. Move these to an enterprise or team plan where training is contractually excluded, or add a banner reminding staff not to submit proprietary material.`,
    });
  }

  // --------------------------------------------------- uncatalogued tooling ---
  const heuristicOnly = input.providers.filter(
    (provider) => provider.isHeuristic && provider.requests > 0,
  );
  if (heuristicOnly.length > 0) {
    recommendations.push({
      severity: 'medium',
      title: `${heuristicOnly.length} unrecognised AI service${heuristicOnly.length === 1 ? '' : 's'} detected`,
      detail: `${listNames(heuristicOnly)} matched AI detection heuristics but are not in the registry. Review each one and either add it with an explicit policy or add it to the heuristic allowlist if it is a false positive. Leaving them undecided means the next report will raise the same finding.`,
    });
  }

  // ------------------------------------------------------ risk concentration ---
  const criticalActors = input.actors.filter((actor) => actor.band === 'critical');
  const highActors = input.actors.filter((actor) => actor.band === 'high');
  if (criticalActors.length > 0) {
    recommendations.push({
      severity: 'high',
      title: `${criticalActors.length} individual${criticalActors.length === 1 ? '' : 's'} at critical risk`,
      detail: `Risk is concentrated rather than diffuse, which usually means a specific team has an unmet tooling need rather than a discipline problem. Start with a conversation about what they are trying to do; a targeted approved tool resolves this faster than a warning does. Individuals: ${input.actors
        .filter((actor) => actor.band === 'critical')
        .slice(0, 5)
        .map((actor) => actor.actor)
        .join(', ')}.`,
    });
  } else if (highActors.length >= 3) {
    recommendations.push({
      severity: 'medium',
      title: `${highActors.length} individuals in the high-risk band`,
      detail:
        'Several people are driving a disproportionate share of unmanaged AI usage. Run targeted awareness training with these teams rather than an organisation-wide broadcast.',
    });
  }

  // ------------------------------------------------------ coverage hygiene ---
  if (input.approvedRequests === 0 && input.aiRequests > 0) {
    recommendations.push({
      severity: 'medium',
      title: 'No approved AI tool is in use',
      detail:
        'Every detected request went to an unassessed or blocked service, which means staff have no sanctioned option. Approving one general-purpose assistant with an enterprise agreement is the single highest-leverage action available: it converts shadow usage into governed usage without a fight.',
    });
  }

  if (input.uniqueProviders >= 8) {
    recommendations.push({
      severity: 'medium',
      title: `${input.uniqueProviders} distinct AI services in use`,
      detail:
        'Tool sprawl multiplies your vendor-assessment burden and your breach-notification surface. Consolidate onto a shorter approved list; each removed vendor is one fewer data-processing agreement to maintain and one fewer party to notify after an incident.',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      severity: 'low',
      title: 'AI usage is within policy for this period',
      detail:
        'All detected AI activity went to approved tools with no confidential content flagged. Keep the registry current — the tools staff adopt change faster than most policies do — and re-run this report monthly.',
    });
  }

  const order: Record<RiskBand, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return recommendations.sort((a, b) => order[a.severity] - order[b.severity]);
}

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function listNames(providers: Array<{ name: string }>): string {
  const names = providers.slice(0, 4).map((provider) => provider.name);
  const remainder = providers.length - names.length;
  const joined =
    names.length <= 1
      ? (names[0] ?? 'this service')
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return remainder > 0 ? `${joined} (+${remainder} more)` : joined;
}
