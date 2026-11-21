import { cn } from './cn';

const BASE_INPUT_CLASSES =
  'h-11 lg:h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-base text-fg transition-[border-color] duration-150 ease-(--ease-out) placeholder:text-fg-muted disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-muted aria-[invalid=true]:border-error-ink data-[invalid=true]:border-error-ink sm:text-sm';

export function inputVariants({ className }: { className?: string } = {}): string {
  return cn(BASE_INPUT_CLASSES, className);
}
