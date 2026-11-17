import 'react-day-picker/style.css';
import { CalendarDays } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { type DateRange, DayPicker } from 'react-day-picker';
import { enUS, es } from 'react-day-picker/locale';
import { useTranslation } from 'react-i18next';
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

function formatDisplayDate(isoDate: string, lang: 'es' | 'en'): string {
  const date = isoToUtcDate(isoDate);
  if (!date) return '';
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
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
  const lang: 'es' | 'en' = (i18n.resolvedLanguage ?? i18n.language).startsWith('en') ? 'en' : 'es';

  const rowRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const minDate = useMemo(() => isoToUtcDate(todayLima), [todayLima]);
  const maxDate = useMemo(() => isoToUtcDate(addDaysIso(todayLima, MAX_ADVANCE_DAYS)), [todayLima]);

  const disabledMatchers = useMemo(() => {
    const matchers: Array<{ before: Date } | { after: Date }> = [];
    if (minDate) matchers.push({ before: minDate });
    if (maxDate) matchers.push({ after: maxDate });
    return matchers;
  }, [minDate, maxDate]);

  const selectedSingle = isoToUtcDate(departureDate);
  const selectedRange: DateRange | undefined = useMemo(() => {
    const from = isoToUtcDate(departureDate);
    if (!from) return undefined;
    const to = returnDate ? isoToUtcDate(returnDate) : undefined;
    return { from, to };
  }, [departureDate, returnDate]);

  const handleClose = () => {
    setOpen(false);
    onBlur?.();
  };

  const formattedDeparture = formatDisplayDate(departureDate, lang);
  const formattedReturn = returnDate ? formatDisplayDate(returnDate, lang) : '';

  return (
    <div
      ref={rowRef}
      className={cn('grid gap-3', tripType === 'ROUND_TRIP' ? 'grid-cols-2' : 'grid-cols-1')}
    >
      <Field label={t('search.departureLabel')} error={departureError}>
        {({ id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid }) => (
          <button
            id={id}
            type="button"
            aria-expanded={open}
            data-invalid={ariaInvalid ? 'true' : undefined}
            aria-describedby={ariaDescribedBy}
            onClick={() => setOpen((prev) => !prev)}
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
              onClick={() => setOpen((prev) => !prev)}
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
        minSpaceBelow={340}
        className="p-3"
      >
        <div role="region" aria-label={t('search.calendarAria')}>
          {tripType === 'ONE_WAY' ? (
            <DayPicker
              mode="single"
              className="navby-calendar"
              locale={lang === 'en' ? enUS : es}
              timeZone="UTC"
              defaultMonth={selectedSingle ?? minDate}
              disabled={disabledMatchers}
              selected={selectedSingle}
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
              locale={lang === 'en' ? enUS : es}
              timeZone="UTC"
              min={0}
              defaultMonth={selectedRange?.from ?? minDate}
              disabled={disabledMatchers}
              selected={selectedRange}
              onSelect={(range) => {
                if (!range?.from) {
                  onDatesChange({ departureDate: '', returnDate: '' });
                  return;
                }
                const nextDep = utcDateToIso(range.from);
                const nextRet = range.to ? utcDateToIso(range.to) : '';
                onDatesChange({
                  departureDate: nextDep,
                  returnDate: nextRet,
                });
                if (range.from && range.to) {
                  handleClose();
                }
              }}
            />
          )}
        </div>
      </AnchoredPopover>
    </div>
  );
}
