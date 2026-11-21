import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { isApiError } from '@/shared/api/errors';
import { type OrderDetail } from '@/shared/api/schemas';
import { useSession } from '@/shared/auth/useSession';
import { useIntlLocale } from '@/shared/i18n/useIntlLocale';
import { useHomeHref } from '@/shared/search/lastSearch';
import { Button } from '@/shared/ui/Button';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { Card } from '@/shared/ui/Card';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { resolveResultOrderId } from '../checkoutNavigation';
import { formatBillingMoney, localizePackageName } from '../formatBilling';
import { useOrderStatus } from '../hooks/useOrderStatus';
import { useWallet } from '../hooks/useWallet';

function OrderDetailsSummary({
  order,
  locale,
  balanceValue,
  showBalanceRow,
}: {
  order: OrderDetail;
  locale: string;
  balanceValue?: number | 'loading';
  showBalanceRow?: boolean;
}) {
  const { t } = useTranslation();
  const packageName = localizePackageName(t, order.package_code, order.package_code);
  const amountFormatted = formatBillingMoney(order.amount, order.currency, locale);

  return (
    <dl
      aria-label={t('billing.result.orderSummary')}
      className="grid w-full max-w-md grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-surface-sunken p-4 text-left text-sm"
    >
      <dt className="text-fg-muted">{t('billing.result.packageLabel')}</dt>
      <dd className="text-right font-semibold text-fg">{packageName}</dd>

      <dt className="text-fg-muted">{t('billing.result.creditsLabel')}</dt>
      <dd className="text-right font-semibold text-fg tabular-nums">
        {t('billing.packages.credits', { count: order.credits })}
      </dd>

      <dt className="text-fg-muted">{t('billing.result.amountLabel')}</dt>
      <dd className="text-right font-semibold text-fg tabular-nums">{amountFormatted}</dd>

      {showBalanceRow ? (
        <>
          <dt className="border-t border-line pt-2 text-fg-muted">
            {t('billing.result.balanceLabel')}
          </dt>
          <dd className="border-t border-line pt-2 text-right font-semibold text-fg tabular-nums">
            {balanceValue === 'loading' ? (
              <span
                aria-hidden="true"
                className="inline-block h-4 w-20 animate-pulse rounded bg-skeleton align-middle"
              />
            ) : balanceValue !== undefined ? (
              t('billing.wallet.totalCredits', { count: balanceValue })
            ) : null}
          </dd>
        </>
      ) : null}
    </dl>
  );
}

/** Retorno desde Mercado Pago Checkout Pro (US-30): consulta y sondea la orden real del backend. */
export default function BillingResultPage() {
  const { t } = useTranslation();
  const locale = useIntlLocale();
  const { user } = useSession();
  const homeHref = useHomeHref(user?.user_id);
  const [searchParams] = useSearchParams();

  const searchKey = `${searchParams.toString()}:${user?.user_id ?? ''}`;
  const resolvedOrderId = resolveResultOrderId(searchParams, user?.user_id);
  const [latched, setLatched] = useState(() => ({ key: searchKey, id: resolvedOrderId }));

  if (latched.key !== searchKey) {
    setLatched({ key: searchKey, id: resolvedOrderId });
  } else if (latched.id === null && resolvedOrderId !== null) {
    setLatched({ key: searchKey, id: resolvedOrderId });
  }

  // Conserva el orderId resuelto tras limpiar sessionStorage al llegar a un estado terminal.
  const orderId = resolvedOrderId ?? latched.id;
  const { order, effectiveStatus, isPending, error, hasPollingError, isTimedOut, recheck } =
    useOrderStatus(orderId);
  const walletQuery = useWallet(true);

  const isNotFound = isApiError(error) && (error.status === 404 || error.status === 422);

  let announcement = '';
  if (orderId && order) {
    if (effectiveStatus === 'PENDING') {
      if (isTimedOut) {
        announcement = t('billing.result.timedOut.announce');
      } else if (!hasPollingError) {
        announcement = t('billing.result.pending.announce');
      }
    } else if (effectiveStatus === 'APPROVED') {
      announcement = t('billing.result.approved.announce', { credits: order.credits });
    } else if (effectiveStatus === 'REJECTED') {
      announcement = t('billing.result.rejected.announce');
    } else if (effectiveStatus === 'EXPIRED') {
      announcement = t('billing.result.expired.announce');
    } else if (effectiveStatus === 'REVERSED') {
      announcement = t('billing.result.reversed.announce');
    }
  }

  const showBalanceRow = effectiveStatus === 'APPROVED' && !walletQuery.isError;
  const balanceValue: number | 'loading' | undefined =
    walletQuery.isPending || walletQuery.isFetching ? 'loading' : walletQuery.data?.total_credits;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-fg">{t('billing.result.title')}</h1>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {orderId === null ? (
        <StatusMessage
          variant="warning"
          title={t('billing.result.missing.title')}
          description={t('billing.result.missing.description')}
          action={
            <Link to="/billing" className={buttonVariants({ variant: 'primary' })}>
              {t('billing.result.backToCredits')}
            </Link>
          }
        />
      ) : isPending && !order ? (
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-ink" aria-hidden="true" />
          <p className="text-sm font-medium text-fg">{t('billing.result.loading')}</p>
        </Card>
      ) : isNotFound ? (
        <StatusMessage
          variant="warning"
          title={t('billing.result.notFound.title')}
          description={t('billing.result.notFound.description')}
          action={
            <Link to="/billing" className={buttonVariants({ variant: 'primary' })}>
              {t('billing.result.backToCredits')}
            </Link>
          }
        />
      ) : (error && !order) || hasPollingError ? (
        <StatusMessage
          variant="error"
          title={t('billing.result.error.title')}
          description={t('billing.result.error.description')}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="primary" onClick={recheck}>
                {t('common.retry')}
              </Button>
              <Link to="/billing" className={buttonVariants({ variant: 'secondary' })}>
                {t('billing.result.backToCredits')}
              </Link>
            </div>
          }
        />
      ) : order && effectiveStatus === 'PENDING' && isTimedOut ? (
        <Card className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-sunken text-warning-ink">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex max-w-md flex-col gap-1">
            <h2 className="text-lg font-semibold text-fg">{t('billing.result.timedOut.title')}</h2>
            <p className="text-sm text-fg-muted">{t('billing.result.timedOut.description')}</p>
          </div>
          <OrderDetailsSummary order={order} locale={locale} />
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="primary" onClick={recheck}>
              {t('billing.result.recheck')}
            </Button>
            <Link to="/billing" className={buttonVariants({ variant: 'secondary' })}>
              {t('billing.result.backToCredits')}
            </Link>
          </div>
        </Card>
      ) : order && effectiveStatus === 'PENDING' ? (
        <Card className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-sunken text-brand-ink">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          </div>
          <div className="flex max-w-md flex-col gap-1">
            <h2 className="text-lg font-semibold text-fg">{t('billing.result.pending.title')}</h2>
            <p className="text-sm text-fg-muted">{t('billing.result.pending.description')}</p>
          </div>
          <OrderDetailsSummary order={order} locale={locale} />
          <Link to="/billing" className={buttonVariants({ variant: 'secondary' })}>
            {t('billing.result.backToCredits')}
          </Link>
        </Card>
      ) : order && effectiveStatus === 'APPROVED' ? (
        <Card className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-sunken text-success-ink">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex max-w-md flex-col gap-1">
            <h2 className="text-lg font-semibold text-fg">{t('billing.result.approved.title')}</h2>
            <p className="text-3xl font-extrabold text-success-ink tabular-nums">
              {t('billing.result.creditsAdded', { credits: order.credits })}
            </p>
            <p className="text-sm text-fg-muted">{t('billing.result.approved.description')}</p>
          </div>
          <OrderDetailsSummary
            order={order}
            locale={locale}
            showBalanceRow={showBalanceRow}
            balanceValue={balanceValue}
          />
          <div className="flex flex-wrap justify-center gap-3">
            <Link to={homeHref} className={buttonVariants({ variant: 'primary' })}>
              {t('billing.result.searchFlights')}
            </Link>
            <Link to="/billing" className={buttonVariants({ variant: 'secondary' })}>
              {t('billing.result.viewCredits')}
            </Link>
          </div>
        </Card>
      ) : order && effectiveStatus === 'REJECTED' ? (
        <Card className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-sunken text-error-ink">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex max-w-md flex-col gap-1">
            <h2 className="text-lg font-semibold text-fg">{t('billing.result.rejected.title')}</h2>
            <p className="text-sm text-fg-muted">{t('billing.result.rejected.description')}</p>
          </div>
          <OrderDetailsSummary order={order} locale={locale} />
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/billing" className={buttonVariants({ variant: 'primary' })}>
              {t('billing.result.tryAgain')}
            </Link>
            <Link to={homeHref} className={buttonVariants({ variant: 'secondary' })}>
              {t('billing.result.searchFlights')}
            </Link>
          </div>
        </Card>
      ) : order && (effectiveStatus === 'EXPIRED' || effectiveStatus === 'REVERSED') ? (
        <Card className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-sunken text-warning-ink">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex max-w-md flex-col gap-1">
            <h2 className="text-lg font-semibold text-fg">
              {t(
                effectiveStatus === 'EXPIRED'
                  ? 'billing.result.expired.title'
                  : 'billing.result.reversed.title',
              )}
            </h2>
            <p className="text-sm text-fg-muted">
              {t(
                effectiveStatus === 'EXPIRED'
                  ? 'billing.result.expired.description'
                  : 'billing.result.reversed.description',
              )}
            </p>
          </div>
          <OrderDetailsSummary order={order} locale={locale} />
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/billing" className={buttonVariants({ variant: 'primary' })}>
              {t(
                effectiveStatus === 'EXPIRED'
                  ? 'billing.result.choosePackage'
                  : 'billing.result.viewCredits',
              )}
            </Link>
            <Link to={homeHref} className={buttonVariants({ variant: 'secondary' })}>
              {t('billing.result.searchFlights')}
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
