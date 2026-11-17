import { type HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'affinity' | 'accent';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'border-line bg-surface-sunken text-fg-muted',
  success: 'border-line bg-surface-sunken text-success-ink',
  warning: 'border-line bg-surface-sunken text-warning-ink',
  error: 'border-line bg-surface-sunken text-error-ink',
  affinity: 'border-transparent bg-primary-soft text-primary-dark',
  accent: 'border-transparent bg-accent text-on-accent',
};

export function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
