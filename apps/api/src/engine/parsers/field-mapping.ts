// FIELD MAPPING AND TIMESTAMP COERCION Nobody exports logs in a single agreed schema.

export const FIELD_ALIASES = {
  url: [
    'url',
    'uri',
    'request_url',
    'requesturl',
    'visited url',
    'page url',
    'pageurl',
    'destination',
    'destination_url',
    'dest',
    'website',
    'site',
    'link',
    'address',
    'host',
    'hostname',
    'domain',
    'server_name',
  ],
  actor: [
    'user',
    'username',
    'user_name',
    'user name',
    'employee',
    'employee_id',
    'employeeid',
    'actor',
    'account',
    'login',
    'src_user',
    'source_user',
    'user_email',
    'email',
    'upn',
    'device',
    'device_name',
    'hostname_src',
    'machine',
  ],
  timestamp: [
    'timestamp',
    'time_usec',
    'visit_time',
    'visited on',
    'last visit time',
    'occurred_at',
    'occurredat',
    'event_time',
    'eventtime',
    'datetime',
    'date_time',
    '@timestamp',
    'time',
    'date',
  ],
  content: [
    'prompt',
    'prompt_text',
    'query',
    'search_term',
    'search_query',
    'content',
    'message',
    'body',
    'request_body',
    'text',
    'payload',
    'title',
  ],
} as const;

export type FieldName = keyof typeof FIELD_ALIASES;

// Lowercases and strips punctuation so `Visited-On` and `visited_on` unify.
export function canonicaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ');
}

// Builds `field -> source key` for one record's key set.
export function resolveFieldMap(keys: readonly string[]): Partial<Record<FieldName, string>> {
  const canonical = new Map<string, string>();
  for (const key of keys) {
    const normalised = canonicaliseHeader(key);
    // First occurrence wins so a duplicated header does not shadow the original.
    if (!canonical.has(normalised)) canonical.set(normalised, key);
  }

  const map: Partial<Record<FieldName, string>> = {};
  for (const field of Object.keys(FIELD_ALIASES) as FieldName[]) {
    for (const alias of FIELD_ALIASES[field]) {
      const canonicalAlias = canonicaliseHeader(alias);
      const original = canonical.get(canonicalAlias);
      if (original !== undefined) {
        map[field] = original;
        break;
      }
    }
  }
  return map;
}

const WEBKIT_EPOCH_OFFSET_MS = 11_644_473_600_000;
const MIN_PLAUSIBLE_MS = Date.UTC(2000, 0, 1);
const MAX_PLAUSIBLE_MS = Date.UTC(2100, 0, 1);
export function parseTimestamp(value: unknown): Date | null {
  if (value instanceof Date) return isPlausible(value) ? value : null;
  if (value === null || value === undefined) return null;

  if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value).trim())) {
    const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value).trim());
    if (!Number.isFinite(numeric)) return null;
    const candidate = numericToDate(numeric);
    return candidate && isPlausible(candidate) ? candidate : null;
  }

  const text = String(value).trim();
  if (!text) return null;

  // `YYYY-MM-DD HH:mm:ss` is not valid ISO 8601 but is the most common export
  // format there is; swapping the space for `T` makes it parseable everywhere.
  const isoish = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text) ? text.replace(' ', 'T') : text;

  const parsed = new Date(isoish);
  if (!Number.isNaN(parsed.getTime()) && isPlausible(parsed)) return parsed;

  return null;
}

function numericToDate(numeric: number): Date | null {
  const magnitude = Math.abs(numeric);
  if (magnitude >= 1e16) return new Date(numeric / 1000 - WEBKIT_EPOCH_OFFSET_MS); // WebKit µs
  if (magnitude >= 1e14) return new Date(numeric / 1000); // µs since Unix epoch
  if (magnitude >= 1e11) return new Date(numeric); // ms
  if (magnitude >= 1e9) return new Date(numeric * 1000); // s
  return null;
}

function isPlausible(date: Date): boolean {
  const time = date.getTime();
  return Number.isFinite(time) && time >= MIN_PLAUSIBLE_MS && time <= MAX_PLAUSIBLE_MS;
}

export function combineDateAndTime(dateValue: unknown, timeValue: unknown): Date | null {
  const dateText = String(dateValue ?? '').trim();
  const timeText = String(timeValue ?? '').trim();
  if (!dateText || !timeText) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) && !/^\d{2}\/\d{2}\/\d{4}$/.test(dateText)) return null;
  return parseTimestamp(`${dateText} ${timeText}`);
}
