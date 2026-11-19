import { describe, expect, it } from 'vitest';
import {
  parsePreferences,
  preferenceKey,
  PROFILE_WEIGHTS,
  redistributeWeights,
  selectionFromApi,
  toApiPreferences,
  WEIGHT_KEYS,
  type PercentWeights,
  writePreferences,
} from './preferences';

const sum = (w: PercentWeights) => w.price + w.duration + w.stops;

describe('redistributeWeights', () => {
  it.each([
    // [actual, slider, valor, esperado]
    [{ price: 50, duration: 30, stops: 20 }, 'price', 40, { price: 40, duration: 35, stops: 25 }],
    [{ price: 100, duration: 0, stops: 0 }, 'price', 60, { price: 60, duration: 20, stops: 20 }],
    [{ price: 50, duration: 50, stops: 0 }, 'price', 30, { price: 30, duration: 70, stops: 0 }],
    [{ price: 50, duration: 30, stops: 20 }, 'stops', 100, { price: 0, duration: 0, stops: 100 }],
    [
      { price: 50, duration: 30, stops: 20 },
      'duration',
      33,
      { price: 45, duration: 35, stops: 20 },
    ],
    [{ price: 50, duration: 30, stops: 20 }, 'price', -10, { price: 0, duration: 60, stops: 40 }],
  ] as const)('%o: %s → %i', (current, key, value, expected) => {
    expect(redistributeWeights(current, key, value)).toEqual(expected);
  });

  it('llega a 40/40/20 desde Equilibrado con dos pasos de teclado en precio', () => {
    const step1 = redistributeWeights(PROFILE_WEIGHTS.BALANCED, 'price', 45);
    expect(step1).toEqual({ price: 45, duration: 35, stops: 20 });
    expect(redistributeWeights(step1, 'price', 40)).toEqual({ price: 40, duration: 40, stops: 20 });
  });

  it('siempre suma 100, en múltiplos de 5, con el slider movido en su valor', () => {
    const starts: PercentWeights[] = [
      ...Object.values(PROFILE_WEIGHTS),
      { price: 100, duration: 0, stops: 0 },
      { price: 0, duration: 0, stops: 100 },
      { price: 35, duration: 35, stops: 30 },
    ];
    for (const start of starts) {
      for (const key of WEIGHT_KEYS) {
        for (let value = 0; value <= 100; value += 5) {
          const next = redistributeWeights(start, key, value);
          expect(sum(next)).toBe(100);
          expect(next[key]).toBe(value);
          for (const k of WEIGHT_KEYS) {
            expect(next[k] % 5).toBe(0);
            expect(next[k]).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});

describe('preferencias en la URL', () => {
  const read = (query: string) => parsePreferences(new URLSearchParams(query));

  it('sin perfil o inválido = Equilibrado', () => {
    expect(read('')).toEqual({ profile: 'BALANCED' });
    expect(read('profile=CHEAP')).toEqual({ profile: 'BALANCED' });
    expect(read('profile=FAST')).toEqual({ profile: 'FAST' });
  });

  it('CUSTOM lee w y descarta pesos fuera de la regla', () => {
    expect(read('profile=CUSTOM&w=40,40,20')).toEqual({
      profile: 'CUSTOM',
      weights: { price: 40, duration: 40, stops: 20 },
    });
    for (const w of ['33,33,34', '50,40,20', '40,40', 'a,b,c']) {
      expect(read(`profile=CUSTOM&w=${w}`)).toEqual({
        profile: 'CUSTOM',
        weights: PROFILE_WEIGHTS.BALANCED,
      });
    }
  });

  it('escribe sin tocar los demás parámetros y omite Equilibrado', () => {
    const base = new URLSearchParams('from=LIM&profile=SAVER&w=1,2,3&sid=s1');
    expect(writePreferences(base, { profile: 'BALANCED' }).toString()).toBe('from=LIM&sid=s1');
    expect(
      writePreferences(base, {
        profile: 'CUSTOM',
        weights: { price: 40, duration: 40, stops: 20 },
      }).toString(),
    ).toBe('from=LIM&profile=CUSTOM&sid=s1&w=40%2C40%2C20');
  });
});

describe('conversión con la API', () => {
  it('pesos en fracciones y de vuelta sin errores de coma flotante', () => {
    const custom = { profile: 'CUSTOM' as const, weights: { price: 35, duration: 45, stops: 20 } };
    const api = toApiPreferences(custom);
    expect(api).toEqual({
      profile: 'CUSTOM',
      weights: { price: 0.35, duration: 0.45, stops: 0.2 },
    });
    expect(selectionFromApi({ profile: 'CUSTOM', weights: api.weights! })).toEqual(custom);
    expect(toApiPreferences({ profile: 'SAVER' })).toEqual({ profile: 'SAVER' });
  });

  it('la clave distingue perfiles y pesos', () => {
    expect(preferenceKey({ profile: 'FAST' })).toBe('FAST');
    expect(
      preferenceKey({ profile: 'CUSTOM', weights: { price: 40, duration: 40, stops: 20 } }),
    ).toBe('CUSTOM:40-40-20');
    expect(
      preferenceKey(
        selectionFromApi({
          profile: 'BALANCED',
          weights: { price: 0.5, duration: 0.3, stops: 0.2 },
        }),
      ),
    ).toBe('BALANCED');
  });
});
