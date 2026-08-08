import type { SourceFormat } from '@shadowscan/shared';

export interface RawRecord {
  // A URL or bare hostname exactly as it appeared in the source.
  url: string;
  // Subject of the request: employee id, username, email or device name.
  actor: string;
  occurredAt: Date | null;
  // Prompt or query text, when the export provides it.
  content: string;
}

export interface ParseResult {
  format: SourceFormat;
  records: RawRecord[];
  // Rows the parser saw, including ones it rejected.
  rowsTotal: number;
  rowsRejected: number;
  errors: string[];
}

export interface ParseOptions {
  maxRows: number;
}

export const MAX_REPORTED_ERRORS = 25;

// Appends an error message while keeping the list bounded.
export function pushError(errors: string[], message: string): void {
  if (errors.length < MAX_REPORTED_ERRORS) errors.push(message);
  else if (errors.length === MAX_REPORTED_ERRORS) errors.push('… further errors suppressed.');
}
