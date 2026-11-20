import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getOrder } from '@/shared/api/endpoints';
import { isApiError } from '@/shared/api/errors';
import { type OrderDetail, type OrderStatus } from '@/shared/api/schemas';
import { billingKeys } from '../billingKeys';
import { clearPendingOrderId } from '../checkoutNavigation';

const DEFAULT_POLL_INTERVAL_MS = 3_000;
const DEFAULT_POLL_TIMEOUT_MS = 60_000;
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

export function isOrderEffectivelyExpired(order: OrderDetail, nowMs: number): boolean {
  if (order.status === 'EXPIRED') return true;
  if (order.status !== 'PENDING') return false;
  const expiresAtMs = Date.parse(order.expires_at);
  return Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs;
}

export interface UseOrderStatusOptions {
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
}

export function useOrderStatus(orderId: string | null, options: UseOrderStatusOptions = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const pollTimeoutMs = options.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const queryClient = useQueryClient();

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [cycleId, setCycleId] = useState(0);
  const [prevOrderId, setPrevOrderId] = useState(orderId);

  if (prevOrderId !== orderId) {
    setPrevOrderId(orderId);
    setIsTimedOut(false);
    setConsecutiveErrors(0);
    setCycleId(0);
  }

  const lastHandledKeyRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: billingKeys.order(orderId ?? ''),
    queryFn: async ({ signal }) => {
      if (!orderId) throw new Error('Order ID missing');
      try {
        const order = await getOrder(orderId, signal);
        const now = Date.now();
        setNowMs(now);
        setConsecutiveErrors(0);
        const resolvedStatus = isOrderEffectivelyExpired(order, now) ? 'EXPIRED' : order.status;
        if (resolvedStatus !== 'PENDING') {
          const handledKey = `${orderId}:${resolvedStatus}`;
          if (lastHandledKeyRef.current !== handledKey) {
            lastHandledKeyRef.current = handledKey;
            clearPendingOrderId(orderId);
            void queryClient.invalidateQueries({ queryKey: billingKeys.wallet });
            void queryClient.invalidateQueries({ queryKey: billingKeys.transactionsAll });
          }
        }
        return order;
      } catch (error) {
        setNowMs(Date.now());
        const isAbort =
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error && error.name === 'AbortError');
        if (!isAbort) {
          setConsecutiveErrors((count) => count + 1);
        }
        throw error;
      }
    },
    enabled: orderId !== null,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
    refetchOnWindowFocus: (q) =>
      q.state.data?.status === 'PENDING' && !isOrderEffectivelyExpired(q.state.data, Date.now()),
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return false;
      if (isOrderEffectivelyExpired(data, Date.now())) return false;
      if (data.status !== 'PENDING') return false;
      if (isTimedOut || consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) return false;
      const err = q.state.error;
      if (isApiError(err) && (err.status === 404 || err.status === 422)) return false;
      return pollIntervalMs;
    },
  });

  const isTerminalClientError =
    isApiError(query.error) && (query.error.status === 404 || query.error.status === 422);

  const effectiveStatus: OrderStatus | null = useMemo(() => {
    if (!query.data) return null;
    return isOrderEffectivelyExpired(query.data, nowMs) ? 'EXPIRED' : query.data.status;
  }, [query.data, nowMs]);

  const canPoll =
    orderId !== null &&
    effectiveStatus === 'PENDING' &&
    !isTimedOut &&
    consecutiveErrors < MAX_CONSECUTIVE_POLL_ERRORS &&
    !isTerminalClientError;

  const { refetch } = query;

  useEffect(() => {
    if (!canPoll) return;
    const timer = window.setTimeout(() => {
      setIsTimedOut(true);
    }, pollTimeoutMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [canPoll, cycleId, orderId, pollTimeoutMs]);

  useEffect(() => {
    if (!canPoll) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [canPoll, refetch]);

  useEffect(() => {
    if (!orderId) return;
    if (isTerminalClientError) {
      clearPendingOrderId(orderId);
      return;
    }
    if (!effectiveStatus || effectiveStatus === 'PENDING') return;
    const handledKey = `${orderId}:${effectiveStatus}`;
    if (lastHandledKeyRef.current === handledKey) return;
    lastHandledKeyRef.current = handledKey;
    clearPendingOrderId(orderId);
    void queryClient.invalidateQueries({ queryKey: billingKeys.wallet });
    void queryClient.invalidateQueries({ queryKey: billingKeys.transactionsAll });
  }, [effectiveStatus, isTerminalClientError, orderId, queryClient]);

  const recheck = useCallback(() => {
    setIsTimedOut(false);
    setConsecutiveErrors(0);
    setNowMs(Date.now());
    setCycleId((id) => id + 1);
    void refetch();
  }, [refetch]);

  const showTimedOut = isTimedOut && effectiveStatus === 'PENDING' && !query.isFetching;
  const hasPollingError =
    consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS &&
    effectiveStatus === 'PENDING' &&
    !query.isFetching;

  return {
    order: query.data,
    effectiveStatus,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    hasPollingError,
    isPolling: canPoll,
    isTimedOut: showTimedOut,
    recheck,
  };
}
