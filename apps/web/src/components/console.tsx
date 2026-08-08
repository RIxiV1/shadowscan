import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/format';

// Shared furniture for the list screens. Without these every page below the
// dashboard was a heading, a toolbar and one big table in a box, six times over.

// Horizontal strip of figures, hairline-divided. Sits directly under the page
// header so you know the shape of what you're looking at before reading rows.
export function Strip({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        'raised mb-2 flex flex-wrap rounded-[5px] border border-line bg-surface',
        className,
      )}
    >
      {children}
    </div>
  );
}

const TONE = {
  default: 'text-fg',
  muted: 'text-fg-muted',
  low: 'text-risk-low',
  medium: 'text-risk-medium',
  high: 'text-risk-high',
  critical: 'text-risk-critical',
} as const;

export type Tone = keyof typeof TONE;

/**
 * One figure in a Strip. When `onClick` is given it behaves as a toggle filter,
 * which is the interaction that makes these worth having: the tallies are the
 * fastest way into the subset they describe.
 */
export function StripStat({
  label,
  value,
  tone = 'default',
  active = false,
  onClick,
}: {
  label: string;
  value: number | string;
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
}): JSX.Element {
  const body = (
    <>
      <span className="eyebrow block truncate">{label}</span>
      <span className={cn('tabular mt-1 block text-display font-semibold leading-none', TONE[tone])}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </span>
    </>
  );

  const shell = 'min-w-[104px] flex-1 border-line px-3 py-2 text-left not-first:border-l';

  if (!onClick) return <div className={shell}>{body}</div>;

  /*
   * The clickable variant needs to look clickable. Previously it was a bare
   * button with a hover background, so nobody would ever discover that the
   * tallies filter the table below them. Now: a pointer cursor, a persistent
   * dotted underline on the label as a hint, an accent underline when active,
   * and a title so the behaviour is stated outright.
   */
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? `Clear the ${label.toLowerCase()} filter` : `Filter to ${label.toLowerCase()}`}
      className={cn(
        shell,
        'group relative cursor-pointer hover:bg-elevated focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-inset',
        'after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:transition-colors',
        active ? 'bg-elevated after:bg-accent' : 'after:bg-transparent group-hover:after:bg-line-strong',
      )}
    >
      <span className="pointer-events-none block underline decoration-line-strong decoration-dotted underline-offset-[3px] group-hover:decoration-fg-subtle">
        {body}
      </span>
    </button>
  );
}

/**
 * Labelled proportional bar. Used for the three inputs to the org risk score, so
 * the weighting is visible rather than something you have to be told about.
 */
export function Meter({
  label,
  detail,
  ratio,
  weight,
  tone = 'muted',
}: {
  label: string;
  detail: string;
  /** 0-1. Clamped. */
  ratio: number;
  /** Share of the overall score this input carries, e.g. "40%". */
  weight: string;
  tone?: Tone;
}): JSX.Element {
  const fill = {
    default: 'bg-fg',
    muted: 'bg-fg-muted',
    low: 'bg-risk-low',
    medium: 'bg-risk-medium',
    high: 'bg-risk-high',
    critical: 'bg-risk-critical',
  }[tone];

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-meta text-fg-muted">{label}</span>
        <span className="tabular shrink-0 text-meta font-medium text-fg">{detail}</span>
      </div>
      <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-elevated">
        <div
          className={cn('h-full rounded-full', fill)}
          style={{ width: `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%` }}
        />
      </div>
      <span className="mt-1 block text-micro text-fg-subtle">{weight} of score</span>
    </div>
  );
}

// Flat toolbar. Replaces the padded Card that used to wrap every filter row.
export function Toolbar({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        'raised mb-2 flex flex-wrap items-center gap-2 rounded-[5px] border border-line bg-surface px-2 py-1.5',
        className,
      )}
    >
      {children}
    </div>
  );
}
