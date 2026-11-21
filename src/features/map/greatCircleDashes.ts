export type LonLat = [number, number];
export type RgbTuple = [number, number, number];
export type RouteBounds = [LonLat, LonLat];

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface DashedArcSegment {
  source: LonLat;
  target: LonLat;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const ANTIPODAL_EPSILON = 1e-4;
const TINY_ANGLE_EPSILON = 1e-4;
const DASH_DUTY = 0.56;

export function normalizeLon180(lon: number): number {
  const shifted = ((((lon + 180) % 360) + 360) % 360) - 180;
  return shifted === -180 && lon > 0 ? 180 : shifted;
}

function normalizeLon360(lon: number): number {
  return ((lon % 360) + 360) % 360;
}

function toCartesian(lonDeg: number, latDeg: number): [number, number, number] {
  const lon = lonDeg * DEG_TO_RAD;
  const lat = latDeg * DEG_TO_RAD;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat)];
}

function fromCartesian(x: number, y: number, z: number): LonLat {
  const lon = Math.atan2(y, x) * RAD_TO_DEG;
  const hyp = Math.hypot(x, y);
  const lat = Math.atan2(z, hyp) * RAD_TO_DEG;
  return [normalizeLon180(lon), lat];
}

function slerpPoint(
  u: [number, number, number],
  v: [number, number, number],
  omega: number,
  sinOmega: number,
  t: number,
): LonLat {
  const a = Math.sin((1 - t) * omega) / sinOmega;
  const b = Math.sin(t * omega) / sinOmega;
  return fromCartesian(a * u[0] + b * v[0], a * u[1] + b * v[1], a * u[2] + b * v[2]);
}

function lerpLonLat(a: GeoPoint, b: GeoPoint, t: number): LonLat {
  const deltaLon = normalizeLon180(b.lon - a.lon);
  return [normalizeLon180(a.lon + deltaLon * t), a.lat + (b.lat - a.lat) * t];
}

function splitAtAntimeridian(p0: LonLat, p1: LonLat): DashedArcSegment[] {
  const [lon0, lat0] = p0;
  const [lon1, lat1] = p1;
  const rawDelta = lon1 - lon0;

  if (Math.abs(rawDelta) <= 180) {
    return [{ source: p0, target: p1 }];
  }

  // Cruce del antimeridiano ±180°: parte el segmento para evitar líneas horizontales envolventes.
  if (rawDelta < -180) {
    // Cruza hacia el este (+180 -> -180)
    const span = lon1 + 360 - lon0;
    const frac = span === 0 ? 0.5 : (180 - lon0) / span;
    const latMid = lat0 + frac * (lat1 - lat0);
    const segments: DashedArcSegment[] = [];
    if (180 - lon0 > 1e-6) {
      segments.push({ source: [lon0, lat0], target: [180, latMid] });
    }
    if (lon1 + 180 > 1e-6) {
      segments.push({ source: [-180, latMid], target: [lon1, lat1] });
    }
    return segments;
  }

  // Cruza hacia el oeste (-180 -> +180)
  const span = lon1 - 360 - lon0;
  const frac = span === 0 ? 0.5 : (-180 - lon0) / span;
  const latMid = lat0 + frac * (lat1 - lat0);
  const segments: DashedArcSegment[] = [];
  if (lon0 + 180 > 1e-6) {
    segments.push({ source: [lon0, lat0], target: [-180, latMid] });
  }
  if (180 - lon1 > 1e-6) {
    segments.push({ source: [180, latMid], target: [lon1, lat1] });
  }
  return segments;
}

/**
 * Construye segmentos discontinuos a lo largo del círculo máximo (SLERP) para cada tramo
 * consecutivo, con guarda antípoda y partición limpia sobre el antimeridiano `±180°`.
 */
export function buildDashedGreatCircleSegments(
  airports: ReadonlyArray<GeoPoint>,
): DashedArcSegment[] {
  if (airports.length < 2) return [];

  const result: DashedArcSegment[] = [];

  for (let legIdx = 0; legIdx < airports.length - 1; legIdx += 1) {
    const a = airports[legIdx];
    const b = airports[legIdx + 1];
    if (!a || !b) continue;

    if (Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(normalizeLon180(a.lon - b.lon)) < 1e-6) {
      continue;
    }

    const u = toCartesian(a.lon, a.lat);
    const v = toCartesian(b.lon, b.lat);
    const dot = Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]));
    const angularDist = Math.acos(dot);
    const angularDeg = angularDist * RAD_TO_DEG;

    const dashCount = Math.min(36, Math.max(6, Math.round(angularDeg * 0.6)));
    const useLinearFallback =
      angularDist > Math.PI - ANTIPODAL_EPSILON || angularDist < TINY_ANGLE_EPSILON;
    const sinOmega = useLinearFallback ? 1 : Math.sin(angularDist);

    const denominator = dashCount - 1 + DASH_DUTY;

    for (let i = 0; i < dashCount; i += 1) {
      const t0 = i / denominator;
      const t1 = Math.min(1, (i + DASH_DUTY) / denominator);
      if (t1 <= t0) continue;

      const p0 = useLinearFallback
        ? lerpLonLat(a, b, t0)
        : slerpPoint(u, v, angularDist, sinOmega, t0);
      const p1 = useLinearFallback
        ? lerpLonLat(a, b, t1)
        : slerpPoint(u, v, angularDist, sinOmega, t1);

      result.push(...splitAtAntimeridian(p0, p1));
    }
  }

  return result;
}

/** Punto a la fracción `t` (0..1) del círculo máximo entre dos coordenadas; recto si es antípoda o diminuto. */
export function interpolateGreatCircle(a: LonLat, b: LonLat, t: number): LonLat {
  const u = toCartesian(a[0], a[1]);
  const v = toCartesian(b[0], b[1]);
  const dot = Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]));
  const omega = Math.acos(dot);
  if (omega > Math.PI - ANTIPODAL_EPSILON || omega < TINY_ANGLE_EPSILON) {
    return lerpLonLat({ lon: a[0], lat: a[1] }, { lon: b[0], lat: b[1] }, t);
  }
  return slerpPoint(u, v, omega, Math.sin(omega), t);
}

/**
 * Los trazos visibles cuando la ruta lleva `progress` (0..1) dibujada: los completos y, el que
 * está en curso, recortado hasta su avance. Así la ruta "se dibuja" sin cortes sueltos.
 */
export function revealSegments(
  segments: ReadonlyArray<DashedArcSegment>,
  progress: number,
): DashedArcSegment[] {
  const scaled = Math.max(0, Math.min(1, progress)) * segments.length;
  const result: DashedArcSegment[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const local = Math.min(1, scaled - i);
    if (local <= 0) break;
    const seg = segments[i]!;
    result.push(
      local >= 1
        ? seg
        : {
            source: seg.source,
            target: [
              seg.source[0] + (seg.target[0] - seg.source[0]) * local,
              seg.source[1] + (seg.target[1] - seg.source[1]) * local,
            ],
          },
    );
  }
  return result;
}

/**
 * Calcula la envolvente `[[west, south], [east, north]]` encontrando la mayor brecha
 * circular de longitudes en `[0, 360)`. Cuando `west > east`, MapLibre ajusta el
 * antimeridiano automáticamente en `fitBounds` (rutas transpacíficas y globales).
 */
export function computeRouteBounds(points: ReadonlyArray<GeoPoint>): RouteBounds | null {
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (valid.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  const lons360: number[] = [];

  for (const pt of valid) {
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    lons360.push(normalizeLon360(pt.lon));
  }

  lons360.sort((a, b) => a - b);

  if (lons360.length === 1) {
    const lon = normalizeLon180(lons360[0]!);
    return [
      [lon, minLat],
      [lon, maxLat],
    ];
  }

  let largestGap = -1;
  let gapStart = lons360[0]!;
  let gapEnd = lons360[0]!;

  for (let i = 0; i < lons360.length - 1; i += 1) {
    const current = lons360[i]!;
    const next = lons360[i + 1]!;
    const gap = next - current;
    if (gap > largestGap) {
      largestGap = gap;
      gapStart = current;
      gapEnd = next;
    }
  }

  const wrapGap = 360 - lons360[lons360.length - 1]! + lons360[0]!;
  if (wrapGap > largestGap) {
    gapStart = lons360[lons360.length - 1]!;
    gapEnd = lons360[0]!;
  }

  // El arco mínimo que cubre todos los puntos empieza donde termina la mayor brecha.
  const west = normalizeLon180(gapEnd);
  const east = normalizeLon180(gapStart);

  return [
    [west, minLat],
    [east, maxLat],
  ];
}

export function parseCssColorToRgbTuple(raw: string): RgbTuple | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (hex.length === 3 && /^[0-9a-f]{3}$/i.test(hex)) {
      return [
        parseInt(hex[0]! + hex[0]!, 16),
        parseInt(hex[1]! + hex[1]!, 16),
        parseInt(hex[2]! + hex[2]!, 16),
      ];
    }
    if (hex.length >= 6 && /^[0-9a-f]{6}/i.test(hex)) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
    return null;
  }

  const rgbMatch =
    /^rgba?\(\s*([0-9]+(?:\.[0-9]+)?)[,\s]+([0-9]+(?:\.[0-9]+)?)[,\s]+([0-9]+(?:\.[0-9]+)?)/i.exec(
      value,
    );
  if (!rgbMatch) return null;

  const r = Math.max(0, Math.min(255, Math.round(Number(rgbMatch[1]))));
  const g = Math.max(0, Math.min(255, Math.round(Number(rgbMatch[2]))));
  const b = Math.max(0, Math.min(255, Math.round(Number(rgbMatch[3]))));
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return null;
  }
  return [r, g, b];
}

export function readCssRgbTuple(varName: string, fallback: RgbTuple): RgbTuple {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return [...fallback];
  }

  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName);
  return parseCssColorToRgbTuple(raw) ?? [...fallback];
}
