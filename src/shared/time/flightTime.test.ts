import { describe, expect, it } from 'vitest';
import { dayOffset, formatLocalTime, layoverMinutes, splitMinutes } from './flightTime';

describe('flightTime', () => {
  it('formatea la hora de pared sin desplazarla por la zona del navegador', () => {
    expect(formatLocalTime('2026-11-01T08:30:00', 'es-PE')).toBe('08:30');
    expect(formatLocalTime('2026-11-01T23:05:00', 'en-US')).toBe('23:05');
  });

  it('calcula la conexión entre segmentos del mismo aeropuerto', () => {
    expect(layoverMinutes('2026-11-01T09:40:00', '2026-11-01T11:00:00')).toBe(80);
    expect(layoverMinutes('2026-11-01T23:30:00', '2026-11-02T01:00:00')).toBe(90);
    expect(layoverMinutes('2026-11-01T11:00:00', '2026-11-01T09:00:00')).toBe(0);
  });

  it('detecta la llegada al día siguiente', () => {
    expect(dayOffset('2026-11-01T22:00:00', '2026-11-02T06:00:00')).toBe(1);
    expect(dayOffset('2026-11-01T08:00:00', '2026-11-01T14:00:00')).toBe(0);
  });

  it('separa horas y minutos', () => {
    expect(splitMinutes(375)).toEqual({ hours: 6, minutes: 15 });
    expect(splitMinutes(45)).toEqual({ hours: 0, minutes: 45 });
  });
});
