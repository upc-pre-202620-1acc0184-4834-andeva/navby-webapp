import { Skeleton } from 'boneyard-js/react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Coins,
  type LucideIcon,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingBag,
  UserX,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { isApiError } from '@/shared/api/errors';
import { formatInstantDateTime } from '@/shared/format/date';
import { type TransactionsPage, type TransactionType } from '@/shared/api/schemas';
import { Button } from '@/shared/ui/Button';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { Card } from '@/shared/ui/Card';
import { cn } from '@/shared/ui/cn';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { formatSignedCredits } from '../formatBilling';

export interface TransactionsSectionProps {
  data: TransactionsPage | undefined;
  isPending: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
  error: unknown;
  onRetry: () => void;
  page: number;
  onPageChange: (nextPage: number) => void;
  locale: string;
  skeletonFixture?: ReactNode;
}

const TYPE_META: Record<TransactionType, { icon: LucideIcon; iconInk: string }> = {
  SEARCH_DEBIT: { icon: Search, iconInk: 'text-fg-muted' },
  SEARCH_REFUND: { icon: RotateCcw, iconInk: 'text-success-ink' },
  PURCHASE: { icon: ShoppingBag, iconInk: 'text-success-ink' },
  PURCHASE_REVERSAL: { icon: AlertTriangle, iconInk: 'text-error-ink' },
  ACCOUNT_DELETION: { icon: UserX, iconInk: 'text-error-ink' },
  UNKNOWN: { icon: Coins, iconInk: 'text-fg-muted' },
};

function resolveDeltaInk(type: TransactionType, netDelta: number): string {
  if (netDelta === 0) return 'text-fg-muted';
  switch (type) {
    case 'SEARCH_REFUND':
    case 'PURCHASE':
      return 'text-success-ink';
    case 'PURCHASE_REVERSAL':
    case 'ACCOUNT_DELETION':
      return 'text-error-ink';
    case 'SEARCH_DEBIT':
      return 'text-fg';
    case 'UNKNOWN':
      return netDelta > 0 ? 'text-success-ink' : 'text-fg';
  }
}

function TransactionsFallback() {
  return (
    <div
      aria-hidden="true"
      className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface"
    >
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-skeleton" />
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-36 animate-pulse rounded bg-skeleton" />
              <div className="h-3 w-28 animate-pulse rounded bg-skeleton" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="h-4 w-12 animate-pulse rounded bg-skeleton" />
            <div className="h-3 w-20 animate-pulse rounded bg-skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lista y paginación del historial, reutilizada por `BonesBillingCapturePage`. */
export function TransactionsBody({
  data,
  isFetching,
  isPlaceholderData,
  page,
  onPageChange,
  locale,
}: {
  data: TransactionsPage;
  isFetching: boolean;
  isPlaceholderData: boolean;
  page: number;
  onPageChange: (nextPage: number) => void;
  locale: string;
}) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));

  if (data.total === 0) {
    return (
      <StatusMessage
        variant="empty"
        icon={ReceiptText}
        title={t('billing.transactions.emptyTitle')}
        description={t('billing.transactions.emptyDescription')}
        action={
          <Link to="/" className={buttonVariants({ variant: 'primary' })}>
            {t('billing.transactions.emptyAction')}
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card
        padding="none"
        className={cn(
          'overflow-hidden transition-opacity duration-150 ease-(--ease-out)',
          isFetching && 'opacity-60',
        )}
      >
        <ul
          aria-label={t('billing.transactions.listLabel')}
          aria-busy={isFetching || undefined}
          className="divide-y divide-line"
        >
          {data.items.map((tx) => {
            const netDelta = tx.free_delta + tx.paid_delta;
            const meta = TYPE_META[tx.type];
            const Icon = meta.icon;
            const deltaInk = resolveDeltaInk(tx.type, netDelta);

            let sourceText: string;
            if (tx.free_delta !== 0 && tx.paid_delta !== 0) {
              sourceText = t('billing.transactions.sourceMixed', {
                free: formatSignedCredits(tx.free_delta, locale),
                paid: formatSignedCredits(tx.paid_delta, locale),
              });
            } else if (tx.free_delta !== 0) {
              sourceText = t('billing.transactions.sourceFree');
            } else if (tx.paid_delta !== 0) {
              sourceText = t('billing.transactions.sourcePaid');
            } else {
              sourceText = t('billing.transactions.sourceNone');
            }

            return (
              <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken',
                      meta.iconInk,
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">
                      {t(`billing.transactions.types.${tx.type}`)}
                    </p>
                    <p className="text-xs text-fg-muted tabular-nums">
                      {formatInstantDateTime(tx.created_at, locale)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn('text-sm font-semibold tabular-nums', deltaInk)}>
                    {formatSignedCredits(netDelta, locale)}
                  </p>
                  <p className="text-xs text-fg-muted tabular-nums">{sourceText}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {data.total > data.page_size ? (
        <nav
          aria-label={t('billing.transactions.paginationLabel')}
          className="flex items-center justify-between gap-3"
        >
          <Button
            variant="secondary"
            disabled={page <= 1 || isPlaceholderData || isFetching}
            icon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />}
            onClick={() => onPageChange(page - 1)}
          >
            {t('billing.transactions.previousPage')}
          </Button>
          <p className="text-sm text-fg-muted tabular-nums">
            {t('billing.transactions.pageOf', { page, totalPages })}
          </p>
          <Button
            variant="secondary"
            disabled={page >= totalPages || isPlaceholderData || isFetching}
            onClick={() => onPageChange(page + 1)}
          >
            <span>{t('billing.transactions.nextPage')}</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

/** Historial paginado de movimientos de créditos (US-27). Nunca muestra `reference_id`. */
export function TransactionsSection({
  data,
  isPending,
  isFetching,
  isPlaceholderData,
  error,
  onRetry,
  page,
  onPageChange,
  locale,
  skeletonFixture,
}: TransactionsSectionProps) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="billing-history-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="billing-history-heading" className="text-lg font-semibold text-fg">
          {t('billing.transactions.heading')}
        </h2>
        {data && data.total > 0 ? (
          <p className="text-sm text-fg-muted tabular-nums">
            {t('billing.transactions.total', { count: data.total })}
          </p>
        ) : null}
      </div>

      {error && !data ? (
        <StatusMessage
          variant="error"
          title={t('billing.transactions.errorTitle')}
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
          name="billing-transactions"
          loading={isPending}
          transition={150}
          fixture={skeletonFixture}
          fallback={<TransactionsFallback />}
        >
          {data ? (
            <TransactionsBody
              data={data}
              isFetching={isFetching}
              isPlaceholderData={isPlaceholderData}
              page={page}
              onPageChange={onPageChange}
              locale={locale}
            />
          ) : null}
        </Skeleton>
      )}
    </section>
  );
}
