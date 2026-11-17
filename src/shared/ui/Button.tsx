import { Loader2 } from 'lucide-react';
import { type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { type ButtonSize, type ButtonVariant, buttonVariants } from './buttonVariants';
import { cn } from './cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** Botón del sistema de diseño (DESIGN.md §Botón): 44 px táctil / 40 px escritorio, ancho estable en carga. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  type = 'button',
  disabled,
  className,
  children,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonVariants({ variant, size, className })}
      {...props}
    >
      <span className={cn('inline-flex items-center justify-center gap-2', loading && 'invisible')}>
        {icon}
        {children}
      </span>
      {loading ? <Loader2 className="absolute h-4 w-4 animate-spin" aria-hidden="true" /> : null}
    </button>
  );
}
