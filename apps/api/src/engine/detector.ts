import type { PolicyStatus, ProviderCategory } from '@shadowscan/shared';
import { HEURISTIC_ALLOWLIST, HEURISTIC_RULES } from '../config/ai-providers.js';
import { domainSuffixes } from './url.js';

// DETECTION ENGINE Two-stage classification, deliberately in this order: 1.

export interface IndexedProvider {
  id: string;
  key: string;
  name: string;
  vendor: string;
  category: ProviderCategory;
  domains: string[];
  riskWeight: number;
  policy: PolicyStatus;
  dataRegion: string;
  trainsOnUserData: boolean;
}

export interface Detection {
  matched: true;
  provider: IndexedProvider | null;
  // `registry` for a catalogued provider, otherwise the heuristic rule id.
  source: string;
  policy: PolicyStatus;
}

export interface NoDetection {
  matched: false;
}

export type DetectionResult = Detection | NoDetection;

export class ProviderIndex {
  private readonly byDomain = new Map<string, IndexedProvider>();
  private readonly allowlist: Set<string>;

  constructor(providers: readonly IndexedProvider[]) {
    for (const provider of providers) {
      for (const domain of provider.domains) {
        const normalised = domain.trim().toLowerCase().replace(/^www\./, '');
        if (!normalised) continue;
        // First writer wins. A duplicate domain across two providers is a data
        // error; silently preferring the earlier entry keeps ingestion
        // deterministic instead of depending on document order.
        if (!this.byDomain.has(normalised)) this.byDomain.set(normalised, provider);
      }
    }
    this.allowlist = new Set(HEURISTIC_ALLOWLIST.map((host) => host.toLowerCase()));
  }

  // Number of distinct domains indexed.
  get size(): number {
    return this.byDomain.size;
  }

  // Classifies a hostname.
  detect(host: string, path: string): DetectionResult {
    for (const suffix of domainSuffixes(host)) {
      const provider = this.byDomain.get(suffix);
      if (provider) {
        return { matched: true, provider, source: 'registry', policy: provider.policy };
      }
    }

    if (this.allowlist.has(host)) return { matched: false };

    for (const rule of HEURISTIC_RULES) {
      if (!rule.hostPattern.test(host)) continue;
      if (rule.pathPattern && !rule.pathPattern.test(path.toLowerCase())) continue;
      return { matched: true, provider: null, source: rule.id, policy: 'unknown' };
    }

    return { matched: false };
  }
}

export function buildProviderIndex(providers: readonly IndexedProvider[]): ProviderIndex {
  return new ProviderIndex(providers);
}
