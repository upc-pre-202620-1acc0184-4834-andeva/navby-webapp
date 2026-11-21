import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Coins,
  type LucideIcon,
  RotateCcw,
  Search,
  ShoppingBag,
  UserX,
  X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { getOrder, getQuotePodium } from '@/shared/api/endpoints';
import {
  type CreditPackage,
  type OrderStatus,
  type TransactionItem,
  type TransactionType,
} from '@/shared/api/schemas';
import { formatInstantDateTime } from '@/shared/format/date';
import { Badge, type BadgeVariant } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { cn } from '@/shared/ui/cn';
import { formatBillingMoney, formatSignedCredits, localizePackageName } from '../formatBilling';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TYPE_META: Record<TransactionType, { icon: LucideIcon; iconInk: string }> = {
  SEARCH_DEBIT: { icon: Search, iconInk: 'text-fg-muted' },
  SEARCH_REFUND: { icon: RotateCcw, iconInk: 'text-success-ink' },
  PURCHASE: { icon: ShoppingBag, iconInk: 'text-success-ink' },
  PURCHASE_REVERSAL: { icon: AlertTriangle, iconInk: 'text-error-ink' },
  ACCOUNT_DELETION: { icon: UserX, iconInk: 'text-error-ink' },
  UNKNOWN: { icon: Coins, iconInk: 'text-fg-muted' },
};

const STATUS_BADGE: Record<OrderStatus, BadgeVariant> = {
  APPROVED: 'success',
  PENDING: 'warning',
  REJECTED: 'error',
  REVERSED: 'error',
  EXPIRED: 'neutral',
};

export interface TransactionDetailDialogProps {
  transaction: TransactionItem | null;
  packages?: CreditPackage[];
  locale: string;
  onClose: () => void;
}

/** Comprobante de compra o detalle de movimiento de créditos (`<dialog>` nativo). */
export function TransactionDetailDialog({
  transaction,
  packages,
  locale,
  onClose,
}: TransactionDetailDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const open = transaction !== null;

  const [shown, setShown] = useState<TransactionItem | null>(transaction);
  if (transaction && transaction !== shown) setShown(transaction);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const tx = shown;
  const isOrderTx = tx?.type === 'PURCHASE' || tx?.type === 'PURCHASE_REVERSAL';
  const orderId =
    isOrderTx && tx?.reference_id && UUID_RE.test(tx.reference_id) ? tx.reference_id : null;
  const isSearchTx = tx?.type === 'SEARCH_DEBIT' || tx?.type === 'SEARCH_REFUND';
  const searchId =
    isSearchTx && tx?.reference_id && tx.reference_id.startsWith('srch_') ? tx.reference_id : null;

  const orderQuery = useQuery({
    queryKey: ['billing', 'transaction-order', orderId],
    queryFn: ({ signal }) => getOrder(orderId!, signal),
    enabled: open && orderId !== null,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const searchQuery = useQuery({
    queryKey: ['billing', 'transaction-search', searchId],
    queryFn: ({ signal }) => getQuotePodium(searchId!, signal),
    enabled: open && searchId !== null,
    retry: false,
    staleTime: 60_000,
  });

  if (!tx) {
    return <dialog ref={dialogRef} className="navby-dialog" />;
  }

  const meta = TYPE_META[tx.type];
  const Icon = meta.icon;
  const netDelta = tx.free_delta + tx.paid_delta;
  const matchedPkgName =
    orderQuery.data && packages
      ? packages.find((p) => p.code === orderQuery.data.package_code)?.name
      : undefined;

  const orderSummaryPairs = searchQuery.data?.pairs_quoted ?? [];
  const primaryPair = orderSummaryPairs[0];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => {
        if (open) onClose();
      }}
      className="navby-dialog m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-surface p-6 text-fg shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken',
              meta.iconInk,
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-fg">
              {isOrderTx
                ? t('billing.transactions.detail.receiptTitle')
                : t('billing.transactions.detail.title')}
            </h2>
            <p className="text-sm text-fg-muted">{t(`billing.transactions.types.${tx.type}`)}</p>
          </div>
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label={t('billing.transactions.detail.close')}
          onClick={onClose}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors duration-150 ease-(--ease-out) hover:bg-surface-sunken hover:text-fg lg:h-9 lg:w-9"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-surface-sunken/70 p-4 text-sm">
          <div>
            <dt className="text-xs font-semibold text-fg-muted">
              {t('billing.transactions.detail.dateLabel')}
            </dt>
            <dd className="mt-0.5 font-medium text-fg tabular-nums">
              {formatInstantDateTime(tx.created_at, locale)}
            </dd>
          </div>

          <div className="text-right">
            <dt className="text-xs font-semibold text-fg-muted">
              {t('billing.transactions.detail.creditsTotalLabel')}
            </dt>
            <dd
              className={cn(
                'mt-0.5 text-base font-bold tabular-nums',
                netDelta > 0 ? 'text-success-ink' : netDelta < 0 ? 'text-fg' : 'text-fg-muted',
              )}
            >
              {formatSignedCredits(netDelta, locale)}
            </dd>
          </div>

          {tx.free_delta !== 0 || tx.paid_delta !== 0 ? (
            <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
              <span className="font-semibold text-fg-muted">
                {t('billing.transactions.detail.breakdownLabel')}
              </span>
              <span className="text-fg tabular-nums">
                {[
                  tx.free_delta !== 0
                    ? `${t('billing.transactions.detail.freeDeltaLabel')}: ${formatSignedCredits(tx.free_delta, locale)}`
                    : null,
                  tx.paid_delta !== 0
                    ? `${t('billing.transactions.detail.paidDeltaLabel')}: ${formatSignedCredits(tx.paid_delta, locale)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
          ) : null}
        </dl>

        {isOrderTx ? (
          orderId && orderQuery.isPending ? (
            <div
              role="status"
              aria-label={t('billing.transactions.detail.loadingOrder')}
              className="flex flex-col gap-2.5 rounded-xl border border-line p-4"
            >
              <div className="h-4 w-32 animate-pulse rounded bg-skeleton" />
              <div className="h-5 w-44 animate-pulse rounded bg-skeleton" />
              <div className="h-4 w-36 animate-pulse rounded bg-skeleton" />
            </div>
          ) : orderQuery.data ? (
            <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-fg-muted">
                  {t('billing.transactions.detail.orderCodeLabel')}{' '}
                  <span className="font-mono text-fg tabular-nums">
                    #{orderQuery.data.order_id.slice(0, 8).toUpperCase()}
                  </span>
                </span>
                <Badge variant={STATUS_BADGE[orderQuery.data.status]}>
                  {t(`billing.transactions.detail.statuses.${orderQuery.data.status}`)}
                </Badge>
              </div>

              <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold text-fg-muted">
                    {t('billing.transactions.detail.packageLabel')}
                  </dt>
                  <dd className="mt-0.5 font-semibold text-fg">
                    {localizePackageName(
                      t,
                      orderQuery.data.package_code,
                      matchedPkgName ?? orderQuery.data.package_code,
                    )}
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs font-semibold text-fg-muted">
                    {t('billing.transactions.detail.amountLabel')}
                  </dt>
                  <dd className="mt-0.5 text-base font-extrabold text-fg tabular-nums">
                    {formatBillingMoney(orderQuery.data.amount, orderQuery.data.currency, locale)}
                  </dd>
                </div>
              </dl>

              <p className="text-xs text-fg-muted">
                {t(
                  tx.type === 'PURCHASE_REVERSAL'
                    ? 'billing.transactions.detail.reversalNote'
                    : 'billing.transactions.detail.purchaseNote',
                )}
              </p>
            </div>
          ) : (
            <p className="rounded-xl border border-line p-3.5 text-xs text-fg-muted">
              {t('billing.transactions.detail.orderUnavailable')}
            </p>
          )
        ) : null}

        {isSearchTx ? (
          searchId && searchQuery.isPending ? (
            <div className="flex flex-col gap-2 rounded-xl border border-line p-4">
              <div className="h-4 w-28 animate-pulse rounded bg-skeleton" />
              <div className="h-4 w-44 animate-pulse rounded bg-skeleton" />
            </div>
          ) : searchQuery.data && primaryPair ? (
            <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-fg-muted">
                  {t('billing.transactions.detail.searchActiveRoute')}
                </span>
                <span className="text-sm font-bold text-fg tabular-nums">
                  {primaryPair.origin} → {primaryPair.destination}
                </span>
              </div>
              <p className="text-xs text-fg-muted tabular-nums">
                {t('billing.transactions.detail.searchActiveOffers', {
                  count: searchQuery.data.offers_received,
                })}
              </p>
              <Link
                to={`/?sid=${encodeURIComponent(searchQuery.data.search_id)}`}
                onClick={onClose}
                className={buttonVariants({
                  variant: 'primary',
                  size: 'sm',
                  className: 'self-start',
                })}
              >
                <span>{t('billing.transactions.detail.searchViewResults')}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 rounded-xl border border-line p-3.5">
              <p className="text-xs leading-relaxed text-fg-muted">
                {t(
                  tx.type === 'SEARCH_REFUND'
                    ? 'billing.transactions.detail.refundNote'
                    : 'billing.transactions.detail.searchExpiredNote',
                )}
              </p>
              {tx.type === 'SEARCH_DEBIT' ? (
                <Link
                  to="/itineraries"
                  onClick={onClose}
                  className={buttonVariants({
                    variant: 'secondary',
                    size: 'sm',
                    className: 'self-start',
                  })}
                >
                  <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t('billing.transactions.detail.searchGoItineraries')}</span>
                </Link>
              ) : null}
            </div>
          )
        ) : null}

        {tx.type === 'ACCOUNT_DELETION' ? (
          <p className="rounded-xl border border-line p-3.5 text-xs text-fg-muted">
            {t('billing.transactions.detail.accountDeletionNote')}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {t('billing.transactions.detail.close')}
        </Button>
      </div>
    </dialog>
  );
}
