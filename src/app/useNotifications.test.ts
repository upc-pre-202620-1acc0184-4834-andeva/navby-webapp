import { describe, expect, it } from 'vitest';
import { type TransactionItem } from '@/shared/api/schemas';
import { formatRelative, transactionToNotification } from './useNotifications';

const NOW = Date.parse('2026-11-20T12:00:00Z');

function tx(overrides: Partial<TransactionItem>): TransactionItem {
  return {
    id: 't1',
    type: 'PURCHASE',
    free_delta: 0,
    paid_delta: 50,
    reference_id: null,
    created_at: '2026-11-20T11:00:00Z',
    ...overrides,
  };
}

describe('transactionToNotification', () => {
  it('convierte compras, devoluciones y reversiones recientes', () => {
    expect(transactionToNotification(tx({}), NOW)).toMatchObject({ kind: 'purchase', credits: 50 });
    expect(
      transactionToNotification(tx({ type: 'SEARCH_REFUND', paid_delta: 0, free_delta: 5 }), NOW),
    ).toMatchObject({ kind: 'refund', credits: 5 });
    expect(
      transactionToNotification(tx({ type: 'PURCHASE_REVERSAL', paid_delta: -50 }), NOW),
    ).toMatchObject({ kind: 'reversal', credits: 50 });
  });

  it('ignora cobros por búsqueda, cierres de cuenta y movimientos viejos', () => {
    expect(transactionToNotification(tx({ type: 'SEARCH_DEBIT', paid_delta: -5 }), NOW)).toBeNull();
    expect(transactionToNotification(tx({ type: 'ACCOUNT_DELETION' }), NOW)).toBeNull();
    expect(transactionToNotification(tx({ created_at: '2026-10-01T00:00:00Z' }), NOW)).toBeNull();
  });
});

describe('formatRelative', () => {
  it('usa la unidad más natural en el idioma activo', () => {
    expect(formatRelative('2026-11-20T11:55:00Z', 'es', NOW)).toBe('hace 5 minutos');
    expect(formatRelative('2026-11-20T09:00:00Z', 'en', NOW)).toBe('3 hours ago');
    expect(formatRelative('2026-11-19T12:00:00Z', 'es', NOW)).toBe('ayer');
  });
});
