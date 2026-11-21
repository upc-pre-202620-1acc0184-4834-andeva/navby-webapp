import 'react-day-picker/style.css';
import { CalendarDays } from 'lucide-react';
import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type DateRange, DayPicker, type DayButtonProps } from 'react-day-picker';
import { enUS, es } from 'react-day-picker/locale';
import { useTranslation } from 'react-i18next';
import { useIntlLocale } from '@/shared/i18n/useIntlLocale';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';
import { Field } from '@/shared/ui/Field';
import { inputVariants } from '@/shared/ui/inputVariants';
import {
  addDaysIso,
  isoToUtcDate,
  MAX_ADVANCE_DAYS,
  type TripType,
  utcDateToIso,
} from '../searchCriteria';
import { AnchoredPopover } from './AnchoredPopover';

export interface DateRangeFieldProps {
  tripType: TripType;
  departureDate: string;
  returnDate: string | null;
  todayLima: string;
  departureError?: string;
  returnError?: string;
  onDatesChange: (dates: { departureDate: string; returnDate: string | null }) => void;
  onBlur?: () => void;
}

type TriggerSource = 'departure' | 'return' | 'picking-return' | null;

interface DragSession {
  mode: 'drag-start' | 'drag-end' | 'drag-new';
  anchorIso: string;
  startX: number;
  startY: number;
  hasMoved: boolean;
}

function formatDisplayDate(isoDate: string, locale: string): string {
  const date = isoToUtcDate(isoDate);
  if (!date) return '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatCompactDate(isoDate: string, locale: string): string {
  const date = isoToUtcDate(isoDate);
  if (!date) return '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

function diffDays(fromIso: string, toIso: string): number {
  const a = isoToUtcDate(fromIso);
  const b = isoToUtcDate(toIso);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function orderedRange(aIso: string, bIso: string): { fromIso: string; toIso: string } {
  return aIso <= bIso ? { fromIso: aIso, toIso: bIso } : { fromIso: bIso, toIso: aIso };
}

export function DateRangeField({
  tripType,
  departureDate,
  returnDate,
  todayLima,
  departureError,
  returnError,
  onDatesChange,
  onBlur,
}: DateRangeFieldProps) {
  const { t, i18n } = useTranslation();
  const locale = useIntlLocale();
  const lang: 'es' | 'en' = (i18n.resolvedLanguage ?? i18n.language).startsWith('en') ? 'en' : 'es';

  const rowRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [triggerSource, setTriggerSource] = useState<TriggerSource>(null);
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ fromIso: string; toIso: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragSessionRef = useRef<DragSession | null>(null);
  const dragPreviewRef = useRef<{ fromIso: string; toIso: string } | null>(null);
  const suppressNextClickRef = useRef(false);

  const minIso = todayLima;
  const maxIso = useMemo(() => addDaysIso(todayLima, MAX_ADVANCE_DAYS), [todayLima]);
  const minDate = useMemo(() => isoToUtcDate(minIso), [minIso]);
  const maxDate = useMemo(() => isoToUtcDate(maxIso), [maxIso]);

  const disabledMatchers = useMemo(() => {
    const matchers: Array<{ before: Date } | { after: Date }> = [];
    if (minDate) matchers.push({ before: minDate });
    if (maxDate) matchers.push({ after: maxDate });
    return matchers;
  }, [minDate, maxDate]);

  const isIsoEnabled = useCallback(
    (iso: string) => iso >= minIso && iso <= maxIso,
    [minIso, maxIso],
  );

  const activeFromIso = dragPreview?.fromIso ?? departureDate;
  const activeToIso = dragPreview?.toIso ?? returnDate ?? '';

  const selectedSingle = isoToUtcDate(departureDate);
  const selectedRange: DateRange | undefined = useMemo(() => {
    const from = isoToUtcDate(activeFromIso);
    if (!from) return undefined;
    const to = activeToIso ? isoToUtcDate(activeToIso) : undefined;
    return { from, to };
  }, [activeFromIso, activeToIso]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setTriggerSource(null);
    setHoveredIso(null);
    setDragPreview(null);
    dragPreviewRef.current = null;
    dragSessionRef.current = null;
    setIsDragging(false);
    onBlur?.();
  }, [onBlur]);

  const handleOpenFor = (field: 'departure' | 'return') => {
    if (!open) {
      setOpen(true);
      setTriggerSource(field);
      return;
    }
    if (triggerSource === field) {
      handleClose();
      return;
    }
    setTriggerSource(field);
  };

  // Arrastre de rango nuevo y de puntos extremos (Salida / Regreso) con puntero.
  useEffect(() => {
    if (!open || tripType !== 'ROUND_TRIP') return;

    const findDayIsoAtPoint = (clientX: number, clientY: number): string | null => {
      if (typeof document.elementFromPoint !== 'function') return null;
      const el = document.elementFromPoint(clientX, clientY);
      const dayBtn = el?.closest<HTMLElement>('[data-day-iso]');
      if (!dayBtn || dayBtn.dataset.disabled === 'true') return null;
      const iso = dayBtn.dataset.dayIso;
      return iso && isIsoEnabled(iso) ? iso : null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session) return;

      const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
      if (!session.hasMoved && distance < 6) return;

      if (!session.hasMoved) {
        session.hasMoved = true;
        setIsDragging(true);
      }

      const targetIso = findDayIsoAtPoint(event.clientX, event.clientY);
      if (!targetIso) return;

      const nextRange = orderedRange(session.anchorIso, targetIso);
      dragPreviewRef.current = nextRange;
      setDragPreview(nextRange);
    };

    const handlePointerUp = () => {
      const session = dragSessionRef.current;
      if (!session) return;
      dragSessionRef.current = null;

      const committed = dragPreviewRef.current;
      const didDrag = session.hasMoved && committed !== null;

      setIsDragging(false);
      setDragPreview(null);
      dragPreviewRef.current = null;

      if (didDrag) {
        suppressNextClickRef.current = true;
        window.setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 0);
        onDatesChange({
          departureDate: committed.fromIso,
          returnDate: committed.toIso,
        });
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [open, tripType, isIsoEnabled, onDatesChange]);

  const handleGridPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (tripType !== 'ROUND_TRIP' || event.button > 0) return;
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-day-iso]');
    if (!target || target.dataset.disabled === 'true') return;
    const iso = target.dataset.dayIso;
    if (!iso || !isIsoEnabled(iso)) return;

    const hasCompleteRange = Boolean(departureDate && returnDate);
    let mode: DragSession['mode'] = 'drag-new';
    let anchorIso = iso;

    if (hasCompleteRange && iso === departureDate && departureDate !== returnDate) {
      mode = 'drag-start';
      anchorIso = returnDate!;
    } else if (hasCompleteRange && iso === returnDate) {
      mode = 'drag-end';
      anchorIso = departureDate;
    }

    dragSessionRef.current = {
      mode,
      anchorIso,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
    };

    if (mode !== 'drag-new') {
      const initial = orderedRange(anchorIso, iso);
      dragPreviewRef.current = initial;
    } else {
      dragPreviewRef.current = null;
    }
  };

  const handleGridClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const previewHoverRange = useMemo(() => {
    if (
      isDragging ||
      tripType !== 'ROUND_TRIP' ||
      !departureDate ||
      returnDate ||
      !hoveredIso ||
      hoveredIso <= departureDate
    ) {
      return undefined;
    }
    const from = isoToUtcDate(departureDate);
    const to = isoToUtcDate(hoveredIso);
    if (!from || !to) return undefined;
    return { from, to };
  }, [isDragging, tripType, departureDate, returnDate, hoveredIso]);

  const CalendarDayButton = useMemo(() => {
    return function CustomDayButton({ day, modifiers, className, ...props }: DayButtonProps) {
      const endpoint = modifiers.range_start ? 'start' : modifiers.range_end ? 'end' : undefined;
      return (
        <button
          {...props}
          data-day-iso={day.isoDate}
          data-disabled={modifiers.disabled ? 'true' : undefined}
          data-endpoint={endpoint}
          onPointerEnter={(e) => {
            props.onPointerEnter?.(e);
            if (!modifiers.disabled) setHoveredIso(day.isoDate);
          }}
          onPointerLeave={(e) => {
            props.onPointerLeave?.(e);
          }}
          className={className}
        />
      );
    };
  }, []);

  const formattedDeparture = formatDisplayDate(departureDate, locale);
  const formattedReturn = returnDate ? formatDisplayDate(returnDate, locale) : '';

  const spanNights = activeFromIso && activeToIso ? diffDays(activeFromIso, activeToIso) : null;
  const headerSummary = useMemo(() => {
    if (tripType === 'ONE_WAY') {
      return departureDate
        ? formatCompactDate(departureDate, locale)
        : t('search.calendarSingleHint');
    }
    if (activeFromIso && activeToIso) {
      const nightsLabel =
        spanNights === 0
          ? t('search.calendarSameDay')
          : t('search.calendarNights', { count: spanNights ?? 0 });
      return `${formatCompactDate(activeFromIso, locale)} – ${formatCompactDate(activeToIso, locale)} · ${nightsLabel}`;
    }
    if (activeFromIso) {
      return `${formatCompactDate(activeFromIso, locale)} – …`;
    }
    return t('search.calendarPrompt');
  }, [tripType, departureDate, activeFromIso, activeToIso, spanNights, locale, t]);

  return (
    <div
      ref={rowRef}
      className={cn('grid gap-2.5', tripType === 'ROUND_TRIP' ? 'grid-cols-2' : 'grid-cols-1')}
    >
      <Field label={t('search.departureLabel')} error={departureError}>
        {({ id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid }) => (
          <button
            id={id}
            type="button"
            aria-expanded={open}
            data-invalid={ariaInvalid ? 'true' : undefined}
            aria-describedby={ariaDescribedBy}
            onClick={() => handleOpenFor('departure')}
            className={inputVariants({
              className: 'flex items-center justify-between gap-2 text-left tabular-nums',
            })}
          >
            <span className={cn('truncate', !formattedDeparture && 'text-fg-muted')}>
              {formattedDeparture || t('search.datePlaceholder')}
            </span>
            <CalendarDays className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
          </button>
        )}
      </Field>

      {tripType === 'ROUND_TRIP' ? (
        <Field label={t('search.returnLabel')} error={returnError}>
          {({ id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid }) => (
            <button
              id={id}
              type="button"
              aria-expanded={open}
              data-invalid={ariaInvalid ? 'true' : undefined}
              aria-describedby={ariaDescribedBy}
              onClick={() => handleOpenFor('return')}
              className={inputVariants({
                className: 'flex items-center justify-between gap-2 text-left tabular-nums',
              })}
            >
              <span className={cn('truncate', !formattedReturn && 'text-fg-muted')}>
                {formattedReturn || t('search.datePlaceholder')}
              </span>
              <CalendarDays className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
            </button>
          )}
        </Field>
      ) : null}

      <AnchoredPopover
        open={open}
        triggerRef={rowRef}
        onClose={handleClose}
        matchTriggerWidth={false}
        minSpaceBelow={370}
        className="w-[min(calc(100vw-24px),344px)] p-3"
      >
        <div role="region" aria-label={t('search.calendarAria')} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
            <span className="text-xs font-semibold text-fg tabular-nums">{headerSummary}</span>
            {tripType === 'ROUND_TRIP' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 px-2.5 text-xs"
              >
                {t('search.calendarDone')}
              </Button>
            ) : null}
          </div>

          <div
            onPointerDown={handleGridPointerDown}
            onClickCapture={handleGridClickCapture}
            onPointerLeave={() => setHoveredIso(null)}
          >
            {tripType === 'ONE_WAY' ? (
              <DayPicker
                mode="single"
                className="navby-calendar"
                locale={lang === 'en' ? enUS : es}
                timeZone="UTC"
                defaultMonth={selectedSingle ?? minDate}
                disabled={disabledMatchers}
                selected={selectedSingle}
                components={{ DayButton: CalendarDayButton }}
                onSelect={(day) => {
                  if (!day) return;
                  onDatesChange({
                    departureDate: utcDateToIso(day),
                    returnDate: null,
                  });
                  handleClose();
                }}
              />
            ) : (
              <DayPicker
                mode="range"
                className="navby-calendar"
                data-dragging={isDragging ? 'true' : undefined}
                locale={lang === 'en' ? enUS : es}
                timeZone="UTC"
                min={0}
                defaultMonth={selectedRange?.from ?? minDate}
                disabled={disabledMatchers}
                selected={selectedRange}
                modifiers={previewHoverRange ? { previewRange: previewHoverRange } : undefined}
                modifiersClassNames={{ previewRange: 'navby-range-preview' }}
                components={{ DayButton: CalendarDayButton }}
                onSelect={(range) => {
                  if (isDragging) return;
                  if (!range?.from) {
                    onDatesChange({ departureDate: '', returnDate: '' });
                    setTriggerSource('departure');
                    return;
                  }
                  const nextDep = utcDateToIso(range.from);
                  const nextRet = range.to ? utcDateToIso(range.to) : '';
                  const isFirstClickSameDay =
                    nextRet === nextDep && (!departureDate || triggerSource === 'departure');

                  if (isFirstClickSameDay) {
                    onDatesChange({
                      departureDate: nextDep,
                      returnDate: '',
                    });
                    setTriggerSource('picking-return');
                    return;
                  }

                  onDatesChange({
                    departureDate: nextDep,
                    returnDate: nextRet,
                  });
                  if (range.from && range.to) {
                    handleClose();
                  } else {
                    setTriggerSource('picking-return');
                  }
                }}
              />
            )}
          </div>

          {tripType === 'ROUND_TRIP' ? (
            <p className="border-t border-line pt-2 text-xs text-fg-muted">
              {t('search.calendarHint')}
            </p>
          ) : null}
        </div>
      </AnchoredPopover>
    </div>
  );
}
