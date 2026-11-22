import { type ExchangeRates } from '@/shared/api/schemas';

/** Respuesta de `GET /fx/rates` (el backend manda las tasas como texto). */
export const exchangeRatesResponse = {
  base: 'USD',
  rates: { USD: '1', PEN: '3.50' },
  as_of: '2026-11-22T00:02:32Z',
  source: 'provider',
};

/** Las mismas tasas ya interpretadas, para calcular lo esperado en pantalla. */
export const TEST_RATES: ExchangeRates['rates'] = { USD: 1, PEN: 3.5 };
