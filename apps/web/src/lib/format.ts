import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

// Locale-stable formatting helpers.

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-IN');
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 10_000) return value.toLocaleString('en-IN');
  return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  const date = toDate(iso);
  return date ? format(date, 'dd MMM yyyy') : '—';
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = toDate(iso);
  return date ? format(date, 'dd MMM yyyy, HH:mm') : '—';
}

export function formatRelative(iso: string | null | undefined): string {
  const date = toDate(iso);
  return date ? `${formatDistanceToNowStrict(date)} ago` : '—';
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatAxisDate(iso: string): string {
  const date = toDate(iso);
  return date ? format(date, 'dd MMM') : iso;
}

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = parseISO(iso);
  return isValid(date) ? date : null;
}
