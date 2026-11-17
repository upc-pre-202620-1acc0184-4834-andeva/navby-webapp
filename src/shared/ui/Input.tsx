import { type InputHTMLAttributes, type Ref } from 'react';
import { cn } from './cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** Campo de entrada de 44 px con fuente `text-base` en móvil para evitar zoom automático. */
export function Input({
  invalid = false,
  className,
  ref,
  'aria-invalid': ariaInvalidProp,
  ...props
}: InputProps) {
  const isInvalid = invalid || (ariaInvalidProp !== undefined && ariaInvalidProp !== false);

  return (
    <input
      ref={ref}
      aria-invalid={isInvalid ? true : undefined}
      className={cn(
        'h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-base text-fg transition-[border-color] duration-150 ease-(--ease-out) placeholder:text-fg-muted disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-muted aria-[invalid=true]:border-error-ink sm:text-sm',
        className,
      )}
      {...props}
    />
  );
}
