import { type InputHTMLAttributes, type Ref } from 'react';
import { inputVariants } from './inputVariants';

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
      className={inputVariants({ className })}
      {...props}
    />
  );
}
