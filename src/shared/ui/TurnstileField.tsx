import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from './theme';

export const TURNSTILE_DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

/** Cabecera con la que viaja el token a navby-platform (AGENTS.md §6). */
export const CAPTCHA_HEADER = 'X-Captcha-Response';

export interface TurnstileFieldProps {
  onToken: (token: string) => void;
  /** Incrementar tras un `400 CAPTCHA_INVALID` para limpiar el token y reiniciar el widget. */
  resetSignal?: number;
  action?: string;
}

/**
 * Captcha de Cloudflare Turnstile para login, registro y recuperación de contraseña.
 * Sin `VITE_TURNSTILE_SITE_KEY` (local, pruebas) no carga script externo y entrega `TURNSTILE_DUMMY_TOKEN`.
 * Entrega `''` cuando el token vence, falla o se reinicia: el formulario no debe enviarse sin token.
 */
export function TurnstileField({ onToken, resetSignal, action }: TurnstileFieldProps) {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? '';
  const hasSiteKey = siteKey.length > 0;
  const language = (i18n.resolvedLanguage ?? i18n.language).startsWith('en') ? 'en' : 'es';

  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);
  const onTokenRef = useRef(onToken);
  const lastResetRef = useRef(resetSignal);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!hasSiteKey) {
      onTokenRef.current(TURNSTILE_DUMMY_TOKEN);
    }
  }, [hasSiteKey]);

  useEffect(() => {
    if (resetSignal === undefined || resetSignal === lastResetRef.current) return;
    lastResetRef.current = resetSignal;
    if (!hasSiteKey) {
      onTokenRef.current(TURNSTILE_DUMMY_TOKEN);
      return;
    }
    onTokenRef.current('');
    turnstileRef.current?.reset();
  }, [hasSiteKey, resetSignal]);

  useEffect(() => {
    if (!hasSiteKey) return;
    return () => {
      onTokenRef.current('');
    };
  }, [hasSiteKey, siteKey, theme, language, action]);

  if (!hasSiteKey) return <div data-testid="turnstile-widget" hidden />;

  return (
    <div className="flex justify-center" data-testid="turnstile-widget">
      <Turnstile
        ref={turnstileRef}
        siteKey={siteKey}
        onSuccess={(token) => onTokenRef.current(token)}
        onExpire={() => onTokenRef.current('')}
        onError={() => onTokenRef.current('')}
        onTimeout={() => onTokenRef.current('')}
        options={{ size: 'flexible', theme, language, action }}
      />
    </div>
  );
}
