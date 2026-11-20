import { Skeleton } from 'boneyard-js/react';
import { Bookmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '@/shared/ui/initBoneyard';
import { PackagesBody, PackagesSection } from '@/features/billing/components/PackagesSection';
import {
  TransactionsBody,
  TransactionsSection,
} from '@/features/billing/components/TransactionsSection';
import {
  WalletSummaryBody,
  WalletSummaryCard,
} from '@/features/billing/components/WalletSummaryCard';
import { ItineraryRow } from '@/features/itineraries/components/ItineraryRow';
import { PodiumCard } from '@/features/podium/components/PodiumCard';
import { PodiumPanel } from '@/features/podium/components/PodiumPanel';
import { ItinerarySchema } from '@/shared/api/schemas';
import { Button } from '@/shared/ui/Button';
import {
  packagesResponse,
  transactionItem,
  transactionsPage,
  walletFixture,
} from '@/test/fixtures/billing';
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

/** Lo mismo para créditos y paquetes (`/__bones/billing`): saldo, paquetes y movimientos. */
export function BonesBillingCapturePage() {
  const { t } = useTranslation();
  const sampleWallet = walletFixture();
  const samplePackages = packagesResponse();
  const sampleTransactions = transactionsPage([
    transactionItem({ id: 'tx-b1', type: 'PURCHASE', free_delta: 0, paid_delta: 100 }),
    transactionItem({ id: 'tx-b2', type: 'SEARCH_DEBIT', free_delta: -5, paid_delta: 0 }),
    transactionItem({ id: 'tx-b3', type: 'SEARCH_REFUND', free_delta: 5, paid_delta: 0 }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-fg">{t('billing.title')}</h1>
      <WalletSummaryCard
        wallet={undefined}
        isPending
        error={null}
        onRetry={() => {}}
        locale="es-PE"
        skeletonFixture={<WalletSummaryBody wallet={sampleWallet} locale="es-PE" />}
      />
      <PackagesSection
        data={undefined}
        isPending
        error={null}
        onRetry={() => {}}
        pendingCode={null}
        isLocked={false}
        onSelectPackage={() => {}}
        locale="es-PE"
        skeletonFixture={
          <PackagesBody
            data={samplePackages}
            pendingCode={null}
            isLocked={false}
            onSelectPackage={() => {}}
            locale="es-PE"
          />
        }
      />
      <TransactionsSection
        data={undefined}
        isPending
        isFetching={false}
        isPlaceholderData={false}
        error={null}
        onRetry={() => {}}
        page={1}
        onPageChange={() => {}}
        locale="es-PE"
        skeletonFixture={
          <TransactionsBody
            data={sampleTransactions}
            isFetching={false}
            isPlaceholderData={false}
            page={1}
            onPageChange={() => {}}
            locale="es-PE"
          />
        }
      />
    </div>
  );
}
