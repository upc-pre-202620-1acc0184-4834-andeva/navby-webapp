import { describe, expect, it } from 'vitest';
import { localizeCountryName } from './countryLocalization';

describe('localizeCountryName', () => {
  it('traduce países clave y alias históricos de OpenFlights al español', () => {
    expect(localizeCountryName('Japan', 'es')).toBe('Japón');
    expect(localizeCountryName('United Kingdom', 'es')).toBe('Reino Unido');
    expect(localizeCountryName('United States', 'es')).toBe('Estados Unidos');
    expect(localizeCountryName('Colombia', 'es')).toBe('Colombia');
    expect(localizeCountryName('Peru', 'es')).toBe('Perú');
    expect(localizeCountryName('Czech Republic', 'es')).toMatch(/Chequia|República Checa/i);
    expect(localizeCountryName('Turkey', 'es')).toMatch(/Turquía|Türkiye/i);
    expect(localizeCountryName('Burma', 'es')).toMatch(/Myanmar|Birmania/i);
    expect(localizeCountryName('Netherlands Antilles', 'es')).toBe('Antillas Neerlandesas');
  });

  it('mantiene nombres en inglés y devuelve el texto original si no reconoce el país', () => {
    expect(localizeCountryName('Japan', 'en')).toBe('Japan');
    expect(localizeCountryName('United Kingdom', 'en')).toBe('United Kingdom');
    expect(localizeCountryName('Unknown Territory', 'es')).toBe('Unknown Territory');
  });
});
