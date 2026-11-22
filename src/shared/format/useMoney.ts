import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getExchangeRates } from '@/shared/api/endpoints';
import { useIntlLocale } from '@/shared/i18n/useIntlLocale';
import { formatInstantDate } from './date';
import { displayCurrencyFor, formatLocalPrice } from './money';

export const exchangeRatesKey = ['fx', 'rates'] as const;

/**
 * Tarifas en la moneda local según la región del navegador (Perú → soles, resto → dólares). Llegan
 * siempre en USD y se convierten aquí; si el tipo de cambio no carga se muestra el USD original.
 * `fxNote` es el aviso de conversión (solo si hay algo convertido en pantalla).
 */
export function useMoney() {
  const { t, i18n } = useTranslation();
  const locale = useIntlLocale();
  const target = displayCurrencyFor(navigator.languages ?? [navigator.language], i18n.language);
  const { data } = useQuery({
    queryKey: exchangeRatesKey,
    queryFn: ({ signal }) => getExchangeRates(signal),
    staleTime: 60 * 60_000,
    retry: 1,
  });

  const rate = data?.rates[target];
  const fxNote =
    data && rate && target !== 'USD'
      ? t(data.source === 'fallback' ? 'legal.fxNoteFallback' : 'legal.fxNote', {
          rate: new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: target,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(rate),
          date: formatInstantDate(data.as_of, locale),
        })
      : null;

  return {
    /** Convierte `amount` (en `currency`) a la moneda de la página y le da formato. */
    format: (amount: string, currency: string) =>
      formatLocalPrice(amount, currency, target, data?.rates, locale),
    fxNote,
  };
}
