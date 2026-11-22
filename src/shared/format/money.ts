import { type ExchangeRates } from '@/shared/api/schemas';
import { formatPrice } from './flight';

/** Monedas en que se muestran las tarifas; las cotizaciones siempre llegan en USD. */
export type DisplayCurrency = 'USD' | 'PEN';

/**
 * Moneda de la página según la región del navegador (primer idioma preferido): Perú → soles,
 * cualquier otra región → dólares. Si el idioma no trae región («es», «en»), decide el idioma
 * de la página: español → soles, inglés → dólares.
 */
export function displayCurrencyFor(
  browserLanguages: ReadonlyArray<string>,
  pageLanguage: string,
): DisplayCurrency {
  try {
    const region = browserLanguages[0] ? new Intl.Locale(browserLanguages[0]).region : undefined;
    if (region) return region === 'PE' ? 'PEN' : 'USD';
  } catch {
    // Etiqueta de idioma inválida: se usa el idioma de la página.
  }
  return pageLanguage.startsWith('en') ? 'USD' : 'PEN';
}

/**
 * Pasa `amount` de una moneda a otra con tasas «unidades por 1 USD». Devuelve `null` si falta
 * la tasa de alguna: quien llama muestra entonces la moneda original.
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: ExchangeRates['rates'],
): number | null {
  if (from === to) return amount;
  const fromRate = from === 'USD' ? 1 : rates[from];
  const toRate = to === 'USD' ? 1 : rates[to];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}

/**
 * Tarifa en la moneda de la página. Lo convertido se redondea a unidades enteras (un precio
 * referencial no necesita centavos); si no hay tasa se deja la moneda original.
 */
export function formatLocalPrice(
  amount: string,
  currency: string,
  target: DisplayCurrency,
  rates: ExchangeRates['rates'] | undefined,
  locale: string,
): string {
  if (currency === target) return formatPrice(amount, currency, locale);
  const converted = rates ? convertAmount(Number(amount), currency, target, rates) : null;
  if (converted === null) return formatPrice(amount, currency, locale);
  return formatPrice(String(Math.round(converted)), target, locale);
}
