import { ChevronDown, Loader2, MapPin } from 'lucide-react';
import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type City } from '@/shared/api/schemas';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/shared/ui/cn';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/Input';
import { formatCityLabel, localizeCountryName } from '../countryLocalization';
import { useCitySearchQuery } from '../hooks/useCityAutocomplete';
import { AnchoredPopover } from './AnchoredPopover';

export interface CityComboboxProps {
  label: string;
  placeholder: string;
  selectedCity: City | null;
  selectedAirports: string[];
  fallbackIatas?: string[];
  error?: string;
  onSelectCity: (city: City, airports: string[]) => void;
  onToggleAirport: (iata: string) => void;
  onClearCity?: () => void;
  onBlur?: () => void;
}

function getCityKey(city: City): string {
  return `${city.city}-${city.country}-${city.airports.map((a) => a.iata).join(',')}`;
}

export function CityCombobox({
  label,
  placeholder,
  selectedCity,
  selectedAirports,
  fallbackIatas = [],
  error,
  onSelectCity,
  onToggleAirport,
  onClearCity,
  onBlur,
}: CityComboboxProps) {
  const { t, i18n } = useTranslation();
  const lang: 'es' | 'en' = (i18n.resolvedLanguage ?? i18n.language).startsWith('en') ? 'en' : 'es';

  const listboxId = useId();
  const airportsPanelId = useId();
  const minHintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [airportsOpen, setAirportsOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const selectedLabel = selectedCity
    ? formatCityLabel(selectedCity, lang)
    : fallbackIatas.length > 0
      ? fallbackIatas.join(', ')
      : '';
  const inputValue = draftQuery ?? selectedLabel;
  const isSearchingDraft = draftQuery !== null;
  const queryText = isSearchingDraft ? draftQuery : '';
  const { data, isFetching, isError, refetch } = useCitySearchQuery(queryText);

  const cities = data?.cities ?? [];
  const trimmedQuery = queryText.trim();
  const showResults = isOpen && trimmedQuery.length >= 2;

  const commitCity = (city: City) => {
    const allIatas = city.airports.slice(0, 5).map((a) => a.iata);
    onSelectCity(city, allIatas);
    setDraftQuery(null);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const closeWithoutCommit = () => {
    setIsOpen(false);
    setDraftQuery(null);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'ArrowDown') {
      if (!showResults) {
        if (trimmedQuery.length >= 2) setIsOpen(true);
        return;
      }
      event.preventDefault();
      if (cities.length === 0) return;
      setActiveIndex((prev) => (prev + 1 < cities.length ? prev + 1 : 0));
      return;
    }

    if (event.key === 'ArrowUp') {
      if (!showResults || cities.length === 0) return;
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : cities.length - 1));
      return;
    }

    if (event.key === 'Enter' && showResults) {
      const target = activeIndex >= 0 ? cities[activeIndex] : cities[0];
      if (target) {
        event.preventDefault();
        commitCity(target);
      }
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closeWithoutCommit();
      return;
    }

    if (event.key === 'Tab' && isOpen) {
      closeWithoutCommit();
    }
  };

  const activeCity = activeIndex >= 0 ? cities[activeIndex] : undefined;
  const activeOptionId =
    showResults && activeCity ? `${listboxId}-opt-${getCityKey(activeCity)}` : undefined;

  const localizedCityShort = selectedCity
    ? lang === 'es'
      ? (selectedCity.city_es ?? selectedCity.city)
      : selectedCity.city
    : '';

  return (
    <div className="flex flex-col gap-2">
      <Field label={label} error={error}>
        {(ariaProps) => (
          <div className="relative">
            <Input
              ref={inputRef}
              {...ariaProps}
              role="combobox"
              aria-expanded={showResults}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeOptionId}
              autoComplete="off"
              spellCheck={false}
              placeholder={placeholder}
              value={inputValue}
              onFocus={() => {
                if (draftQuery === null) {
                  setDraftQuery('');
                }
                if (trimmedQuery.length >= 2) {
                  setIsOpen(true);
                }
              }}
              onChange={(event) => {
                const next = event.target.value;
                setDraftQuery(next);
                setActiveIndex(-1);
                if (next.trim().length === 0 && selectedCity && onClearCity) {
                  onClearCity();
                }
                setIsOpen(next.trim().length >= 2);
              }}
              onBlur={() => {
                closeWithoutCommit();
                onBlur?.();
              }}
              onKeyDown={handleKeyDown}
            />
          </div>
        )}
      </Field>

      <AnchoredPopover
        open={showResults}
        triggerRef={inputRef}
        onClose={closeWithoutCommit}
        minSpaceBelow={220}
      >
        <div className="max-h-72 overflow-y-auto p-1.5">
          {isFetching ? (
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-fg-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>{t('search.searchingCities')}</span>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-error-ink">
              <span>{t('search.citiesError')}</span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void refetch()}
                className="font-semibold text-brand-ink underline underline-offset-2"
              >
                {t('common.retry')}
              </button>
            </div>
          ) : cities.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-fg-muted">
              {t('search.noCitiesFound', { query: trimmedQuery })}
            </p>
          ) : (
            <div id={listboxId} role="listbox" aria-label={t('search.citySuggestionsAria')}>
              {cities.map((city, idx) => {
                const key = getCityKey(city);
                const optionId = `${listboxId}-opt-${key}`;
                const isActive = idx === activeIndex;
                const cityTitle = lang === 'es' ? (city.city_es ?? city.city) : city.city;
                const countryTitle = localizeCountryName(city.country, lang);
                const iataSummary = city.airports.map((a) => a.iata).join(', ');

                return (
                  <button
                    key={key}
                    id={optionId}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onPointerDown={(e) => e.preventDefault()}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commitCity(city)}
                    className={cn(
                      'flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-100 ease-(--ease-out)',
                      isActive ? 'bg-surface-sunken text-fg' : 'text-fg hover:bg-surface-sunken',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
                      <span className="truncate font-medium">
                        {cityTitle}, {countryTitle}
                      </span>
                    </span>
                    <Badge variant="neutral" className="shrink-0">
                      {iataSummary}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </AnchoredPopover>

      {selectedCity && selectedCity.airports.length > 1 ? (
        <div className="rounded-lg border border-line bg-surface-sunken/60 px-3 py-1.5">
          <button
            type="button"
            aria-expanded={airportsOpen}
            aria-controls={airportsPanelId}
            onClick={() => setAirportsOpen((prev) => !prev)}
            className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-xs font-semibold text-fg sm:min-h-8"
          >
            <span className="tabular-nums">
              {t('search.airportsToggle', {
                city: localizedCityShort,
                selected: selectedAirports.length,
                total: selectedCity.airports.length,
              })}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-fg-muted transition-transform duration-150 ease-(--ease-out) motion-reduce:transition-none',
                airportsOpen && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>

          {airportsOpen ? (
            <div
              id={airportsPanelId}
              className="mt-1.5 flex flex-col gap-1 border-t border-line pt-2"
            >
              {selectedCity.airports.slice(0, 5).map((airport) => {
                const checked = selectedAirports.includes(airport.iata);
                const disableUncheck = checked && selectedAirports.length === 1;
                return (
                  <label
                    key={airport.iata}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 text-xs sm:min-h-9',
                      disableUncheck && 'cursor-not-allowed opacity-75',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disableUncheck}
                        aria-describedby={disableUncheck ? minHintId : undefined}
                        onChange={() => onToggleAirport(airport.iata)}
                        className="h-4 w-4 rounded border-line-strong accent-primary"
                      />
                      <span className="truncate text-fg">{airport.name}</span>
                    </span>
                    <Badge variant="neutral" className="shrink-0">
                      {airport.iata}
                    </Badge>
                  </label>
                );
              })}
              <p id={minHintId} className="px-1.5 pt-0.5 text-xs text-fg-muted">
                {t('search.airportsMinHint')}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
