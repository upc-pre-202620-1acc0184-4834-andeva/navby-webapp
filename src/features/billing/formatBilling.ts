import { type TFunction } from 'i18next';

/**
 * Montos de facturación siempre con 2 decimales fijos (a diferencia de `formatPrice` de vuelos,
 * que omite `.00` en enteros).
 */
export function formatBillingMoney(
  amount: string | number,
  currency: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

/** Costo unitario por búsqueda en un paquete de créditos. */
export function formatPerSearchPrice(
  price: string,
  searches: number,
  currency: string,
  locale: string,
): string | null {
  const numericPrice = Number(price);
  if (searches <= 0 || !Number.isFinite(numericPrice)) return null;
  return formatBillingMoney(numericPrice / searches, currency, locale);
}

/** Variación de créditos con signo explícito (`+100`, `−5`, `0`) y menos tipográfico. */
export function formatSignedCredits(delta: number, locale: string): string {
  if (delta === 0) return '0';
  return new Intl.NumberFormat(locale, { signDisplay: 'exceptZero' })
    .format(delta)
    .replace(/-/g, '\u2212');
}

/** Nombre localizado para los códigos conocidos (`pack_50`, `pack_100`, `pack_250`) con respaldo del API. */
export function localizePackageName(t: TFunction, code: string, fallbackName: string): string {
  return t(`billing.packages.names.${code}`, { defaultValue: fallbackName });
}
