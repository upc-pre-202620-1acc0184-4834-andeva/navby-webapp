import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ArrowUpDown, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/shared/api/errors';
import { type City, type RoutePreviewResponse } from '@/shared/api/schemas';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { cn } from '@/shared/ui/cn';
import { Field } from '@/shared/ui/Field';
import { inputVariants } from '@/shared/ui/inputVariants';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { useHydrateCityByIata } from '../hooks/useCityAutocomplete';
import {
  CABIN_CLASSES,
  type CabinClass,
  createSearchCriteriaSchema,
  CURRENCIES,
  type CurrencyCode,
  getTodayInLima,
  type SearchCriteria,
} from '../searchCriteria';
import { CityAirportsToggle, CityCombobox } from './CityCombobox';
import { DateRangeField } from './DateRangeField';
import { PassengersField } from './PassengersField';

export interface SearchPanelProps {
  initialCriteria: SearchCriteria;
  hasActiveSearch: boolean;
  preview: RoutePreviewResponse | undefined;
  previewError: unknown;
  isPreviewLoading: boolean;
  isPreviewFetching: boolean;
  isRateLimitCooldown: boolean;
  /** Cotización en curso: Buscar queda deshabilitado (US-18, el 409 no debería verse). */
  isQuoting?: boolean;
  /** `card` para el panel flotante de escritorio; `embedded` dentro de la hoja móvil/tablet. */
  variant?: 'card' | 'embedded';
  /** Permite volver a los resultados si ya existen recomendaciones cargadas. */
  hasStoredResults?: boolean;
  onViewResults?: () => void;
  onRetryPreview: () => void;
  onSubmitCriteria: (criteria: SearchCriteria) => void;
  onAirportsDebouncedChange: (criteria: SearchCriteria) => void;
  onResolvedCitiesChange?: (cities: { origin: City | null; destination: City | null }) => void;
}

const SEGMENTED_TAB_BASE =
  'inline-flex min-h-10 lg:min-h-8 items-center justify-center rounded-md px-3 text-xs font-semibold transition-colors duration-150 ease-(--ease-out)';

export function SearchPanel({
  initialCriteria,
  hasActiveSearch,
  preview,
  previewError,
  isPreviewLoading,
  isPreviewFetching,
  isRateLimitCooldown,
  isQuoting = false,
  variant = 'card',
  hasStoredResults = false,
  onViewResults,
  onRetryPreview,
  onSubmitCriteria,
  onAirportsDebouncedChange,
  onResolvedCitiesChange,
}: SearchPanelProps) {
  const { t } = useTranslation();
  const todayLima = useMemo(() => getTodayInLima(), []);
  const schema = useMemo(() => createSearchCriteriaSchema(todayLima), [todayLima]);

  const {
    control,
    setValue,
    reset,
    handleSubmit,
    trigger,
    formState: { errors, touchedFields, submitCount },
  } = useForm<SearchCriteria>({
    resolver: zodResolver(schema),
    defaultValues: initialCriteria,
    mode: 'onTouched',
    reValidateMode: 'onBlur',
  });

  // Sincroniza el formulario cuando la URL cambia por navegación (p. ej. botón Atrás).
  const serializedInitial = useMemo(() => JSON.stringify(initialCriteria), [initialCriteria]);
  const prevSerializedRef = useRef(serializedInitial);
  useEffect(() => {
    if (prevSerializedRef.current !== serializedInitial) {
      prevSerializedRef.current = serializedInitial;
      reset(initialCriteria);
    }
  }, [serializedInitial, initialCriteria, reset]);

  const origins = useWatch({ control, name: 'origins' });
  const destinations = useWatch({ control, name: 'destinations' });
  const tripType = useWatch({ control, name: 'tripType' });
  const departureDate = useWatch({ control, name: 'departureDate' });
  const returnDate = useWatch({ control, name: 'returnDate' });
  const adults = useWatch({ control, name: 'adults' });
  const childrenCount = useWatch({ control, name: 'children' });
  const infants = useWatch({ control, name: 'infants' });
  const cabin = useWatch({ control, name: 'cabin' });
  const currency = useWatch({ control, name: 'currency' });

  const [pickedOriginCity, setPickedOriginCity] = useState<City | null>(null);
  const [pickedDestCity, setPickedDestCity] = useState<City | null>(null);
  const airportDebounceRef = useRef<number | null>(null);

  const activePickedOrigin =
    pickedOriginCity &&
    origins.length > 0 &&
    pickedOriginCity.airports.some((airport) => origins.includes(airport.iata))
      ? pickedOriginCity
      : null;
  const activePickedDest =
    pickedDestCity &&
    destinations.length > 0 &&
    pickedDestCity.airports.some((airport) => destinations.includes(airport.iata))
      ? pickedDestCity
      : null;

  const originHydration = useHydrateCityByIata(
    origins,
    activePickedOrigin === null && origins.length > 0,
  );
  const destHydration = useHydrateCityByIata(
    destinations,
    activePickedDest === null && destinations.length > 0,
  );

  const originCity = origins.length > 0 ? (activePickedOrigin ?? originHydration.city) : null;
  const destinationCity = destinations.length > 0 ? (activePickedDest ?? destHydration.city) : null;

  useEffect(() => {
    onResolvedCitiesChange?.({ origin: originCity, destination: destinationCity });
  }, [originCity, destinationCity, onResolvedCitiesChange]);

  useEffect(() => {
    return () => {
      if (airportDebounceRef.current !== null) {
        window.clearTimeout(airportDebounceRef.current);
      }
    };
  }, []);

  const fieldError = (name: keyof SearchCriteria): string | undefined => {
    const issue = errors[name];
    if (!issue?.message) return undefined;
    const isTouched = Boolean(touchedFields[name]) || submitCount > 0;
    return isTouched ? t(issue.message) : undefined;
  };

  const passengersError = fieldError('infants') ?? fieldError('adults') ?? fieldError('children');

  const scheduleAirportChange = (nextOrigins: string[], nextDestinations: string[]) => {
    if (!hasActiveSearch) return;
    if (airportDebounceRef.current !== null) {
      window.clearTimeout(airportDebounceRef.current);
    }
    airportDebounceRef.current = window.setTimeout(() => {
      onAirportsDebouncedChange({
        tripType,
        origins: nextOrigins,
        destinations: nextDestinations,
        departureDate,
        returnDate,
        adults,
        children: childrenCount,
        infants,
        cabin,
        currency,
      });
    }, 400);
  };

  const handleToggleAirport = (side: 'origins' | 'destinations', iata: string) => {
    const current = side === 'origins' ? origins : destinations;
    const next = current.includes(iata)
      ? current.length > 1
        ? current.filter((item) => item !== iata)
        : current
      : [...current, iata];

    setValue(side, next, { shouldValidate: true, shouldTouch: true });
    if (side === 'origins') {
      scheduleAirportChange(next, destinations);
    } else {
      scheduleAirportChange(origins, next);
    }
  };

  const handleSwap = () => {
    const prevOriginCity = originCity;
    const prevDestCity = destinationCity;
    const prevOrigins = [...origins];
    const prevDestinations = [...destinations];

    setPickedOriginCity(prevDestCity);
    setPickedDestCity(prevOriginCity);
    setValue('origins', prevDestinations, { shouldValidate: submitCount > 0 });
    setValue('destinations', prevOrigins, { shouldValidate: submitCount > 0 });
  };

  const renderPreviewError = () => {
    if (!previewError) return null;
    if (isApiError(previewError)) {
      if (previewError.status === 429 || previewError.code === 'RATE_LIMITED') {
        return (
          <StatusMessage
            variant="error"
            title={t('search.previewErrorTitle')}
            description={t('search.errors.rateLimited')}
            action={
              <Button variant="secondary" disabled={isRateLimitCooldown} onClick={onRetryPreview}>
                {t('common.retry')}
              </Button>
            }
          />
        );
      }
      if (previewError.code === 'AIRPORT_NOT_FOUND') {
        return (
          <StatusMessage
            variant="error"
            title={t('search.previewErrorTitle')}
            description={t('search.errors.airportNotFound')}
          />
        );
      }
      if (previewError.status === 401 || previewError.code === 'UNAUTHENTICATED') {
        return (
          <StatusMessage
            variant="error"
            title={t('search.previewErrorTitle')}
            description={t('errors.UNAUTHENTICATED')}
          />
        );
      }
    }

    const fallbackDescription =
      isApiError(previewError) && previewError.code === 'NETWORK_ERROR'
        ? t('errors.NETWORK_ERROR')
        : t('errors.UNKNOWN');

    return (
      <StatusMessage
        variant="error"
        title={t('search.previewErrorTitle')}
        description={fallbackDescription}
        action={
          <Button variant="secondary" onClick={onRetryPreview}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  };

  const content = (
    <div className="flex flex-col gap-2.5">
      {variant === 'card' ? (
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-fg sm:text-xl">{t('home.title')}</h1>
          <p className="mt-0.5 text-xs leading-snug text-fg-muted">{t('home.subtitle')}</p>
        </div>
      ) : null}

      <form
        noValidate
        onSubmit={handleSubmit((data) => onSubmitCriteria(data))}
        className="flex flex-col gap-2.5"
      >
        <div
          role="group"
          aria-label={t('search.tripTypeLabel')}
          className="grid grid-cols-2 gap-1 rounded-lg bg-surface-sunken p-1"
        >
          <button
            type="button"
            aria-pressed={tripType === 'ROUND_TRIP'}
            onClick={() => {
              setValue('tripType', 'ROUND_TRIP', { shouldValidate: submitCount > 0 });
              if (returnDate === null) setValue('returnDate', '');
            }}
            className={cn(
              SEGMENTED_TAB_BASE,
              tripType === 'ROUND_TRIP'
                ? 'border border-line bg-surface text-fg shadow-xs'
                : 'border border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {t('search.roundTrip')}
          </button>
          <button
            type="button"
            aria-pressed={tripType === 'ONE_WAY'}
            onClick={() => {
              setValue('tripType', 'ONE_WAY', { shouldValidate: submitCount > 0 });
              setValue('returnDate', null, { shouldValidate: false });
            }}
            className={cn(
              SEGMENTED_TAB_BASE,
              tripType === 'ONE_WAY'
                ? 'border border-line bg-surface text-fg shadow-xs'
                : 'border border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {t('search.oneWay')}
          </button>
        </div>

        {/* Origen y Destino emparejados al estilo Google Maps; los toggles de aeropuerto van debajo para no desalinear el botón ⇅. */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
            <div className="flex min-w-0 flex-col gap-2">
              <CityCombobox
                label={t('search.originLabel')}
                placeholder={t('search.originPlaceholder')}
                selectedCity={originCity}
                selectedAirports={origins}
                fallbackIatas={origins}
                showAirportsPanel={false}
                error={
                  fieldError('origins') ??
                  (originHydration.notFound ? t('search.errors.airportNotFound') : undefined)
                }
                onSelectCity={(city, iatas) => {
                  setPickedOriginCity(city);
                  setValue('origins', iatas, { shouldValidate: true, shouldTouch: true });
                }}
                onToggleAirport={(iata) => handleToggleAirport('origins', iata)}
                onClearCity={() => {
                  setPickedOriginCity(null);
                  setValue('origins', [], { shouldValidate: true, shouldTouch: true });
                }}
                onBlur={() => void trigger('origins')}
              />

              <CityCombobox
                label={t('search.destinationLabel')}
                placeholder={t('search.destinationPlaceholder')}
                selectedCity={destinationCity}
                selectedAirports={destinations}
                fallbackIatas={destinations}
                showAirportsPanel={false}
                error={
                  fieldError('destinations') ??
                  (destHydration.notFound ? t('search.errors.airportNotFound') : undefined)
                }
                onSelectCity={(city, iatas) => {
                  setPickedDestCity(city);
                  setValue('destinations', iatas, { shouldValidate: true, shouldTouch: true });
                }}
                onToggleAirport={(iata) => handleToggleAirport('destinations', iata)}
                onClearCity={() => {
                  setPickedDestCity(null);
                  setValue('destinations', [], { shouldValidate: true, shouldTouch: true });
                }}
                onBlur={() => void trigger('destinations')}
              />
            </div>

            <div className="flex items-center self-center pt-5">
              <Button
                variant="secondary"
                size="icon"
                aria-label={t('search.swapAria')}
                onClick={handleSwap}
                className="h-10 min-h-10 w-10 min-w-10 shrink-0 rounded-full shadow-xs lg:h-9 lg:min-h-9 lg:w-9 lg:min-w-9"
              >
                <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {originCity && originCity.airports.length > 1 ? (
            <CityAirportsToggle
              city={originCity}
              selectedAirports={origins}
              onToggleAirport={(iata) => handleToggleAirport('origins', iata)}
            />
          ) : null}

          {destinationCity && destinationCity.airports.length > 1 ? (
            <CityAirportsToggle
              city={destinationCity}
              selectedAirports={destinations}
              onToggleAirport={(iata) => handleToggleAirport('destinations', iata)}
            />
          ) : null}
        </div>

        <DateRangeField
          tripType={tripType}
          departureDate={departureDate}
          returnDate={returnDate}
          todayLima={todayLima}
          departureError={fieldError('departureDate')}
          returnError={fieldError('returnDate')}
          onDatesChange={({ departureDate: nextDep, returnDate: nextRet }) => {
            setValue('departureDate', nextDep, { shouldValidate: true, shouldTouch: true });
            setValue('returnDate', nextRet, { shouldValidate: true, shouldTouch: true });
          }}
          onBlur={() => {
            void trigger('departureDate');
            if (tripType === 'ROUND_TRIP') void trigger('returnDate');
          }}
        />

        <PassengersField
          adults={adults}
          childrenCount={childrenCount}
          infants={infants}
          error={passengersError}
          onChange={({ adults: nextAd, children: nextCh, infants: nextIn }) => {
            setValue('adults', nextAd, { shouldValidate: true, shouldTouch: true });
            setValue('children', nextCh, { shouldValidate: true, shouldTouch: true });
            setValue('infants', nextIn, { shouldValidate: true, shouldTouch: true });
          }}
          onBlur={() => {
            void trigger('adults');
            void trigger('infants');
          }}
        />

        <div className="grid grid-cols-2 gap-2.5">
          <Field label={t('search.cabinLabel')}>
            {(ariaProps) => (
              <div className="relative">
                <select
                  {...ariaProps}
                  value={cabin}
                  onChange={(event) =>
                    setValue('cabin', event.target.value as CabinClass, { shouldValidate: true })
                  }
                  className={inputVariants({ className: 'cursor-pointer appearance-none pr-9' })}
                >
                  {CABIN_CLASSES.map((item) => (
                    <option key={item} value={item}>
                      {t(`search.cabins.${item}`)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-fg-muted"
                  aria-hidden="true"
                />
              </div>
            )}
          </Field>

          <Field label={t('search.currencyLabel')}>
            {(ariaProps) => (
              <div className="relative">
                <select
                  {...ariaProps}
                  value={currency}
                  onChange={(event) =>
                    setValue('currency', event.target.value as CurrencyCode, {
                      shouldValidate: true,
                    })
                  }
                  className={inputVariants({ className: 'cursor-pointer appearance-none pr-9' })}
                >
                  {CURRENCIES.map((item) => (
                    <option key={item} value={item}>
                      {t(`search.currencies.${item}`)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-fg-muted"
                  aria-hidden="true"
                />
              </div>
            )}
          </Field>
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={isQuoting || isPreviewFetching}
          disabled={isQuoting}
          className="mt-0.5 w-full"
        >
          {t('search.submit')}
        </Button>
      </form>

      <div aria-live="polite" className="flex flex-col gap-2">
        {isPreviewLoading ? (
          <p className="text-xs font-semibold text-fg-muted">{t('search.previewLoading')}</p>
        ) : null}

        {!isPreviewLoading && previewError ? renderPreviewError() : null}

        {!isPreviewLoading && !previewError && preview && !preview.reachable ? (
          <StatusMessage
            variant="empty"
            title={t('search.unreachableTitle')}
            description={t('search.unreachableDescription')}
          />
        ) : null}

        {hasStoredResults && onViewResults ? (
          <Button variant="secondary" onClick={onViewResults} className="w-full">
            <span>{t('home.viewResults')}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (variant === 'embedded') {
    return content;
  }

  return (
    <Card variant="elevated" className="p-3.5 sm:p-4">
      {content}
    </Card>
  );
}
