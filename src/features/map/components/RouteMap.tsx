import '../maplibreWorker';
import 'maplibre-gl/dist/maplibre-gl.css';

import { LocateFixed } from 'lucide-react';
import { type Layer, type PickingInfo } from '@deck.gl/core';
import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { type IControl, type Map as MaplibreMap, type StyleSpecification } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Map, NavigationControl, useControl, type MapRef } from 'react-map-gl/maplibre';
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
  interpolateGreatCircle,
  readCssRgbTuple,
  revealSegments,
  type DashedArcSegment,
  type LonLat,
  type RgbTuple,
} from '../greatCircleDashes';
import { buildPodiumArcs, buildPodiumStops, type PodiumArc } from '../podiumRoutes';
import { PREVIEW_DRAW_S, useRouteReveal } from '../useRouteReveal';
import { MapMarker } from './MapMarker';

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
/** Resaltado de una ruta del podio; el dibujado de las rutas vive en `useRouteReveal`. */
const ARC_FADE_MS = 200;
const CAMERA_MS = 900;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
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
  /** Padding inferior extra en móvil/tablet cuando la hoja inferior cubre parte del mapa. */
  bottomInset?: number;
  /** Etiqueta accesible del mapa (p. ej. mapa de ruta guardada en el detalle). */
  regionLabel?: string;
  /** Dibuja las rutas de inmediato sin animación progresiva (p. ej. itinerario guardado). */
  instantReveal?: boolean;
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
  getLayers,
  subscribe,
  pulsing,
  onHover,
}: {
  getLayers: () => Layer[];
  /** Avisa de cada fotograma de la animación para repintar sin re-renderizar React. */
  subscribe: (listener: () => void) => () => void;
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
    const push = () => control.setProps({ layers: getLayers(), onHover });
    push();
    return subscribe(push);
  }, [control, getLayers, subscribe, onHover]);

  useEffect(() => {
    control.setPulsing(pulsing);
  }, [control, pulsing]);

  return null;
}

type Rgba = [number, number, number, number];

interface RouteHead {
  position: LonLat;
  color: Rgba;
}

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
  bottomInset = 0,
  regionLabel,
  instantReveal = false,
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

  // Secuencia: preliminar completa → pausa → podio (ver `useRouteReveal`).
  const previewKey = routeAirports.map((pt) => pt.iata).join('>');
  const podiumKey = hasPodium ? podium.map((offer) => offer.offer_id).join('|') : '';
  const reveal = useRouteReveal({
    previewKey,
    podiumKey,
    reducedMotion: prefersReducedMotion || instantReveal,
  });
  const { values: revealValues, subscribe: subscribeReveal } = reveal;
  const showPodium = hasPodium && reveal.podiumReleased;

  const markers = useMemo<MapMarkerPoint[]>(() => {
    if (showPodium && podiumStops.length >= 2) return podiumStops;
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
  }, [showPodium, podiumStops, routeAirports, originAirports, destinationAirports]);

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

  const getLayers = (): Layer[] => {
    const v = revealValues.current;
    const transition = (duration: number) => (prefersReducedMotion ? 0 : duration);
    const heads: RouteHead[] = [];

    const previewAlpha = Math.round(OPAQUE * v.previewAlpha);
    const previewColor = withAlpha(routeColor, previewAlpha);
    const previewSegments = revealSegments(dashedSegments, v.previewDraw);
    const previewTip = previewSegments[previewSegments.length - 1]?.target;
    if (previewTip && v.previewDraw < 1) {
      heads.push({ position: previewTip, color: withAlpha(routeColor, 255) });
    }

    const result: Layer[] = [
      new ArcLayer<DashedArcSegment>({
        id: 'navby-preliminary-route-arcs',
        data: previewSegments,
        greatCircle: true,
        numSegments: 16,
        widthUnits: 'pixels',
        getWidth: 3,
        getHeight: 0,
        getSourcePosition: (d) => d.source,
        getTargetPosition: (d) => d.target,
        getSourceColor: previewColor,
        getTargetColor: previewColor,
        updateTriggers: { getSourceColor: previewAlpha, getTargetColor: previewAlpha },
      }),
    ];

    // Las rutas peores se dibujan primero: el Top 1 queda encima.
    for (const rank of [...RANKS].reverse()) {
      const color = podiumColors[rank];
      const isDimmed = highlightedRank !== null && highlightedRank !== rank;
      const rgba = withAlpha(color, isDimmed ? DIMMED : OPAQUE);

      // Los tramos de una opción se dibujan uno tras otro, como un solo trazo continuo.
      const arcs = podiumArcs.filter((arc) => arc.rank === rank);
      const visible: PodiumArc[] = [];
      arcs.forEach((arc, index) => {
        const local = Math.min(1, v.arcDraw[rank] * arcs.length - index);
        if (local <= 0) return;
        if (local >= 1) {
          visible.push(arc);
          return;
        }
        const tip: LonLat = interpolateGreatCircle(arc.source, arc.target, local);
        visible.push({ ...arc, target: tip });
        heads.push({ position: tip, color: withAlpha(color, 255) });
      });

      result.push(
        new ArcLayer<PodiumArc>({
          id: `route-${rank}`,
          data: visible,
          greatCircle: true,
          numSegments: 48,
          widthUnits: 'pixels',
          getWidth: highlightedRank === rank ? 5 : 3,
          getHeight: 0,
          pickable: visible.length > 0,
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

    // Punta luminosa que acompaña al trazo mientras se dibuja.
    result.push(
      new ScatterplotLayer<RouteHead>({
        id: 'navby-route-heads',
        data: heads,
        getPosition: (d) => d.position,
        getFillColor: (d) => d.color,
        getRadius: 4.5,
        radiusUnits: 'pixels',
        stroked: true,
        getLineColor: (d) => [d.color[0], d.color[1], d.color[2], 90],
        getLineWidth: 5,
        lineWidthUnits: 'pixels',
        pickable: false,
      }),
    );
    return result;
  };

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
  const mobileTopInset = floatingPanel && !isDesktop ? 76 : 52;
  const effectiveBottomInset = hasSidePanel
    ? 56
    : Math.max(56, Math.min(360, Math.round(bottomInset)));
  const detailSidePadding = floatingPanel ? 44 : 72;
  const initialPadding = hasSidePanel
    ? { top: 64, right: 80, bottom: 56, left: 492 }
    : {
        top: mobileTopInset,
        right: detailSidePadding,
        bottom: effectiveBottomInset,
        left: floatingPanel ? 44 : 56,
      };

  // Ciudad pulsada: se centra con suavidad y muestra su tarjeta.
  const [selectedIata, setSelectedIata] = useState<string | null>(null);
  const selectedMarker = markers.find((m) => m.iata === selectedIata) ?? null;
  const airportName = (iata: string) =>
    [...originAirports, ...destinationAirports].find((a) => a.iata === iata)?.name;

  useEffect(() => {
    if (!selectedMarker) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedIata(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedMarker]);

  const handleSelectMarker = (marker: MapMarkerPoint) => {
    const isSame = marker.iata === selectedIata;
    setSelectedIata(isSame ? null : marker.iata);
    if (isSame || !mapRef.current) return;
    const padding = hasSidePanel
      ? { top: 64, right: 80, bottom: 56, left: 492 }
      : {
          top: mobileTopInset,
          right: detailSidePadding,
          bottom: effectiveBottomInset,
          left: floatingPanel ? 44 : 56,
        };
    mapRef.current.easeTo({
      center: [marker.lon, marker.lat],
      zoom: Math.max(mapRef.current.getZoom(), 4),
      padding,
      easing: easeInOutCubic,
      duration: prefersReducedMotion ? 0 : 700,
    });
  };

  const fitMapToRoute = (animate: boolean) => {
    if (!mapRef.current || markers.length === 0) return;
    const bounds = computeRouteBounds(markers);
    if (!bounds) return;

    const padding = hasSidePanel
      ? { top: 64, right: 80, bottom: 56, left: 492 }
      : {
          top: mobileTopInset,
          right: detailSidePadding,
          bottom: effectiveBottomInset,
          left: floatingPanel ? 44 : 56,
        };

    try {
      mapRef.current.fitBounds(bounds, {
        padding,
        maxZoom: 7,
        linear: true,
        easing: easeInOutCubic,
        duration: animate && !prefersReducedMotion ? CAMERA_MS : 0,
      });
    } catch {
      // Ignora tamaños transitorios insuficientes durante redimensionamientos extremos.
    }
  };

  useEffect(() => {
    if (!mapReady || !mapRef.current || markers.length === 0) return;
    const shouldAnimate = hasFittedRouteRef.current && !prefersReducedMotion;
    hasFittedRouteRef.current = true;
    fitMapToRoute(shouldAnimate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapReady,
    activePointsKey,
    markers,
    fitTrigger,
    hasSidePanel,
    effectiveBottomInset,
    mobileTopInset,
    prefersReducedMotion,
  ]);

  if (isUnavailable) {
    return (
      <div
        role="region"
        aria-label={regionLabel ?? t('map.regionLabel')}
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
      className={cn(
        'relative h-full w-full overflow-hidden bg-surface-sunken',
        floatingPanel && !isDesktop && 'navby-map-offset-controls',
      )}
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
        onClick={() => setSelectedIata(null)}
        onError={() => {
          setTilesFallback(true);
        }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {markers.length > 0 ? (
          <div
            className={cn(
              'pointer-events-auto absolute right-2.5 z-10',
              isDesktop || !floatingPanel
                ? 'top-[88px] [@media(pointer:coarse)]:top-[108px]'
                : 'top-[150px] [@media(pointer:coarse)]:top-[170px]',
            )}
          >
            <button
              type="button"
              aria-label={t('map.recenter')}
              title={t('map.recenter')}
              onClick={() => fitMapToRoute(true)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-surface text-fg shadow-md transition-colors duration-150 ease-(--ease-out) hover:bg-surface-sunken active:scale-[0.97] lg:min-h-10 lg:min-w-10"
            >
              <LocateFixed className="h-4 w-4 text-brand-ink" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <DeckArcOverlay
          getLayers={getLayers}
          subscribe={subscribeReveal}
          pulsing={
            !prefersReducedMotion && !hasPodium && reveal.previewDrawn && dashedSegments.length > 0
          }
          onHover={handleArcHover}
        />

        {markers.map((marker, index) => {
          const isEndpoint = marker.markerRole === 'origin' || marker.markerRole === 'destination';
          const isPreviewMarkers = !showPodium && routeAirports.length >= 2;
          // La etiqueta aparece cuando el trazo la alcanza: la preliminar la recorre de punta a punta.
          const enterDelayMs = prefersReducedMotion
            ? 0
            : isPreviewMarkers
              ? Math.round((index / Math.max(1, markers.length - 1)) * PREVIEW_DRAW_S * 1000)
              : index * 90;
          return (
            <MapMarker
              key={`${marker.markerRole}-${marker.iata}`}
              iata={marker.iata}
              lat={marker.lat}
              lon={marker.lon}
              isEndpoint={isEndpoint}
              label={getMarkerLabel(marker)}
              caption={
                marker.layoverMinutes !== undefined
                  ? `${marker.iata} · ${formatLayover(t, marker.layoverMinutes)}`
                  : marker.iata
              }
              isSelected={selectedMarker?.iata === marker.iata}
              enterDelayMs={enterDelayMs}
              onSelect={() => handleSelectMarker(marker)}
              card={{
                roleLabel: t(`map.role.${marker.markerRole}`),
                name: airportName(marker.iata),
                detail:
                  marker.layoverMinutes !== undefined
                    ? t('map.layoverLine', { duration: formatLayover(t, marker.layoverMinutes) })
                    : undefined,
              }}
            />
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
