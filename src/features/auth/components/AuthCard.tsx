import { AlertCircle, Info } from 'lucide-react';
import { type ReactNode } from 'react';
import { Card } from '@/shared/ui/Card';
import { cn } from '@/shared/ui/cn';

export interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Tarjeta de las rutas de acceso: un `<h1>`, subtítulo breve, formulario y enlace secundario. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <Card className="flex w-full flex-col gap-5 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-fg">{title}</h1>
        {subtitle ? <p className="text-sm text-fg-muted">{subtitle}</p> : null}
      </div>
      {children}
      {footer ? <div className="text-center text-sm text-fg-muted">{footer}</div> : null}
    </Card>
  );
}

/** Aviso dentro del formulario: error (`role="alert"`) o información (`role="status"`). */
export function FormNotice({
  tone = 'error',
  children,
  className,
}: {
  tone?: 'error' | 'info';
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === 'error' ? AlertCircle : Info;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-lg border p-3 text-sm',
        tone === 'error'
          ? 'border-error-ink/40 bg-surface-sunken text-error-ink'
          : 'border-line bg-surface-sunken text-fg',
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const AUTH_LINK_CLASS =
  'font-semibold text-brand-ink underline-offset-4 hover:underline focus-visible:underline';
