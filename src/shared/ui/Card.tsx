import { type HTMLAttributes } from 'react';
import { cn } from './cn';

export type CardVariant = 'default' | 'elevated' | 'highlighted';
export type CardPadding = 'none' | 'md';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'border-line',
  elevated: 'border-line shadow-lg',
  highlighted: 'border-primary',
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: '',
  md: 'p-4',
};

export function Card({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-surface',
        VARIANT_CLASSES[variant],
        PADDING_CLASSES[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
