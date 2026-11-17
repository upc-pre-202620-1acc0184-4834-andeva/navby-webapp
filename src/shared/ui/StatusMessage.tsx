import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from './cn';

export type StatusMessageVariant = 'empty' | 'info' | 'success' | 'warning' | 'error';

export interface StatusMessageProps {
  variant?: StatusMessageVariant;
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const DEFAULT_ICONS: Record<StatusMessageVariant, LucideIcon> = {
  empty: Inbox,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

const ICON_COLOR_CLASSES: Record<StatusMessageVariant, string> = {
  empty: 'text-fg-muted',
  info: 'text-brand-ink',
  success: 'text-success-ink',
  warning: 'text-warning-ink',
  error: 'text-error-ink',
};

/** Estado vacío, informativo, de advertencia o error sin ilustraciones decorativas (DESIGN.md). */
export function StatusMessage({
  variant = 'info',
  icon,
  title,
  description,
  action,
  className,
}: StatusMessageProps) {
  const Icon = icon ?? DEFAULT_ICONS[variant];

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-line bg-surface p-6 text-center',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full bg-surface-sunken',
          ICON_COLOR_CLASSES[variant],
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="flex max-w-md flex-col gap-1">
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
