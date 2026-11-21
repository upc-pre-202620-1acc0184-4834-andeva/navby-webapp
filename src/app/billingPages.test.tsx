import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { sileo } from 'sileo';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import * as checkoutNavigation from '@/features/billing/checkoutNavigation';
import { applySession } from '@/shared/api/client';
import {
  orderCreated,
  orderDetail,
  packagesResponse,
  SAMPLE_ORDER_ID,
  transactionItem,
  transactionsPage,
  walletFixture,
} from '@/test/fixtures/billing';
import { jsonResponse, mockApi, problem, renderApp, verifiedSession } from '@/test/renderApp';

vi.mock('@/features/billing/checkoutNavigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/billing/checkoutNavigation')>();
  return {
    ...actual,
    redirectToCheckout: vi.fn(),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(checkoutNavigation.redirectToCheckout).mockReset();
});

function setupBilling(overrides: Parameters<typeof mockApi>[0] = {}) {
  applySession(verifiedSession);
  return mockApi({
    'POST /auth/refresh': () => jsonResponse(200, verifiedSession),
    'GET /billing/wallet': () => jsonResponse(200, walletFixture()),
    'GET /billing/packages': () => jsonResponse(200, packagesResponse()),
    'GET /billing/transactions': () => jsonResponse(200, transactionsPage()),
    ...overrides,
  });
}

describe('Saldo y créditos en /billing (US-25, US-26)', () => {
  it('muestra créditos totales, búsquedas disponibles, desglose diario/pagado y hora de Lima', async () => {
    setupBilling();
    renderApp('/billing');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Créditos y paquetes' }),
    ).toBeInTheDocument();
    const walletSection = screen.getByRole('region', { name: 'Tu saldo' });
    expect(await within(walletSection).findByText('50 créditos')).toBeInTheDocument();
    expect(
      within(walletSection).getByText('10 búsquedas disponibles (5 créditos por búsqueda)'),
    ).toBeInTheDocument();
    expect(within(walletSection).getByText('5 / 10')).toBeInTheDocument();

    const progress = within(walletSection).getByRole('progressbar', {
      name: 'Créditos gratuitos diarios disponibles',
    });
    expect(progress).toHaveAttribute('aria-valuenow', '5');
    expect(progress).toHaveAttribute('aria-valuemin', '0');
    expect(progress).toHaveAttribute('aria-valuemax', '10');
    expect(within(walletSection).getByText(/00:00 \(hora de Lima\)/)).toBeInTheDocument();
    expect(within(walletSection).getByText(/No se acumulan y se usan primero/)).toBeInTheDocument();
    expect(within(walletSection).getByText('45')).toBeInTheDocument();
    expect(within(walletSection).getByText('No caducan y se acumulan')).toBeInTheDocument();
  });

  it('muestra 10 créditos gratuitos y estado vacío para usuario recién verificado', async () => {
    setupBilling({
      'GET /billing/wallet': () =>
        jsonResponse(
          200,
          walletFixture({
            free_credits: 10,
            paid_credits: 0,
            total_credits: 10,
            searches_available: 2,
          }),
        ),
    });
    renderApp('/billing');

    const walletSection = await screen.findByRole('region', { name: 'Tu saldo' });
    expect(await within(walletSection).findByText('10 créditos')).toBeInTheDocument();
    expect(
      within(walletSection).getByText('2 búsquedas disponibles (5 créditos por búsqueda)'),
    ).toBeInTheDocument();
    expect(within(walletSection).getByText('10 / 10')).toBeInTheDocument();
    expect(await screen.findByText('Aún no tienes movimientos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buscar vuelos' })).toHaveAttribute('href', '/');
  });

  it('permite reintentar si falla la carga del saldo', async () => {
    let calls = 0;
    setupBilling({
      'GET /billing/wallet': () => {
        calls += 1;
        return calls === 1
          ? problem(500, 'INTERNAL')
          : jsonResponse(200, walletFixture({ total_credits: 50 }));
      },
    });
    renderApp('/billing');
    const user = userEvent.setup();

    expect(await screen.findByText('No pudimos cargar tu saldo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    const walletSection = screen.getByRole('region', { name: 'Tu saldo' });
    expect(await within(walletSection).findByText('50 créditos')).toBeInTheDocument();
  });
});

describe('Historial de movimientos en /billing (US-27)', () => {
  it('muestra todos los tipos, movimientos mixtos y delta 0 sin exponer reference_id', async () => {
    const items = [
      transactionItem({
        id: 'tx-1',
        type: 'PURCHASE',
        free_delta: 0,
        paid_delta: 100,
        reference_id: 'SECRET_REF_001',
      }),
      transactionItem({
        id: 'tx-2',
        type: 'SEARCH_DEBIT',
        free_delta: -2,
        paid_delta: -3,
        reference_id: 'SECRET_REF_002',
      }),
      transactionItem({
        id: 'tx-3',
        type: 'SEARCH_REFUND',
        free_delta: 5,
        paid_delta: 0,
        reference_id: null,
      }),
      transactionItem({
        id: 'tx-4',
        type: 'PURCHASE_REVERSAL',
        free_delta: 0,
        paid_delta: -100,
      }),
      transactionItem({
        id: 'tx-5',
        type: 'ACCOUNT_DELETION',
        free_delta: 0,
        paid_delta: 0,
      }),
      transactionItem({
        id: 'tx-6',
        type: 'FUTURE_NEW_TYPE' as never,
        free_delta: 10,
        paid_delta: 0,
      }),
    ];

    setupBilling({
      'GET /billing/transactions': () => jsonResponse(200, transactionsPage(items)),
    });
    renderApp('/billing');

    const list = await screen.findByRole('list', { name: 'Movimientos de créditos' });
    const rows = Array.from(list.children) as HTMLElement[];
    expect(rows).toHaveLength(6);

    expect(within(rows[0]!).getByText('Compra de paquete')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('+100')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Comprados')).toBeInTheDocument();

    expect(within(rows[1]!).getByText('Búsqueda de vuelos')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('\u22125')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('\u22122 gratis · \u22123 comprados')).toBeInTheDocument();

    expect(within(rows[2]!).getByText('Devolución por búsqueda fallida')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('+5')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Gratis')).toBeInTheDocument();

    expect(within(rows[3]!).getByText('Reversión de compra')).toBeInTheDocument();
    expect(within(rows[3]!).getByText('\u2212100')).toBeInTheDocument();

    expect(within(rows[4]!).getByText('Anulación por cierre de cuenta')).toBeInTheDocument();
    expect(within(rows[4]!).getByText('0')).toBeInTheDocument();
    expect(within(rows[4]!).getByText('Sin cambio de saldo')).toBeInTheDocument();

    expect(within(rows[5]!).getByText('Movimiento de créditos')).toBeInTheDocument();
    expect(screen.queryByText(/SECRET_REF_/)).not.toBeInTheDocument();
  });

  it('pagina movimientos con ?page=2 preservando otros parámetros y corrige ?page=99', async () => {
    const page1Items = Array.from({ length: 20 }, (_, i) =>
      transactionItem({ id: `p1-${i}`, type: 'SEARCH_DEBIT', free_delta: -5, paid_delta: 0 }),
    );
    const page2Items = Array.from({ length: 5 }, (_, i) =>
      transactionItem({ id: `p2-${i}`, type: 'PURCHASE', free_delta: 0, paid_delta: 50 }),
    );

    setupBilling({
      'GET /billing/transactions': (_init, url) => {
        const page = Number(url?.searchParams.get('page') ?? '1');
        return jsonResponse(
          200,
          page >= 2
            ? transactionsPage(page2Items, { page: 2, page_size: 20, total: 25 })
            : transactionsPage(page1Items, { page: 1, page_size: 20, total: 25 }),
        );
      },
    });

    const { router } = renderApp('/billing?pack=2');
    const user = userEvent.setup();

    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
    expect(router.state.location.search).toContain('pack=2');
    expect(router.state.location.search).toContain('page=2');

    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?pack=2');
  });

  it('corrige una página fuera de rango (?page=99) a la última página válida y reintenta errores', async () => {
    const page2Items = [
      transactionItem({ id: 'p2-0', type: 'PURCHASE', free_delta: 0, paid_delta: 50 }),
    ];
    let calls = 0;

    setupBilling({
      'GET /billing/transactions': (_init, url) => {
        // La campana del TopBar pide la página 1 por su cuenta: no cuenta para el reintento.
        if (url?.searchParams.get('page') === '1') return jsonResponse(200, transactionsPage());
        calls += 1;
        if (calls === 1) return problem(500, 'INTERNAL');
        return jsonResponse(
          200,
          transactionsPage(page2Items, { page: 2, page_size: 20, total: 25 }),
        );
      },
    });

    const { router } = renderApp('/billing?page=99');
    const user = userEvent.setup();

    expect(await screen.findByText('No pudimos cargar tu historial')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe('?page=2'));
  });

  it('abre comprobante de compra al hacer clic en una fila PURCHASE (GET /billing/orders/:id)', async () => {
    const purchaseTx = transactionItem({
      id: 'tx-purchase-1',
      type: 'PURCHASE',
      free_delta: 0,
      paid_delta: 100,
      reference_id: SAMPLE_ORDER_ID,
    });
    setupBilling({
      'GET /billing/transactions': () => jsonResponse(200, transactionsPage([purchaseTx])),
      [`GET /billing/orders/${SAMPLE_ORDER_ID}`]: () =>
        jsonResponse(
          200,
          orderDetail({
            order_id: SAMPLE_ORDER_ID,
            package_code: 'pack_100',
            credits: 100,
            amount: '16.90',
            currency: 'PEN',
            status: 'APPROVED',
          }),
        ),
    });

    renderApp('/billing');
    const user = userEvent.setup();
    const list = await screen.findByRole('list', { name: 'Movimientos de créditos' });
    await user.click(
      within(list).getByRole('button', { name: /Ver detalle de Compra de paquete/ }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { level: 2, name: 'Comprobante de compra' }),
    ).toBeInTheDocument();
    expect(await within(dialog).findByText('Aprobado')).toBeInTheDocument();
    expect(within(dialog).getByText('Viajero Frecuente')).toBeInTheDocument();
    expect(within(dialog).getByText('+100')).toBeInTheDocument();
    expect(within(dialog).getByText(/S\/\s*16\.90/)).toBeInTheDocument();

    const closeButtons = within(dialog).getAllByRole('button', { name: 'Cerrar' });
    await user.click(closeButtons[closeButtons.length - 1]!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('muestra aviso y enlace a itinerarios al abrir un SEARCH_DEBIT ya expirado (404)', async () => {
    const searchTx = transactionItem({
      id: 'tx-search-expired',
      type: 'SEARCH_DEBIT',
      free_delta: -5,
      paid_delta: 0,
      reference_id: 'srch_expired_01',
    });
    setupBilling({
      'GET /billing/transactions': () => jsonResponse(200, transactionsPage([searchTx])),
      'GET /quotes/srch_expired_01': () => problem(404, 'SEARCH_NOT_FOUND'),
    });

    renderApp('/billing');
    const user = userEvent.setup();
    const list = await screen.findByRole('list', { name: 'Movimientos de créditos' });
    await user.click(
      within(list).getByRole('button', { name: /Ver detalle de Búsqueda de vuelos/ }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { level: 2, name: 'Detalle del movimiento' }),
    ).toBeInTheDocument();
    expect(
      await within(dialog).findByText(/superaron los 30 minutos de vigencia/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Ir a mis itinerarios' })).toHaveAttribute(
      'href',
      '/itineraries',
    );
  });
});

describe('Paquetes y compra en /billing (US-28, US-29)', () => {
  it('muestra los 3 paquetes en soles, USD referencial y precio por búsqueda', async () => {
    setupBilling();
    renderApp('/billing');

    expect(await screen.findByRole('heading', { level: 3, name: 'Escapada' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Viajero Frecuente' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Nómada' })).toBeInTheDocument();
    expect(screen.getByText('Recomendado')).toBeInTheDocument();

    expect(screen.getByText(/S\/\s*9\.90/)).toBeInTheDocument();
    expect(screen.getByText(/S\/\s*16\.90/)).toBeInTheDocument();
    expect(screen.getByText(/S\/\s*34\.90/)).toBeInTheDocument();
    expect(screen.getByText(/aprox\. USD\s*2\.49 \(referencial\)/)).toBeInTheDocument();
    expect(screen.getByText(/S\/\s*0\.85 por búsqueda/)).toBeInTheDocument();
    expect(screen.queryByText(/Mercado Pago opera en modo sandbox/)).not.toBeInTheDocument();
  });

  it('localiza nombres y USD explícito cuando el idioma es inglés', async () => {
    await i18n.changeLanguage('en');
    setupBilling();
    renderApp('/billing');

    expect(await screen.findByRole('heading', { level: 3, name: 'Getaway' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Frequent Traveler' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Nomad' })).toBeInTheDocument();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.getByText('approx. $4.49 USD (reference)')).toBeInTheDocument();
  });

  it('crea orden, bloquea botones (y desbloquea en bfcache pageshow), guarda sessionStorage y redirige', async () => {
    let resolveOrder!: (res: Response) => void;
    setupBilling({
      'POST /billing/orders': () =>
        new Promise<Response>((resolve) => {
          resolveOrder = resolve;
        }),
    });

    renderApp('/billing');
    const user = userEvent.setup();

    const buyButtons = await screen.findAllByRole('button', { name: /^Comprar / });
    expect(buyButtons).toHaveLength(3);

    await user.click(buyButtons[1]!);
    buyButtons.forEach((btn) => expect(btn).toBeDisabled());

    resolveOrder(jsonResponse(201, orderCreated()));

    await waitFor(() => {
      expect(checkoutNavigation.redirectToCheckout).toHaveBeenCalledWith(
        'https://sandbox.mercadopago.com.pe/checkout/v1/redirect?pref_id=pref-test-123',
      );
    });
    expect(checkoutNavigation.readPendingOrderId(verifiedSession.user.user_id)).toBe(
      SAMPLE_ORDER_ID,
    );
    // Sigue bloqueado tras 201 hasta navegar o volver por bfcache.
    buyButtons.forEach((btn) => expect(btn).toBeDisabled());

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await waitFor(() => buyButtons.forEach((btn) => expect(btn).toBeEnabled()));
  });

  it('rechaza URL de checkout no HTTPS con toast y sin guardar sessionStorage', async () => {
    const toastSpy = vi.spyOn(sileo, 'error');
    setupBilling({
      'POST /billing/orders': () =>
        jsonResponse(201, orderCreated({ checkout_url: 'http://insecure.example/pay' })),
    });

    renderApp('/billing');
    const user = userEvent.setup();
    const buyButton = await screen.findByRole('button', { name: /Comprar Viajero Frecuente/ });

    await user.click(buyButton);

    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'No pudimos iniciar el pago',
          description: 'Recibimos un enlace de pago no válido. No se realizó ningún cobro.',
        }),
      ),
    );
    expect(checkoutNavigation.redirectToCheckout).not.toHaveBeenCalled();
    expect(checkoutNavigation.readPendingOrderId(verifiedSession.user.user_id)).toBeNull();
  });

  it('maneja 503 PROVIDER_UNAVAILABLE, 404 PACKAGE_NOT_FOUND, 403 EMAIL_NOT_VERIFIED y 401', async () => {
    const toastSpy = vi.spyOn(sileo, 'error');
    let packageCalls = 0;
    let mode: '503' | '404' | '403' | '401' = '503';

    setupBilling({
      'GET /billing/packages': () => {
        packageCalls += 1;
        return jsonResponse(200, packagesResponse());
      },
      'POST /billing/orders': () => {
        if (mode === '503') return problem(503, 'PROVIDER_UNAVAILABLE');
        if (mode === '404') return problem(404, 'PACKAGE_NOT_FOUND');
        if (mode === '403') return problem(403, 'EMAIL_NOT_VERIFIED');
        return problem(401, 'UNAUTHENTICATED');
      },
    });

    const { router, unmount } = renderApp('/billing');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Comprar Viajero Frecuente/ }));
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('Mercado Pago no está disponible'),
        }),
      ),
    );

    mode = '404';
    const beforeCalls = packageCalls;
    await user.click(screen.getByRole('button', { name: /Comprar Viajero Frecuente/ }));
    await waitFor(() => expect(packageCalls).toBeGreaterThan(beforeCalls));
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Ese paquete ya no está disponible. Elige otro de la lista.',
      }),
    );

    mode = '403';
    await user.click(screen.getByRole('button', { name: /Comprar Viajero Frecuente/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/verify-email'));

    // 401 sin sesión activa redirige a /login silenciosamente.
    unmount();
    toastSpy.mockClear();
    let refreshCalls = 0;
    setupBilling({
      'POST /auth/refresh': () => {
        refreshCalls += 1;
        return refreshCalls === 1
          ? jsonResponse(200, verifiedSession)
          : problem(401, 'INVALID_REFRESH_TOKEN');
      },
      'POST /billing/orders': () => problem(401, 'UNAUTHENTICATED'),
    });
    const second = renderApp('/billing');
    await user.click(await screen.findByRole('button', { name: /Comprar Viajero Frecuente/ }));
    await waitFor(() => expect(second.router.state.location.pathname).toBe('/login'));
    expect(toastSpy).not.toHaveBeenCalled();
  });
});

describe('Resultado de pago en /billing/result (US-30)', () => {
  it('APPROVED inmediato limpia sessionStorage, no muestra saldo viejo y actualiza al nuevo', async () => {
    applySession(verifiedSession);
    checkoutNavigation.savePendingOrderId(SAMPLE_ORDER_ID, verifiedSession.user.user_id);

    let walletCalls = 0;
    let resolveUpdatedWallet!: (res: Response) => void;
    mockApi({
      'POST /auth/refresh': () => jsonResponse(200, verifiedSession),
      'GET /billing/wallet': () => {
        walletCalls += 1;
        if (walletCalls === 1) {
          return jsonResponse(200, walletFixture({ total_credits: 10, paid_credits: 0 }));
        }
        return new Promise<Response>((resolve) => {
          resolveUpdatedWallet = resolve;
        });
      },
      'GET /billing/orders/550e8400-e29b-41d4-a716-446655440000': () =>
        jsonResponse(200, orderDetail({ status: 'APPROVED', credits: 100 })),
    });

    renderApp(`/billing/result?external_reference=${SAMPLE_ORDER_ID}&status=approved`);

    const main = screen.getByRole('main');
    expect(
      await within(main).findByRole('heading', { level: 2, name: '¡Pago aprobado!' }),
    ).toBeInTheDocument();
    expect(within(main).getByText('+100 créditos')).toBeInTheDocument();
    expect(within(main).queryByText('10 créditos')).not.toBeInTheDocument();
    expect(checkoutNavigation.readPendingOrderId(verifiedSession.user.user_id)).toBeNull();
    expect(within(main).queryByText(/boleta|factura/i)).not.toBeInTheDocument();

    resolveUpdatedWallet(
      jsonResponse(200, walletFixture({ total_credits: 110, paid_credits: 100 })),
    );
    expect(await within(main).findByText('110 créditos')).toBeInTheDocument();
    expect(within(main).getByRole('link', { name: 'Buscar vuelos' })).toHaveAttribute('href', '/');
    expect(within(main).getByRole('link', { name: 'Ver mis créditos' })).toHaveAttribute(
      'href',
      '/billing',
    );
  });

  it('usa respaldo de sessionStorage ante ?external_reference=null y sondea PENDING -> APPROVED', async () => {
    applySession(verifiedSession);
    checkoutNavigation.savePendingOrderId(SAMPLE_ORDER_ID, verifiedSession.user.user_id);

    let orderCalls = 0;
    mockApi({
      'POST /auth/refresh': () => jsonResponse(200, verifiedSession),
      'GET /billing/wallet': () =>
        jsonResponse(200, walletFixture({ total_credits: 110, paid_credits: 100 })),
      'GET /billing/orders/550e8400-e29b-41d4-a716-446655440000': () => {
        orderCalls += 1;
        return jsonResponse(
          200,
          orderDetail({ status: orderCalls >= 2 ? 'APPROVED' : 'PENDING', credits: 100 }),
        );
      },
    });

    renderApp('/billing/result?external_reference=null');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Confirmando tu pago…' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a créditos' })).toHaveAttribute(
      'href',
      '/billing',
    );

    expect(
      await screen.findByRole('heading', { level: 2, name: '¡Pago aprobado!' }, { timeout: 6_000 }),
    ).toBeInTheDocument();
  }, 10_000);

  it('muestra estados REJECTED, EXPIRED (backend y client-side), REVERSED, 404 y referencia faltante/malformada', async () => {
    let status: 'REJECTED' | 'EXPIRED' | 'REVERSED' | 'PENDING_PAST' | '404' = 'REJECTED';
    setupBilling({
      'GET /billing/orders/550e8400-e29b-41d4-a716-446655440000': () => {
        if (status === '404') return problem(404, 'ORDER_NOT_FOUND');
        if (status === 'PENDING_PAST') {
          return jsonResponse(
            200,
            orderDetail({
              status: 'PENDING',
              expires_at: new Date(Date.now() - 1_000).toISOString(),
            }),
          );
        }
        return jsonResponse(200, orderDetail({ status }));
      },
    });

    renderApp(`/billing/result?external_reference=${SAMPLE_ORDER_ID}`);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Pago rechazado' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Intentar de nuevo' })).toHaveAttribute(
      'href',
      '/billing',
    );

    status = 'PENDING_PAST';
    renderApp(`/billing/result?external_reference=${SAMPLE_ORDER_ID}`);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Orden vencida' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir un paquete' })).toHaveAttribute(
      'href',
      '/billing',
    );

    status = 'REVERSED';
    renderApp(`/billing/result?external_reference=${SAMPLE_ORDER_ID}`);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Pago revertido' }),
    ).toBeInTheDocument();

    status = '404';
    checkoutNavigation.savePendingOrderId(SAMPLE_ORDER_ID, verifiedSession.user.user_id);
    renderApp(`/billing/result?external_reference=${SAMPLE_ORDER_ID}`);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'No encontramos esa orden de compra' }),
    ).toBeInTheDocument();
    expect(checkoutNavigation.readPendingOrderId(verifiedSession.user.user_id)).toBeNull();

    // Parámetro explícito malformado no debe caer a sessionStorage.
    checkoutNavigation.savePendingOrderId(SAMPLE_ORDER_ID, verifiedSession.user.user_id);
    renderApp('/billing/result?external_reference=bad-uuid');
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'No encontramos la referencia de tu compra',
      }),
    ).toBeInTheDocument();
  });

  it('ofrece reintentar ante fallo de red inicial en /billing/result', async () => {
    let calls = 0;
    setupBilling({
      'GET /billing/orders/550e8400-e29b-41d4-a716-446655440000': () => {
        calls += 1;
        return calls === 1
          ? problem(500, 'INTERNAL')
          : jsonResponse(200, orderDetail({ status: 'APPROVED' }));
      },
    });

    renderApp(`/billing/result?external_reference=${SAMPLE_ORDER_ID}`);
    const user = userEvent.setup();

    expect(await screen.findByText('No pudimos verificar tu pago')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: '¡Pago aprobado!' }),
    ).toBeInTheDocument();
  });
});
