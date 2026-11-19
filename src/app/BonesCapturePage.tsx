import { PodiumCard } from '@/features/podium/components/PodiumCard';
import { PodiumPanel } from '@/features/podium/components/PodiumPanel';
import { podiumResponse } from '@/test/fixtures/podium';

/**
 * Solo en desarrollo (`pnpm bones`): el CLI de boneyard no tiene sesión, así que esta ruta
 * monta el panel del podio en carga con tarjetas de ejemplo como `fixture`.
 */
export default function BonesCapturePage() {
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
                <PodiumCard offer={offer} locale="es-PE" />
              </li>
            ))}
          </ol>
        }
      />
    </div>
  );
}
