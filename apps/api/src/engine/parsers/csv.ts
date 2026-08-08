import { parse } from 'csv-parse/sync';
import { AppError } from '../../lib/errors.js';
import { combineDateAndTime, parseTimestamp, resolveFieldMap } from './field-mapping.js';
import { pushError, type ParseOptions, type ParseResult, type RawRecord } from './types.js';

/**
 * CSV / TSV parser.
 *
 * `relax_column_count` is on deliberately. Real exports contain ragged rows - 
 * an unescaped comma inside a page title is enough - and rejecting the entire
 * file for one bad line is the behaviour that makes security tools unusable.
 * Ragged rows are parsed as best they can be and counted as rejects if they
 * yield no destination.
 *
 * `bom: true` matters on Windows: Excel writes a UTF-8 BOM, which otherwise
 * becomes part of the first header name and breaks every column alias.
 */
export function parseCsv(input: string, options: ParseOptions): ParseResult {
  const errors: string[] = [];

  let rows: Record<string, string>[];
  try {
    rows = parse(input, {
      columns: (header: string[]) => header.map((column) => column.trim()),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
      // Autodetect comma vs tab vs semicolon - European exports use `;`.
      delimiter: [',', '\t', ';'],
      // Hard stop well above the row cap so a hostile file cannot exhaust memory
      // during parsing, before the cap is ever applied.
      to: options.maxRows + 1,
    }) as Record<string, string>[];
  } catch (error) {
    throw AppError.badRequest(
      `The CSV file could not be parsed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }

  if (rows.length === 0) {
    throw AppError.badRequest('The CSV file contains no data rows.');
  }

  const firstRow = rows[0];
  if (!firstRow) throw AppError.badRequest('The CSV file contains no data rows.');

  const fieldMap = resolveFieldMap(Object.keys(firstRow));
  if (!fieldMap.url) {
    throw AppError.badRequest(
      'No destination column found. Include a column named url, uri, destination, host or domain.',
    );
  }

  const records: RawRecord[] = [];
  let rowsRejected = 0;
  const limit = Math.min(rows.length, options.maxRows);

  for (let index = 0; index < limit; index += 1) {
    const row = rows[index];
    if (!row) continue;

    const url = String(row[fieldMap.url] ?? '').trim();
    if (!url) {
      rowsRejected += 1;
      pushError(errors, `Row ${index + 2}: destination column is empty.`);
      continue;
    }

    records.push({
      url,
      actor: fieldMap.actor ? String(row[fieldMap.actor] ?? '').trim() : '',
      occurredAt: resolveTimestamp(row, fieldMap),
      content: fieldMap.content ? String(row[fieldMap.content] ?? '').trim() : '',
    });
  }

  if (rows.length > options.maxRows) {
    pushError(
      errors,
      `File truncated at ${options.maxRows.toLocaleString()} rows. Split the export and upload the remainder separately.`,
    );
  }

  return { format: 'csv', records, rowsTotal: limit, rowsRejected, errors };
}

// Resolves an event time, preferring a single timestamp column and falling back to separate date and time columns.
function resolveTimestamp(
  row: Record<string, string>,
  fieldMap: Partial<Record<'url' | 'actor' | 'timestamp' | 'content', string>>,
): Date | null {
  if (fieldMap.timestamp) {
    const direct = parseTimestamp(row[fieldMap.timestamp]);
    if (direct) return direct;
  }

  const dateKey = Object.keys(row).find((key) => key.trim().toLowerCase() === 'date');
  const timeKey = Object.keys(row).find((key) => key.trim().toLowerCase() === 'time');
  if (dateKey && timeKey) return combineDateAndTime(row[dateKey], row[timeKey]);

  return null;
}
