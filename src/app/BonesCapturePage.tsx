import { Skeleton } from 'boneyard-js/react';
import { Bookmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PodiumCard } from '@/features/podium/components/PodiumCard';
import { PodiumPanel } from '@/features/podium/components/PodiumPanel';
import { ItineraryRow } from '@/features/itineraries/components/ItineraryRow';
import { ItinerarySchema } from '@/shared/api/schemas';
import { Button } from '@/shared/ui/Button';
import { manyItineraries } from '@/test/fixtures/itineraries';
import { podiumResponse } from '@/test/fixtures/podium';

/**
 * Solo en desarrollo (`pnpm bones`): el CLI de boneyard no tiene sesión, así que esta ruta
 * monta el panel del podio en carga con tarjetas de ejemplo como `fixture`.
 */
export default function BonesCapturePage() {
  const { t } = useTranslation();
  const sample = podiumResponse();
  return (
    <div className="mx-auto w-full max-w-[420px] p-4">
      <PodiumPanel
        isQuoting
        isLoadingPodium={false}
        podium={undefined}
        isFreeResult={false}
        quoteError={null}
        podiumError={null}
        isRouteUnreachable={false}
        isStale={false}
        onRetry={() => {}}
        locale="es-PE"
        skeletonFixture={
          <ol className="flex flex-col gap-3">
            {sample.podium.map((offer) => (
              <li key={offer.offer_id}>
                <PodiumCard
                  offer={offer}
                  locale="es-PE"
                  actions={
                    <Button
                      variant="secondary"
                      icon={<Bookmark className="h-4 w-4" aria-hidden="true" />}
                    >
                      {t('podium.save.save')}
                    </Button>
                  }
                />
              </li>
            ))}
          </ol>
        }
      />
    </div>
  );
}

/** Lo mismo para la lista de itinerarios (`/__bones/itineraries`): tres filas de ejemplo. */
export function BonesItinerariesCapturePage() {
  const { t } = useTranslation();
  const rows = manyItineraries(3).map((item) => ItinerarySchema.parse(item));
  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <Skeleton
        name="itineraries-list"
        loading
        fixture={
          <ul aria-label={t('itineraries.listLabel')} className="flex flex-col gap-3">
            {rows.map((itinerary) => (
              <li key={itinerary.id}>
                <ItineraryRow itinerary={itinerary} locale="es-PE" onDelete={() => {}} />
              </li>
            ))}
          </ul>
        }
      >
        {null}
      </Skeleton>
    </div>
  );
}
