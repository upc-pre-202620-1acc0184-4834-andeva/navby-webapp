import { type TFunction } from 'i18next';
import { isApiError } from './errors';

/** Texto traducido para un error de la API: decide por `code`, nunca por el `detail` (AGENTS.md §6). */
export function apiErrorMessage(t: TFunction, error: unknown): string {
  const code = isApiError(error) ? error.code : 'UNKNOWN';
  return t(`errors.${code}`, { defaultValue: t('errors.UNKNOWN') });
}
