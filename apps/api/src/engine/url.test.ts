import { describe, expect, it } from 'vitest';
import { decodeQueryText, domainSuffixes, normaliseUrl } from './url.js';

describe('normaliseUrl', () => {
  it('accepts a full URL and splits it into host, path and query', () => {
    expect(normaliseUrl('https://chat.openai.com/c/abc?q=hello#top')).toEqual({
      host: 'chat.openai.com',
      path: '/c/abc',
      query: 'q=hello',
    });
  });

  it('assumes https for a bare hostname', () => {
    expect(normaliseUrl('claude.ai')).toEqual({ host: 'claude.ai', path: '/', query: '' });
  });

  it('strips a www prefix so www.perplexity.ai and perplexity.ai are one host', () => {
    expect(normaliseUrl('https://www.perplexity.ai/search')?.host).toBe('perplexity.ai');
  });

  it('drops the port', () => {
    expect(normaliseUrl('example.com:8443/path')?.host).toBe('example.com');
  });

  it('rejects non-web schemes that appear in browser history exports', () => {
    expect(normaliseUrl('chrome://settings')).toBeNull();
    expect(normaliseUrl('file:///C:/reports/q3.pdf')).toBeNull();
    expect(normaliseUrl('about:blank')).toBeNull();
  });

  it('rejects bare IP addresses and single-label hosts', () => {
    expect(normaliseUrl('http://10.0.0.5/admin')).toBeNull();
    expect(normaliseUrl('localhost')).toBeNull();
  });

  it('rejects empty and oversized input', () => {
    expect(normaliseUrl('')).toBeNull();
    expect(normaliseUrl(`https://example.com/${'a'.repeat(3000)}`)).toBeNull();
  });

  it('removes quoting left behind by CSV exporters', () => {
    expect(normaliseUrl('"https://gemini.google.com/app"')?.host).toBe('gemini.google.com');
  });
});

describe('domainSuffixes', () => {
  it('yields the host then each parent domain, most specific first', () => {
    expect([...domainSuffixes('api.chat.openai.com')]).toEqual([
      'api.chat.openai.com',
      'chat.openai.com',
      'openai.com',
      'com',
    ]);
  });
});

describe('decodeQueryText', () => {
  it('decodes percent-encoding and plus separators', () => {
    expect(decodeQueryText('q=leaked+customer%20list')).toBe('q=leaked customer list');
  });

  it('returns the input unchanged when decoding would throw', () => {
    expect(decodeQueryText('q=%E0%A4')).toBe('q=%E0%A4');
  });
});
