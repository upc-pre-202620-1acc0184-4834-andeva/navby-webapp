import '../maplibreWorker';
import 'maplibre-gl/dist/maplibre-gl.css';

import { type Layer, type PickingInfo } from '@deck.gl/core';
import { ArcLayer } from '@deck.gl/layers';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { type IControl, type Map as MaplibreMap, type StyleSpecification } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Map, Marker, NavigationControl, useControl, type MapRef } from 'react-map-gl/maplibre';
import {
  type CityAirport,
  type PodiumOffer,
  type RouteAirportPoint,
  type RoutePreviewResponse,
} from '@/shared/api/schemas';
import { type PodiumRank, usePodiumHighlight } from '@/shared/state/podiumHighlight';
import { splitMinutes } from '@/shared/time/flightTime';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/shared/ui/cn';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { useTheme } from '@/shared/ui/theme';
import {
  buildDashedGreatCircleSegments,
  computeRouteBounds,
  readCssRgbTuple,
  type DashedArcSegment,
  type RgbTuple,
} from '../greatCircleDashes';
import { buildPodiumArcs, buildPodiumStops, type PodiumArc } from '../podiumRoutes';

const LIGHT_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DARK_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const FALLBACK_BLANK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [],
};

const DEFAULT_ROUTE_RGB: RgbTuple = [138, 138, 147];
const DEFAULT_PODIUM_RGB: Record<PodiumRank, RgbTuple> = {
  1: [96, 74, 255],
  2: [255, 107, 53],
  3: [102, 102, 110],
};
const RANKS: PodiumRank[] = [1, 2, 3];
/** DESIGN.md §Motion: la preliminar se desvanece en 200 ms y los arcos entran escalonados 60 ms. */
const PREVIEW_FADE_MS = 200;
const ARC_STAGGER_MS = 60;
const ARC_FADE_MS = 200;
const OPAQUE = 230;
const DIMMED = Math.round(255 * 0.3);

type MarkerRole = 'origin' | 'stop' | 'destination' | 'selected';

interface MapMarkerPoint extends RouteAirportPoint {
  markerRole: MarkerRole;
  /** Conexión en una escala del podio (la de la opción mejor ubicada que pasa por ahí). */
  layoverMinutes?: number;
}

function formatLayover(t: TFunction, totalMinutes: number): string {
  const { hours, minutes } = splitMinutes(totalMinutes);
  if (hours === 0) return t('map.duration.minutes', { minutes });
  return minutes === 0
    ? t('map.duration.hours', { hours })
    : t('map.duration.hoursMinutes', { hours, minutes });
}

export interface RouteMapProps {
  preview: RoutePreviewResponse | null | undefined;
  /** Podio vigente: reemplaza la ruta preliminar por 3 rutas (`route-1..3`). */
  podium?: PodiumOffer[];
  originAirports: CityAirport[];
  destinationAirports: CityAirport[];
  fitTrigger: number;
  onUnavailableChange?: (unavailable: boolean) => void;
  /** Escritorio: hay un panel flotante a la izquierda y el mapa deja ese espacio libre. */
  floatingPanel?: boolean;
  /** Etiqueta accesible del mapa (p. ej. mapa de ruta guardada en el detalle). */
  regionLabel?: string;
}

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (typeof mql.addEventListener !== 'function') return () => {};
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function subscribeDesktopViewport(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia('(min-width: 1024px)');
  if (typeof mql.addEventListener !== 'function') return () => {};
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getDesktopViewportSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(min-width: 1024px)').matches;
}

function detectWebGLSupport(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    if (!gl) return false;
    if ('getExtension' in gl && typeof gl.getExtension === 'function') {
      const ext = gl.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null;
      ext?.loseContext?.();
    }
    return true;
  } catch {
    return false;
  }
}

interface OverlayControlHandle extends IControl {
  setProps: (props: MapboxOverlayProps) => void;
  setPulsing: (pulsing: boolean) => void;
}

function createPulseOverlayControl(initialProps: MapboxOverlayProps): OverlayControlHandle {
  // Se fuerza interleaved: false por incompatibilidad de interleaved: true con MapLibre v6 (sin map.transform._nearZ).
  const inner = new MapboxOverlay({ ...initialProps, interleaved: false });
  let containerEl: HTMLElement | null = null;
  let shouldPulse = false;

  const syncPulse = () => {
    if (!containerEl) return;
    containerEl.classList.toggle('navby-preview-pulse', shouldPulse);
  };

  return {
    onAdd(map: MaplibreMap) {
      const el = inner.onAdd(map);
      containerEl = el;
      syncPulse();
      return el;
    },
    onRemove() {
      containerEl = null;
      inner.onRemove();
    },
    setProps(props: MapboxOverlayProps) {
      inner.setProps({ ...props, interleaved: false });
    },
    setPulsing(pulsing: boolean) {
      shouldPulse = pulsing;
      syncPulse();
    },
  };
}

function DeckArcOverlay({
  layers,
  pulsing,
  onHover,
}: {
  layers: Layer[];
  pulsing: boolean;
  onHover: (info: PickingInfo) => void;
}) {
  const control = useControl<OverlayControlHandle>(
    () =>
      createPulseOverlayControl({
        layers: [],
      }),
    { position: 'top-left' },
  );

  useEffect(() => {
    control.setProps({ layers, onHover });
    control.setPulsing(pulsing);
  }, [control, layers, pulsing, onHover]);

  return null;
}

type Rgba = [number, number, number, number];

function withAlpha([r, g, b]: RgbTuple, alpha: number): Rgba {
  return [r, g, b, alpha];
}

export default function RouteMap({
  preview,
  podium,
  originAirports,
  destinationAirports,
  fitTrigger,
  onUnavailableChange,
  floatingPanel = true,
  regionLabel,
}: RouteMapProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  const isDesktop = useSyncExternalStore(
    subscribeDesktopViewport,
    getDesktopViewportSnapshot,
    () => true,
  );

  const mapRef = useRef<MapRef | null>(null);
  const cleanupContextLossRef = useRef<(() => void) | null>(null);
  const hasFittedRouteRef = useRef(false);

  const [hasWebGL] = useState(() => detectWebGLSupport());
  const [webglLost, setWebglLost] = useState(false);
  const [tilesFallback, setTilesFallback] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const attachMapRef = (instance: MapRef | null) => {
    mapRef.current = instance;
    if (instance) {
      setMapReady(true);
    }
  };

  const isUnavailable = !hasWebGL || webglLost;

  useEffect(() => {
    onUnavailableChange?.(isUnavailable);
  }, [isUnavailable, onUnavailableChange]);

  useEffect(() => {
    return () => {
      cleanupContextLossRef.current?.();
    };
  }, []);

  const routeAirports = useMemo<RouteAirportPoint[]>(
    () => (preview?.reachable && preview.best_route ? preview.best_route.airports : []),
    [preview],
  );

  const dashedSegments = useMemo(
    () => buildDashedGreatCircleSegments(routeAirports),
    [routeAirports],
  );

  const hasPodium = podium !== undefined && podium.length > 0;
  const podiumArcs = useMemo(() => (hasPodium ? buildPodiumArcs(podium) : []), [hasPodium, podium]);
  const podiumStops = useMemo(
    () => (hasPodium ? buildPodiumStops(podium) : []),
    [hasPodium, podium],
  );
  const highlightedRank = usePodiumHighlight((state) => state.highlightedRank);
  const setHighlightedRank = usePodiumHighlight((state) => state.setHighlightedRank);

  // Entrada escalonada de las 3 rutas al llegar un podio nuevo.
  const podiumKey = hasPodium ? podium.map((offer) => offer.offer_id).join('|') : '';
  const [revealed, setRevealed] = useState({ key: '', count: 0 });
  useEffect(() => {
    if (!podiumKey || prefersReducedMotion) return;
    const timers = RANKS.map((rank, index) =>
      window.setTimeout(
        () => setRevealed({ key: podiumKey, count: rank }),
        PREVIEW_FADE_MS / 2 + index * ARC_STAGGER_MS,
      ),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [podiumKey, prefersReducedMotion]);
  const revealedCount = prefersReducedMotion
    ? RANKS.length
    : revealed.key === podiumKey
      ? revealed.count
      : 0;

  const markers = useMemo<MapMarkerPoint[]>(() => {
    if (podiumStops.length >= 2) return podiumStops;
    if (routeAirports.length >= 2) {
      return routeAirports.map((pt, idx) => ({
        ...pt,
        markerRole:
          idx === 0 ? 'origin' : idx === routeAirports.length - 1 ? 'destination' : 'stop',
      }));
    }

    const seen = new Set<string>();
    const combined: MapMarkerPoint[] = [];
    for (const pt of [...originAirports, ...destinationAirports]) {
      if (seen.has(pt.iata)) continue;
      seen.add(pt.iata);
      combined.push({
        iata: pt.iata,
        lat: pt.lat,
        lon: pt.lon,
        markerRole: 'selected',
      });
    }
    return combined;
  }, [podiumStops, routeAirports, originAirports, destinationAirports]);

  const activePointsKey = useMemo(
    () => markers.map((m) => `${m.iata}:${m.lat.toFixed(3)},${m.lon.toFixed(3)}`).join('|'),
    [markers],
  );

  const routeColor = useMemo(
    () => readCssRgbTuple('--route-preview', DEFAULT_ROUTE_RGB),
    // `theme` fuerza la relectura cuando cambia .dark en <html>.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  );

  const podiumColors = useMemo(
    () =>
      Object.fromEntries(
        RANKS.map((rank) => [rank, readCssRgbTuple(`--route-${rank}`, DEFAULT_PODIUM_RGB[rank])]),
      ) as Record<PodiumRank, RgbTuple>,
    // `theme` fuerza la relectura cuando cambia .dark en <html>.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  );

  const layers = useMemo<Layer[]>(() => {
    const transition = (duration: number) => (prefersReducedMotion ? 0 : duration);
    const previewColor = withAlpha(routeColor, hasPodium ? 0 : OPAQUE);
    const result: Layer[] = [
      new ArcLayer<DashedArcSegment>({
        id: 'navby-preliminary-route-arcs',
        data: dashedSegments,
        greatCircle: true,
        numSegments: 16,
        widthUnits: 'pixels',
        getWidth: 3,
        getHeight: 0,
        getSourcePosition: (d) => d.source,
        getTargetPosition: (d) => d.target,
        getSourceColor: previewColor,
        getTargetColor: previewColor,
        transitions: {
          getSourceColor: transition(PREVIEW_FADE_MS),
          getTargetColor: transition(PREVIEW_FADE_MS),
        },
      }),
    ];

    // Las rutas peores se dibujan primero: el Top 1 queda encima.
    for (const rank of [...RANKS].reverse()) {
      const color = podiumColors[rank];
      const isVisible = rank <= revealedCount;
      const isDimmed = highlightedRank !== null && highlightedRank !== rank;
      const alpha = !isVisible ? 0 : isDimmed ? DIMMED : OPAQUE;
      const rgba = withAlpha(color, alpha);
      result.push(
        new ArcLayer<PodiumArc>({
          id: `route-${rank}`,
          data: podiumArcs.filter((arc) => arc.rank === rank),
          greatCircle: true,
          numSegments: 48,
          widthUnits: 'pixels',
          getWidth: highlightedRank === rank ? 5 : 3,
          getHeight: 0,
          pickable: isVisible,
          autoHighlight: false,
          getSourcePosition: (d) => d.source,
          getTargetPosition: (d) => d.target,
          getSourceColor: rgba,
          getTargetColor: rgba,
          updateTriggers: { getSourceColor: rgba, getTargetColor: rgba },
          transitions: {
            getSourceColor: transition(ARC_FADE_MS),
            getTargetColor: transition(ARC_FADE_MS),
            getWidth: transition(150),
          },
        }),
      );
    }
    return result;
  }, [
    dashedSegments,
    hasPodium,
    highlightedRank,
    podiumArcs,
    podiumColors,
    prefersReducedMotion,
    revealedCount,
    routeColor,
  ]);

  // Ruta bajo el cursor ↔ tarjeta; solo limpia lo que el propio mapa resaltó.
  const hoverFromMapRef = useRef(false);
  const handleArcHover = useMemo(
    () => (info: PickingInfo) => {
      const arc = info.object as PodiumArc | undefined;
      if (arc) {
        hoverFromMapRef.current = true;
        setHighlightedRank(arc.rank);
      } else if (hoverFromMapRef.current) {
        hoverFromMapRef.current = false;
        setHighlightedRank(null);
      }
    },
    [setHighlightedRank],
  );

  const initialBounds = useMemo(() => computeRouteBounds(markers), [markers]);
  const hasSidePanel = isDesktop && floatingPanel;
  const initialPadding = hasSidePanel
    ? { top: 64, right: 80, bottom: 56, left: 492 }
    : { top: 44, right: 44, bottom: 44, left: 44 };

  useEffect(() => {
    if (!mapReady || !mapRef.current || markers.length === 0) return;

    const bounds = computeRouteBounds(markers);
    if (!bounds) return;

    const padding = hasSidePanel
      ? { top: 64, right: 80, bottom: 56, left: 492 }
      : { top: 44, right: 44, bottom: 44, left: 44 };

    const shouldAnimate = hasFittedRouteRef.current && !prefersReducedMotion;
    hasFittedRouteRef.current = true;

    try {
      mapRef.current.fitBounds(bounds, {
        padding,
        maxZoom: 7,
        linear: true,
        duration: shouldAnimate ? 450 : 0,
      });
    } catch {
      // Ignora tamaños transitorios insuficientes durante redimensionamientos extremos.
    }
  }, [mapReady, activePointsKey, markers, fitTrigger, hasSidePanel, prefersReducedMotion]);

  if (isUnavailable) {
    return (
      <div
        role="region"
        aria-label={t('map.regionLabel')}
        className={cn(
          'flex h-full w-full items-center justify-center bg-surface-sunken p-4',
          floatingPanel && 'lg:pl-[460px]',
        )}
      >
        <StatusMessage
          variant="info"
          title={t('map.fallbackTitle')}
          description={t('map.fallbackDescription')}
        />
      </div>
    );
  }

  const mapStyle = tilesFallback
    ? FALLBACK_BLANK_STYLE
    : theme === 'dark'
      ? DARK_STYLE_URL
      : LIGHT_STYLE_URL;

  const getMarkerLabel = (marker: MapMarkerPoint): string => {
    switch (marker.markerRole) {
      case 'origin':
        return t('map.markerOrigin', { iata: marker.iata });
      case 'destination':
        return t('map.markerDestination', { iata: marker.iata });
      case 'stop':
        return marker.layoverMinutes !== undefined
          ? t('map.markerStopLayover', {
              iata: marker.iata,
              duration: formatLayover(t, marker.layoverMinutes),
            })
          : t('map.markerStop', { iata: marker.iata });
      default:
        return t('map.markerSelected', { iata: marker.iata });
    }
  };

  return (
    <div
      role="region"
      aria-label={regionLabel ?? t('map.regionLabel')}
      className="relative h-full w-full overflow-hidden bg-surface-sunken"
    >
      <Map
        ref={attachMapRef}
        initialViewState={
          initialBounds
            ? {
                bounds: initialBounds,
                fitBoundsOptions: { padding: initialPadding, maxZoom: 7 },
              }
            : {
                longitude: -40,
                latitude: 12,
                zoom: 1.5,
              }
        }
        mapStyle={mapStyle}
        attributionControl={{ compact: true }}
        onLoad={(event) => {
          setMapReady(true);
          cleanupContextLossRef.current?.();
          const canvas = event.target.getCanvas();
          const handleContextLost = (e: Event) => {
            e.preventDefault();
            setWebglLost(true);
          };
          canvas.addEventListener('webglcontextlost', handleContextLost);
          cleanupContextLossRef.current = () => {
            canvas.removeEventListener('webglcontextlost', handleContextLost);
          };
        }}
        onError={() => {
          setTilesFallback(true);
        }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        <DeckArcOverlay
          layers={layers}
          pulsing={!prefersReducedMotion && !hasPodium && dashedSegments.length > 0}
          onHover={handleArcHover}
        />

        {markers.map((marker) => {
          const isEndpoint = marker.markerRole === 'origin' || marker.markerRole === 'destination';
          return (
            <Marker
              key={`${marker.markerRole}-${marker.iata}`}
              longitude={marker.lon}
              latitude={marker.lat}
              anchor="center"
              className="z-10"
            >
              <div className="flex items-center gap-1.5">
                <span className="sr-only">{getMarkerLabel(marker)}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full border-2 border-surface shadow-sm',
                    isEndpoint ? 'bg-primary' : 'bg-route-preview',
                  )}
                />
                <span aria-hidden="true">
                  <Badge variant="neutral" className="shadow-xs">
                    {marker.iata}
                    {marker.layoverMinutes !== undefined ? (
                      <span className="font-medium text-fg-muted">
                        {' · '}
                        {formatLayover(t, marker.layoverMinutes)}
                      </span>
                    ) : null}
                  </Badge>
                </span>
              </div>
            </Marker>
          );
        })}
      </Map>

      {tilesFallback ? (
        <div
          className={cn(
            'pointer-events-none absolute bottom-3 left-3 z-10',
            floatingPanel && 'lg:left-[444px]',
          )}
        >
          <Badge variant="neutral" className="shadow-xs">
            {t('map.tilesFallbackNote')}
          </Badge>
        </div>
      ) : null}
    </div>
  );
}
