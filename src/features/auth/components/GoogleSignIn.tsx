import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import googleLogo from '@/assets/auth/google.svg';
import { loginWithGoogle } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { getPrivacyUrl, getTermsUrl } from '@/shared/config/legalLinks';
import { cn } from '@/shared/ui/cn';
import { LegalAnchor } from '@/shared/ui/LegalLinks';
import { useTheme } from '@/shared/ui/theme';
import { getLastAuthMethod, setLastAuthMethod } from '../lastAuthMethod';
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
 * Botón personalizado de Google (estilo Quina con `google.svg`) respaldado por el
 * iframe oficial de Google Identity Services para mantener el flujo OAuth seguro.
 * Se oculta sin `VITE_GOOGLE_CLIENT_ID`.
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

  const mutation = useMutation({
    mutationFn: loginWithGoogle,
    onSuccess: () => setLastAuthMethod('google'),
  });
  const isLastUsed = getLastAuthMethod() === 'google';
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
          width: Math.max(200, Math.min(400, Math.floor(el.clientWidth) || 400)),
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
        <div className="group relative">
          {isLastUsed ? (
            <span className="pointer-events-none absolute -top-2.5 right-2 z-20 rounded-full border border-line bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary-dark shadow-xs dark:bg-primary/25 dark:text-brand-ink">
              {t('auth.lastUsed')}
            </span>
          ) : null}

          {/* Capa visual personalizada estilo Quina */}
          <div
            aria-hidden="true"
            className={cn(
              'flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface px-4 text-sm font-semibold text-fg transition-[transform,background-color,border-color,opacity] duration-150 ease-(--ease-out) group-hover:bg-surface-sunken group-active:scale-[0.98] motion-reduce:group-active:scale-100',
              mutation.isPending && 'opacity-50',
            )}
          >
            <img src={googleLogo} alt="" className="h-4 w-4 shrink-0" />
            <span>{t('auth.google.continue')}</span>
          </div>

          {/* Capa interactiva oficial de Google Identity Services superpuesta */}
          <div
            ref={containerRef}
            inert={mutation.isPending ? true : undefined}
            aria-busy={mutation.isPending || undefined}
            data-testid="google-signin"
            className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-lg opacity-[0.001]"
          />
        </div>
      )}

      <p className="text-center text-xs leading-relaxed text-fg-muted">
        <Trans
          i18nKey="auth.google.consentRich"
          components={{
            terms: <LegalAnchor href={getTermsUrl()} />,
            privacy: <LegalAnchor href={getPrivacyUrl()} />,
          }}
        />
      </p>

      {mutation.isError ? <FormNotice>{apiErrorMessage(t, mutation.error)}</FormNotice> : null}

      <div className="flex items-center gap-3 pt-1 text-xs text-fg-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span>{t('auth.google.divider')}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
