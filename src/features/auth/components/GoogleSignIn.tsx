import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loginWithGoogle } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { cn } from '@/shared/ui/cn';
import { useTheme } from '@/shared/ui/theme';
import { FormNotice } from './AuthCard';

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisPromise: Promise<GoogleAccountsId> | null = null;

/** Carga el script de Google Identity Services una sola vez y solo en /login y /register. */
function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  gisPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error('Google Identity Services unavailable'));
    };
    script.onerror = () => {
      gisPromise = null;
      script.remove();
      reject(new Error('Google Identity Services failed to load'));
    };
    document.head.append(script);
  });
  return gisPromise;
}

/**
 * Botón oficial de Google (US-05). Se oculta sin `VITE_GOOGLE_CLIENT_ID`.
 * El texto bajo el botón es el consentimiento RL-01: siempre se envía `accept_terms: true`.
 */
export function GoogleSignIn() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
  if (!clientId) return null;
  return <GoogleSignInButton clientId={clientId} />;
}

function GoogleSignInButton({ clientId }: { clientId: string }) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const language = (i18n.resolvedLanguage ?? i18n.language).startsWith('en') ? 'en' : 'es';

  const mutation = useMutation({ mutationFn: loginWithGoogle });
  const submitRef = useRef(mutation.mutate);
  useEffect(() => {
    submitRef.current = mutation.mutate;
  }, [mutation.mutate]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleIdentity().then(
      (gis) => {
        const el = containerRef.current;
        if (cancelled || !el) return;
        gis.initialize({
          client_id: clientId,
          callback: ({ credential }) =>
            submitRef.current({ id_token: credential, accept_terms: true }),
        });
        el.replaceChildren();
        gis.renderButton(el, {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          locale: language,
          // GIS acepta un ancho en px de 200 a 400.
          width: Math.max(200, Math.min(400, Math.floor(el.clientWidth) || 320)),
        });
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [clientId, theme, language, attempt]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs text-fg-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {t('auth.google.divider')}
        <span className="h-px flex-1 bg-line" />
      </div>

      {loadFailed ? (
        <FormNotice>
          {t('auth.google.loadFailed')}{' '}
          <button
            type="button"
            className="font-semibold underline underline-offset-4"
            onClick={() => {
              setLoadFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            {t('common.retry')}
          </button>
        </FormNotice>
      ) : (
        <div
          ref={containerRef}
          inert={mutation.isPending ? true : undefined}
          aria-busy={mutation.isPending || undefined}
          data-testid="google-signin"
          className={cn(
            'flex min-h-11 w-full justify-center transition-opacity duration-150 ease-(--ease-out)',
            mutation.isPending && 'opacity-50',
          )}
        />
      )}

      <p className="text-center text-xs text-fg-muted">{t('auth.google.consent')}</p>

      {mutation.isError ? <FormNotice>{apiErrorMessage(t, mutation.error)}</FormNotice> : null}
    </div>
  );
}
