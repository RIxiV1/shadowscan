import { describe, expect, it } from 'vitest';
import { parseLogFile } from './index.js';
import { parseTimestamp, resolveFieldMap } from './field-mapping.js';

const options = { maxRows: 1000 };

describe('resolveFieldMap', () => {
  it('resolves aliases regardless of case, spacing or punctuation', () => {
    const map = resolveFieldMap(['Visited URL', 'User_Name', 'Visited On', 'Prompt']);
    expect(map.url).toBe('Visited URL');
    expect(map.actor).toBe('User_Name');
    expect(map.timestamp).toBe('Visited On');
    expect(map.content).toBe('Prompt');
  });

  it('prefers the more specific alias when several are present', () => {
    const map = resolveFieldMap(['date', 'visit_time', 'url']);
    expect(map.timestamp).toBe('visit_time');
  });
});

describe('parseTimestamp', () => {
  it('handles ISO-8601', () => {
    expect(parseTimestamp('2026-03-04T14:22:01Z')?.toISOString()).toBe('2026-03-04T14:22:01.000Z');
  });

  it('handles the space-separated form exports actually produce', () => {
    expect(parseTimestamp('2026-03-04 14:22:01')).toBeInstanceOf(Date);
  });

  it('disambiguates epoch seconds, milliseconds and Chrome microseconds by magnitude', () => {
    expect(parseTimestamp(1_772_000_000)?.getUTCFullYear()).toBe(2026);
    expect(parseTimestamp(1_772_000_000_000)?.getUTCFullYear()).toBe(2026);
    expect(parseTimestamp(13_416_473_600_000_000)?.getUTCFullYear()).toBe(2026);
  });

  it('rejects values that are not plausible event times', () => {
    expect(parseTimestamp(42)).toBeNull();
    expect(parseTimestamp('not a date')).toBeNull();
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp(null)).toBeNull();
  });
});

describe('parseLogFile: CSV', () => {
  it('parses a browser history export with split date and time columns', () => {
    const csv = [
      'date,time,title,url,visitCount',
      '2026-03-04,14:22:01,ChatGPT,https://chatgpt.com/c/abc,3',
      '2026-03-04,15:05:44,Claude,https://claude.ai/chat,1',
    ].join('\n');

    const result = parseLogFile('History.csv', csv, options);
    expect(result.format).toBe('csv');
    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.url).toBe('https://chatgpt.com/c/abc');
    expect(result.records[0]?.occurredAt).toBeInstanceOf(Date);
  });

  it('parses a semicolon-delimited export', () => {
    const csv = 'user;url;timestamp\npriya;https://claude.ai/;2026-03-04T10:00:00Z';
    const result = parseLogFile('export.csv', csv, options);
    expect(result.records[0]?.actor).toBe('priya');
  });

  it('picks up a prompt column when the source is a CASB export', () => {
    const csv =
      'user,url,timestamp,prompt\npriya,https://chatgpt.com/,2026-03-04T10:00:00Z,"summarise this confidential memo"';
    const result = parseLogFile('casb.csv', csv, options);
    expect(result.records[0]?.content).toContain('confidential');
  });

  it('counts rows with an empty destination as rejected rather than failing the file', () => {
    const csv = 'url,user\nhttps://claude.ai/,priya\n,arjun\nhttps://chatgpt.com/,rahul';
    const result = parseLogFile('mixed.csv', csv, options);
    expect(result.records).toHaveLength(2);
    expect(result.rowsRejected).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a file with no destination column', () => {
    expect(() => parseLogFile('bad.csv', 'a,b\n1,2', options)).toThrow(/destination column/i);
  });

  it('enforces the row cap and reports the truncation', () => {
    const rows = Array.from({ length: 20 }, (_, i) => `https://chatgpt.com/${i},priya`);
    const csv = ['url,user', ...rows].join('\n');
    const result = parseLogFile('big.csv', csv, { maxRows: 5 });
    expect(result.records).toHaveLength(5);
    expect(result.errors.join(' ')).toMatch(/truncated/i);
  });
});

describe('parseLogFile: JSON', () => {
  it('parses a bare array', () => {
    const json = JSON.stringify([
      { url: 'https://claude.ai/', user: 'priya', timestamp: '2026-03-04T10:00:00Z' },
    ]);
    const result = parseLogFile('logs.json', json, options);
    expect(result.format).toBe('json');
    expect(result.records[0]?.actor).toBe('priya');
  });

  it('parses a Chrome Takeout export with time_usec', () => {
    const json = JSON.stringify({
      'Browser History': [
        { url: 'https://gemini.google.com/app', title: 'Gemini', time_usec: 1_772_000_000_000_000 },
      ],
    });

    const result = parseLogFile('BrowserHistory.json', json, options);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.occurredAt?.getUTCFullYear()).toBe(2026);
  });

  it('parses newline-delimited JSON', () => {
    const ndjson = [
      '{"url":"https://chatgpt.com/","user":"priya"}',
      '{"url":"https://claude.ai/","user":"arjun"}',
    ].join('\n');
    const result = parseLogFile('stream.ndjson', ndjson, options);
    expect(result.records).toHaveLength(2);
  });

  it('collects field names across records so sparse exports still map the actor', () => {
    const json = JSON.stringify([
      { url: 'https://chatgpt.com/' },
      { url: 'https://claude.ai/', user: 'priya' },
    ]);
    const result = parseLogFile('sparse.json', json, options);
    expect(result.records[1]?.actor).toBe('priya');
  });
});

describe('parseLogFile: text and proxy logs', () => {
  it('parses one URL per line', () => {
    const txt = ['https://chatgpt.com/', 'claude.ai', '# a comment', '', 'perplexity.ai/search'].join('\n');
    const result = parseLogFile('urls.txt', txt, options);
    expect(result.records).toHaveLength(3);
    expect(result.format).toBe('txt');
  });

  it('extracts timestamp, URL and user from a Squid access line', () => {
    const line =
      '1772000000.123 234 10.0.0.5 TCP_MISS/200 4523 GET https://chat.deepseek.com/ priya.sharma DIRECT/1.2.3.4 text/html';
    const result = parseLogFile('access.log', line, options);
    expect(result.format).toBe('proxy-log');
    expect(result.records[0]?.url).toBe('https://chat.deepseek.com/');
    expect(result.records[0]?.actor).toBe('priya.sharma');
    expect(result.records[0]?.occurredAt?.getUTCFullYear()).toBe(2026);
  });

  it('rejects lines with no recognisable destination but keeps the rest', () => {
    const txt = ['https://claude.ai/', 'this line has no url at all'].join('\n');
    const result = parseLogFile('mixed.txt', txt, options);
    expect(result.records).toHaveLength(1);
    expect(result.rowsRejected).toBe(1);
  });
});

describe('parseLogFile: format selection', () => {
  it('sniffs content rather than trusting the extension', () => {
    const json = JSON.stringify([{ url: 'https://claude.ai/' }]);
    expect(parseLogFile('actually-json.txt', json, options).format).toBe('json');
  });

  it('rejects an unsupported extension outright', () => {
    expect(() => parseLogFile('payload.exe', 'MZ', options)).toThrow(/not supported/i);
  });

  it('rejects an empty file', () => {
    expect(() => parseLogFile('empty.csv', '   ', options)).toThrow(/empty/i);
  });
});
