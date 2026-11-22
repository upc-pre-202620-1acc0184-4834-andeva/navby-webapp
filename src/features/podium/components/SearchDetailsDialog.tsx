import { Activity, Gauge, GitBranch, Layers, Play, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type PodiumOffer,
  type PodiumResponse,
  type RoutePreviewResponse,
} from '@/shared/api/schemas';
import { formatDuration, formatExtra, formatStops } from '@/shared/format/flight';
import { useMoney } from '@/shared/format/useMoney';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';
import { RouteAlgorithmSimulation } from './RouteAlgorithmSimulation';

export interface SearchDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  routeTitle: string;
  preview: RoutePreviewResponse | null | undefined;
  podium: PodiumResponse | undefined;
}

const RANK_CSS_COLOR: Record<number, string> = {
  1: 'var(--route-1)',
  2: 'var(--route-2)',
  3: 'var(--route-3)',
};

function PriceDurationScatterChart({
  offers,
  tminMinutes,
  durationLabel,
  priceLabel,
}: {
  offers: PodiumOffer[];
  tminMinutes: number;
  durationLabel: string;
  priceLabel: string;
}) {
  const { t } = useTranslation();
  const { format } = useMoney();
  const width = 380;
  const height = 160;
  const padLeft = 56;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const prices = offers.map((o) => Number(o.price.amount) || 0);
  const durations = offers.map((o) => o.duration_minutes);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const pSpan = maxP - minP || Math.max(10, minP * 0.2);
  const pLow = Math.max(0, minP - pSpan * 0.15);
  const pHigh = maxP + pSpan * 0.15;

  const minD = Math.min(...durations, tminMinutes > 0 ? tminMinutes : (durations[0] ?? 0));
  const maxD = Math.max(...durations);
  const dSpan = maxD - minD || Math.max(60, minD * 0.2);
  const dLow = Math.max(0, minD - dSpan * 0.12);
  const dHigh = maxD + dSpan * 0.15;

  const mapX = (mins: number) => padLeft + ((mins - dLow) / Math.max(1, dHigh - dLow)) * plotW;
  const mapY = (price: number) =>
    padTop + plotH - ((price - pLow) / Math.max(1, pHigh - pLow)) * plotH;

  const currency = offers[0]?.price.currency ?? 'USD';
  const tminX = tminMinutes > 0 ? mapX(tminMinutes) : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${priceLabel} vs ${durationLabel}`}
      className="h-auto w-full overflow-visible"
    >
      {/* Rejilla horizontal sutil */}
      {[0, 0.5, 1].map((ratio) => {
        const y = padTop + plotH * (1 - ratio);
        const val = pLow + (pHigh - pLow) * ratio;
        return (
          <g key={ratio}>
            <line
              x1={padLeft}
              y1={y}
              x2={padLeft + plotW}
              y2={y}
              stroke="var(--line)"
              strokeDasharray={ratio === 0 ? undefined : '3 3'}
              strokeWidth={1}
            />
            <text
              x={padLeft - 6}
              y={y + 3}
              textAnchor="end"
              fill="var(--fg-muted)"
              fontSize="10"
              className="tabular-nums"
            >
              {format(val.toFixed(0), currency)}
            </text>
          </g>
        );
      })}

      {/* Eje X base y etiquetas */}
      <line
        x1={padLeft}
        y1={padTop}
        x2={padLeft}
        y2={padTop + plotH}
        stroke="var(--line)"
        strokeWidth={1}
      />
      <text
        x={padLeft}
        y={height - 6}
        textAnchor="start"
        fill="var(--fg-muted)"
        fontSize="10"
        className="tabular-nums"
      >
        {formatDuration(t, Math.round(dLow))}
      </text>
      <text
        x={padLeft + plotW / 2}
        y={height - 6}
        textAnchor="middle"
        fill="var(--fg-muted)"
        fontSize="10"
        fontWeight="600"
      >
        {durationLabel} →
      </text>
      <text
        x={padLeft + plotW}
        y={height - 6}
        textAnchor="end"
        fill="var(--fg-muted)"
        fontSize="10"
        className="tabular-nums"
      >
        {formatDuration(t, Math.round(dHigh))}
      </text>

      {/* Referencia mínima física */}
      {tminX !== null && tminX >= padLeft && tminX <= padLeft + plotW ? (
        <line
          x1={tminX}
          y1={padTop}
          x2={tminX}
          y2={padTop + plotH}
          stroke="var(--brand-ink)"
          strokeOpacity={0.35}
          strokeDasharray="2 3"
          strokeWidth={1}
        />
      ) : null}

      {/* Puntos del podio (#3 al fondo, #1 encima) */}
      {[...offers].reverse().map((offer) => {
        const cx = mapX(offer.duration_minutes);
        const cy = mapY(Number(offer.price.amount) || 0);
        const color = RANK_CSS_COLOR[offer.rank] ?? 'var(--route-3)';
        const isFirst = offer.rank === 1;
        const labelOnLeft = cx > padLeft + plotW * 0.68;
        const labelDy = cy < padTop + 18 ? 15 : -9;

        return (
          <g key={offer.offer_id}>
            {isFirst ? <circle cx={cx} cy={cy} r={11} fill={color} fillOpacity={0.18} /> : null}
            <circle
              cx={cx}
              cy={cy}
              r={isFirst ? 6 : 5}
              fill={color}
              stroke="var(--surface)"
              strokeWidth={2}
            />
            <text
              x={labelOnLeft ? cx - 9 : cx + 9}
              y={cy + labelDy}
              textAnchor={labelOnLeft ? 'end' : 'start'}
              fill="var(--fg)"
              fontSize="10"
              fontWeight={isFirst ? '700' : '600'}
              className="tabular-nums"
            >
              #{offer.rank} · {format(offer.price.amount, offer.price.currency)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function SearchDetailsDialog({
  open,
  onClose,
  routeTitle,
  preview,
  podium,
}: SearchDetailsDialogProps) {
  const { t } = useTranslation();
  const { format } = useMoney();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();
  const [tab, setTab] = useState<'charts' | 'simulation'>('charts');

  const canSimulate = Boolean(
    preview?.reachable && preview.best_route && preview.best_route.airports.length >= 2,
  );

  const handleClose = () => {
    setTab('charts');
    onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      closeBtnRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const telemetry = preview?.telemetry;
  const pairs = preview?.pairs ?? [];
  const weights = podium?.preferences.weights;
  const maxLatencyMs = telemetry ? Math.max(telemetry.bfs_ms, telemetry.astar_ms, 0.01) : 1;
  const funnelMax = podium ? Math.max(podium.offers_received, podium.pareto_size, 1) : 1;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
      onClose={() => {
        if (open) handleClose();
      }}
      className="navby-dialog m-auto max-h-[88dvh] w-[min(100%-2rem,38rem)] overflow-y-auto rounded-xl border border-line bg-surface p-5 text-fg shadow-lg sm:p-6"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-bold text-fg">
            {t('podium.details.title')}
          </h2>
          <p id={descId} className="mt-0.5 truncate text-xs font-medium text-fg-muted">
            {routeTitle}
          </p>
        </div>
        <Button
          ref={closeBtnRef}
          variant="ghost"
          size="icon"
          aria-label={t('podium.details.close')}
          onClick={handleClose}
          className="shrink-0 rounded-full"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {canSimulate ? (
        <div
          role="tablist"
          aria-label={t('podium.details.title')}
          className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-surface-sunken p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'charts'}
            onClick={() => setTab('charts')}
            className={cn(
              'min-h-9 rounded-md px-3 text-xs font-semibold transition-colors duration-150 ease-(--ease-out)',
              tab === 'charts'
                ? 'border border-line bg-surface text-fg shadow-xs'
                : 'border border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {t('podium.details.tabs.charts')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'simulation'}
            onClick={() => setTab('simulation')}
            className={cn(
              'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors duration-150 ease-(--ease-out)',
              tab === 'simulation'
                ? 'border border-line bg-surface text-fg shadow-xs'
                : 'border border-transparent text-fg-muted hover:text-fg',
            )}
          >
            <Play className="h-3.5 w-3.5 text-brand-ink" aria-hidden="true" />
            <span>{t('podium.details.tabs.simulation')}</span>
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-5">
        {tab === 'simulation' && canSimulate ? (
          <RouteAlgorithmSimulation preview={preview} podium={podium} />
        ) : (
          <>
            {telemetry ? (
              <section className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                    <Activity className="h-4 w-4 text-brand-ink" aria-hidden="true" />
                    <span>{t('podium.details.routeSectionTitle')}</span>
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="neutral">
                      <span>{telemetry.astar_nodes_expanded}</span>
                      <span>{t('podium.details.airportsExplored')}</span>
                    </Badge>
                    <Badge variant="neutral">
                      {t('podium.details.pairsEvaluated', { count: telemetry.pairs_evaluated })}
                    </Badge>
                  </div>
                </div>

                {/* Gráfica de barras comparativa de latencia */}
                <div
                  role="group"
                  aria-label={t('podium.details.latencyChartLabel')}
                  className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface-sunken p-3"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-fg">
                        {t('podium.details.connectivityLatency')}
                      </span>
                      <span className="font-semibold text-fg tabular-nums">
                        {t('podium.details.milliseconds', { value: telemetry.bfs_ms.toFixed(2) })}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-300 ease-(--ease-out)"
                        style={{
                          width: `${Math.max(4, (telemetry.bfs_ms / maxLatencyMs) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-fg">
                        {t('podium.details.optimalPathLatency')}
                      </span>
                      <span className="font-semibold text-fg tabular-nums">
                        {t('podium.details.milliseconds', { value: telemetry.astar_ms.toFixed(2) })}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-(--ease-out)"
                        style={{
                          width: `${Math.max(4, (telemetry.astar_ms / maxLatencyMs) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {pairs.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {pairs.map((pair) => (
                      <li key={`${pair.origin}-${pair.destination}`}>
                        <Badge variant="neutral" className="py-1">
                          <GitBranch className="h-3.5 w-3.5 text-brand-ink" aria-hidden="true" />
                          <span>
                            {t('podium.details.pairItem', {
                              origin: pair.origin,
                              destination: pair.destination,
                              stops: formatStops(t, pair.min_stops),
                              hours: Math.max(1, Math.round(pair.t_min_minutes / 60)),
                            })}
                          </span>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {podium ? (
              <section className="flex flex-col gap-3.5 border-t border-line pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                    <Layers className="h-4 w-4 text-brand-ink" aria-hidden="true" />
                    <span>{t('podium.details.multicriteriaHeading')}</span>
                  </h3>
                  <span className="text-xs font-medium text-fg-muted tabular-nums">
                    {t('podium.details.physicalMinimum', {
                      duration: formatDuration(t, podium.t_min_minutes),
                    })}
                  </span>
                </div>

                {/* Embudo visual de selección + Distribución de pesos */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div
                    role="group"
                    aria-label={t('podium.details.funnelTitle')}
                    className="flex flex-col gap-2 rounded-lg border border-line bg-surface-sunken p-3"
                  >
                    <p className="text-xs font-semibold text-fg-muted">
                      {t('podium.details.funnelTitle')}
                    </p>
                    {[
                      {
                        label: t('podium.details.offersReceived'),
                        count: podium.offers_received,
                        barClass: 'bg-line-strong/60',
                      },
                      {
                        label: t('podium.details.optimalFrontier'),
                        count: podium.pareto_size,
                        barClass: 'bg-route-2',
                      },
                      {
                        label: t('podium.details.finalPodium'),
                        count: podium.podium.length,
                        barClass: 'bg-route-1',
                      },
                    ].map((stage) => (
                      <div key={stage.label} className="flex items-center gap-2 text-xs">
                        <span className="w-32 shrink-0 text-fg-muted">{stage.label}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                          <div
                            className={`h-full rounded-full ${stage.barClass}`}
                            style={{
                              width: `${
                                stage.count === 0
                                  ? 0
                                  : Math.max(8, Math.round((stage.count / funnelMax) * 100))
                              }%`,
                            }}
                          />
                        </div>
                        <span className="w-6 shrink-0 text-right font-bold text-fg tabular-nums">
                          {stage.count}
                        </span>
                      </div>
                    ))}
                  </div>

                  {weights ? (
                    <div
                      role="group"
                      aria-label={t('podium.details.weightsDistribution')}
                      className="flex flex-col justify-between gap-2 rounded-lg border border-line bg-surface-sunken p-3"
                    >
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
                        <Gauge className="h-3.5 w-3.5 text-brand-ink" aria-hidden="true" />
                        <span>{t('podium.details.weightsDistribution')}</span>
                      </p>
                      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full bg-route-1"
                          style={{ width: `${Math.round(weights.price * 100)}%` }}
                        />
                        <div
                          className="h-full bg-route-2"
                          style={{ width: `${Math.round(weights.duration * 100)}%` }}
                        />
                        <div
                          className="h-full bg-route-3"
                          style={{ width: `${Math.round(weights.stops * 100)}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-route-1" aria-hidden="true" />
                          {t('podium.preferences.weights.price')} {Math.round(weights.price * 100)}%
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-route-2" aria-hidden="true" />
                          {t('podium.preferences.weights.duration')}{' '}
                          {Math.round(weights.duration * 100)}%
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-route-3" aria-hidden="true" />
                          {t('podium.preferences.weights.stops')} {Math.round(weights.stops * 100)}%
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                {podium.podium.length > 0 ? (
                  <>
                    {/* Scatter plot SVG Precio vs Duración */}
                    <div className="rounded-lg border border-line bg-surface-sunken p-3">
                      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-xs font-semibold text-fg">
                          {t('podium.details.scatterTitle')}
                        </p>
                        <p className="text-xs text-fg-muted">
                          {t('podium.details.scatterCaption')}
                        </p>
                      </div>
                      <PriceDurationScatterChart
                        offers={podium.podium}
                        tminMinutes={podium.t_min_minutes}
                        durationLabel={t('podium.details.scatterAxisDuration')}
                        priceLabel={t('podium.details.scatterAxisPrice')}
                      />
                    </div>

                    {/* Tabla compacta con barras de afinidad */}
                    <div className="overflow-x-auto rounded-lg border border-line">
                      <table className="w-full border-collapse text-left text-xs tabular-nums">
                        <thead>
                          <tr className="border-b border-line bg-surface-sunken text-fg-muted">
                            <th className="px-3 py-2 font-semibold">
                              {t('podium.details.tableOption')}
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              {t('podium.details.tableAffinity')}
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              {t('podium.details.tableScore')}
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              {t('podium.details.tableDuration')}
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              {t('podium.details.tableExtra')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {podium.podium.map((offer) => (
                            <tr key={offer.offer_id} className="bg-surface">
                              <td className="px-3 py-2 font-semibold text-fg">
                                #{offer.rank} · {format(offer.price.amount, offer.price.currency)}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-sunken">
                                    <div
                                      className="h-full rounded-full bg-primary"
                                      style={{
                                        width: `${Math.min(100, Math.max(0, offer.match_pct))}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="font-semibold text-fg">{offer.match_pct}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 font-semibold text-fg">
                                {offer.score.toFixed(4)}
                              </td>
                              <td className="px-3 py-2 text-fg-muted">
                                {formatDuration(t, offer.duration_minutes)}
                              </td>
                              <td className="px-3 py-2 text-fg-muted">
                                {formatExtra(t, offer.extra_minutes_vs_t_min)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-fg-muted">{t('podium.details.scoreNote')}</p>
                  </>
                ) : null}
              </section>
            ) : (
              <p className="rounded-lg border border-line bg-surface-sunken px-3 py-2.5 text-xs text-fg-muted">
                {t('podium.details.noQuoteYet')}
              </p>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          {tab === 'charts' && canSimulate ? (
            <Button variant="secondary" size="sm" onClick={() => setTab('simulation')}>
              <Play className="h-3.5 w-3.5 text-brand-ink" aria-hidden="true" />
              <span>{t('podium.details.simulation.ctaButton')}</span>
            </Button>
          ) : (
            <span />
          )}
          <Button variant="secondary" onClick={handleClose}>
            {t('podium.details.close')}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
