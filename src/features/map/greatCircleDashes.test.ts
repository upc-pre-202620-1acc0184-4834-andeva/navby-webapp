import { afterEach, describe, expect, it } from 'vitest';
import {
  buildDashedGreatCircleSegments,
  computeRouteBounds,
  type DashedArcSegment,
  interpolateGreatCircle,
  type LonLat,
  readCssRgbTuple,
  revealSegments,
} from './greatCircleDashes';

describe('greatCircleDashes', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--route-preview');
  });

  it('divide un tramo transpacífico que cruza ±180° sin saltos globales', () => {
    // NRT (140.39 E) -> LAX (-118.41 W) cruza el antimeridiano sobre el Pacífico.
    const segments = buildDashedGreatCircleSegments([
      { lat: 35.77, lon: 140.39 },
      { lat: 33.94, lon: -118.41 },
    ]);

    expect(segments.length).toBeGreaterThanOrEqual(6);
    for (const seg of segments) {
      expect(Math.abs(seg.target[0] - seg.source[0])).toBeLessThanOrEqual(180);
    }

    const touchesAntimeridian = segments.some(
      (seg) => Math.abs(seg.target[0]) === 180 || Math.abs(seg.source[0]) === 180,
    );
    expect(touchesAntimeridian).toBe(true);
  });

  it('mantiene continuidad geodésica segura en puntos casi antípodas', () => {
    const segments = buildDashedGreatCircleSegments([
      { lat: 0, lon: 0 },
      { lat: 0, lon: 179.999 },
    ]);

    expect(segments.length).toBe(36);
    for (const seg of segments) {
      expect(Number.isFinite(seg.source[0])).toBe(true);
      expect(Number.isFinite(seg.source[1])).toBe(true);
      expect(Number.isFinite(seg.target[0])).toBe(true);
      expect(Number.isFinite(seg.target[1])).toBe(true);
    }
  });

  it('retorna arreglo vacío si hay menos de dos aeropuertos o coordenadas idénticas', () => {
    expect(buildDashedGreatCircleSegments([])).toEqual([]);
    expect(buildDashedGreatCircleSegments([{ lat: -12.02, lon: -77.11 }])).toEqual([]);
    expect(
      buildDashedGreatCircleSegments([
        { lat: -12.02, lon: -77.11 },
        { lat: -12.02, lon: -77.11 },
      ]),
    ).toEqual([]);
  });

  it('calcula mayor brecha circular correcta para rutas transpacíficas y transatlánticas', () => {
    // Transpacífica: LIM (-77.11) -> LAX (-118.41) -> NRT (140.39) -> west > east para fitBounds sobre Pacífico
    const pacific = computeRouteBounds([
      { lat: -12.02, lon: -77.11 },
      { lat: 33.94, lon: -118.41 },
      { lat: 35.77, lon: 140.39 },
    ]);
    expect(pacific).not.toBeNull();
    expect(pacific![0][0]).toBeCloseTo(140.39, 2);
    expect(pacific![1][0]).toBeCloseTo(-77.11, 2);

    // Transatlántica hacia el este: LIM (-77.11) -> GRU (-46.47) -> JNB (28.25) -> SIN (103.99)
    const atlantic = computeRouteBounds([
      { lat: -12.02, lon: -77.11 },
      { lat: -23.43, lon: -46.47 },
      { lat: -26.14, lon: 28.25 },
      { lat: 1.36, lon: 103.99 },
    ]);
    expect(atlantic).not.toBeNull();
    expect(atlantic![0][0]).toBeCloseTo(-77.11, 2);
    expect(atlantic![1][0]).toBeCloseTo(103.99, 2);
  });

  it('lee variables CSS hex/rgb con fallback numérico cuando no hay estilos cargados', () => {
    expect(readCssRgbTuple('--route-preview', [138, 138, 147])).toEqual([138, 138, 147]);

    document.documentElement.style.setProperty('--route-preview', '#85858f');
    expect(readCssRgbTuple('--route-preview', [138, 138, 147])).toEqual([133, 133, 143]);

    document.documentElement.style.setProperty('--route-preview', 'rgb(96 74 255)');
    expect(readCssRgbTuple('--route-preview', [138, 138, 147])).toEqual([96, 74, 255]);
  });
});

describe('interpolateGreatCircle y revealSegments', () => {
  it('interpola extremos y el punto medio sobre el círculo máximo', () => {
    const a: LonLat = [0, 0];
    const b: LonLat = [90, 0];
    expect(interpolateGreatCircle(a, b, 0)[0]).toBeCloseTo(0);
    expect(interpolateGreatCircle(a, b, 1)[0]).toBeCloseTo(90);
    expect(interpolateGreatCircle(a, b, 0.5)[0]).toBeCloseTo(45);
  });

  it('no falla con puntos idénticos', () => {
    expect(interpolateGreatCircle([10, 10], [10, 10], 0.5)).toEqual([10, 10]);
  });

  it('revela los trazos completos y recorta el que va en curso', () => {
    const segments = [
      { source: [0, 0], target: [10, 0] },
      { source: [20, 0], target: [30, 0] },
    ] as DashedArcSegment[];
    expect(revealSegments(segments, 0)).toHaveLength(0);
    const half = revealSegments(segments, 0.75);
    expect(half).toHaveLength(2);
    expect(half[0]).toBe(segments[0]);
    expect(half[1]!.target[0]).toBeCloseTo(25);
    expect(revealSegments(segments, 1)).toEqual(segments);
  });
});
