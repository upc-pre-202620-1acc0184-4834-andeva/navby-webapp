import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { AUTH_LIQUID_DURATION_MS } from '@/shared/auth/authTransitionSide';

export type LiquidDirection = 'ltr' | 'rtl';

interface BoxRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const CARD_RADIUS_PX = 24; // rounded-3xl
const CONTOUR_SAMPLES = 64;
const SATELLITE_SAMPLES = 20;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number, t: number): number {
  let u = t;
  for (let i = 0; i < 6; i += 1) {
    const inv = 1 - u;
    const x = 3 * inv * inv * u * p1x + 3 * inv * u * u * p2x + u * u * u;
    const dx = 3 * inv * inv * p1x + 6 * inv * u * (p2x - p1x) + 3 * u * u * (1 - p2x);
    if (Math.abs(dx) < 1e-5) break;
    u = clamp(u - (x - t) / dx, 0, 1);
  }
  const inv = 1 - u;
  return 3 * inv * inv * u * p1y + 3 * inv * u * u * p2y + u * u * u;
}

function roundedRectPoint(theta: number, w: number, h: number, r: number): [number, number] {
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const ax = Math.abs(ux);
  const ay = Math.abs(uy);
  const dBox = Math.min(ax > 1e-6 ? w / ax : 1e9, ay > 1e-6 ? h / ay : 1e9);
  const bx = ux * dBox;
  const by = uy * dBox;
  const ix = Math.max(0, w - r);
  const iy = Math.max(0, h - r);

  if (Math.abs(bx) > ix && Math.abs(by) > iy && r > 0) {
    const cx = Math.sign(bx) * ix;
    const cy = Math.sign(by) * iy;
    const b = ux * cx + uy * cy;
    const c = cx * cx + cy * cy - r * r;
    const disc = Math.max(0, b * b - c);
    const t = b + Math.sqrt(disc);
    return [ux * t, uy * t];
  }

  return [bx, by];
}

function catmullRomClosedPath(pts: readonly [number, number][]): string {
  const n = pts.length;
  if (n < 3) return '';
  let d = `M ${pts[0]![0].toFixed(1)} ${pts[0]![1].toFixed(1)}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

function teardropPath(cx: number, cy: number, rx: number, ry: number, dir: number): string {
  if (rx <= 0.6 || ry <= 0.6) return '';
  const pts: [number, number][] = [];
  for (let i = 0; i < SATELLITE_SAMPLES; i += 1) {
    const a = (i / SATELLITE_SAMPLES) * Math.PI * 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const s = ux * dir;
    const taper = 1 + 0.16 * (1 - s * s) * (0.5 + 0.5 * s) - 0.62 * Math.pow((1 - s) * 0.5, 1.9);
    const tailPull = -dir * rx * 0.34 * Math.pow((1 - s) * 0.5, 2.1);
    pts.push([cx + ux * rx + tailPull, cy + uy * ry * taper]);
  }
  return catmullRomClosedPath(pts);
}

function buildMainDroplet(t: number, dir: number, origin: BoxRect, target: BoxRect) {
  const u = clamp(t / 0.86, 0, 1);
  const moveP = cubicBezier(0.36, 0.08, 0.2, 1.0, u);
  const drop = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.76)), 1.18);

  const startCx = origin.left + origin.width / 2;
  const endCx = target.left + target.width / 2;
  const startCy = origin.top + origin.height / 2;
  const endCy = target.top + target.height / 2;

  const cx = startCx + (endCx - startCx) * moveP;
  const arcLift = Math.sin(Math.PI * u) * -14;
  const cy = startCy + (endCy - startCy) * moveP + arcLift;

  const baseRx = (origin.width + (target.width - origin.width) * moveP) / 2;
  const baseRy = (origin.height + (target.height - origin.height) * moveP) / 2;
  const peakRx = Math.min(baseRx * 0.48, 168);
  const peakRy = Math.min(baseRy * 0.27, 114);

  const rx = baseRx + (peakRx - baseRx) * drop;
  const ry = baseRy + (peakRy - baseRy) * drop;
  const cr = CARD_RADIUS_PX + (Math.min(rx, ry) - CARD_RADIUS_PX) * drop;

  // Mezcla suave hacia elipse pura en vuelo para eliminar segmentos rectos y hombros
  const ellipseBlend = Math.pow(drop, 0.85);

  // Tensión superficial al despegar del borde origen y onda amortiguada al asentarse
  const detach = t >= 0.02 && t <= 0.26 ? Math.sin(Math.PI * ((t - 0.02) / 0.24)) : 0;
  const rippleElapsed = t - 0.68;
  const rippleAmp =
    t >= 0.68 ? Math.sin(rippleElapsed * 28) * Math.exp(-rippleElapsed * 10) * 9 : 0;

  const pts: [number, number][] = [];
  let minX = Infinity;
  let maxX = -Infinity;

  for (let i = 0; i < CONTOUR_SAMPLES; i += 1) {
    const theta = (i / CONTOUR_SAMPLES) * Math.PI * 2;
    const [rectX, rectY] = roundedRectPoint(theta, rx, ry, cr);
    const ellX = rx * Math.cos(theta);
    const ellY = ry * Math.sin(theta);

    let px = rectX + (ellX - rectX) * ellipseBlend;
    let py = rectY + (ellY - rectY) * ellipseBlend;

    const nx = rx > 0 ? px / rx : 0;
    const ny = ry > 0 ? py / ry : 0;
    const s = nx * dir;

    // Perfil C∞ de gota: frente lleno y cola hidrodinámica sin quiebres en s = 0
    const backWeight = (1 - s) * 0.5;
    const frontWeight = (1 + s) * 0.5;
    const profile =
      1 + drop * (0.22 * (1 - s * s) * frontWeight - 0.56 * Math.pow(backWeight, 1.85));
    py *= profile;

    px -= dir * drop * rx * 0.34 * Math.pow(backWeight, 2.15);
    px += dir * drop * rx * 0.08 * Math.pow(frontWeight, 2.2);

    if (detach > 0) {
      px -= dir * detach * 36 * (1 - ny * ny) * Math.pow(backWeight, 1.4);
    }
    if (rippleAmp !== 0) {
      px += dir * rippleAmp * (1 - ny * ny) * Math.pow(backWeight, 1.2);
    }

    const wx = cx + px;
    const wy = cy + py;
    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    pts.push([wx, wy]);
  }

  const tailTipX = dir === 1 ? minX : maxX;
  return {
    path: catmullRomClosedPath(pts),
    cx,
    cy,
    rx,
    ry,
    drop,
    tailTipX,
  };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Transición líquida 60 fps en SVG puro (sin filtros pesados de blur) que convierte
 * el panel de origen en una gota orgánica con tensión superficial y microgotas de estela
 * que cruzan hacia el lado opuesto antes de fundirse suavemente sobre el nuevo showcase.
 */
export function LiquidBridge({
  direction,
  transitionKey,
  targetCardRef,
}: {
  direction: LiquidDirection | null;
  transitionKey: number;
  targetCardRef: RefObject<HTMLDivElement | null>;
}) {
  const [active, setActive] = useState(() =>
    Boolean(direction && transitionKey > 0 && !prefersReducedMotion()),
  );

  const svgRef = useRef<SVGSVGElement | null>(null);
  const mainPathRef = useRef<SVGPathElement | null>(null);
  const sat1PathRef = useRef<SVGPathElement | null>(null);
  const sat2PathRef = useRef<SVGPathElement | null>(null);
  const sheenRef = useRef<SVGEllipseElement | null>(null);
  const shadowRef = useRef<SVGEllipseElement | null>(null);

  useLayoutEffect(() => {
    if (!direction || transitionKey === 0 || prefersReducedMotion()) {
      const id = window.requestAnimationFrame(() => setActive(false));
      return () => window.cancelAnimationFrame(id);
    }

    const svgEl = svgRef.current;
    const targetEl = targetCardRef.current;
    const width = targetEl?.offsetWidth ?? 0;
    const height = targetEl?.offsetHeight ?? 0;
    if (width <= 0 || height <= 0) {
      if (svgEl) svgEl.style.opacity = '0';
      const id = window.requestAnimationFrame(() => setActive(false));
      return () => window.cancelAnimationFrame(id);
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = vw >= 1280 ? 20 : 16; // p-4 xl:p-5 de AuthShowcase
    const targetLeft = direction === 'ltr' ? vw / 2 + pad : pad;
    const originLeft = direction === 'ltr' ? pad : vw / 2 + pad;
    const targetRect: BoxRect = {
      left: targetLeft,
      top: pad,
      width,
      height,
    };
    const originRect: BoxRect = {
      left: originLeft,
      top: pad,
      width,
      height: Math.min(height, Math.max(320, vh - pad * 2)),
    };

    const dir = direction === 'ltr' ? 1 : -1;
    if (svgEl) {
      svgEl.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    }

    const drawFrame = (t: number) => {
      const main = buildMainDroplet(t, dir, originRect, targetRect);
      mainPathRef.current?.setAttribute('d', main.path);

      // Borde sutil tipo menisco que resalta la gota en vuelo y converge al borde del card
      const strokeAlpha = 0.1 + main.drop * 0.22;
      mainPathRef.current?.setAttribute('stroke', `rgba(157, 144, 255, ${strokeAlpha.toFixed(3)})`);

      if (sheenRef.current) {
        const sheenCx = main.cx + dir * main.rx * 0.26;
        const sheenCy = main.cy - main.ry * 0.28;
        sheenRef.current.setAttribute('cx', sheenCx.toFixed(1));
        sheenRef.current.setAttribute('cy', sheenCy.toFixed(1));
        sheenRef.current.setAttribute('rx', (main.rx * 0.36).toFixed(1));
        sheenRef.current.setAttribute('ry', (main.ry * 0.22).toFixed(1));
        sheenRef.current.setAttribute(
          'transform',
          `rotate(${(-12 * dir).toFixed(1)} ${sheenCx.toFixed(1)} ${sheenCy.toFixed(1)})`,
        );
        sheenRef.current.setAttribute('opacity', (main.drop * 0.72).toFixed(3));
      }

      if (shadowRef.current) {
        shadowRef.current.setAttribute('cx', main.cx.toFixed(1));
        shadowRef.current.setAttribute('cy', (main.cy + main.ry * 1.12).toFixed(1));
        shadowRef.current.setAttribute('rx', (main.rx * 0.72).toFixed(1));
        shadowRef.current.setAttribute('ry', Math.max(14, main.ry * 0.16).toFixed(1));
        shadowRef.current.setAttribute('opacity', (main.drop * 0.32).toFixed(3));
      }

      // Microgota 1: se desprende sólida y se encoge al reabsorberse por tensión superficial
      if (sat1PathRef.current) {
        if (t >= 0.16 && t <= 0.56) {
          const p = (t - 0.16) / 0.4;
          const lag = Math.sin(Math.PI * p) * 56 * (1 - p * 0.55);
          const scale = Math.sin(Math.PI * Math.pow(p, 0.72));
          const sx = main.tailTipX - dir * lag;
          const sy = main.cy + Math.sin(p * Math.PI * 2) * 2.5;
          sat1PathRef.current.setAttribute('d', teardropPath(sx, sy, 15 * scale, 9 * scale, dir));
          sat1PathRef.current.setAttribute('opacity', scale > 0.08 ? '1' : '0');
        } else {
          sat1PathRef.current.setAttribute('opacity', '0');
        }
      }

      // Microgota 2: estela secundaria sólida más pequeña
      if (sat2PathRef.current) {
        if (t >= 0.2 && t <= 0.48) {
          const p = (t - 0.2) / 0.28;
          const lag = 24 + Math.sin(Math.PI * p) * 60 * (1 - p * 0.45);
          const scale = Math.sin(Math.PI * Math.pow(p, 0.78));
          const sx = main.tailTipX - dir * lag;
          const sy = main.cy - 5 * scale;
          sat2PathRef.current.setAttribute('d', teardropPath(sx, sy, 9 * scale, 5.5 * scale, dir));
          sat2PathRef.current.setAttribute('opacity', scale > 0.08 ? '1' : '0');
        } else {
          sat2PathRef.current.setAttribute('opacity', '0');
        }
      }

      // El puente permanece opaco hasta que el showcase destino debajo ya alcanzó opacidad 1
      if (svgEl) {
        const fade = t <= 0.84 ? 1 : 1 - (t - 0.84) / 0.16;
        svgEl.style.opacity = clamp(fade, 0, 1).toFixed(3);
      }
    };

    drawFrame(0);

    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const t = clamp((now - start) / AUTH_LIQUID_DURATION_MS, 0, 1);
      drawFrame(t);
      if (t < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setActive(false);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [direction, transitionKey, targetCardRef]);

  if (!active || !direction) return null;

  return (
    <div
      key={transitionKey}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 hidden overflow-hidden lg:block"
    >
      <svg ref={svgRef} className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <radialGradient
            id="navby-liquid-body"
            cx={direction === 'ltr' ? '58%' : '42%'}
            cy="42%"
            r="65%"
          >
            <stop offset="0%" stopColor="#1D1836" />
            <stop offset="58%" stopColor="#141120" />
            <stop offset="100%" stopColor="#12101B" />
          </radialGradient>
          <radialGradient id="navby-liquid-sheen" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(157, 144, 255, 0.24)" />
            <stop offset="65%" stopColor="rgba(96, 74, 255, 0.08)" />
            <stop offset="100%" stopColor="rgba(96, 74, 255, 0)" />
          </radialGradient>
          <radialGradient id="navby-liquid-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(18, 16, 27, 0.34)" />
            <stop offset="100%" stopColor="rgba(18, 16, 27, 0)" />
          </radialGradient>
        </defs>

        <ellipse ref={shadowRef} fill="url(#navby-liquid-shadow)" opacity="0" />
        <path
          ref={sat2PathRef}
          fill="#12101B"
          stroke="rgba(157, 144, 255, 0.25)"
          strokeWidth="1.2"
          opacity="0"
        />
        <path
          ref={sat1PathRef}
          fill="#12101B"
          stroke="rgba(157, 144, 255, 0.28)"
          strokeWidth="1.3"
          opacity="0"
        />
        <path
          ref={mainPathRef}
          fill="url(#navby-liquid-body)"
          stroke="rgba(157, 144, 255, 0.1)"
          strokeWidth="1.5"
        />
        <ellipse ref={sheenRef} fill="url(#navby-liquid-sheen)" opacity="0" />
      </svg>
    </div>
  );
}
