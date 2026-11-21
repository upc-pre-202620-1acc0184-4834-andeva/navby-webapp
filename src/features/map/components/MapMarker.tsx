import { Marker } from 'react-map-gl/maplibre';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/shared/ui/cn';

export interface MapMarkerProps {
  iata: string;
  lat: number;
  lon: number;
  isEndpoint: boolean;
  /** Texto accesible del botón («Origen: LIM»). */
  label: string;
  /** Texto corto junto al punto (IATA, y la conexión en una escala). */
  caption: string;
  isSelected: boolean;
  /** Retraso de la animación de entrada para que aparezca cuando la ruta lo alcanza. */
  enterDelayMs: number;
  onSelect: () => void;
  /** Contenido de la tarjeta de la ciudad cuando está seleccionada. */
  card: { roleLabel: string; name?: string; detail?: string };
}

/**
 * Punto de un aeropuerto. El elemento anclado es solo el punto (la etiqueta y la tarjeta salen
 * en posición absoluta), así su centro cae exactamente sobre la coordenada.
 */
export function MapMarker({
  iata,
  lat,
  lon,
  isEndpoint,
  label,
  caption,
  isSelected,
  enterDelayMs,
  onSelect,
  card,
}: MapMarkerProps) {
  return (
    <Marker longitude={lon} latitude={lat} anchor="center" className={isSelected ? 'z-20' : 'z-10'}>
      <div
        className="navby-marker-in relative h-2.5 w-2.5"
        style={{ animationDelay: `${enterDelayMs}ms` }}
      >
        <button
          type="button"
          aria-expanded={isSelected}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          className={cn(
            'relative block h-2.5 w-2.5 cursor-pointer rounded-full border-2 border-surface shadow-sm transition-transform duration-150 ease-(--ease-out) before:absolute before:-inset-[17px] before:content-[""] hover:scale-125 active:scale-110 motion-reduce:transition-none',
            isEndpoint ? 'bg-primary' : 'bg-route-preview',
            isSelected && 'scale-125 ring-2 ring-primary/40',
          )}
        >
          <span className="sr-only">{label}</span>
        </button>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-full ml-1.5 -translate-y-1/2"
        >
          <Badge variant="neutral" className="whitespace-nowrap shadow-xs">
            {caption}
          </Badge>
        </span>

        {isSelected ? (
          <div
            role="group"
            aria-label={iata}
            className="navby-card-in absolute bottom-full left-1/2 mb-3 w-max max-w-56 -translate-x-1/2 rounded-xl border border-line bg-surface p-3 shadow-lg"
          >
            <p className="text-sm font-semibold text-fg">{iata}</p>
            {card.name ? <p className="mt-0.5 text-xs text-fg">{card.name}</p> : null}
            <p className="mt-0.5 text-xs text-fg-muted">{card.roleLabel}</p>
            {card.detail ? <p className="mt-0.5 text-xs text-fg-muted">{card.detail}</p> : null}
          </div>
        ) : null}
      </div>
    </Marker>
  );
}
