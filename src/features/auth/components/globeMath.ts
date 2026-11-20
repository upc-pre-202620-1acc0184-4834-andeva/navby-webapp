import DottedMap from 'dotted-map';

export type Vec3 = [number, number, number];

export interface GlobeTheme {
  ground: string;
  land: string;
  pop: string;
  arc: string;
  glow: string;
  text: string;
  muted: string;
}

export const NAVBY_GLOBE_PAPER: GlobeTheme = {
  ground: '#F2F0EB',
  land: '#4A5568',
  pop: '#604AFF',
  arc: '#FF6B35',
  glow: 'rgb(96 74 255 / 0.14)',
  text: '#262626',
  muted: '#66666E',
};

export const NAVBY_GLOBE_NIGHT: GlobeTheme = {
  ground: '#12101B',
  land: '#6E6A86',
  pop: '#9D90FF',
  arc: '#FF6B35',
  glow: 'rgb(96 74 255 / 0.24)',
  text: '#FFFFFF',
  muted: '#B4B4C4',
};

export interface LandDot {
  v: Vec3;
  phase: number;
  pop: boolean;
}

const RAD = Math.PI / 180;
let cachedDots: LandDot[] | null = null;

/** Convierte longitud y latitud (en grados) a un vector unitario 3D. */
export function toVec(lon: number, lat: number): Vec3 {
  const phi = lat * RAD;
  const lam = lon * RAD;
  const cosPhi = Math.cos(phi);
  return [cosPhi * Math.sin(lam), Math.sin(phi), cosPhi * Math.cos(lam)];
}

/** Rota un vector 3D según guiñada (yaw) e inclinación (tilt). */
export function rotate(v: Vec3, yaw: number, tilt: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = v[0] * cy - v[2] * sy;
  const z1 = v[0] * sy + v[2] * cy;

  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const y2 = v[1] * ct - z1 * st;
  const z2 = v[1] * st + z1 * ct;

  return [x1, y2, z2];
}

/** Interpolación esférica (Slerp) entre dos vectores unitarios sobre el círculo máximo. */
export function slerp(a: Vec3, b: Vec3, u: number): Vec3 {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-4) return a;
  const sinO = Math.sin(omega);
  const s0 = Math.sin((1 - u) * omega) / sinO;
  const s1 = Math.sin(u * omega) / sinO;
  return [a[0] * s0 + b[0] * s1, a[1] * s0 + b[1] * s1, a[2] * s0 + b[2] * s1];
}

/** Genera y cachea los puntos de tierra firme del planeta usando dotted-map. */
export function landDots(gridHeight = 68): LandDot[] {
  if (cachedDots) return cachedDots;

  const map = new DottedMap({ height: gridHeight, grid: 'diagonal' });
  const { region, width, height } = map.image;
  const lonSpan = region.lng.max - region.lng.min;
  const latSpan = region.lat.max - region.lat.min;

  cachedDots = map.getPoints().map((pt, idx) => {
    const lon = region.lng.min + (pt.x / width) * lonSpan;
    const lat = region.lat.max - (pt.y / height) * latSpan;
    // Selección determinista de puntos con efecto "pop" (inspirado en geo-visitors)
    const hash = Math.abs(Math.sin(idx * 12.9898 + pt.x * 78.233) * 43758.5453);
    const frac = hash - Math.floor(hash);
    return {
      v: toVec(lon, lat),
      phase: frac * Math.PI * 2,
      pop: frac > 0.87,
    };
  });

  return cachedDots;
}

export interface DrawGlobeOptions {
  cx: number;
  cy: number;
  r: number;
  yaw: number;
  tilt: number;
  timeSec: number;
  reduced: boolean;
}

/** Dibuja la esfera punteada con halo atmosférico y efecto pop de píxeles. */
export function drawGlobe(
  ctx: CanvasRenderingContext2D,
  dots: LandDot[],
  opts: DrawGlobeOptions,
  colors: { land: string; pop: string; glow: string },
  dotRadius: number,
) {
  const { cx, cy, r, yaw, tilt, timeSec, reduced } = opts;

  // Halo atmosférico suave detrás del globo
  const grad = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r * 1.18);
  grad.addColorStop(0, colors.glow);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2);
  ctx.fill();

  // Contorno sutil de la esfera
  ctx.strokeStyle = colors.land;
  ctx.globalAlpha = 0.14;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Puntos de los continentes
  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i]!;
    const [x, y, z] = rotate(dot.v, yaw, tilt);
    const px = cx + x * r;
    const py = cy - y * r;

    if (z <= 0) {
      // Cara posterior tenue
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = colors.land;
      ctx.beginPath();
      ctx.arc(px, py, dotRadius * 0.78, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    const depthAlpha = 0.28 + z * 0.62;
    if (dot.pop) {
      const wave = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(timeSec * 2.1 + dot.phase);
      if (wave > 0.65) {
        const boost = (wave - 0.65) / 0.35;
        ctx.globalAlpha = Math.min(1, depthAlpha + boost * 0.45);
        ctx.fillStyle = colors.pop;
        ctx.beginPath();
        ctx.arc(px, py, dotRadius * (1 + boost * 0.65), 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
    }

    ctx.globalAlpha = depthAlpha;
    ctx.fillStyle = colors.land;
    ctx.beginPath();
    ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}
