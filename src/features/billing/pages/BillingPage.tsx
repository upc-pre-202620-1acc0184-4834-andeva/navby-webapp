import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { type Wallet } from '@/shared/api/schemas';
import { useSession } from '@/shared/auth/useSession';
import { useIntlLocale } from '@/shared/i18n/useIntlLocale';
import { billingKeys } from '../billingKeys';
import { PackagesSection } from '../components/PackagesSection';
import { TransactionsSection } from '../components/TransactionsSection';
import { WalletSummaryCard } from '../components/WalletSummaryCard';
import { useCreateOrder, usePackages, useTransactions } from '../hooks/useBillingQueries';
import { useWallet } from '../hooks/useWallet';

const PAGE_SIZE = 20;
const PAGE_PARAM_REGEX = /^[1-9]\d{0,4}$/;

/** Créditos y paquetes (US-25 a US-29). */
export default function BillingPage() {
  const { t } = useTranslation();
  const locale = useIntlLocale();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawPage = searchParams.get('page');
  const isValidPageParam = rawPage === null || PAGE_PARAM_REGEX.test(rawPage);
  const page = rawPage !== null && PAGE_PARAM_REGEX.test(rawPage) ? Number(rawPage) : 1;

  const walletQuery = useWallet(true);
  const packagesQuery = usePackages();
  const transactionsQuery = useTransactions(page, PAGE_SIZE);
  const createOrder = useCreateOrder(user?.user_id);

  // Si la caché del saldo cruzó la medianoche de Lima, refresca al entrar a /billing.
  useEffect(() => {
    const cached = queryClient.getQueryData<Wallet>(billingKeys.wallet);
    if (cached) {
      const resetMs = Date.parse(cached.free_credits_reset_at);
      if (Number.isFinite(resetMs) && Date.now() >= resetMs) {
        void queryClient.invalidateQueries({ queryKey: billingKeys.wallet });
      }
    }
  }, [queryClient]);

  // Limpia un `?page=` inválido o fuera de rango preservando cualquier otro parámetro de la URL.
  useEffect(() => {
    if (!isValidPageParam) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('page');
          return next;
        },
        { replace: true },
      );
      return;
    }

    const txData = transactionsQuery.data;
    if (!txData || txData.total <= 0) return;
    const totalPages = Math.max(1, Math.ceil(txData.total / txData.page_size));
    if (page > totalPages) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (totalPages <= 1) {
            next.delete('page');
          } else {
            next.set('page', String(totalPages));
          }
          return next;
        },
        { replace: true },
      );
    }
  }, [isValidPageParam, page, setSearchParams, transactionsQuery.data]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (nextPage <= 1) {
            next.delete('page');
          } else {
            next.set('page', String(nextPage));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-fg">{t('billing.title')}</h1>

      <WalletSummaryCard
        wallet={walletQuery.data}
        isPending={walletQuery.isPending}
        error={walletQuery.error}
        onRetry={() => void walletQuery.refetch()}
        locale={locale}
      />

      <PackagesSection
        data={packagesQuery.data}
        isPending={packagesQuery.isPending}
        error={packagesQuery.error}
        onRetry={() => void packagesQuery.refetch()}
        pendingCode={createOrder.pendingCode}
        isLocked={createOrder.isLocked}
        onSelectPackage={createOrder.mutate}
        locale={locale}
      />

      <TransactionsSection
        data={transactionsQuery.data}
        isPending={transactionsQuery.isPending}
        isFetching={transactionsQuery.isFetching}
        isPlaceholderData={transactionsQuery.isPlaceholderData}
        error={transactionsQuery.error}
        onRetry={() => void transactionsQuery.refetch()}
        page={page}
        onPageChange={handlePageChange}
        locale={locale}
      />
    </div>
  );
}
