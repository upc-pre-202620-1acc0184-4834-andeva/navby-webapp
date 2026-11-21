import {
  type PodiumResponse,
  type PreviewPair,
  type RouteAirportPoint,
  type RoutePreviewResponse,
} from '@/shared/api/schemas';

/**
 * Esquema de la simulación: diagrama por capas de izquierda a derecha (origen → saltos → destino).
 * Es ilustrativo, no un mapa: la geografía real vive en el mapa. Toda arista une dos nodos
 * dibujados y cada candidata evaluada es una ruta completa origen → … → destino.
 */
export const VIEW_WIDTH = 400;
export const VIEW_HEIGHT = 260;
const PAD_X = 44;
const PAD_Y = 44;
const LANE_GAP = 56;
const MIN_STOP_DX = 52;
const CANDIDATES_PER_PAIR = 2;

export type SimRole = 'origin' | 'destination' | 'best-stop' | 'alt-stop' | 'network';

export interface SimNode {
  id: string;
  label: string;
  x: number;
  y: number;
  role: SimRole;
  /** Momento (0..1) en que se descubre durante el barrido por niveles. */
  bfsRevealAt: number;
  /** Momento (0..1) en que se evalúa durante la búsqueda guiada. */
  astarRevealAt: number;
  /** Capa 1 o 2 de los nodos de red; 0 para aeropuertos reales. */
  level: 0 | 1 | 2;
}

export type SimEdgeKind = 'bfs-hop1' | 'bfs-hop2' | 'candidate' | 'best' | 'podium-alt';

export interface SimEdge {
  id: string;
  from: SimNode;
  to: SimNode;
  kind: SimEdgeKind;
  revealAt: number;
  /** Solo en candidatas: desde este momento la ruta completa se da por descartada. */
  pruneAt?: number;
}

export interface SimulationGeometry {
  width: number;
  height: number;
  origin: SimNode;
  destination: SimNode;
  realNodes: SimNode[];
  networkNodes: SimNode[];
  edges: SimEdge[];
  pairs: PreviewPair[];
  pairsCount: number;
  totalSimNodes: number;
  routeChain: string;
}

/** Curva en S horizontal: sale y llega en horizontal, sin cruces raros entre capas. */
export function edgePath(from: SimNode, to: SimNode): string {
  const mx = (from.x + to.x) / 2;
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${mx.toFixed(1)} ${from.y.toFixed(1)}, ${mx.toFixed(1)} ${to.y.toFixed(1)}, ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

function haversineKm(a: RouteAirportPoint, b: RouteAirportPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** Reparte `count` posiciones verticales a lo largo del alto útil, centradas. */
function spreadY(count: number): number[] {
  if (count <= 1) return [VIEW_HEIGHT / 2];
  const span = VIEW_HEIGHT - PAD_Y * 2;
  return Array.from({ length: count }, (_, i) => PAD_Y + (span * i) / (count - 1));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildSimulationGeometry(
  preview: RoutePreviewResponse | null | undefined,
  podium: PodiumResponse | undefined,
): SimulationGeometry | null {
  const best = preview?.best_route?.airports ?? [];
  if (!preview || best.length < 2) return null;

  const pairs = preview.pairs;
  const pairsCount = Math.max(1, preview.telemetry.pairs_evaluated || pairs.length);
  const paths: RouteAirportPoint[][] = [
    best,
    ...(podium?.podium ?? []).map((offer) => offer.airports).filter((path) => path.length >= 2),
  ];

  const bestOrigin = best[0]!;
  const bestDest = best[best.length - 1]!;
  const originIatas = unique([
    bestOrigin.iata,
    ...pairs.map((p) => p.origin),
    ...paths.map((p) => p[0]!.iata),
  ]);
  const destIatas = unique([
    bestDest.iata,
    ...pairs.map((p) => p.destination),
    ...paths.map((p) => p[p.length - 1]!.iata),
  ]);
  const endpointSet = new Set([...originIatas, ...destIatas]);

  const nodes = new Map<string, SimNode>();
  const addEndpoints = (iatas: string[], role: 'origin' | 'destination', x: number) => {
    const ys = spreadY(iatas.length);
    iatas.forEach((iata, i) => {
      nodes.set(iata, {
        id: iata,
        label: iata,
        x,
        y: ys[i]!,
        role,
        level: 0,
        bfsRevealAt: role === 'origin' ? 0 : 0.22,
        astarRevealAt: role === 'origin' ? 0.28 : 0.34,
      });
    });
  };
  addEndpoints(originIatas, 'origin', PAD_X);
  addEndpoints(destIatas, 'destination', VIEW_WIDTH - PAD_X);

  // Escalas reales: x según qué tan avanzadas están en el trayecto, y en carriles sin solaparse.
  const bestStopSet = new Set(best.slice(1, -1).map((p) => p.iata));
  const lanes = [0, -1, 1, -2, 2].map((n) => VIEW_HEIGHT / 2 + n * LANE_GAP);
  const placed: SimNode[] = [];
  let stopIndex = 0;
  for (const path of paths) {
    const first = path[0]!;
    const last = path[path.length - 1]!;
    for (const stop of path.slice(1, -1)) {
      if (nodes.has(stop.iata) || endpointSet.has(stop.iata)) continue;
      const dOrigin = haversineKm(first, stop);
      const dDest = haversineKm(stop, last);
      const frac = dOrigin + dDest === 0 ? 0.5 : dOrigin / (dOrigin + dDest);
      const x = PAD_X + (VIEW_WIDTH - PAD_X * 2) * clamp(frac, 0.22, 0.78);
      const y =
        lanes.find((laneY) =>
          placed.every((p) => p.y !== laneY || Math.abs(p.x - x) >= MIN_STOP_DX),
        ) ?? lanes[lanes.length - 1]!;
      const node: SimNode = {
        id: stop.iata,
        label: stop.iata,
        x,
        y,
        role: bestStopSet.has(stop.iata) ? 'best-stop' : 'alt-stop',
        level: 0,
        bfsRevealAt: 0.1 + stopIndex * 0.02,
        astarRevealAt: 0.34 + stopIndex * 0.04,
      };
      stopIndex += 1;
      nodes.set(stop.iata, node);
      placed.push(node);
    }
  }
  const realNodes = [...nodes.values()];

  // Malla de fondo: dos columnas de nodos que ilustran el barrido por niveles.
  const buildColumn = (count: number, level: 1 | 2, xFrac: number): SimNode[] => {
    const ys = spreadY(count);
    const column: SimNode[] = [];
    ys.forEach((baseY, i) => {
      const jitterX = ((i * 37) % 11) - 5;
      let y = baseY + (level === 1 ? 0 : (VIEW_HEIGHT - PAD_Y * 2) / (count * 2));
      const x = PAD_X + (VIEW_WIDTH - PAD_X * 2) * xFrac + jitterX;
      // Se aparta de los aeropuertos reales para no tapar sus etiquetas.
      for (let tries = 0; tries < 4; tries += 1) {
        const clash = realNodes.find((n) => Math.hypot(n.x - x, n.y - y) < 26);
        if (!clash) break;
        y += 22;
      }
      if (y > VIEW_HEIGHT - 14 || realNodes.some((n) => Math.hypot(n.x - x, n.y - y) < 26)) return;
      const bfsStart = level === 1 ? 0.04 : 0.15;
      const bfsSpan = level === 1 ? 0.11 : 0.12;
      column.push({
        id: `n${level}-${i}`,
        label: '',
        x,
        y,
        role: 'network',
        level,
        bfsRevealAt: bfsStart + (i / count) * bfsSpan,
        astarRevealAt: (level === 1 ? 0.29 : 0.36) + (i / count) * (level === 1 ? 0.17 : 0.26),
      });
    });
    return column;
  };
  const hop1 = buildColumn(8, 1, 0.3);
  const hop2 = buildColumn(9, 2, 0.64);
  const networkNodes = [...hop1, ...hop2];

  const origins = originIatas.map((iata) => nodes.get(iata)!);
  const nearestByY = (list: SimNode[], y: number): SimNode =>
    list.reduce((a, b) => (Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a));

  const edges: SimEdge[] = [];

  // Barrido por niveles: cada nodo se cuelga del más cercano de la capa anterior.
  for (const node of hop1) {
    edges.push({
      id: `bfs1-${node.id}`,
      from: nearestByY(origins, node.y),
      to: node,
      kind: 'bfs-hop1',
      revealAt: node.bfsRevealAt,
    });
  }
  for (const node of hop2) {
    edges.push({
      id: `bfs2-${node.id}`,
      from: nearestByY(hop1, node.y),
      to: node,
      kind: 'bfs-hop2',
      revealAt: node.bfsRevealAt,
    });
  }

  // Búsqueda guiada: cada candidata es una ruta completa origen → salto 1 → salto 2 → destino.
  const evaluated: Array<{ origin: string; destination: string }> =
    pairs.length > 0 ? pairs : [{ origin: bestOrigin.iata, destination: bestDest.iata }];
  const pairSlice = 0.4 / evaluated.length;
  evaluated.forEach((pair, pIdx) => {
    const from = nodes.get(pair.origin);
    const target = nodes.get(pair.destination);
    if (!from || !target || hop1.length === 0 || hop2.length === 0) return;
    const midY = (from.y + target.y) / 2;
    const byMid = [...hop1].sort((a, b) => Math.abs(a.y - midY) - Math.abs(b.y - midY));
    const byTarget = [...hop2].sort((a, b) => Math.abs(a.y - target.y) - Math.abs(b.y - target.y));
    for (let c = 0; c < CANDIDATES_PER_PAIR; c += 1) {
      const h1 = byMid[(c * 2 + pIdx) % byMid.length]!;
      const h2 = byTarget[(c * 2 + pIdx) % byTarget.length]!;
      const start = 0.28 + pIdx * pairSlice + c * pairSlice * 0.4;
      const pruneAt = start + 0.1;
      const chain = [from, h1, h2, target];
      for (let i = 0; i < chain.length - 1; i += 1) {
        edges.push({
          id: `cand-${pIdx}-${c}-${i}`,
          from: chain[i]!,
          to: chain[i + 1]!,
          kind: 'candidate',
          revealAt: start + i * 0.02,
          pruneAt,
        });
      }
    }
  });

  // Ruta mínima elegida.
  const bestEdgeKeys = new Set<string>();
  for (let i = 0; i < best.length - 1; i += 1) {
    const from = nodes.get(best[i]!.iata)!;
    const to = nodes.get(best[i + 1]!.iata)!;
    bestEdgeKeys.add(`${from.id}>${to.id}`);
    edges.push({
      id: `best-${from.id}-${to.id}`,
      from,
      to,
      kind: 'best',
      revealAt: 0.66 + (i / Math.max(1, best.length - 1)) * 0.16,
    });
  }

  // Alternativas del podio.
  const altKeys = new Set<string>();
  for (const path of paths.slice(1)) {
    for (let i = 0; i < path.length - 1; i += 1) {
      const from = nodes.get(path[i]!.iata);
      const to = nodes.get(path[i + 1]!.iata);
      if (!from || !to) continue;
      const key = `${from.id}>${to.id}`;
      if (bestEdgeKeys.has(key) || altKeys.has(key)) continue;
      altKeys.add(key);
      edges.push({
        id: `alt-${key}`,
        from,
        to,
        kind: 'podium-alt',
        revealAt: 0.86 + Math.min(0.1, altKeys.size * 0.03),
      });
    }
  }

  return {
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    origin: nodes.get(bestOrigin.iata)!,
    destination: nodes.get(bestDest.iata)!,
    realNodes,
    networkNodes,
    edges,
    pairs,
    pairsCount,
    totalSimNodes: Math.max(1, preview.telemetry.astar_nodes_expanded || networkNodes.length),
    routeChain: best.map((a) => a.iata).join(' → '),
  };
}
