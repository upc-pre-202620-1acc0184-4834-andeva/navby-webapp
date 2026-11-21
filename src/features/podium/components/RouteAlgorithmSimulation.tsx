import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type PodiumResponse, type RoutePreviewResponse } from '@/shared/api/schemas';
import { formatDuration } from '@/shared/format/flight';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';
import { buildSimulationGeometry, edgePath } from './simulationGeometry';

export interface RouteAlgorithmSimulationProps {
  preview: RoutePreviewResponse | null | undefined;
  podium: PodiumResponse | undefined;
  autoStart?: boolean;
}

const PHASE_ANCHORS = [0.22, 0.56, 0.8, 1] as const;
const BASE_DURATION_MS = 7600;

function getPhaseIndex(progress: number): number {
  if (progress < 0.28) return 0;
  if (progress < 0.68) return 1;
  if (progress < 0.86) return 2;
  return 3;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function RouteAlgorithmSimulation({
  preview,
  podium,
  autoStart = true,
}: RouteAlgorithmSimulationProps) {
  const { t } = useTranslation();
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [progress, setProgress] = useState<number>(() => (prefersReducedMotion ? 1 : 0));
  const [isPlaying, setIsPlaying] = useState<boolean>(() => autoStart && !prefersReducedMotion);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      lastFrameRef.current = null;
      return;
    }

    let rafId = 0;
    const tick = (now: number) => {
      const prevTime = lastFrameRef.current ?? now;
      lastFrameRef.current = now;
      const dt = Math.min(64, now - prevTime);
      const stepDelta = (dt * speed) / BASE_DURATION_MS;

      setProgress((prev) => {
        const next = clamp01(prev + stepDelta);
        if (next >= 1) {
          setIsPlaying(false);
        }
        return next;
      });

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      lastFrameRef.current = null;
    };
  }, [isPlaying, speed]);

  const geometry = useMemo(() => buildSimulationGeometry(preview, podium), [podium, preview]);

  if (!geometry) return null;

  const telemetry = preview?.telemetry;
  const bfsMs = telemetry?.bfs_ms ?? 0;
  const astarMs = telemetry?.astar_ms ?? 0;
  const totalMs = bfsMs + astarMs;
  const phase = getPhaseIndex(progress);

  // Interpolación continua de métricas vivas según el progreso (0..1)
  const exploredNow =
    progress < 0.02
      ? 0
      : progress < 0.28
        ? Math.min(
            geometry.totalSimNodes,
            Math.round((progress / 0.28) * geometry.totalSimNodes * 0.22),
          )
        : progress < 0.68
          ? Math.min(
              geometry.totalSimNodes,
              Math.round(geometry.totalSimNodes * (0.22 + ((progress - 0.28) / 0.4) * 0.78)),
            )
          : geometry.totalSimNodes;

  const elapsedMsNow =
    progress < 0.28
      ? (progress / 0.28) * bfsMs
      : progress < 0.68
        ? bfsMs + ((progress - 0.28) / 0.4) * astarMs
        : totalMs;

  const activePairIndex =
    progress < 0.28
      ? 0
      : progress < 0.68
        ? Math.min(
            geometry.pairsCount - 1,
            Math.floor(((progress - 0.28) / 0.4) * geometry.pairsCount),
          )
        : geometry.pairsCount - 1;

  const activePair = geometry.pairs[activePairIndex];
  const waveFrac = progress < 0.28 ? progress / 0.28 : 0;
  const waveRadius = waveFrac * geometry.width * 0.7;

  // Traza viva de candidatos evaluados en el panel inferior
  const traceItems = geometry.pairs.map((pair, idx) => {
    const threshold = 0.28 + ((idx + 0.65) / geometry.pairsCount) * 0.4;
    const isBestPair = pair.t_min_minutes === preview?.best_route?.t_min_minutes && idx === 0;
    const state =
      progress < 0.28
        ? 'pending'
        : progress < threshold
          ? 'evaluating'
          : progress >= 0.68 && isBestPair
            ? 'winner'
            : 'evaluated';
    return { pair, idx, state };
  });

  const durationLabel = preview?.best_route
    ? formatDuration(t, preview.best_route.t_min_minutes)
    : '';

  const stepsMeta = [
    {
      title: t('podium.details.simulation.steps.originTitle'),
      desc: t('podium.details.simulation.steps.originDesc', { ms: bfsMs.toFixed(2) }),
    },
    {
      title: t('podium.details.simulation.steps.bfsTitle'),
      desc: t('podium.details.simulation.steps.bfsDesc', {
        pairs: geometry.pairsCount,
        explored: geometry.totalSimNodes,
      }),
    },
    {
      title: t('podium.details.simulation.steps.astarTitle'),
      desc: t('podium.details.simulation.steps.astarDesc', { route: geometry.routeChain }),
    },
    {
      title: t('podium.details.simulation.steps.rankTitle'),
      desc: podium
        ? t('podium.details.simulation.steps.rankDesc', {
            offers: podium.offers_received,
            frontier: podium.pareto_size,
          })
        : t('podium.details.simulation.steps.rankPreviewDesc', {
            route: geometry.routeChain,
            duration: durationLabel,
          }),
    },
  ];

  const activeMeta = stepsMeta[phase] ?? stepsMeta[0]!;

  const jumpToPhase = (targetPhase: number) => {
    setIsPlaying(false);
    setProgress(PHASE_ANCHORS[Math.max(0, Math.min(3, targetPhase))] ?? 1);
  };

  const handleRestart = () => {
    setProgress(0);
    setIsPlaying(true);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Banner de fase viva + par evaluado actual */}
      <div className="rounded-lg border border-line bg-surface-sunken px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-brand-ink">
            {t('podium.details.simulation.stepLabel', { current: phase + 1, total: 4 })}
            {activePair && phase >= 1
              ? ` · ${t('podium.details.simulation.pairProgress', {
                  index: activePairIndex + 1,
                  total: geometry.pairsCount,
                  origin: activePair.origin,
                  destination: activePair.destination,
                })}`
              : ''}
          </p>
          <span className="text-xs font-semibold text-fg tabular-nums">
            {Math.round(progress * 100)}%
          </span>
        </div>
        <h3 className="mt-0.5 text-sm font-bold text-fg">{activeMeta.title}</h3>
        <p className="mt-0.5 text-xs text-fg-muted">{activeMeta.desc}</p>
      </div>

      {/* Lienzo SVG animado continuo de red y aristas */}
      <div className="rounded-lg border border-line bg-surface-sunken p-2.5">
        <svg
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          role="img"
          aria-label={t('podium.details.simulation.canvasAria', {
            origin: geometry.origin.label,
            destination: geometry.destination.label,
          })}
          className="h-auto w-full"
        >
          {/* Guías de capas: origen, dos saltos y destino */}
          {[0.3, 0.64].map((ratio) => (
            <line
              key={ratio}
              x1={44 + (geometry.width - 88) * ratio}
              y1={14}
              x2={44 + (geometry.width - 88) * ratio}
              y2={geometry.height - 14}
              stroke="var(--line)"
              strokeDasharray="2 5"
              strokeWidth={1}
            />
          ))}

          {/* Onda radial continua durante el barrido de conectividad */}
          {progress > 0 && progress < 0.28 ? (
            <circle
              cx={geometry.origin.x}
              cy={geometry.origin.y}
              r={waveRadius}
              fill="var(--route-2)"
              fillOpacity={0.05 * (1 - waveFrac)}
              stroke="var(--route-2)"
              strokeOpacity={0.45 * (1 - waveFrac)}
              strokeDasharray="4 4"
              strokeWidth={1.25}
            />
          ) : null}

          {/* Aristas: todas unen dos nodos dibujados; las candidatas son rutas completas */}
          {geometry.edges.map((edge) => {
            if (progress < edge.revealAt) return null;
            const d = edgePath(edge.from, edge.to);
            const age = progress - edge.revealAt;

            if (edge.kind === 'best') {
              const drawFrac = clamp01(age / 0.1);
              return (
                <path
                  key={edge.id}
                  d={d}
                  fill="none"
                  stroke="var(--route-1)"
                  strokeWidth={3.25}
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray={100}
                  strokeDashoffset={(1 - drawFrac) * 100}
                />
              );
            }

            if (edge.kind === 'podium-alt') {
              const drawFrac = clamp01(age / 0.08);
              return (
                <path
                  key={edge.id}
                  d={d}
                  fill="none"
                  stroke="var(--route-2)"
                  strokeWidth={2}
                  strokeOpacity={0.9}
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray={100}
                  strokeDashoffset={(1 - drawFrac) * 100}
                />
              );
            }

            if (edge.kind === 'candidate') {
              const isPruned = edge.pruneAt !== undefined && progress >= edge.pruneAt;
              // Las descartadas se desvanecen al fijar la ruta para dejar el resultado limpio.
              if (isPruned && progress >= 0.66) return null;
              return (
                <path
                  key={edge.id}
                  d={d}
                  fill="none"
                  stroke={isPruned ? 'var(--route-preview)' : 'var(--route-2)'}
                  strokeWidth={isPruned ? 1.15 : 2}
                  strokeOpacity={isPruned ? 0.3 : 0.9}
                  strokeLinecap="round"
                  strokeDasharray={isPruned ? '3 3' : undefined}
                />
              );
            }

            // bfs-hop1 / bfs-hop2
            const inBfsPhase = progress < 0.34;
            return (
              <path
                key={edge.id}
                d={d}
                fill="none"
                stroke={inBfsPhase ? 'var(--route-2)' : 'var(--route-preview)'}
                strokeWidth={inBfsPhase ? 1.3 : 1}
                strokeOpacity={inBfsPhase ? 0.5 : 0.14}
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Red de fondo iluminada progresivamente */}
          {geometry.networkNodes.map((node) => {
            if (progress < node.bfsRevealAt) return null;
            const inBfsBurst = Math.abs(progress - node.bfsRevealAt) < 0.07;
            const inAstarBurst =
              progress >= node.astarRevealAt && progress < node.astarRevealAt + 0.09;
            const isHighlighted = inBfsBurst || inAstarBurst;

            return (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r={isHighlighted ? 3.6 : 2.4}
                fill={isHighlighted ? 'var(--route-2)' : 'var(--route-preview)'}
                fillOpacity={isHighlighted ? 0.95 : progress >= 0.68 ? 0.35 : 0.65}
              />
            );
          })}

          {/* Aeropuertos reales: origen, escalas y destinos, con etiqueta sobre el nodo */}
          {geometry.realNodes.map((pt) => {
            const isEndpoint = pt.role === 'origin' || pt.role === 'destination';
            const isBestStop = pt.role === 'best-stop';
            const visible =
              isEndpoint || progress >= pt.bfsRevealAt || progress >= pt.astarRevealAt;
            const isLocked =
              pt.role === 'origin' ||
              (isBestStop && progress >= 0.68) ||
              (pt.role === 'destination' && progress >= 0.76);
            const fill = isLocked
              ? 'var(--route-1)'
              : progress >= 0.28
                ? 'var(--route-2)'
                : 'var(--route-preview)';

            return (
              <g key={pt.id} opacity={visible ? 1 : 0.3}>
                {isEndpoint || (isBestStop && progress >= 0.66) ? (
                  <circle cx={pt.x} cy={pt.y} r={isLocked ? 10 : 8} fill={fill} fillOpacity={0.2} />
                ) : null}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isEndpoint ? 5.5 : 4.5}
                  fill={fill}
                  stroke="var(--surface-sunken)"
                  strokeWidth={2}
                />
                <text
                  x={pt.x}
                  y={pt.y - 14}
                  textAnchor="middle"
                  fill="var(--fg)"
                  stroke="var(--surface-sunken)"
                  strokeWidth={3}
                  paintOrder="stroke"
                  fontSize="12"
                  fontWeight={isEndpoint ? '700' : '600'}
                  className="tabular-nums"
                >
                  {pt.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Leyenda de colores */}
        <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2 text-xs text-fg-muted">
          {(
            [
              ['var(--route-1)', 'legendOptimal'],
              ['var(--route-2)', 'legendAlternative'],
              ['var(--route-preview)', 'legendDiscarded'],
            ] as const
          ).map(([color, key]) => (
            <li key={key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-1 w-4 rounded-full"
                style={{ backgroundColor: color }}
              />
              {t(`podium.details.simulation.${key}`)}
            </li>
          ))}
        </ul>

        {/* Leyenda visual + contadores vivos */}
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
          <span className="text-fg-muted">
            {t('podium.details.simulation.statExplored')}:{' '}
            <strong className="text-fg">
              {exploredNow} / {geometry.totalSimNodes}
            </strong>
          </span>
          <span className="text-fg-muted">
            {t('podium.details.simulation.statTime')}:{' '}
            <strong className="text-fg">{elapsedMsNow.toFixed(2)} ms</strong>
          </span>
          <Badge variant="neutral">{geometry.routeChain}</Badge>
        </div>
      </div>

      {/* Traza en vivo de pares evaluados */}
      {traceItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {traceItems.map(({ pair, idx, state }) => (
            <div
              key={`${pair.origin}-${pair.destination}`}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs tabular-nums transition-colors duration-150',
                state === 'winner'
                  ? 'border-primary bg-primary-soft/35 text-fg dark:bg-primary/15'
                  : state === 'evaluating'
                    ? 'border-route-2 bg-surface text-fg'
                    : 'border-line bg-surface-sunken text-fg-muted',
              )}
            >
              <span className="font-semibold">
                {idx + 1}. {pair.origin} → {pair.destination}
              </span>
              <span>
                {state === 'pending'
                  ? '…'
                  : t('podium.details.simulation.candidateLabel', {
                      route:
                        pair.min_stops === 0
                          ? t('podium.direct')
                          : t('podium.stops', { count: pair.min_stops }),
                      hours: Math.max(1, Math.round(pair.t_min_minutes / 60)),
                    })}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Scrubber continuo de línea temporal */}
      <div className="flex flex-col gap-1.5">
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          aria-label={t('podium.details.simulation.timelineAria')}
          onChange={(event) => {
            setIsPlaying(false);
            setProgress(Number(event.target.value) / 1000);
          }}
          style={{ '--value': Math.round(progress * 100) } as CSSProperties}
          className="navby-range h-6 w-full cursor-pointer"
        />
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-surface-sunken p-1">
          {[0, 1, 2, 3].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => jumpToPhase(idx)}
              className={cn(
                'min-h-8 rounded-md px-2 text-xs font-semibold transition-colors duration-150 ease-(--ease-out)',
                phase === idx
                  ? 'border border-primary bg-surface text-fg shadow-xs'
                  : 'border border-transparent text-fg-muted hover:text-fg',
              )}
            >
              {idx + 1}.
            </button>
          ))}
        </div>
      </div>

      {/* Controles de reproducción + velocidad */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            aria-label={t('podium.details.simulation.prevStep')}
            disabled={phase === 0 && progress === 0}
            onClick={() => jumpToPhase(Math.max(0, phase - 1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (progress >= 0.99 && !isPlaying) {
                handleRestart();
              } else {
                setIsPlaying((prev) => !prev);
              }
            }}
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('podium.details.simulation.pause')}</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('podium.details.simulation.play')}</span>
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label={t('podium.details.simulation.nextStep')}
            disabled={phase >= 3}
            onClick={() => jumpToPhase(Math.min(3, phase + 1))}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSpeed((prev) => (prev === 1 ? 2 : 1))}
          >
            {t('podium.details.simulation.speedLabel', { speed })}
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={handleRestart}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('podium.details.simulation.restart')}</span>
        </Button>
      </div>
    </div>
  );
}
