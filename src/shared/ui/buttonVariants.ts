import { cn } from './cn';

export type ButtonVariant = 'primary' | 'buy' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'icon';

const BASE_CLASSES =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap select-none rounded-lg font-semibold text-sm transition-[transform,background-color,border-color,color,opacity] duration-150 ease-(--ease-out) active:scale-[0.97] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  buy: 'bg-accent text-on-accent hover:bg-accent/90',
  secondary: 'border border-line-strong bg-surface text-fg hover:bg-surface-sunken',
  ghost: 'bg-transparent text-fg hover:bg-surface-sunken',
  danger: 'border border-error-ink bg-surface text-error-ink hover:bg-surface-sunken',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'min-h-11 sm:min-h-10 px-4',
  icon: 'min-h-11 min-w-11 sm:min-h-10 sm:min-w-10 px-0',
};

export function buttonVariants({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className);
}
