import { useCallback, useState } from 'react';

/**
 * Token de Turnstile de un formulario. Cloudflare consume el token en cada `siteverify`,
 * así que `renew()` va tras cualquier respuesta de error para no dejar el formulario sin token.
 */
export function useCaptcha() {
  const [token, setToken] = useState('');
  const [resetSignal, setResetSignal] = useState(0);
  const renew = useCallback(() => setResetSignal((n) => n + 1), []);
  return { token, onToken: setToken, resetSignal, renew };
}
