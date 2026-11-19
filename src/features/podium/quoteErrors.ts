import { isApiError } from '@/shared/api/errors';

/** Errores que se reportan con toast o redirección y no se repiten en el panel. */
export const HANDLED_ELSEWHERE = new Set([
  'INSUFFICIENT_CREDITS',
  'PROVIDER_UNAVAILABLE',
  'EMAIL_NOT_VERIFIED',
  'UNAUTHENTICATED',
]);

/** Error de cotización que el panel muestra en línea (los demás van por toast o redirección). */
export function isQuoteErrorShownInline(error: unknown): boolean {
  return Boolean(error) && !(isApiError(error) && HANDLED_ELSEWHERE.has(error.code));
}
