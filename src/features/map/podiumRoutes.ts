import { type PodiumOffer, type RouteAirportPoint } from '@/shared/api/schemas';
import { type PodiumRank } from '@/shared/state/podiumHighlight';
import { layoverMinutes } from '@/shared/time/flightTime';
import { type LonLat } from './greatCircleDashes';

export interface PodiumArc {
  rank: PodiumRank;
  from: string;
  to: string;
  source: LonLat;
  target: LonLat;
}

export interface PodiumStop extends RouteAirportPoint {
  markerRole: 'origin' | 'stop' | 'destination';
  layoverMinutes?: number;
}

/** Un arco por segmento; si falta un aeropuerto en `airports[]`, ese arco se omite. */
export function buildPodiumArcs(offers: readonly PodiumOffer[]): PodiumArc[] {
  const arcs: PodiumArc[] = [];
  const seen = new Set<string>();
  for (const offer of offers) {
    const coords = new Map(offer.airports.map((a) => [a.iata, [a.lon, a.lat] as LonLat]));
    for (const leg of offer.legs) {
      for (const segment of leg.segments) {
        const source = coords.get(segment.from);
        const target = coords.get(segment.to);
        // La vuelta repite el mismo trazo: se dibuja una vez por opción.
        const key = `${offer.rank}:${[segment.from, segment.to].sort().join('-')}`;
        if (!source || !target || seen.has(key)) continue;
        seen.add(key);
        arcs.push({
          rank: offer.rank as PodiumRank,
          from: segment.from,
          to: segment.to,
          source,
          target,
        });
      }
    }
  }
  return arcs;
}

/**
 * Marcadores del podio: origen y destino de la ida, y escalas con su conexión. En una escala
 * compartida manda la opción mejor ubicada (el podio llega ordenado por puesto).
 */
export function buildPodiumStops(offers: readonly PodiumOffer[]): PodiumStop[] {
  const stops = new Map<string, PodiumStop>();
  const firstOutbound = offers[0]?.legs.find((leg) => leg.direction === 'OUTBOUND');
  const originIata = firstOutbound?.segments[0]?.from;
  const destinationIata = firstOutbound?.segments[firstOutbound.segments.length - 1]?.to;

  for (const offer of offers) {
    const points = new Map(offer.airports.map((a) => [a.iata, a]));
    const add = (iata: string, stop: Omit<PodiumStop, 'iata' | 'lat' | 'lon'>) => {
      const point = points.get(iata);
      if (!point || stops.has(iata)) return;
      stops.set(iata, { iata, lat: point.lat, lon: point.lon, ...stop });
    };
    for (const leg of offer.legs) {
      const first = leg.segments[0];
      const last = leg.segments[leg.segments.length - 1];
      if (!first || !last) continue;
      add(first.from, { markerRole: first.from === originIata ? 'origin' : 'destination' });
      add(last.to, { markerRole: last.to === destinationIata ? 'destination' : 'origin' });
      leg.segments.slice(1).forEach((segment, index) => {
        const previous = leg.segments[index];
        if (!previous) return;
        add(segment.from, {
          markerRole: 'stop',
          layoverMinutes: layoverMinutes(previous.arrival, segment.departure),
        });
      });
    }
  }
  return [...stops.values()];
}
