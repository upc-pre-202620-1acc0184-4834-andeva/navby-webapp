import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/ui/cn';

export type SheetSnap = 'peek' | 'half' | 'full';

export interface MapBottomSheetProps {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  /** Resumen compacto mostrado en la barra del tirador (visible incluso en estado `peek`). */
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}

const PEEK_HEIGHT_PX = 148;
const TOP_GAP_PX = 12;

/** Proyección exponencial de momento (Apple WWDC Designing Fluid Interfaces). */
function projectDisplacement(velocityPxPerSec: number, decelerationRate = 0.995): number {
  return ((velocityPxPerSec / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Resistencia progresiva en los límites de arrastre (rubber-banding). */
function rubberband(overshoot: number, dimension: number, constant = 0.45): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

function snapTranslateY(snap: SheetSnap, containerHeight: number): number {
  const safeHeight = Math.max(360, containerHeight);
  if (snap === 'full') return TOP_GAP_PX;
  if (snap === 'half') return Math.max(TOP_GAP_PX, Math.round(safeHeight * 0.45));
  return Math.max(TOP_GAP_PX, safeHeight - PEEK_HEIGHT_PX);
}

function getLiveTranslateY(el: HTMLElement): number {
  const matrix = new DOMMatrix(window.getComputedStyle(el).transform);
  return Number.isFinite(matrix.m42) ? matrix.m42 : 0;
}

export function MapBottomSheet({
  snap,
  onSnapChange,
  summary,
  children,
  className,
}: MapBottomSheetProps) {
  const { t } = useTranslation();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.max(480, window.innerHeight - 56) : 720,
  );
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    pointerId: number;
    startClientY: number;
    startTranslateY: number;
    lastSamples: Array<{ y: number; t: number }>;
  } | null>(null);

  useLayoutEffect(() => {
    const updateHeight = () => {
      const parent = sheetRef.current?.parentElement;
      if (parent && parent.clientHeight > 0) {
        setContainerHeight(parent.clientHeight);
      } else if (typeof window !== 'undefined') {
        setContainerHeight(Math.max(480, window.innerHeight - 56));
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const currentTargetY = snapTranslateY(snap, containerHeight);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || isDragging) return;
    el.style.transform = `translate3d(0, ${currentTargetY}px, 0)`;
  }, [currentTargetY, isDragging]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button > 0) return;
    // No intercepta clics sobre botones dentro del resumen de cabecera.
    if ((event.target as HTMLElement | null)?.closest('button, a')) return;

    const el = sheetRef.current;
    if (!el) return;

    const liveY = getLiveTranslateY(el);
    el.style.transform = `translate3d(0, ${liveY}px, 0)`;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignora en entornos sintéticos sin puntero activo.
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startTranslateY: liveY,
      lastSamples: [{ y: event.clientY, t: performance.now() }],
    };
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const session = dragRef.current;
      const el = sheetRef.current;
      if (!session || !el || session.pointerId !== event.pointerId) return;

      const now = performance.now();
      session.lastSamples.push({ y: event.clientY, t: now });
      if (session.lastSamples.length > 5) session.lastSamples.shift();

      const minY = snapTranslateY('full', containerHeight);
      const maxY = snapTranslateY('peek', containerHeight);
      const rawY = session.startTranslateY + (event.clientY - session.startClientY);

      let boundedY = rawY;
      if (rawY < minY) {
        boundedY = minY - rubberband(minY - rawY, containerHeight);
      } else if (rawY > maxY) {
        boundedY = maxY + rubberband(rawY - maxY, containerHeight);
      }

      el.style.transform = `translate3d(0, ${boundedY}px, 0)`;
    },
    [containerHeight],
  );

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const session = dragRef.current;
      const el = sheetRef.current;
      if (!session || !el || session.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setIsDragging(false);

      const firstSample = session.lastSamples[0];
      const lastSample = session.lastSamples[session.lastSamples.length - 1];
      let velocity = 0;
      if (firstSample && lastSample && lastSample.t > firstSample.t) {
        velocity = ((lastSample.y - firstSample.y) / (lastSample.t - firstSample.t)) * 1000;
      }

      const currentY = getLiveTranslateY(el);
      const projectedY = currentY + projectDisplacement(velocity);

      const candidates: SheetSnap[] = ['full', 'half', 'peek'];
      let nearest: SheetSnap = snap;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of candidates) {
        const target = snapTranslateY(candidate, containerHeight);
        const dist = Math.abs(projectedY - target);
        if (dist < bestDistance) {
          bestDistance = dist;
          nearest = candidate;
        }
      }

      onSnapChange(nearest);
      el.style.transform = `translate3d(0, ${snapTranslateY(nearest, containerHeight)}px, 0)`;
    },
    [containerHeight, onSnapChange, snap],
  );

  const cycleSnap = () => {
    const next: SheetSnap = snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'half';
    onSnapChange(next);
  };

  return (
    <div
      ref={sheetRef}
      style={{
        height: `${Math.max(360, containerHeight - TOP_GAP_PX)}px`,
        transform: `translate3d(0, ${currentTargetY}px, 0)`,
      }}
      className={cn(
        'fixed right-0 bottom-0 left-0 z-20 flex flex-col rounded-t-2xl border border-b-0 border-line bg-surface shadow-lg',
        'md:right-auto md:left-4 md:w-[480px]',
        !isDragging &&
          'transition-transform duration-260 ease-(--ease-drawer) motion-reduce:duration-150',
        className,
      )}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        className="flex shrink-0 cursor-grab touch-none flex-col gap-2 border-b border-line px-4 pt-2.5 pb-3 active:cursor-grabbing"
      >
        <div className="flex items-center justify-center">
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-line-strong/60" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">{summary}</div>
          <button
            type="button"
            data-no-drag="true"
            aria-label={t('home.sheetHandleAria')}
            aria-expanded={snap !== 'peek'}
            onClick={cycleSnap}
            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-line bg-surface-sunken px-3 text-xs font-semibold text-fg transition-colors duration-150 ease-(--ease-out) hover:bg-line/50"
          >
            {snap === 'full' ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('home.collapseSheet')}</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('home.expandSheet')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div
        style={{ paddingBottom: `${Math.max(24, currentTargetY + 24)}px` }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
      >
        {children}
      </div>
    </div>
  );
}
