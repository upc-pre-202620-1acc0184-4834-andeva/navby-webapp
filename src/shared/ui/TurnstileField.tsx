import { Turnstile } from '@marsidev/react-turnstile';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Claves de prueba oficiales de Cloudflare: la de sitio siempre aprueba y el backend
// la acepta con el secreto de prueba 1x0000000000000000000000000000000AA.
const TEST_SITE_KEY = '1x00000000000000000000AA';
export const TURNSTILE_DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

/** Cabecera con la que viaja el token a navby-platform (AGENTS.md §6). */
export const CAPTCHA_HEADER = 'X-Captcha-Response';

/**
 * Captcha de Cloudflare Turnstile para login, registro y recuperación de contraseña.
 * Sin VITE_TURNSTILE_SITE_KEY (local, pruebas) no pinta nada y entrega el token de prueba.
 * Entrega '' cuando el token vence o falla: el formulario no debe enviarse sin token.
 */
export function TurnstileField({ onToken }: { onToken: (token: string) => void }) {
  const { i18n } = useTranslation();
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || TEST_SITE_KEY;
  const isTestKey = siteKey === TEST_SITE_KEY;

  useEffect(() => {
    if (isTestKey) onToken(TURNSTILE_DUMMY_TOKEN);
  }, [isTestKey, onToken]);

  if (isTestKey) return <div data-testid="turnstile-widget" hidden />;

  const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  return (
    <div className="flex justify-center">
      <Turnstile
        siteKey={siteKey}
        onSuccess={onToken}
        onExpire={() => onToken('')}
        onError={() => onToken('')}
        options={{ size: 'flexible', theme, language: i18n.language }}
      />
    </div>
  );
}
