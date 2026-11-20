import {
  type CreditPackage,
  type OrderCreated,
  type OrderDetail,
  type PackagesResponse,
  type TransactionItem,
  type TransactionsPage,
  type Wallet,
} from '@/shared/api/schemas';

export const SAMPLE_ORDER_ID = '550e8400-e29b-41d4-a716-446655440000';

export function walletFixture(overrides: Partial<Wallet> = {}): Wallet {
  return {
    free_credits: 5,
    paid_credits: 45,
    total_credits: 50,
    searches_available: 10,
    free_credits_reset_at: '2026-11-20T05:00:00Z',
    ...overrides,
  };
}

export const defaultPackages: CreditPackage[] = [
  {
    code: 'pack_50',
    name: 'Escapada',
    credits: 50,
    searches: 10,
    price: '9.90',
    usd_reference: '2.49',
  },
  {
    code: 'pack_100',
    name: 'Viajero Frecuente',
    credits: 100,
    searches: 20,
    price: '16.90',
    usd_reference: '4.49',
  },
  {
    code: 'pack_250',
    name: 'Nómada',
    credits: 250,
    searches: 50,
    price: '34.90',
    usd_reference: '8.99',
  },
];

export function packagesResponse(overrides: Partial<PackagesResponse> = {}): PackagesResponse {
  return {
    currency: 'PEN',
    packages: defaultPackages,
    ...overrides,
  };
}

export function transactionItem(overrides: Partial<TransactionItem> = {}): TransactionItem {
  return {
    id: 'tx-0001',
    type: 'SEARCH_DEBIT',
    free_delta: -5,
    paid_delta: 0,
    reference_id: 'srch_internal_ref_001',
    created_at: '2026-11-19T14:30:00Z',
    ...overrides,
  };
}

export function transactionsPage(
  items: TransactionItem[] = [],
  overrides: Partial<Omit<TransactionsPage, 'items'>> = {},
): TransactionsPage {
  return {
    items,
    page: 1,
    page_size: 20,
    total: items.length,
    ...overrides,
  };
}

export function orderDetail(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    order_id: SAMPLE_ORDER_ID,
    package_code: 'pack_100',
    credits: 100,
    amount: '16.90',
    currency: 'PEN',
    status: 'PENDING',
    expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    ...overrides,
  };
}

export function orderCreated(overrides: Partial<OrderCreated> = {}): OrderCreated {
  return {
    ...orderDetail(),
    checkout_url: 'https://sandbox.mercadopago.com.pe/checkout/v1/redirect?pref_id=pref-test-123',
    ...overrides,
  };
}
