import { Loader2 } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { type Location, Navigate, Outlet, useLocation } from 'react-router';
import { Button } from '@/shared/ui/Button';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { useSession } from './useSession';

export interface AuthRedirectState {
  from?: Location;
}

/** Protege toda ruta privada: espera el refresh inicial, ofrece reintento si falla la red y redirige a `/login` sin sesión. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, isPending, isError, refetch } = useSession();

  if (isPending) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="grid flex-1 place-items-center p-6 text-brand-ink"
      >
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 items-center p-4">
        <StatusMessage
          variant="error"
          title={t('errors.sessionCheckTitle')}
          description={t('errors.NETWORK_ERROR')}
          action={
            <Button variant="secondary" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          }
          className="w-full"
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location } satisfies AuthRedirectState} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
