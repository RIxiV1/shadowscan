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
        'mb-2 flex flex-wrap rounded-[3px] border border-line bg-surface',
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
      <span className={cn('tabular mt-1 block text-[17px] font-semibold leading-none', TONE[tone])}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </span>
    </>
  );

  const shell = 'min-w-[104px] flex-1 border-line px-3 py-2 text-left not-first:border-l';

  if (!onClick) return <div className={shell}>{body}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        shell,
        'relative hover:bg-elevated',
        active && 'bg-elevated after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-accent',
      )}
    >
      {body}
    </button>
  );
}

// Flat toolbar. Replaces the padded Card that used to wrap every filter row.
export function Toolbar({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        'mb-2 flex flex-wrap items-center gap-1.5 rounded-[3px] border border-line bg-surface px-2 py-1.5',
        className,
      )}
    >
      {children}
    </div>
  );
}
