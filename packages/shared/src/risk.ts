import type { RiskBand } from './enums.js';

export const RISK_BAND_THRESHOLDS: ReadonlyArray<{ band: RiskBand; min: number }> = [
  { band: 'critical', min: 75 },
  { band: 'high', min: 50 },
  { band: 'medium', min: 25 },
  { band: 'low', min: 0 },
];
export function bandForScore(score: number): RiskBand {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(score) ? score : 0));
  for (const entry of RISK_BAND_THRESHOLDS) {
    if (clamped >= entry.min) return entry.band;
  }
  return 'low';
}

// Display ordering / severity comparison helper (0 = low, 3 = critical).
export function bandSeverity(band: RiskBand): number {
  return ['low', 'medium', 'high', 'critical'].indexOf(band);
}
