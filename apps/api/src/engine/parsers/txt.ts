import { AppError } from '../../lib/errors.js';
import { normaliseUrl } from '../url.js';
import { parseTimestamp } from './field-mapping.js';
import { pushError, type ParseOptions, type ParseResult, type RawRecord } from './types.js';

// Line-oriented parser for plain text and proxy access logs.

// Tokens that are structurally username-like but never actually a user.
const NON_ACTOR_TOKENS = new Set([
  '-',
  'get',
  'post',
  'put',
  'head',
  'delete',
  'patch',
  'connect',
  'options',
  'direct',
  'none',
  'default',
  'tcp_miss',
  'tcp_hit',
  'tcp_denied',
  'allowed',
  'blocked',
  'text/html',
  'application/json',
]);

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const ACTOR_LIKE = /^[A-Za-z][A-Za-z0-9._@\\-]{1,63}$/;

export function parseTxt(input: string, options: ParseOptions): ParseResult {
  const lines = input.split(/\r?\n/);
  const errors: string[] = [];
  const records: RawRecord[] = [];

  let rowsTotal = 0;
  let rowsRejected = 0;
  let sawStructuredFields = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // `#` prefixes W3C directives; `//` shows up in hand-annotated exports.
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    rowsTotal += 1;
    if (rowsTotal > options.maxRows) {
      pushError(
        errors,
        `File truncated at ${options.maxRows.toLocaleString()} lines. Split the export and upload the remainder separately.`,
      );
      rowsTotal -= 1;
      break;
    }

    const tokens = trimmed.split(/[\s\t]+/).filter(Boolean);
    const extracted = extractFromTokens(tokens);

    if (!extracted.url) {
      rowsRejected += 1;
      pushError(errors, `Line ${rowsTotal}: no recognisable URL or hostname.`);
      continue;
    }

    if (extracted.occurredAt || extracted.actor) sawStructuredFields = true;

    records.push({
      url: extracted.url,
      actor: extracted.actor,
      occurredAt: extracted.occurredAt,
      content: '',
    });
  }

  if (rowsTotal === 0) {
    throw AppError.badRequest('The text file contains no readable lines.');
  }

  return {
    format: sawStructuredFields ? 'proxy-log' : 'txt',
    records,
    rowsTotal,
    rowsRejected,
    errors,
  };
}

interface ExtractedLine {
  url: string;
  actor: string;
  occurredAt: Date | null;
}

function extractFromTokens(tokens: string[]): ExtractedLine {
  let url = '';
  let actor = '';
  let occurredAt: Date | null = null;
  let urlIndex = -1;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;

    if (!url && normaliseUrl(token)) {
      url = token;
      urlIndex = index;
      continue;
    }

    if (!occurredAt) {
      const candidate = parseTimestamp(token);
      if (candidate) {
        occurredAt = candidate;
        continue;
      }
    }
  }

  // Squid puts the authenticated user immediately after the response size and
  // method/URL group; scanning left-to-right from the URL finds it without
  // hard-coding a column index for a format that varies between builds.
  if (urlIndex >= 0) {
    for (let index = urlIndex + 1; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (!token) continue;
      const lower = token.toLowerCase();
      if (NON_ACTOR_TOKENS.has(lower) || IPV4.test(token) || /^\d+$/.test(token)) continue;
      if (token.includes('/')) continue;
      if (ACTOR_LIKE.test(token)) {
        actor = token;
        break;
      }
    }
  }

  return { url, actor, occurredAt };
}
