import { AppError } from '../../lib/errors.js';
import { parseCsv } from './csv.js';
import { parseJson } from './json.js';
import { parseTxt } from './txt.js';
import type { ParseOptions, ParseResult } from './types.js';

export * from './types.js';

export { parseCsv } from './csv.js';

export { parseJson } from './json.js';

export { parseTxt } from './txt.js';

const ACCEPTED_EXTENSIONS = ['.csv', '.tsv', '.json', '.ndjson', '.jsonl', '.txt', '.log'] as const;

// Chooses a parser.
export function parseLogFile(
  filename: string,
  content: string,
  options: ParseOptions,
): ParseResult {
  const extension = extname(filename);

  if (extension && !ACCEPTED_EXTENSIONS.includes(extension as (typeof ACCEPTED_EXTENSIONS)[number])) {
    throw AppError.unsupportedFormat(
      `Files of type "${extension}" are not supported. Upload a CSV, JSON, NDJSON, TXT or LOG file.`,
    );
  }

  if (content.trim().length === 0) {
    throw AppError.badRequest('The uploaded file is empty.');
  }

  switch (sniffFormat(content, extension)) {
    case 'json':
      return parseJson(content, options);
    case 'csv':
      return parseCsv(content, options);
    default:
      return parseTxt(content, options);
  }
}

type SniffedFormat = 'json' | 'csv' | 'txt';

function sniffFormat(content: string, extension: string): SniffedFormat {
  const head = content.slice(0, 4096).trimStart();

  // Unambiguous JSON: a document or an NDJSON stream both start with a brace or
  // bracket, and no CSV header realistically does.
  if (head.startsWith('{') || head.startsWith('[')) return 'json';

  const firstLine = head.split(/\r?\n/, 1)[0] ?? '';
  const secondLine = head.split(/\r?\n/)[1] ?? '';

  // A CSV needs a consistent delimiter count across the header and first data
  // row. Counting on one line alone misclassifies a log line containing commas.
  for (const delimiter of [',', '\t', ';']) {
    const headerCount = countOutsideQuotes(firstLine, delimiter);
    if (headerCount === 0) continue;
    if (secondLine === '' || countOutsideQuotes(secondLine, delimiter) === headerCount) {
      return 'csv';
    }
  }

  if (extension === '.csv' || extension === '.tsv') return 'csv';
  if (extension === '.json' || extension === '.ndjson' || extension === '.jsonl') return 'json';
  return 'txt';
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === delimiter && !inQuotes) count += 1;
  }
  return count;
}

function extname(filename: string): string {
  const index = filename.lastIndexOf('.');
  return index === -1 ? '' : filename.slice(index).toLowerCase();
}
