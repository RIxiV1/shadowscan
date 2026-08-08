// Default risk-engine tuning.
export const RISK_DEFAULTS = {
  // Points for a request to a host that matched no registry entry but did match a detection heuristic.
  unknownProviderWeight: 5,

  // Multiplier applied when the resolved policy is `blocked`.
  blockedProviderMultiplier: 2,
  sensitiveKeywordWeight: 10,

  /**
   * Points per distinct structured identifier class (email, card number, API key)
   * found. Lower than a keyword hit because regex identifier matches carry more
   * false positives than a curated keyword list.
   */
  sensitiveIdentifierWeight: 6,
  offHoursWeight: 1,
  offHoursStart: 21,
  offHoursEnd: 6,

  // Curated confidential-content vocabulary.
  confidentialKeywords: [
    'confidential',
    'proprietary',
    'internal only',
    'trade secret',
    'nda',
    'non-disclosure',
    'unreleased',
    'salary',
    'payroll',
    'appraisal',
    'termination letter',
    'patient',
    'diagnosis',
    'medical record',
    'aadhaar',
    'pan card',
    'passport number',
    'customer list',
    'source code',
    'private key',
    'api key',
    'credentials',
    'password',
    'merger',
    'acquisition',
    'due diligence',
    'earnings',
    'board deck',
    'roadmap',
    'litigation',
    'legal hold',
  ],
  actorSaturationScore: 500,
} as const;

export type RiskDefaults = typeof RISK_DEFAULTS;
