import { describe, expect, it } from 'vitest';
import { podiumResponse, roundTripOffer } from '@/test/fixtures/podium';
import { buildPodiumArcs, buildPodiumStops } from './podiumRoutes';

describe('podiumRoutes', () => {
  it('dibuja un arco por segmento y por opción', () => {
    const arcs = buildPodiumArcs(podiumResponse().podium);
    expect(arcs.map((arc) => `${arc.rank}:${arc.from}-${arc.to}`)).toEqual([
      '1:LIM-MAD',
      '2:LIM-PTY',
      '2:PTY-MAD',
      '3:LIM-MAD',
    ]);
  });

  it('no repite el trazo de la vuelta y omite aeropuertos sin coordenadas', () => {
    expect(buildPodiumArcs([roundTripOffer])).toHaveLength(1);
    const withoutMad = { ...roundTripOffer, airports: roundTripOffer.airports.slice(0, 1) };
    expect(buildPodiumArcs([withoutMad])).toEqual([]);
  });

  it('marca origen, destino y escalas con su conexión', () => {
    const stops = buildPodiumStops(podiumResponse().podium);
    expect(stops.map((stop) => [stop.iata, stop.markerRole, stop.layoverMinutes])).toEqual([
      ['LIM', 'origin', undefined],
      ['MAD', 'destination', undefined],
      ['PTY', 'stop', 80],
    ]);
  });
});
