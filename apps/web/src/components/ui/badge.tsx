import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-line-strong bg-elevated text-fg-muted',
        accent: 'border-accent/40 bg-accent/10 text-accent',
        low: 'border-risk-low/40 bg-risk-low/10 text-risk-low',
        medium: 'border-risk-medium/40 bg-risk-medium/10 text-risk-medium',
        high: 'border-risk-high/40 bg-risk-high/10 text-risk-high',
        critical: 'border-risk-critical/40 bg-risk-critical/10 text-risk-critical',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps): JSX.Element {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
