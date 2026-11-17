import { AlertCircle } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { cn } from './cn';

export interface FieldAriaProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  required?: boolean;
}

export interface FieldProps {
  id?: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (ariaProps: FieldAriaProps) => ReactNode;
}

/** Contenedor de campo accesible: etiqueta visible encima y error vinculado vía `aria-describedby`. */
export function Field({
  id,
  label,
  error,
  hint,
  required = false,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={fieldId} className="text-xs font-semibold text-fg">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-error-ink">
            {' '}
            *
          </span>
        ) : null}
      </label>

      {children({
        id: fieldId,
        ...(error ? { 'aria-invalid': true } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        ...(required ? { required: true } : {}),
      })}

      {hint ? (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-xs text-error-ink">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
