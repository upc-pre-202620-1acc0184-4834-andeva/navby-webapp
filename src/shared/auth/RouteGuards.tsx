import { Loader2 } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { wasSignedOutByUser } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { type AuthRedirectState, resolveAuthRedirectFrom } from './authRedirect';
import { useSession } from './useSession';

function SessionLoadingSpinner({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid flex-1 place-items-center p-6 text-brand-ink"
    >
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Protege toda ruta privada: espera el refresh inicial, ofrece reintento si falla la red y redirige a `/login` sin sesión. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, isPending, isError, refetch } = useSession();

  if (isPending) {
    return <SessionLoadingSpinner label={t('common.loading')} />;
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
    // Tras un logout o eliminación de cuenta no se guarda la ruta: volver a entrar lleva al inicio.
    const state: AuthRedirectState | undefined = wasSignedOutByUser()
      ? undefined
      : { from: location };
    return <Navigate to="/login" state={state} replace />;
  }

  // RN-12: el backend no abre sesión sin correo verificado; esto es defensa en profundidad.
  if (!user.email_verified) {
    return (
      <Navigate
        to="/verify-email"
        state={
          { from: location, email: user.email, reason: 'unverified' } satisfies AuthRedirectState
        }
        replace
      />
    );
  }

  return <>{children ?? <Outlet />}</>;
}

/** Redirige a la aplicación a usuarios que ya tienen sesión al entrar en rutas de acceso. */
export function RedirectIfAuthenticated({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, isPending } = useSession();

  if (isPending) {
    return <SessionLoadingSpinner label={t('common.loading')} />;
  }

  // Un usuario sin verificar solo puede quedarse en /verify-email.
  if (user && !(location.pathname === '/verify-email' && !user.email_verified)) {
    const target = resolveAuthRedirectFrom(location);
    const destination = target ? `${target.pathname}${target.search}${target.hash}` : '/';
    return <Navigate to={destination} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
