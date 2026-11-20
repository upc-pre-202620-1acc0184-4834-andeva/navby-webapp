import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sileo } from 'sileo';
import { createOrder, listPackages, listTransactions } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { isApiError } from '@/shared/api/errors';
import { markEmailUnverified } from '@/shared/auth/useSession';
import { billingKeys } from '../billingKeys';
import { isSafeCheckoutUrl, redirectToCheckout, savePendingOrderId } from '../checkoutNavigation';

export function usePackages() {
  return useQuery({
    queryKey: billingKeys.packages,
    queryFn: ({ signal }) => listPackages(signal),
    staleTime: 5 * 60_000,
  });
}

export function useTransactions(page: number, pageSize = 20) {
  return useQuery({
    queryKey: billingKeys.transactions(page, pageSize),
    queryFn: ({ signal }) => listTransactions({ page, pageSize }, signal),
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
  });
}

export function useCreateOrder(userId: string | undefined) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [redirectingCode, setRedirectingCode] = useState<string | null>(null);

  // Si el usuario vuelve con el botón Atrás del navegador (bfcache), desbloquea los botones.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setRedirectingCode(null);
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const mutation = useMutation({
    mutationFn: (packageCode: string) => createOrder({ package_code: packageCode }),
    onSuccess: (order) => {
      if (!isSafeCheckoutUrl(order.checkout_url)) {
        setRedirectingCode(null);
        sileo.error({
          title: t('billing.errors.checkoutFailed'),
          description: t('billing.errors.invalidCheckoutUrl'),
        });
        return;
      }

      setRedirectingCode(order.package_code);
      if (userId) {
        savePendingOrderId(order.order_id, userId);
      }
      redirectToCheckout(order.checkout_url);
    },
    onError: (error) => {
      setRedirectingCode(null);
      if (isApiError(error)) {
        if (error.code === 'UNAUTHENTICATED') {
          return;
        }
        if (error.code === 'EMAIL_NOT_VERIFIED') {
          markEmailUnverified(queryClient);
          return;
        }
        if (error.code === 'PACKAGE_NOT_FOUND') {
          void queryClient.invalidateQueries({ queryKey: billingKeys.packages });
          sileo.error({
            title: t('billing.errors.checkoutFailed'),
            description: t('errors.PACKAGE_NOT_FOUND'),
          });
          return;
        }
        if (error.code === 'PROVIDER_UNAVAILABLE') {
          sileo.error({
            title: t('billing.errors.checkoutFailed'),
            description: t('billing.errors.providerUnavailable'),
          });
          return;
        }
      }

      sileo.error({
        title: t('billing.errors.checkoutFailed'),
        description: apiErrorMessage(t, error),
      });
    },
  });

  const pendingCode = mutation.isPending ? (mutation.variables ?? null) : redirectingCode;
  const isLocked = mutation.isPending || redirectingCode !== null;

  return {
    mutate: (packageCode: string) => {
      if (isLocked) return;
      mutation.mutate(packageCode);
    },
    pendingCode,
    isLocked,
  };
}
