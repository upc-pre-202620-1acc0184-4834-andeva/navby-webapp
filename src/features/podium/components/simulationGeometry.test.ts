import { describe, expect, it } from 'vitest';
import { type PodiumResponse, type RoutePreviewResponse } from '@/shared/api/schemas';
import { buildSimulationGeometry, VIEW_HEIGHT, VIEW_WIDTH } from './simulationGeometry';

const LIM = { iata: 'LIM', lat: -12.02, lon: -77.11 };
const LAX = { iata: 'LAX', lat: 33.94, lon: -118.41 };
const PTY = { iata: 'PTY', lat: 9.07, lon: -79.38 };
const NRT = { iata: 'NRT', lat: 35.76, lon: 140.39 };

const preview: RoutePreviewResponse = {
  reachable: true,
  pairs: [
    { origin: 'LIM', destination: 'NRT', min_stops: 1, t_min_minutes: 1100 },
    { origin: 'LIM', destination: 'HND', min_stops: 1, t_min_minutes: 1130 },
  ],
  best_route: { t_min_minutes: 1100, airports: [LIM, LAX, NRT] },
  telemetry: { pairs_evaluated: 2, bfs_ms: 3, astar_ms: 2, astar_nodes_expanded: 40 },
};

const podium = {
  podium: [
    { airports: [LIM, PTY, NRT].map((a) => ({ ...a, timezone: 'UTC' })) },
    { airports: [LIM, NRT].map((a) => ({ ...a, timezone: 'UTC' })) },
  ],
} as unknown as PodiumResponse;

describe('buildSimulationGeometry', () => {
  it('devuelve null sin ruta base', () => {
    expect(buildSimulationGeometry(null, undefined)).toBeNull();
    expect(buildSimulationGeometry({ ...preview, best_route: null }, undefined)).toBeNull();
  });

  it('ninguna arista queda suelta: todas unen nodos dibujados', () => {
    const geometry = buildSimulationGeometry(preview, podium)!;
    const drawn = new Set([...geometry.realNodes, ...geometry.networkNodes].map((n) => n.id));
    expect(geometry.edges.length).toBeGreaterThan(0);
    for (const edge of geometry.edges) {
      expect(drawn.has(edge.from.id)).toBe(true);
      expect(drawn.has(edge.to.id)).toBe(true);
    }
  });

  it('cada candidata es una ruta completa de origen a destino, sin cortes', () => {
    const geometry = buildSimulationGeometry(preview, podium)!;
    const chains = new Map<string, typeof geometry.edges>();
    for (const edge of geometry.edges.filter((e) => e.kind === 'candidate')) {
      const key = edge.id.split('-').slice(1, 3).join('-');
      chains.set(key, [...(chains.get(key) ?? []), edge]);
    }
    expect(chains.size).toBeGreaterThan(0);
    for (const chain of chains.values()) {
      const ordered = [...chain].sort((a, b) => a.revealAt - b.revealAt);
      ordered.slice(1).forEach((edge, i) => expect(edge.from.id).toBe(ordered[i]!.to.id));
      expect(ordered[0]!.from.role).toBe('origin');
      expect(ordered[ordered.length - 1]!.to.role).toBe('destination');
    }
  });

  it('coloca origen a la izquierda, destinos a la derecha y todo dentro del lienzo', () => {
    const geometry = buildSimulationGeometry(preview, podium)!;
    expect(geometry.origin.x).toBeLessThan(geometry.destination.x);
    for (const node of [...geometry.realNodes, ...geometry.networkNodes]) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(VIEW_WIDTH);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(VIEW_HEIGHT);
    }
    // Incluye el segundo destino de los pares (HND) aunque no figure en ninguna ruta.
    expect(geometry.realNodes.map((n) => n.id)).toContain('HND');
  });

  it('no superpone etiquetas de aeropuertos reales', () => {
    const { realNodes } = buildSimulationGeometry(preview, podium)!;
    for (const [i, a] of realNodes.entries()) {
      for (const b of realNodes.slice(i + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(24);
      }
    }
  });
});
