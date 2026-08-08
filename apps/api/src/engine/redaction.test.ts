import { describe, expect, it } from 'vitest';
import { findConfidentialKeywords, inspectContent } from './redaction.js';

describe('inspectContent', () => {
  it('detects and masks email addresses', () => {
    const result = inspectContent('send the list to priya.sharma@acme.co.in today');
    expect(result.findings).toContainEqual({ class: 'email', count: 1 });
    expect(result.redacted).not.toContain('priya.sharma@acme.co.in');
    expect(result.redacted).toContain('[REDACTED:email]');
  });

  it('detects a Luhn-valid card number and ignores a random 16-digit string', () => {
    const valid = inspectContent('card 4111 1111 1111 1111');
    expect(valid.findings.some((finding) => finding.class === 'credit-card')).toBe(true);

    const invalid = inspectContent('order 1234 5678 9012 3456');
    expect(invalid.findings.some((finding) => finding.class === 'credit-card')).toBe(false);
  });

  it('detects an API key and a JWT', () => {
    const result = inspectContent(
      'key sk-proj-9f2Ba7QeLm4X8vTzR1cW0dYh and token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    );

    const classes = result.findings.map((finding) => finding.class);
    expect(classes).toContain('api-key');
    expect(classes).toContain('jwt');
  });

  it('rejects Aadhaar-shaped numbers that cannot be real', () => {
    expect(inspectContent('id 1111 1111 1111').findings.some((f) => f.class === 'aadhaar')).toBe(false);
    expect(inspectContent('id 0234 5678 9012').findings.some((f) => f.class === 'aadhaar')).toBe(false);
    expect(inspectContent('id 4321 8765 2109').findings.some((f) => f.class === 'aadhaar')).toBe(true);
  });

  it('never leaves the original secret in the redacted output', () => {
    const secret = 'AKIAIOSFODNN7EXAMPLE';
    const result = inspectContent(`aws ${secret}`);
    expect(result.redacted).not.toContain(secret);
  });

  it('is safe on empty input', () => {
    expect(inspectContent('')).toEqual({ redacted: '', findings: [], totalHits: 0 });
  });

  it('produces the same result when called repeatedly (no shared regex state)', () => {
    const text = 'contact a@b.com and c@d.com';
    const first = inspectContent(text);
    const second = inspectContent(text);
    expect(second).toEqual(first);
    expect(first.findings).toContainEqual({ class: 'email', count: 2 });
  });
});

describe('findConfidentialKeywords', () => {
  const keywords = ['confidential', 'nda', 'salary', 'source code'];

  it('matches on word boundaries only', () => {
    expect(findConfidentialKeywords('this is confidential', keywords)).toContain('confidential');
    expect(findConfidentialKeywords('travelling to Rwanda', keywords)).not.toContain('nda');
  });

  it('is case-insensitive and matches multi-word terms', () => {
    expect(findConfidentialKeywords('Review the SOURCE CODE please', keywords)).toContain('source code');
  });

  it('reports each keyword once regardless of repetition', () => {
    const matches = findConfidentialKeywords('salary salary salary', keywords);
    expect(matches.filter((match) => match === 'salary')).toHaveLength(1);
  });

  it('returns nothing for clean text', () => {
    expect(findConfidentialKeywords('summarise this public blog post', keywords)).toEqual([]);
  });
});
