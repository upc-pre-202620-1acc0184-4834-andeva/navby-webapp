import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applySession } from '@/shared/api/client';
import { orderDetail, SAMPLE_ORDER_ID } from '@/test/fixtures/billing';
import { jsonResponse, problem, verifiedSession } from '@/test/renderApp';
import { billingKeys } from '../billingKeys';
import {
  PENDING_ORDER_STORAGE_KEY,
  readPendingOrderId,
  savePendingOrderId,
} from '../checkoutNavigation';
import { useOrderStatus } from './useOrderStatus';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useOrderStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sondea PENDING hasta APPROVED e invalida wallet y transactions una sola vez', async () => {
    applySession(verifiedSession);
    savePendingOrderId(SAMPLE_ORDER_ID, verifiedSession.user.user_id);

    let status: 'PENDING' | 'APPROVED' = 'PENDING';
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return jsonResponse(200, orderDetail({ status }));
      }),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => useOrderStatus(SAMPLE_ORDER_ID, { pollIntervalMs: 30, pollTimeoutMs: 500 }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.effectiveStatus).toBe('PENDING'));
    status = 'APPROVED';
    await waitFor(() => expect(result.current.effectiveStatus).toBe('APPROVED'));

    expect(calls).toBeGreaterThanOrEqual(2);
    expect(result.current.isPolling).toBe(false);
    expect(readPendingOrderId(verifiedSession.user.user_id)).toBeNull();
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: billingKeys.wallet }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: billingKeys.transactionsAll }),
    );
  });

  it('detiene el sondeo al vencer la ventana y recheck() inicia un ciclo nuevo', async () => {
    applySession(verifiedSession);
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return jsonResponse(200, orderDetail({ status: calls >= 4 ? 'APPROVED' : 'PENDING' }));
      }),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useOrderStatus(SAMPLE_ORDER_ID, { pollIntervalMs: 25, pollTimeoutMs: 70 }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isTimedOut).toBe(true));
    expect(result.current.isPolling).toBe(false);
    const callsAtTimeout = calls;
    expect(callsAtTimeout).toBeLessThan(4);

    act(() => {
      result.current.recheck();
    });

    await waitFor(() => expect(result.current.effectiveStatus).toBe('APPROVED'));
  });

  it('trata como EXPIRED una orden PENDING con expires_at vencido sin sondear (D3)', async () => {
    applySession(verifiedSession);
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return jsonResponse(
          200,
          orderDetail({
            status: 'PENDING',
            expires_at: new Date(Date.now() - 5_000).toISOString(),
          }),
        );
      }),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useOrderStatus(SAMPLE_ORDER_ID, { pollIntervalMs: 25, pollTimeoutMs: 200 }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.effectiveStatus).toBe('EXPIRED'));
    expect(result.current.isPolling).toBe(false);
    await new Promise((r) => setTimeout(r, 70));
    expect(calls).toBe(1);
  });

  it('supera errores transitorios aislados y se detiene tras 3 fallos consecutivos de red', async () => {
    applySession(verifiedSession);
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) return jsonResponse(200, orderDetail({ status: 'PENDING' }));
        throw new TypeError('Network failure');
      }),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useOrderStatus(SAMPLE_ORDER_ID, { pollIntervalMs: 20, pollTimeoutMs: 1_000 }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.hasPollingError).toBe(true));
    expect(calls).toBe(4);
    expect(result.current.isPolling).toBe(false);
  });

  it('limpia sessionStorage ante 404 ORDER_NOT_FOUND', async () => {
    applySession(verifiedSession);
    savePendingOrderId(SAMPLE_ORDER_ID, verifiedSession.user.user_id);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => problem(404, 'ORDER_NOT_FOUND')),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useOrderStatus(SAMPLE_ORDER_ID, { pollIntervalMs: 25, pollTimeoutMs: 200 }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY)).toBeNull();
  });
});
