import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from 'boneyard-js/react';
import { ArrowLeft, Bookmark, ChevronDown, Info, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import '@/shared/ui/initBoneyard';
import { isApiError } from '@/shared/api/errors';
import { type Itinerary } from '@/shared/api/schemas';
import { useSession } from '@/shared/auth/useSession';
import { useIntlLocale } from '@/shared/i18n/useIntlLocale';
import { useHomeHref } from '@/shared/search/lastSearch';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { inputVariants } from '@/shared/ui/inputVariants';
import { PriceDisclaimer } from '@/shared/ui/PriceDisclaimer';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { DeleteItineraryDialog } from '../components/DeleteItineraryDialog';
import { ItineraryRow } from '../components/ItineraryRow';
import { type DeleteResult, useItineraries } from '../hooks/useItineraries';
import { itineraryKeys } from '../itineraryKeys';

/** Tope de itinerarios guardados (RN-13). */
const MAX_ITINERARIES = 50;

type SortKey = 'recent' | 'priceAsc' | 'durationAsc' | 'departureAsc';

/** Estado de navegación con el anuncio que deja el detalle al eliminar. */
interface ItinerariesLocationState {
  announce?: string;
}

/** Mientras no existan huesos generados (`pnpm bones`): misma estructura de billete en dos zonas. */
function ItinerariesFallback({ label }: { label: string }) {
  return (
    <div aria-hidden="true" title={label} className="flex flex-col gap-3">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="grid grid-cols-1 overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="flex flex-col gap-2.5 p-4">
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 animate-pulse rounded-md bg-skeleton" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-skeleton" />
            </div>
            <div className="h-5 w-56 animate-pulse rounded bg-skeleton" />
            <div className="h-4 w-48 animate-pulse rounded bg-skeleton" />
            <div className="h-14 w-full animate-pulse rounded-lg bg-skeleton" />
          </div>
          <div className="flex items-center justify-between border-t border-dashed border-line-strong/45 bg-surface-sunken/35 px-4 py-3 sm:min-w-[176px] sm:flex-col sm:items-end sm:justify-between sm:border-t-0 sm:border-l sm:px-5 sm:py-4">
            <div className="h-7 w-24 animate-pulse rounded bg-skeleton" />
            <div className="h-8 w-24 animate-pulse rounded bg-skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}

function matchesSearch(itinerary: Itinerary, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const haystacks = [
    itinerary.name,
    itinerary.origin,
    itinerary.destination,
    ...itinerary.offer.airlines.map((a) => `${a.name} ${a.iata}`),
  ];
  return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery));
}

function sortItineraries(items: Itinerary[], sortBy: SortKey): Itinerary[] {
  if (sortBy === 'recent') return items;
  const copy = [...items];
  switch (sortBy) {
    case 'priceAsc':
      return copy.sort((a, b) => Number(a.offer.price.amount) - Number(b.offer.price.amount));
    case 'durationAsc':
      return copy.sort((a, b) => a.offer.duration_minutes - b.offer.duration_minutes);
    case 'departureAsc':
      return copy.sort((a, b) => a.departure_date.localeCompare(b.departure_date));
  }
}

/** Mis itinerarios (US-23, US-24): del más reciente al más antiguo, sin mapa. */
export default function ItinerariesPage() {
  const { t } = useTranslation();
  const locale = useIntlLocale();
  const { user } = useSession();
  const homeHref = useHomeHref(user?.user_id);
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data, isPending, error, refetch } = useItineraries();

  const incoming = (location.state as ItinerariesLocationState | null)?.announce ?? '';
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeadingRef = useRef(false);
  const searchInputId = useId();
  const sortSelectId = useId();
  const [toDelete, setToDelete] = useState<Itinerary | null>(null);
  const [announcement, setAnnouncement] = useState(incoming);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('recent');

  // Llegando del detalle tras eliminar, el foco vuelve al título y se refresca el anuncio post-montaje.
  useEffect(() => {
    if (!incoming) return;
    headingRef.current?.focus();
    const frame = requestAnimationFrame(() => setAnnouncement(incoming));
    return () => cancelAnimationFrame(frame);
  }, [incoming]);

  // Con la fila ya sin su botón, el foco no puede volver a él: va al título (tras cerrar el diálogo).
  useEffect(() => {
    if (toDelete === null && focusHeadingRef.current) {
      focusHeadingRef.current = false;
      headingRef.current?.focus();
    }
  }, [toDelete]);

  const handleDeleted = (itinerary: Itinerary, result: DeleteResult) => {
    queryClient.removeQueries({ queryKey: itineraryKeys.detail(itinerary.id) });
    setAnnouncement(t(result === 'gone' ? 'itineraries.gone' : 'itineraries.deleted'));
    focusHeadingRef.current = true;
    setToDelete(null);
  };

  const items = useMemo(() => data?.items ?? [], [data]);
  const isFull = (data?.total ?? 0) >= MAX_ITINERARIES;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleItems = useMemo(
    () =>
      sortItineraries(
        items.filter((item) => matchesSearch(item, normalizedQuery)),
        sortBy,
      ),
    [items, normalizedQuery, sortBy],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          to={homeHref}
          className={buttonVariants({ variant: 'ghost', className: '-ml-3 self-start px-3' })}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{t('itineraries.backToSearch')}</span>
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="focus:not(:focus-visible):outline-none text-2xl font-bold text-fg focus-visible:outline-2 focus-visible:outline-ring"
          >
            {t('itineraries.title')}
          </h1>
          {items.length > 0 ? (
            <Badge variant={isFull ? 'warning' : 'neutral'} className="px-3 py-1">
              {t('itineraries.count', { count: data?.total ?? items.length, max: MAX_ITINERARIES })}
            </Badge>
          ) : null}
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {isFull ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-sunken p-3 text-sm text-fg"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
          <span>{t('itineraries.full')}</span>
        </div>
      ) : null}

      {error && !data ? (
        <StatusMessage
          variant="error"
          title={t('itineraries.error.title')}
          description={
            isApiError(error) && error.code === 'NETWORK_ERROR'
              ? t('errors.NETWORK_ERROR')
              : t('errors.UNKNOWN')
          }
          action={
            <Button variant="secondary" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        <Skeleton
          name="itineraries-list"
          loading={isPending}
          transition={150}
          fallback={<ItinerariesFallback label={t('common.loading')} />}
        >
          {data ? (
            items.length === 0 ? (
              <StatusMessage
                variant="empty"
                icon={Bookmark}
                title={t('itineraries.empty.title')}
                description={t('itineraries.empty.description')}
                action={
                  <Link to={homeHref} className={buttonVariants({ variant: 'primary' })}>
                    {t('itineraries.empty.action')}
                  </Link>
                }
              />
            ) : (
              <div className="flex flex-col gap-4">
                {items.length >= 2 ? (
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <label htmlFor={searchInputId} className="sr-only">
                        {t('itineraries.searchLabel')}
                      </label>
                      <Search
                        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-muted"
                        aria-hidden="true"
                      />
                      <input
                        id={searchInputId}
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={t('itineraries.searchPlaceholder')}
                        className={inputVariants({ className: 'pr-10 pl-9' })}
                      />
                      {searchQuery ? (
                        <button
                          type="button"
                          aria-label={t('itineraries.clearSearch')}
                          onClick={() => setSearchQuery('')}
                          className="absolute top-1/2 right-1 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted transition-colors duration-150 ease-(--ease-out) before:absolute before:-inset-1 before:content-[''] hover:bg-surface-sunken hover:text-fg"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>

                    <div className="relative sm:w-52">
                      <label htmlFor={sortSelectId} className="sr-only">
                        {t('itineraries.sortLabel')}
                      </label>
                      <select
                        id={sortSelectId}
                        value={sortBy}
                        onChange={(event) => setSortBy(event.target.value as SortKey)}
                        className={inputVariants({
                          className: 'cursor-pointer appearance-none pr-9',
                        })}
                      >
                        <option value="recent">{t('itineraries.sort.recent')}</option>
                        <option value="priceAsc">{t('itineraries.sort.priceAsc')}</option>
                        <option value="durationAsc">{t('itineraries.sort.durationAsc')}</option>
                        <option value="departureAsc">{t('itineraries.sort.departureAsc')}</option>
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-fg-muted"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                ) : null}

                {visibleItems.length === 0 ? (
                  <StatusMessage
                    variant="empty"
                    icon={Search}
                    title={t('itineraries.noMatches.title')}
                    description={t('itineraries.noMatches.description')}
                    action={
                      <Button variant="secondary" onClick={() => setSearchQuery('')}>
                        {t('itineraries.clearSearch')}
                      </Button>
                    }
                  />
                ) : (
                  <ul aria-label={t('itineraries.listLabel')} className="flex flex-col gap-3">
                    {visibleItems.map((itinerary) => (
                      <li key={itinerary.id}>
                        <ItineraryRow
                          itinerary={itinerary}
                          locale={locale}
                          onDelete={setToDelete}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                <PriceDisclaimer
                  note={t('itineraries.priceNote')}
                  className="rounded-xl border border-line bg-surface-sunken px-4 py-3"
                />
              </div>
            )
          ) : null}
        </Skeleton>
      )}

      <DeleteItineraryDialog
        itinerary={toDelete}
        onDeleted={handleDeleted}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
