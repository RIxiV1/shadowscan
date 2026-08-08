import { describe, expect, it } from 'vitest';
import { buildProviderIndex, type IndexedProvider } from './detector.js';

function provider(overrides: Partial<IndexedProvider> & Pick<IndexedProvider, 'key' | 'domains'>): IndexedProvider {
  return {
    id: `id-${overrides.key}`,
    name: overrides.key,
    vendor: 'Test',
    category: 'assistant',
    riskWeight: 2,
    policy: 'unknown',
    dataRegion: 'US',
    trainsOnUserData: false,
    ...overrides,
  };
}

const index = buildProviderIndex([
  provider({ key: 'openai', domains: ['openai.com', 'chatgpt.com'], policy: 'unknown' }),
  provider({ key: 'openai-api', domains: ['api.openai.com'], policy: 'approved', riskWeight: 1 }),
  provider({ key: 'deepseek', domains: ['deepseek.com'], policy: 'blocked', riskWeight: 3 }),
]);

describe('ProviderIndex', () => {
  it('matches a registered domain exactly', () => {
    const result = index.detect('chatgpt.com', '/');
    expect(result.matched).toBe(true);
    expect(result.matched && result.provider?.key).toBe('openai');
    expect(result.matched && result.source).toBe('registry');
  });

  it('matches subdomains via suffix walk', () => {
    const result = index.detect('chat.deepseek.com', '/v1/chat');
    expect(result.matched && result.provider?.key).toBe('deepseek');
    expect(result.matched && result.policy).toBe('blocked');
  });

  it('prefers the most specific registration', () => {
    // api.openai.com is registered separately and must win over openai.com.
    const result = index.detect('api.openai.com', '/v1/responses');
    expect(result.matched && result.provider?.key).toBe('openai-api');
    expect(result.matched && result.policy).toBe('approved');
  });

  it('falls back to a heuristic for an uncatalogued AI host', () => {
    const result = index.detect('promptforge.ai', '/generate');
    expect(result.matched).toBe(true);
    expect(result.matched && result.provider).toBeNull();
    expect(result.matched && result.policy).toBe('unknown');
  });

  it('flags a dedicated chat subdomain on an unknown vendor', () => {
    const result = index.detect('ai.internal-vendor-tools.com', '/chat');
    expect(result.matched).toBe(true);
    expect(result.matched && result.provider).toBeNull();
  });

  it('does not flag ordinary business traffic', () => {
    expect(index.detect('github.com', '/anthropics/repo').matched).toBe(false);
    expect(index.detect('mail.google.com', '/mail/u/0').matched).toBe(false);
    expect(index.detect('stackoverflow.com', '/questions/1').matched).toBe(false);
  });

  it('respects the heuristic allowlist for known false positives', () => {
    expect(index.detect('chat.google.com', '/').matched).toBe(false);
    expect(index.detect('chat.zoom.us', '/').matched).toBe(false);
  });

  it('is deterministic when two providers claim the same domain', () => {
    const conflicted = buildProviderIndex([
      provider({ key: 'first', domains: ['shared.example.com'] }),
      provider({ key: 'second', domains: ['shared.example.com'] }),
    ]);
    const result = conflicted.detect('shared.example.com', '/');
    expect(result.matched && result.provider?.key).toBe('first');
  });
});
