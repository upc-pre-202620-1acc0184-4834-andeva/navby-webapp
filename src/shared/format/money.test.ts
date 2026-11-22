import { describe, expect, it } from 'vitest';
import { convertAmount, displayCurrencyFor, formatLocalPrice } from './money';

const rates = { USD: 1, PEN: 3.5 };
const nbsp = /\s/g;
/** `Intl` separa símbolo y cifra con espacios no separables: se normalizan para comparar. */
const plain = (value: string) => value.replace(nbsp, ' ');

describe('displayCurrencyFor', () => {
  it('usa soles si la región del navegador es Perú, en cualquier idioma de la página', () => {
    expect(displayCurrencyFor(['es-PE', 'en-US'], 'es')).toBe('PEN');
    expect(displayCurrencyFor(['es-PE'], 'en')).toBe('PEN');
  });

  it('usa dólares en cualquier otra región, aunque la página esté en español', () => {
    expect(displayCurrencyFor(['en-US'], 'en')).toBe('USD');
    expect(displayCurrencyFor(['es-MX', 'es'], 'es')).toBe('USD');
    expect(displayCurrencyFor(['es-ES'], 'es')).toBe('USD');
  });

  it('sin región en el navegador decide el idioma de la página', () => {
    expect(displayCurrencyFor(['es'], 'es')).toBe('PEN');
    expect(displayCurrencyFor(['en'], 'en')).toBe('USD');
    expect(displayCurrencyFor([], 'es')).toBe('PEN');
    expect(displayCurrencyFor(['no es válido'], 'en')).toBe('USD');
  });
});

describe('convertAmount', () => {
  it('convierte entre USD y PEN en ambos sentidos', () => {
    expect(convertAmount(100, 'USD', 'PEN', rates)).toBe(350);
    expect(convertAmount(350, 'PEN', 'USD', rates)).toBe(100);
  });

  it('no toca el monto si la moneda es la misma', () => {
    expect(convertAmount(80, 'USD', 'USD', {})).toBe(80);
  });

  it('devuelve null si falta la tasa', () => {
    expect(convertAmount(100, 'USD', 'PEN', {})).toBeNull();
    expect(convertAmount(100, 'EUR', 'PEN', rates)).toBeNull();
  });
});

describe('formatLocalPrice', () => {
  it('muestra soles enteros al convertir desde USD', () => {
    expect(plain(formatLocalPrice('240.00', 'USD', 'PEN', rates, 'es-PE'))).toBe('S/ 840');
    expect(plain(formatLocalPrice('241.10', 'USD', 'PEN', rates, 'es-PE'))).toBe('S/ 844');
  });

  it('deja el USD tal cual en inglés', () => {
    expect(plain(formatLocalPrice('980.50', 'USD', 'USD', rates, 'en-US'))).toBe('$980.50');
  });

  it('convierte un itinerario guardado en soles a dólares', () => {
    expect(plain(formatLocalPrice('350.00', 'PEN', 'USD', rates, 'en-US'))).toBe('$100');
  });

  it('cae a la moneda original sin tasas', () => {
    expect(plain(formatLocalPrice('240.00', 'USD', 'PEN', undefined, 'es-PE'))).toBe('USD 240');
  });
});
