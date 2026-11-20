import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/ui/cn';
import {
  drawGlobe,
  type GlobeTheme,
  landDots,
  NAVBY_GLOBE_NIGHT,
  rotate,
  slerp,
  toVec,
  type Vec3,
} from './globeMath';

export interface GlobePlace {
  name: string;
  lon: number;
  lat: number;
  note?: string;
}

const LIMA_HUB: GlobePlace = { name: 'Lima', lon: -77.04, lat: -12.05 };

const NAVBY_DESTINATIONS: GlobePlace[] = [
  { name: 'Tokio', lon: 139.69, lat: 35.69, note: '22 h 15 m' },
  { name: 'Madrid', lon: -3.7, lat: 40.42, note: '11 h 45 m' },
  { name: 'Nueva York', lon: -74.01, lat: 40.71, note: '7 h 40 m' },
  { name: 'Londres', lon: -0.13, lat: 51.51, note: '12 h 50 m' },
  { name: 'París', lon: 2.35, lat: 48.86, note: '12 h 30 m' },
  { name: 'Buenos Aires', lon: -58.38, lat: -34.6, note: '4 h 25 m' },
  { name: 'Ciudad de México', lon: -99.13, lat: 19.43, note: '5 h 50 m' },
  { name: 'Bogotá', lon: -74.07, lat: 4.71, note: '3 h 05 m' },
  { name: 'Miami', lon: -80.19, lat: 25.76, note: '5 h 35 m' },
];

interface RouteGlobeProps {
  hub?: GlobePlace;
  places?: GlobePlace[];
  theme?: GlobeTheme;
  motion?: 'full' | 'reduced';
  className?: string;
  style?: CSSProperties;
}

/**
 * Globo interactivo de rutas ortodrómicas (adaptado de 21st.dev RouteGlobe + pop de píxeles).
 * Arrastrable 1:1 con inercia, rotación suave en reposo, arcos con cometas y pulso en destino.
 */
export function RouteGlobe({
  hub = LIMA_HUB,
  places = NAVBY_DESTINATIONS,
  theme = NAVBY_GLOBE_NIGHT,
  motion = 'full',
  className,
  style,
}: RouteGlobeProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ p: GlobePlace; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    const cv = canvasRef.current;
    if (!el || !cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const reduced =
      motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dots = landDots(window.innerWidth < 640 ? 52 : 68);
    const H = toVec(hub.lon, hub.lat);
    const routes = places.map((p, i) => ({
      p,
      v: toVec(p.lon, p.lat),
      offset: i / places.length,
    }));

    const RAD = Math.PI / 180;
    const st = {
      yaw: hub.lon * RAD - 0.35,
      tilt: 14 * RAD,
      vy: 0,
      vt: 0,
      drag: false,
      px: 0,
      py: 0,
      last: 0,
      idle: 0,
    };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let alive = true;
    let visible = true;
    const t0 = performance.now();
    const pins: { p: GlobePlace; x: number; y: number; front: boolean }[] = [];

    const size = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = el.clientWidth;
      height = el.clientHeight;
      cv.width = Math.round(width * dpr);
      cv.height = Math.round(height * dpr);
    };

    const project = (v: Vec3, lift: number, r: number, cx: number, cy: number) => {
      const [x, y, z] = rotate(v, st.yaw, st.tilt);
      return { x: cx + x * r * lift, y: cy - y * r * lift, z };
    };

    const draw = (now: number) => {
      if (width === 0 || height === 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const r = Math.min(width, height) * 0.37;
      const cx = width / 2;
      const cy = height * 0.56;
      const t = (now - t0) / 1000;

      drawGlobe(
        ctx,
        dots,
        { cx, cy, r, yaw: st.yaw, tilt: st.tilt, timeSec: t, reduced },
        { land: theme.land, pop: theme.pop, glow: theme.glow },
        Math.max(1.4, r / 145),
      );

      pins.length = 0;
      ctx.lineCap = 'round';

      for (const rt of routes) {
        const ang = Math.acos(
          Math.max(-1, Math.min(1, H[0] * rt.v[0] + H[1] * rt.v[1] + H[2] * rt.v[2])),
        );
        const arcLift = 0.06 + ang * 0.12;
        const pts: { x: number; y: number; z: number }[] = [];
        for (let k = 0; k <= 48; k++) {
          const u = k / 48;
          pts.push(project(slerp(H, rt.v, u), 1 + Math.sin(Math.PI * u) * arcLift, r, cx, cy));
        }

        // Arco completo (tenue detrás de la esfera)
        ctx.strokeStyle = theme.arc;
        ctx.lineWidth = 1.15;
        for (let k = 0; k < 48; k++) {
          const a = pts[k]!;
          const b = pts[k + 1]!;
          const hidden = a.z < 0 && Math.hypot(a.x - cx, a.y - cy) < r;
          ctx.globalAlpha = hidden ? 0.06 : 0.36;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }

        // Cometa animado a lo largo del arco
        const cycle = 3.8;
        const ph = reduced ? 0.999 : (t / cycle + rt.offset) % 1;
        const run = Math.min(1, ph / 0.7);
        const head = Math.floor(run * 48);
        for (let k = Math.max(0, head - 10); k < head; k++) {
          const a = pts[k]!;
          const b = pts[k + 1]!;
          if (a.z < 0 && Math.hypot(a.x - cx, a.y - cy) < r) continue;
          ctx.globalAlpha = (1 - (head - k) / 10) * 0.95;
          ctx.lineWidth = 2.25;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }

        const end = pts[48]!;
        const front = end.z > 0;
        pins.push({ p: rt.p, x: end.x, y: end.y, front });
        if (front) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = theme.arc;
          ctx.beginPath();
          ctx.arc(end.x, end.y, 2.8, 0, Math.PI * 2);
          ctx.fill();

          if (ph > 0.7) {
            const k = (ph - 0.7) / 0.3;
            ctx.globalAlpha = 1 - k;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(end.x, end.y, 3 + k * 15, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // Hub principal (Lima)
      const h = project(H, 1, r, cx, cy);
      if (h.z > 0) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = theme.text;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = reduced ? 0.65 : 0.45 + 0.45 * Math.sin(t * 3);
        ctx.strokeStyle = theme.pop;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 9.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      raf = 0;
      if (!alive || !visible || document.hidden) return;
      const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0.016;
      st.last = now;
      if (!st.drag) {
        st.yaw += st.vy * dt;
        st.tilt += st.vt * dt;
        st.vy *= Math.pow(0.05, dt);
        st.vt *= Math.pow(0.05, dt);
        if (now - st.idle > 2500) st.yaw += dt * 0.085;
        st.tilt = Math.max(
          -0.9,
          Math.min(0.9, st.tilt + (14 * RAD - st.tilt) * Math.min(1, dt * 0.4)),
        );
      }
      draw(now);
      raf = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (reduced) {
        draw(performance.now());
        return;
      }
      if (!raf && alive) {
        st.last = 0;
        raf = window.requestAnimationFrame(tick);
      }
    };

    const onDown = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      st.drag = true;
      st.px = e.clientX;
      st.py = e.clientY;
      st.vy = 0;
      st.vt = 0;
      setDragging(true);
    };

    const onMove = (e: PointerEvent) => {
      if (st.drag) {
        const r = Math.min(width, height) * 0.4 || 1;
        const dx = e.clientX - st.px;
        const dy = e.clientY - st.py;
        st.px = e.clientX;
        st.py = e.clientY;
        st.yaw -= dx / r;
        st.tilt = Math.max(-0.9, Math.min(0.9, st.tilt + dy / r));
        st.vy = (-dx / r) * 30;
        st.vt = (dy / r) * 30;
        st.idle = performance.now();
        if (reduced) draw(performance.now());
        setHover(null);
        return;
      }
      const b = cv.getBoundingClientRect();
      const x = e.clientX - b.left;
      const y = e.clientY - b.top;
      const near = pins
        .filter((p) => p.front)
        .map((p) => ({ ...p, d: Math.hypot(p.x - x, p.y - y) }))
        .sort((a, b2) => a.d - b2.d)[0];
      setHover(near && near.d < 20 ? { p: near.p, x: near.x, y: near.y } : null);
    };

    const onUp = () => {
      st.drag = false;
      st.idle = performance.now();
      setDragging(false);
    };

    const onLeave = () => setHover(null);

    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('pointerleave', onLeave);

    const ro = new ResizeObserver(() => {
      size();
      draw(performance.now());
    });
    ro.observe(el);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) start();
    });
    io.observe(el);

    const onVis = () => {
      if (!document.hidden) start();
    };
    document.addEventListener('visibilitychange', onVis);

    size();
    start();

    return () => {
      alive = false;
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
      cv.removeEventListener('pointerleave', onLeave);
    };
  }, [hub, places, theme, motion]);

  return (
    <div
      ref={hostRef}
      className={cn(
        'relative h-full w-full select-none',
        dragging ? 'cursor-grabbing' : 'cursor-grab',
        className,
      )}
      style={{ background: theme.ground, color: theme.text, ...style }}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        role="img"
        aria-label={`Globo de rutas desde ${hub.name}`}
      />
      {hover ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: hover.x, top: hover.y }}
        >
          <p className="font-semibold text-fg">{hover.p.name}</p>
          {hover.p.note ? (
            <p className="text-[11px] text-fg-muted tabular-nums">
              {hover.p.note} · {hub.name}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
