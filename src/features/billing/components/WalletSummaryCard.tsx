import { Skeleton } from 'boneyard-js/react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/shared/api/errors';
import { type Wallet } from '@/shared/api/schemas';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { formatResetTime } from '../hooks/useWallet';

export interface WalletSummaryCardProps {
  wallet: Wallet | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  locale: string;
  skeletonFixture?: ReactNode;
}

const DAILY_FREE_CREDITS_CAP = 10;

function WalletSummaryFallback() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5"
    >
      <div className="h-6 w-28 animate-pulse rounded bg-skeleton" />
      <div className="flex flex-col gap-2">
        <div className="h-9 w-36 animate-pulse rounded-lg bg-skeleton" />
        <div className="h-4 w-64 animate-pulse rounded bg-skeleton" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-lg bg-skeleton" />
        <div className="h-24 animate-pulse rounded-lg bg-skeleton" />
      </div>
    </div>
  );
}

/** Contenido de la tarjeta de saldo, reutilizado por `BonesBillingCapturePage`. */
export function WalletSummaryBody({ wallet, locale }: { wallet: Wallet; locale: string }) {
  const { t } = useTranslation();
  const freeCredits = Math.min(DAILY_FREE_CREDITS_CAP, Math.max(0, wallet.free_credits));

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 id="billing-wallet-heading" className="text-lg font-semibold text-fg">
        {t('billing.wallet.heading')}
      </h2>

      <div className="flex flex-col gap-1">
        <p className="text-3xl font-extrabold text-fg tabular-nums">
          {t('billing.wallet.totalCredits', { count: wallet.total_credits })}
        </p>
        <p className="text-sm text-fg-muted tabular-nums">
          {t('billing.wallet.searchesAvailable', { count: wallet.searches_available })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg bg-surface-sunken p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-fg-muted">
              {t('billing.wallet.freeLabel')}
            </span>
            <span className="text-sm font-semibold text-fg tabular-nums">
              {t('billing.wallet.freeRatio', { free: wallet.free_credits })}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={freeCredits}
            aria-valuemin={0}
            aria-valuemax={DAILY_FREE_CREDITS_CAP}
            aria-label={t('billing.wallet.freeProgressLabel')}
            className="h-1.5 w-full overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-200 ease-(--ease-out) motion-reduce:transition-none"
              style={{ transform: `scaleX(${freeCredits / DAILY_FREE_CREDITS_CAP})` }}
            />
          </div>
          <p className="text-xs text-fg-muted tabular-nums">
            {t('billing.wallet.freeResetNote', {
              time: formatResetTime(wallet.free_credits_reset_at, locale),
            })}
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-surface-sunken p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-fg-muted">
              {t('billing.wallet.paidLabel')}
            </span>
            <span className="text-sm font-semibold text-fg tabular-nums">
              {wallet.paid_credits}
            </span>
          </div>
          <p className="text-xs text-fg-muted">{t('billing.wallet.paidNote')}</p>
        </div>
      </div>
    </Card>
  );
}

/** Tarjeta de saldo con créditos gratuitos diarios (hora de Lima) y comprados perpetuos (US-25, US-26). */
export function WalletSummaryCard({
  wallet,
  isPending,
  error,
  onRetry,
  locale,
  skeletonFixture,
}: WalletSummaryCardProps) {
  const { t } = useTranslation();

  if (error && !wallet) {
    return (
      <section aria-labelledby="billing-wallet-heading">
        <h2 id="billing-wallet-heading" className="sr-only">
          {t('billing.wallet.heading')}
        </h2>
        <StatusMessage
          variant="error"
          title={t('billing.wallet.errorTitle')}
          description={
            isApiError(error) && error.code === 'NETWORK_ERROR'
              ? t('errors.NETWORK_ERROR')
              : t('errors.UNKNOWN')
          }
          action={
            <Button variant="secondary" onClick={onRetry}>
              {t('common.retry')}
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="billing-wallet-heading">
      <Skeleton
        name="billing-wallet"
        loading={isPending}
        transition={150}
        fixture={skeletonFixture}
        fallback={<WalletSummaryFallback />}
      >
        {wallet ? <WalletSummaryBody wallet={wallet} locale={locale} /> : null}
      </Skeleton>
    </section>
  );
}
