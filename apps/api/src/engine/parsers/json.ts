import { AppError } from '../../lib/errors.js';
import { parseTimestamp, resolveFieldMap } from './field-mapping.js';
import { pushError, type ParseOptions, type ParseResult, type RawRecord } from './types.js';

// JSON and NDJSON parser.
const ARRAY_CONTAINER_KEYS = [
  'Browser History',
  'browser_history',
  'history',
  'records',
  'events',
  'logs',
  'entries',
  'items',
  'results',
  'hits',
  'data',
  'rows',
];

export function parseJson(input: string, options: ParseOptions): ParseResult {
  const rows = extractRows(input);

  if (rows.length === 0) {
    throw AppError.badRequest('The JSON file contains no records.');
  }

  const firstRow = rows[0];
  if (!firstRow) throw AppError.badRequest('The JSON file contains no records.');

  const fieldMap = resolveFieldMap(collectKeys(rows));
  if (!fieldMap.url) {
    throw AppError.badRequest(
      'No destination field found. Each record needs a url, uri, destination, host or domain property.',
    );
  }

  const errors: string[] = [];
  const records: RawRecord[] = [];
  let rowsRejected = 0;
  const limit = Math.min(rows.length, options.maxRows);

  for (let index = 0; index < limit; index += 1) {
    const row = rows[index];
    if (!row || typeof row !== 'object') {
      rowsRejected += 1;
      pushError(errors, `Record ${index + 1}: expected an object.`);
      continue;
    }

    const url = stringify(row[fieldMap.url]);
    if (!url) {
      rowsRejected += 1;
      pushError(errors, `Record ${index + 1}: destination field is empty.`);
      continue;
    }

    records.push({
      url,
      actor: fieldMap.actor ? stringify(row[fieldMap.actor]) : '',
      occurredAt: fieldMap.timestamp ? parseTimestamp(row[fieldMap.timestamp]) : null,
      content: fieldMap.content ? stringify(row[fieldMap.content]) : '',
    });
  }

  if (rows.length > options.maxRows) {
    pushError(
      errors,
      `File truncated at ${options.maxRows.toLocaleString()} records. Split the export and upload the remainder separately.`,
    );
  }

  return { format: 'json', records, rowsTotal: limit, rowsRejected, errors };
}

function extractRows(input: string): Record<string, unknown>[] {
  const trimmed = input.trim();
  if (!trimmed) throw AppError.badRequest('The JSON file is empty.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Not a single JSON document - try newline-delimited before giving up.
    const ndjson = parseNdjson(trimmed);
    if (ndjson.length > 0) return ndjson;
    throw AppError.badRequest('The file is not valid JSON or newline-delimited JSON.');
  }

  if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];

  if (parsed && typeof parsed === 'object') {
    const container = parsed as Record<string, unknown>;
    for (const key of ARRAY_CONTAINER_KEYS) {
      const candidate = container[key];
      if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
    }
    // Last resort: the first array-valued property of any name.
    for (const value of Object.values(container)) {
      if (Array.isArray(value) && value.length > 0) return value as Record<string, unknown>[];
    }
    // A single record submitted on its own is still a valid upload.
    return [container];
  }

  throw AppError.badRequest('The JSON file must contain an array of log records.');
}

function parseNdjson(input: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '[' || trimmed === ']' || trimmed === ',') continue;
    try {
      const value: unknown = JSON.parse(trimmed.replace(/,$/, ''));
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        rows.push(value as Record<string, unknown>);
      }
    } catch {
      // A malformed line in NDJSON is expected; skip it rather than fail the file.
    }
  }
  return rows;
}

// Field names are collected across the first 50 records, not just the first.
function collectKeys(rows: Record<string, unknown>[]): string[] {
  const keys = new Set<string>();
  for (const row of rows.slice(0, 50)) {
    if (row && typeof row === 'object') {
      for (const key of Object.keys(row)) keys.add(key);
    }
  }
  return [...keys];
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}
