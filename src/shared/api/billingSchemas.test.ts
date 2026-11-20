import { describe, expect, it } from 'vitest';
import {
  orderCreated,
  orderDetail,
  packagesResponse,
  transactionItem,
  transactionsPage,
} from '@/test/fixtures/billing';
import {
  OrderCreatedSchema,
  OrderDetailSchema,
  PackagesResponseSchema,
  TransactionItemSchema,
  TransactionsPageSchema,
  TransactionTypeSchema,
} from './schemas';

describe('schemas de billing', () => {
  it('valida los tipos de transacción conocidos y degrada desconocidos a UNKNOWN', () => {
    expect(TransactionTypeSchema.parse('SEARCH_DEBIT')).toBe('SEARCH_DEBIT');
    expect(TransactionTypeSchema.parse('SEARCH_REFUND')).toBe('SEARCH_REFUND');
    expect(TransactionTypeSchema.parse('PURCHASE')).toBe('PURCHASE');
    expect(TransactionTypeSchema.parse('PURCHASE_REVERSAL')).toBe('PURCHASE_REVERSAL');
    expect(TransactionTypeSchema.parse('ACCOUNT_DELETION')).toBe('ACCOUNT_DELETION');
    expect(TransactionTypeSchema.parse('FUTURE_CREDIT_TYPE')).toBe('UNKNOWN');
  });

  it('valida una página de transacciones incluyendo reference_id nulo y tipo futuro', () => {
    const parsed = TransactionsPageSchema.parse(
      transactionsPage([
        transactionItem({ type: 'PURCHASE', free_delta: 0, paid_delta: 100 }),
        transactionItem({
          id: 'tx-2',
          type: 'FUTURE_TYPE' as never,
          free_delta: 0,
          paid_delta: 0,
          reference_id: null,
        }),
      ]),
    );
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[1]?.type).toBe('UNKNOWN');
    expect(parsed.items[1]?.reference_id).toBeNull();
  });

  it('rechaza un item de transacción sin deltas enteros', () => {
    expect(
      TransactionItemSchema.safeParse({
        ...transactionItem(),
        free_delta: 1.5,
      }).success,
    ).toBe(false);
  });

  it('valida el catálogo de paquetes y rechaza créditos no positivos', () => {
    const parsed = PackagesResponseSchema.parse(packagesResponse());
    expect(parsed.currency).toBe('PEN');
    expect(parsed.packages).toHaveLength(3);

    const invalid = packagesResponse();
    invalid.packages = [{ ...invalid.packages[0]!, credits: 0 }];
    expect(PackagesResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it('valida OrderDetail y OrderCreated con URL válida', () => {
    expect(OrderDetailSchema.parse(orderDetail({ status: 'APPROVED' })).status).toBe('APPROVED');
    expect(OrderCreatedSchema.parse(orderCreated()).checkout_url).toContain('https://');
  });

  it('rechaza OrderCreated sin checkout_url válido y OrderDetail con estado inválido', () => {
    expect(OrderCreatedSchema.safeParse(orderCreated({ checkout_url: 'not-a-url' })).success).toBe(
      false,
    );
    expect(OrderDetailSchema.safeParse({ ...orderDetail(), status: 'UNKNOWN' }).success).toBe(
      false,
    );
  });
});
