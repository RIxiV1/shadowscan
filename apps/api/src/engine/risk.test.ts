import { describe, expect, it } from 'vitest';
import { RISK_DEFAULTS } from '../config/risk-defaults.js';
import type { IndexedProvider } from './detector.js';
import { isOffHours, scoreActor, scoreEvent, scoreOrg, type RiskWeights } from './risk.js';

const weights: RiskWeights = { ...RISK_DEFAULTS };

const chatgpt: IndexedProvider = {
  id: '1',
  key: 'openai-chatgpt',
  name: 'ChatGPT',
  vendor: 'OpenAI',
  category: 'assistant',
  domains: ['chatgpt.com'],
  riskWeight: 2,
  policy: 'unknown',
  dataRegion: 'US',
  trainsOnUserData: true,
};

const deepseek: IndexedProvider = {
  ...chatgpt,
  id: '2',
  key: 'deepseek',
  name: 'DeepSeek',
  riskWeight: 3,
  policy: 'blocked',
  dataRegion: 'CN',
};

describe('scoreEvent', () => {
  it('scores an approved mainstream tool as low risk', () => {
    const result = scoreEvent(
      {
        provider: { ...chatgpt, policy: 'approved' },
        policy: 'approved',
        hourOfDay: 14,
        keywordMatches: [],
        identifierFindings: [],
      },
      weights,
    );
    expect(result.score).toBe(2);
    expect(result.band).toBe('low');
  });

  it('applies the unknown-provider weight when nothing matched the registry', () => {
    const result = scoreEvent(
      { provider: null, policy: 'unknown', hourOfDay: 14, keywordMatches: [], identifierFindings: [] },
      weights,
    );
    expect(result.score).toBe(weights.unknownProviderWeight);
    expect(result.band).toBe('medium');
  });

  it('multiplies rather than adds for a blocked tool, preserving provider ordering', () => {
    const heavy = scoreEvent(
      { provider: deepseek, policy: 'blocked', hourOfDay: 14, keywordMatches: [], identifierFindings: [] },
      weights,
    );

    const light = scoreEvent(
      {
        provider: { ...chatgpt, policy: 'blocked' },
        policy: 'blocked',
        hourOfDay: 14,
        keywordMatches: [],
        identifierFindings: [],
      },
      weights,
    );
    expect(heavy.score).toBeGreaterThan(light.score);
  });

  it('adds a cross-border factor for elevated jurisdictions', () => {
    const result = scoreEvent(
      { provider: deepseek, policy: 'blocked', hourOfDay: 14, keywordMatches: [], identifierFindings: [] },
      weights,
    );
    expect(result.factors.some((factor) => factor.kind === 'data-residency')).toBe(true);
  });

  it('drives an event to critical when confidential content is present', () => {
    const result = scoreEvent(
      {
        provider: chatgpt,
        policy: 'unknown',
        hourOfDay: 14,
        keywordMatches: ['confidential', 'board deck'],
        identifierFindings: [{ class: 'email', count: 2 }],
      },
      weights,
    );
    expect(result.band).toBe('critical');
    expect(result.factors.filter((factor) => factor.kind === 'sensitive-content')).toHaveLength(2);
  });

  it('counts a repeated keyword only once', () => {
    const once = scoreEvent(
      { provider: chatgpt, policy: 'approved', hourOfDay: 14, keywordMatches: ['nda'], identifierFindings: [] },
      weights,
    );

    const thrice = scoreEvent(
      {
        provider: chatgpt,
        policy: 'approved',
        hourOfDay: 14,
        keywordMatches: ['nda', 'nda', 'nda'],
        identifierFindings: [],
      },
      weights,
    );
    expect(thrice.score).toBe(once.score);
  });

  it('itemises every point so a score can be explained', () => {
    const result = scoreEvent(
      { provider: deepseek, policy: 'blocked', hourOfDay: 3, keywordMatches: [], identifierFindings: [] },
      weights,
    );

    const total = result.factors.reduce((sum, factor) => sum + factor.points, 0);
    expect(Math.round(total * 10) / 10).toBe(result.score);
  });
});

describe('isOffHours', () => {
  it('handles a window that wraps midnight', () => {
    const window = { offHoursStart: 21, offHoursEnd: 6 };
    expect(isOffHours(22, window)).toBe(true);
    expect(isOffHours(3, window)).toBe(true);
    expect(isOffHours(14, window)).toBe(false);
  });

  it('handles a same-day window', () => {
    const window = { offHoursStart: 12, offHoursEnd: 14 };
    expect(isOffHours(13, window)).toBe(true);
    expect(isOffHours(15, window)).toBe(false);
  });
});

describe('scoreActor', () => {
  const settings = { actorSaturationScore: 500 };

  it('scores no activity as zero', () => {
    expect(scoreActor(0, settings).score).toBe(0);
  });

  it('maps the curve constant to ~63, the 1 - 1/e point', () => {
    expect(scoreActor(500, settings).score).toBe(63);
  });

  it('stays strictly ordered across the whole range, so ranking is never lost', () => {
    // The regression this guards: linear normalisation clipped every heavy user
    // to exactly 100, which made the "highest-risk individuals" table unable to
    // rank the people it exists to rank.
    const raws = [100, 250, 500, 750, 1000, 1500, 2500, 5000];
    const scores = raws.map((raw) => scoreActor(raw, settings).score);

    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]!).toBeGreaterThan(scores[i - 1]!);
    }
  });

  it('leaves headroom across the range real telemetry produces', () => {
    // The guarantee is "no clipping at realistic volumes", not "never reaches
    // 100". The curve is asymptotic, so past roughly 5k of raw points the
    // rounded score does converge on 100 and ordering is lost again. That bound
    // is ~5x the heaviest individual in a month of demo telemetry; if a real
    // dataset approaches it, raise actorSaturationScore - which is exactly what
    // that setting is for.
    expect(scoreActor(2_000, settings).score).toBeLessThan(100);
    expect(scoreActor(2_500, settings).score).toBeLessThan(100);
  });

  it('spans every band across a realistic spread of totals', () => {
    expect(scoreActor(80, settings).band).toBe('low');
    expect(scoreActor(250, settings).band).toBe('medium');
    expect(scoreActor(500, settings).band).toBe('high');
    expect(scoreActor(900, settings).band).toBe('critical');
  });

  it('honours a lower curve constant for short windows', () => {
    expect(scoreActor(120, { actorSaturationScore: 120 }).score).toBe(63);
  });
});

describe('scoreOrg', () => {
  it('returns zero when there was no AI activity', () => {
    expect(scoreOrg({ aiRequests: 0, shadowAiRequests: 0, sensitiveHits: 0, topActorScores: [] })).toEqual({
      score: 0,
      band: 'low',
    });
  });

  it('is size-invariant: the same ratios give the same score', () => {
    const small = scoreOrg({ aiRequests: 100, shadowAiRequests: 60, sensitiveHits: 5, topActorScores: [40] });
    const large = scoreOrg({ aiRequests: 10_000, shadowAiRequests: 6_000, sensitiveHits: 500, topActorScores: [40] });
    expect(small.score).toBe(large.score);
  });

  it('rates fully-governed usage as low and fully-shadow usage with leaks as critical', () => {
    const governed = scoreOrg({ aiRequests: 500, shadowAiRequests: 0, sensitiveHits: 0, topActorScores: [5] });
    expect(governed.band).toBe('low');

    const bad = scoreOrg({
      aiRequests: 500,
      shadowAiRequests: 500,
      sensitiveHits: 120,
      topActorScores: [100, 95, 90, 88, 80],
    });
    expect(bad.band).toBe('critical');
  });
});
