import '../maplibreWorker';
import 'maplibre-gl/dist/maplibre-gl.css';

import { ArcLayer } from '@deck.gl/layers';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { type IControl, type Map as MaplibreMap, type StyleSpecification } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Map, Marker, NavigationControl, useControl, type MapRef } from 'react-map-gl/maplibre';
import {
  type CityAirport,
  type RouteAirportPoint,
  type RoutePreviewResponse,
} from '@/shared/api/schemas';
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

const LIGHT_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DARK_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const FALLBACK_BLANK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [],
};

const DEFAULT_ROUTE_RGB: RgbTuple = [138, 138, 147];

type MarkerRole = 'origin' | 'stop' | 'destination' | 'selected';

interface MapMarkerPoint extends RouteAirportPoint {
  markerRole: MarkerRole;
}

export interface RouteMapProps {
  preview: RoutePreviewResponse | null | undefined;
  originAirports: CityAirport[];
  destinationAirports: CityAirport[];
  fitTrigger: number;
  onUnavailableChange?: (unavailable: boolean) => void;
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
  segments,
  color,
  pulsing,
}: {
  segments: DashedArcSegment[];
  color: RgbTuple;
  pulsing: boolean;
}) {
  const control = useControl<OverlayControlHandle>(
    () =>
      createPulseOverlayControl({
        layers: [],
      }),
    { position: 'top-left' },
  );

  useEffect(() => {
    const [r, g, b] = color;
    const rgba: [number, number, number, number] = [r, g, b, 230];

    control.setProps({
      layers: [
        new ArcLayer<DashedArcSegment>({
          id: 'navby-preliminary-route-arcs',
          data: segments,
          greatCircle: true,
          numSegments: 16,
          widthUnits: 'pixels',
          getWidth: 3,
          getHeight: 0,
          getSourcePosition: (d) => d.source,
          getTargetPosition: (d) => d.target,
          getSourceColor: rgba,
          getTargetColor: rgba,
        }),
      ],
    });
    control.setPulsing(pulsing && segments.length > 0);
  }, [control, segments, color, pulsing]);

  return null;
}

export default function RouteMap({
  preview,
  originAirports,
  destinationAirports,
  fitTrigger,
  onUnavailableChange,
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

  const markers = useMemo<MapMarkerPoint[]>(() => {
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
  }, [routeAirports, originAirports, destinationAirports]);

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

  const initialBounds = useMemo(() => computeRouteBounds(markers), [markers]);
  const initialPadding = isDesktop
    ? { top: 64, right: 80, bottom: 56, left: 492 }
    : { top: 44, right: 44, bottom: 44, left: 44 };

  useEffect(() => {
    if (!mapReady || !mapRef.current || markers.length === 0) return;

    const bounds = computeRouteBounds(markers);
    if (!bounds) return;

    const padding = isDesktop
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
  }, [mapReady, activePointsKey, markers, fitTrigger, isDesktop, prefersReducedMotion]);

  if (isUnavailable) {
    return (
      <div
        role="region"
        aria-label={t('map.regionLabel')}
        className="flex h-full w-full items-center justify-center bg-surface-sunken p-4 lg:pl-[460px]"
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
        return t('map.markerStop', { iata: marker.iata });
      default:
        return t('map.markerSelected', { iata: marker.iata });
    }
  };

  return (
    <div
      role="region"
      aria-label={t('map.regionLabel')}
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
          segments={dashedSegments}
          color={routeColor}
          pulsing={!prefersReducedMotion}
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
                  </Badge>
                </span>
              </div>
            </Marker>
          );
        })}
      </Map>

      {tilesFallback ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 lg:left-[444px]">
          <Badge variant="neutral" className="shadow-xs">
            {t('map.tilesFallbackNote')}
          </Badge>
        </div>
      ) : null}
    </div>
  );
}
