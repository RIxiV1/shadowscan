import { describe, expect, it } from 'vitest';
import { RISK_DEFAULTS } from '../config/risk-defaults.js';
import { buildProviderIndex, type IndexedProvider } from './detector.js';
import { ingestRecords, normaliseActor } from './ingest.js';
import type { RawRecord } from './parsers/types.js';

const providers: IndexedProvider[] = [
  {
    id: '1',
    key: 'openai-chatgpt',
    name: 'ChatGPT',
    vendor: 'OpenAI',
    category: 'assistant',
    domains: ['chatgpt.com'],
    riskWeight: 2,
    policy: 'approved',
    dataRegion: 'US',
    trainsOnUserData: true,
  },
  {
    id: '2',
    key: 'deepseek',
    name: 'DeepSeek',
    vendor: 'DeepSeek',
    category: 'assistant',
    domains: ['deepseek.com'],
    riskWeight: 3,
    policy: 'blocked',
    dataRegion: 'CN',
    trainsOnUserData: true,
  },
];

const options = {
  index: buildProviderIndex(providers),
  weights: { ...RISK_DEFAULTS },
  confidentialKeywords: RISK_DEFAULTS.confidentialKeywords,
  fallbackTimestamp: new Date('2026-03-04T12:00:00Z'),
};

function record(overrides: Partial<RawRecord>): RawRecord {
  return {
    url: 'https://chatgpt.com/',
    actor: 'priya.sharma',
    occurredAt: new Date('2026-03-04T14:00:00Z'),
    content: '',
    ...overrides,
  };
}

describe('ingestRecords', () => {
  it('keeps only AI traffic and counts the rest', () => {
    const outcome = ingestRecords(
      [
        record({}),
        record({ url: 'https://github.com/acme/repo' }),
        record({ url: 'https://mail.google.com/mail' }),
      ],
      options,
    );

    expect(outcome.rowsParsed).toBe(3);
    expect(outcome.aiRequests).toBe(1);
    expect(outcome.events).toHaveLength(1);
  });

  it('separates approved usage from shadow usage', () => {
    const outcome = ingestRecords(
      [record({}), record({ url: 'https://chat.deepseek.com/' })],
      options,
    );
    expect(outcome.approvedRequests).toBe(1);
    expect(outcome.shadowAiRequests).toBe(1);
  });

  it('counts unnormalisable rows as rejected', () => {
    const outcome = ingestRecords([record({ url: 'chrome://newtab' }), record({ url: '' })], options);
    expect(outcome.rowsRejected).toBe(2);
    expect(outcome.rowsParsed).toBe(0);
  });

  it('never persists the query string, but does score its contents', () => {
    const outcome = ingestRecords(
      [record({ url: 'https://chatgpt.com/search?q=our+confidential+merger+plan' })],
      options,
    );

    const event = outcome.events[0]!;
    expect(event.path).toBe('/search');
    expect(JSON.stringify(event)).not.toContain('merger plan');
    expect(event.sensitiveHits.some((hit) => hit.class === 'keyword')).toBe(true);
    expect(event.riskBand).toBe('critical');
  });

  it('records the class of a detected secret without storing the secret', () => {
    const outcome = ingestRecords(
      [record({ content: 'my key is sk-proj-9f2Ba7QeLm4X8vTzR1cW0dYh please fix the script' })],
      options,
    );

    const event = outcome.events[0]!;
    expect(event.sensitiveHits.some((hit) => hit.class === 'api-key')).toBe(true);
    expect(JSON.stringify(event)).not.toContain('sk-proj-9f2Ba7QeLm4X8vTzR1cW0dYh');
  });

  it('dates rows with no timestamp to the fallback instead of the epoch', () => {
    const outcome = ingestRecords([record({ occurredAt: null })], options);
    expect(outcome.events[0]?.occurredAt).toEqual(options.fallbackTimestamp);
  });

  it('flags heuristic detections as unknown with no provider attached', () => {
    const outcome = ingestRecords([record({ url: 'https://promptforge.ai/generate' })], options);
    const event = outcome.events[0]!;
    expect(event.providerKey).toBeNull();
    expect(event.policy).toBe('unknown');
    expect(event.detectionSource).not.toBe('registry');
  });

  it('gives the same actor the same hash across records', () => {
    const outcome = ingestRecords([record({}), record({ actor: 'priya.sharma@acme.co.in' })], options);
    expect(outcome.events[0]?.actorHash).toBe(outcome.events[1]?.actorHash);
  });
});

describe('normaliseActor', () => {
  it('reduces an email to its local part', () => {
    expect(normaliseActor('Priya.Sharma@acme.co.in')).toBe('priya.sharma');
  });

  it('strips a Windows domain prefix', () => {
    expect(normaliseActor('CORP\\priya')).toBe('priya');
  });

  it('falls back to a stable label when the log has no actor', () => {
    expect(normaliseActor('')).toBe('unattributed');
    expect(normaliseActor('   ')).toBe('unattributed');
  });
});
