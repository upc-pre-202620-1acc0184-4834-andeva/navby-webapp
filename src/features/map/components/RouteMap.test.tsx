import { act, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type RoutePreviewResponse } from '@/shared/api/schemas';
import { at, oneWayOffers } from '@/test/fixtures/podium';
import { MapErrorBoundary } from './MapErrorBoundary';
import RouteMap from './RouteMap';
import { RouteTextLegend } from './RouteTextLegend';

const mockFitBounds = vi.fn();
const mockOverlaySetProps = vi.fn();
const mockOverlayOnAdd = vi.fn(() => document.createElement('div'));
const mockOverlayOnRemove = vi.fn();
const mockOverlayConstructor = vi.fn();

vi.mock('maplibre-gl', () => ({
  setWorkerUrl: vi.fn(),
}));

vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({
  default: '/mock-worker.mjs',
}));

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

vi.mock('@deck.gl/layers', () => ({
  ArcLayer: class MockArcLayer {
    props: Record<string, unknown>;
    constructor(props: Record<string, unknown>) {
      this.props = props;
    }
  },
}));

vi.mock('@deck.gl/mapbox', () => ({
  MapboxOverlay: class MockMapboxOverlay {
    constructor(props: Record<string, unknown>) {
      mockOverlayConstructor(props);
    }
    onAdd = mockOverlayOnAdd;
    onRemove = mockOverlayOnRemove;
    setProps = mockOverlaySetProps;
  },
}));

let triggerOnError: (() => void) | null = null;
let lastInitialViewState: { fitBoundsOptions?: { padding?: { left: number } } } | undefined;
let mockCanvas: HTMLCanvasElement | null = null;

vi.mock('react-map-gl/maplibre', () => {
  return {
    Map: ({
      children,
      mapStyle,
      initialViewState,
      onLoad,
      onError,
    }: {
      children?: ReactNode;
      mapStyle: unknown;
      initialViewState?: typeof lastInitialViewState;
      onLoad?: (ev: { target: { getCanvas: () => HTMLCanvasElement } }) => void;
      onError?: () => void;
    }) => {
      triggerOnError = onError ?? null;
      lastInitialViewState = initialViewState;
      const canvas = mockCanvas ?? document.createElement('canvas');
      mockCanvas = canvas;
      // Invoca onLoad sincrónicamente una vez por render si hace falta probar fitBounds.
      queueMicrotask(() => {
        onLoad?.({ target: { getCanvas: () => canvas } });
      });
      return (
        <div data-testid="mock-map" data-style={typeof mapStyle === 'string' ? mapStyle : 'inline'}>
          <button
            type="button"
            data-testid="simulate-fit-ref"
            hidden
            onClick={() => mockFitBounds()}
          />
          {children}
        </div>
      );
    },
    Marker: ({ children }: { children?: ReactNode }) => (
      <div data-testid="mock-marker">{children}</div>
    ),
    NavigationControl: () => <div data-testid="mock-nav-control" />,
    useControl: (onCreate: () => { onAdd: (m: unknown) => HTMLElement }) => {
      const ctrl = onCreate();
      ctrl.onAdd({});
      return ctrl;
    },
  };
});

const SAMPLE_PREVIEW: RoutePreviewResponse = {
  reachable: true,
  pairs: [{ origin: 'LIM', destination: 'HND', min_stops: 1, t_min_minutes: 1320 }],
  best_route: {
    t_min_minutes: 1320,
    airports: [
      { iata: 'LIM', lat: -12.02, lon: -77.11 },
      { iata: 'LAX', lat: 33.94, lon: -118.41 },
      { iata: 'HND', lat: 35.55, lon: 139.78 },
    ],
  },
  telemetry: {
    pairs_evaluated: 1,
    bfs_ms: 4,
    astar_ms: 8,
    astar_nodes_expanded: 12,
  },
};

describe('RouteMap y componentes accesibles del mapa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    triggerOnError = null;
    mockCanvas = null;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) => {
      if (type === 'webgl2' || type === 'webgl') {
        return {
          getExtension: () => ({ loseContext: vi.fn() }),
        } as unknown as RenderingContext;
      }
      return null;
    }) as typeof HTMLCanvasElement.prototype.getContext);
  });

  it('renderiza RouteMap con interleaved: false y marcadores origen/escala/destino', () => {
    render(
      <RouteMap
        preview={SAMPLE_PREVIEW}
        originAirports={[]}
        destinationAirports={[]}
        fitTrigger={1}
      />,
    );

    expect(mockOverlayConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ interleaved: false }),
    );
    expect(screen.getByText('Origen: LIM')).toBeInTheDocument();
    expect(screen.getByText('Escala: LAX')).toBeInTheDocument();
    expect(screen.getByText('Destino: HND')).toBeInTheDocument();
    expect(mockOverlaySetProps).toHaveBeenCalled();
  });

  it('activa el fallback textual cuando WebGL no está disponible', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const onUnavailable = vi.fn();

    render(
      <RouteMap
        preview={SAMPLE_PREVIEW}
        originAirports={[]}
        destinationAirports={[]}
        fitTrigger={1}
        onUnavailableChange={onUnavailable}
      />,
    );

    expect(screen.getByText('Mapa no disponible en este navegador')).toBeInTheDocument();
    expect(onUnavailable).toHaveBeenCalledWith(true);
  });

  it('cambia a estilo inline mínimo si fallan los tiles del mapa base', () => {
    render(
      <RouteMap
        preview={SAMPLE_PREVIEW}
        originAirports={[]}
        destinationAirports={[]}
        fitTrigger={1}
      />,
    );

    expect(screen.getByTestId('mock-map')).toHaveAttribute(
      'data-style',
      expect.stringContaining('positron-gl-style'),
    );

    act(() => {
      triggerOnError?.();
    });

    expect(screen.getByTestId('mock-map')).toHaveAttribute('data-style', 'inline');
    expect(
      screen.getByText('Mapa base sin conexión; se muestran los trazos y aeropuertos.'),
    ).toBeInTheDocument();
  });

  describe('floatingPanel (el detalle de un itinerario no tiene panel flotante)', () => {
    const podium = [at(oneWayOffers, 0)];

    function useDesktopViewport() {
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query) =>
          ({
            matches: query === '(min-width: 1024px)',
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }) as unknown as MediaQueryList,
      );
    }

    it('por defecto, en escritorio deja libre el espacio del panel (padding izquierdo 492)', () => {
      useDesktopViewport();
      render(
        <RouteMap
          preview={null}
          podium={podium}
          originAirports={[]}
          destinationAirports={[]}
          fitTrigger={0}
        />,
      );
      expect(lastInitialViewState?.fitBoundsOptions?.padding?.left).toBe(492);
    });

    it('con floatingPanel={false} encuadra con 44 px en los cuatro lados', () => {
      useDesktopViewport();
      render(
        <RouteMap
          preview={null}
          podium={podium}
          originAirports={[]}
          destinationAirports={[]}
          fitTrigger={0}
          floatingPanel={false}
        />,
      );
      expect(lastInitialViewState?.fitBoundsOptions?.padding).toEqual({
        top: 44,
        right: 44,
        bottom: 44,
        left: 44,
      });
    });

    it('sin panel, el fallback sin WebGL y la nota de teselas no reservan su espacio', () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
      const { container, unmount } = render(
        <RouteMap
          preview={null}
          podium={podium}
          originAirports={[]}
          destinationAirports={[]}
          fitTrigger={0}
        />,
      );
      expect(container.querySelector('[role="region"]')?.className).toContain('lg:pl-[460px]');
      unmount();

      const detail = render(
        <RouteMap
          preview={null}
          podium={podium}
          originAirports={[]}
          destinationAirports={[]}
          fitTrigger={0}
          floatingPanel={false}
        />,
      );
      expect(detail.container.querySelector('[role="region"]')?.className).not.toContain(
        'lg:pl-[460px]',
      );
    });
  });

  it('RouteTextLegend con podio lista sus rutas aunque no haya ruta preliminar', () => {
    render(
      <RouteTextLegend
        preview={null}
        fastestHours={null}
        hasActiveSearch={true}
        forceVisible={true}
        podium={[at(oneWayOffers, 1)]}
        heading="Tramos del itinerario guardado"
        routeLabel="Ruta guardada:"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Tramos del itinerario guardado' })).toBeVisible();
    expect(screen.getByText('Ruta guardada:')).toBeInTheDocument();
    expect(screen.getByText(/LIM → PTY → MAD/)).toBeInTheDocument();
    expect(screen.queryByText(/Calculando|vacío/i)).not.toBeInTheDocument();
  });

  it('renderiza RouteTextLegend con secuencia de tramos, escalas y horas', () => {
    render(
      <RouteTextLegend
        preview={SAMPLE_PREVIEW}
        fastestHours={22}
        hasActiveSearch={true}
        forceVisible={true}
      />,
    );

    expect(
      screen.getByText(
        /Tramos estimados: LIM → LAX → HND \(1 escala\)\. Tiempo mínimo físico: ~22 h\./,
      ),
    ).toBeInTheDocument();
  });

  it('MapErrorBoundary muestra fallback textual si falla el render del mapa', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function BrokenMap(): ReactNode {
      throw new Error('boom');
    }

    render(
      <MapErrorBoundary
        fallbackLegend={
          <RouteTextLegend
            preview={SAMPLE_PREVIEW}
            fastestHours={22}
            hasActiveSearch={true}
            forceVisible={true}
          />
        }
      >
        <BrokenMap />
      </MapErrorBoundary>,
    );

    expect(screen.getByText('Mapa no disponible en este navegador')).toBeInTheDocument();
    expect(screen.getByText(/LIM → LAX → HND/)).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });
});
