import { Skeleton } from 'boneyard-js/react';
import { CreditCard, Info } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/shared/api/errors';
import { type PackagesResponse } from '@/shared/api/schemas';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { formatBillingMoney, formatPerSearchPrice, localizePackageName } from '../formatBilling';

export interface PackagesSectionProps {
  data: PackagesResponse | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  pendingCode: string | null;
  isLocked: boolean;
  onSelectPackage: (code: string) => void;
  locale: string;
  skeletonFixture?: ReactNode;
}

function PackagesFallback() {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4"
        >
          <div className="h-5 w-28 animate-pulse rounded bg-skeleton" />
          <div className="h-4 w-36 animate-pulse rounded bg-skeleton" />
          <div className="h-8 w-24 animate-pulse rounded-lg bg-skeleton" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-skeleton" />
        </div>
      ))}
    </div>
  );
}

/** Contenido de paquetes y aviso RL-04, reutilizado por `BonesBillingCapturePage`. */
export function PackagesBody({
  data,
  pendingCode,
  isLocked,
  onSelectPackage,
  locale,
}: {
  data: PackagesResponse;
  pendingCode: string | null;
  isLocked: boolean;
  onSelectPackage: (code: string) => void;
  locale: string;
}) {
  const { t } = useTranslation();

  if (data.packages.length === 0) {
    return (
      <StatusMessage
        variant="empty"
        title={t('billing.packages.emptyTitle')}
        description={t('billing.packages.emptyDescription')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {data.packages.map((pkg) => {
          const isRecommended = pkg.code === 'pack_100';
          const name = localizePackageName(t, pkg.code, pkg.name);
          const priceFormatted = formatBillingMoney(pkg.price, data.currency, locale);
          const usdFormatted = formatBillingMoney(pkg.usd_reference, 'USD', locale);
          const perSearchFormatted = formatPerSearchPrice(
            pkg.price,
            pkg.searches,
            data.currency,
            locale,
          );

          return (
            <Card
              key={pkg.code}
              variant={isRecommended ? 'highlighted' : 'default'}
              className="flex flex-col justify-between gap-4 p-4"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-fg">{name}</h3>
                  {isRecommended ? (
                    <Badge variant="neutral" className="shrink-0 whitespace-nowrap">
                      {t('billing.packages.recommended')}
                    </Badge>
                  ) : null}
                </div>

                <p className="text-sm text-fg tabular-nums">
                  <span className="font-semibold">
                    {t('billing.packages.credits', { count: pkg.credits })}
                  </span>{' '}
                  <span className="text-fg-muted">
                    · {t('billing.packages.searches', { count: pkg.searches })}
                  </span>
                </p>

                <div className="flex flex-col gap-1">
                  <p className="text-3xl font-extrabold text-fg tabular-nums">{priceFormatted}</p>
                  <p className="text-xs text-fg-muted tabular-nums">
                    {t('billing.packages.usdReference', { price: usdFormatted })}
                  </p>
                  {perSearchFormatted ? (
                    <p className="text-xs text-fg-muted tabular-nums">
                      {t('billing.packages.perSearch', { price: perSearchFormatted })}
                    </p>
                  ) : null}
                </div>
              </div>

              <Button
                variant={isRecommended ? 'primary' : 'secondary'}
                className="w-full"
                loading={pendingCode === pkg.code}
                disabled={isLocked}
                aria-label={t('billing.packages.buyAria', {
                  name,
                  price: priceFormatted,
                })}
                icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
                onClick={() => onSelectPackage(pkg.code)}
              >
                {t('billing.packages.buy')}
              </Button>
            </Card>
          );
        })}
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-sunken p-3 text-sm text-fg">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
        <p>{t('billing.packages.sandboxNotice')}</p>
      </div>
    </div>
  );
}

/** Catálogo de paquetes en PEN con equivalente referencial en USD y aviso RL-04 (US-28, US-29). */
export function PackagesSection({
  data,
  isPending,
  error,
  onRetry,
  pendingCode,
  isLocked,
  onSelectPackage,
  locale,
  skeletonFixture,
}: PackagesSectionProps) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="billing-packages-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="billing-packages-heading" className="text-lg font-semibold text-fg">
          {t('billing.packages.heading')}
        </h2>
        <p className="text-sm text-fg-muted">{t('billing.packages.subtitle')}</p>
      </div>

      {error && !data ? (
        <StatusMessage
          variant="error"
          title={t('billing.packages.errorTitle')}
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
      ) : (
        <Skeleton
          name="billing-packages"
          loading={isPending}
          transition={150}
          fixture={skeletonFixture}
          fallback={<PackagesFallback />}
        >
          {data ? (
            <PackagesBody
              data={data}
              pendingCode={pendingCode}
              isLocked={isLocked}
              onSelectPackage={onSelectPackage}
              locale={locale}
            />
          ) : null}
        </Skeleton>
      )}
    </section>
  );
}
