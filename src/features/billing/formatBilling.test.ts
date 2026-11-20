import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import {
  clearPendingOrderId,
  isSafeCheckoutUrl,
  PENDING_ORDER_STORAGE_KEY,
  readPendingOrderId,
  resolveResultOrderId,
  savePendingOrderId,
} from './checkoutNavigation';
import {
  formatBillingMoney,
  formatPerSearchPrice,
  formatSignedCredits,
  localizePackageName,
} from './formatBilling';

const ORDER_A = '550e8400-e29b-41d4-a716-446655440000';
const ORDER_B = '660e8400-e29b-41d4-a716-446655440001';

describe('formatBilling', () => {
  it('formatea dinero siempre con exactamente 2 decimales en es-PE y en-US', () => {
    expect(formatBillingMoney('16.90', 'PEN', 'es-PE').replace(/\s/g, ' ')).toBe('S/ 16.90');
    expect(formatBillingMoney(10, 'PEN', 'es-PE').replace(/\s/g, ' ')).toBe('S/ 10.00');
    expect(formatBillingMoney('4.49', 'USD', 'en-US')).toBe('$4.49');
  });

  it('calcula el precio por búsqueda y devuelve null si searches <= 0 o precio inválido', () => {
    expect(formatPerSearchPrice('16.90', 20, 'PEN', 'es-PE')?.replace(/\s/g, ' ')).toBe('S/ 0.85');
    expect(formatPerSearchPrice('16.90', 0, 'PEN', 'es-PE')).toBeNull();
    expect(formatPerSearchPrice('16.90', -5, 'PEN', 'es-PE')).toBeNull();
    expect(formatPerSearchPrice('abc', 10, 'PEN', 'es-PE')).toBeNull();
  });

  it('formatea variaciones con signo positivo, menos tipográfico y cero', () => {
    expect(formatSignedCredits(100, 'es-PE')).toBe('+100');
    expect(formatSignedCredits(-5, 'es-PE')).toBe('\u22125');
    expect(formatSignedCredits(0, 'es-PE')).toBe('0');
  });

  it('localiza paquetes conocidos y conserva el nombre del servidor para desconocidos', async () => {
    expect(localizePackageName(i18n.t, 'pack_100', 'Fallback')).toBe('Viajero Frecuente');
    await i18n.changeLanguage('en');
    expect(localizePackageName(i18n.t, 'pack_100', 'Fallback')).toBe('Frequent Traveler');
    expect(localizePackageName(i18n.t, 'pack_999', 'Pack Especial')).toBe('Pack Especial');
  });
});

describe('checkoutNavigation', () => {
  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('acepta solo URLs https: en isSafeCheckoutUrl', () => {
    expect(isSafeCheckoutUrl('https://www.mercadopago.com.pe/checkout/v1/redirect')).toBe(true);
    expect(isSafeCheckoutUrl('http://www.mercadopago.com.pe/checkout')).toBe(false);
    expect(isSafeCheckoutUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeCheckoutUrl('not-a-url')).toBe(false);
  });

  it('resuelve external_reference > order_id > sessionStorage del mismo usuario', () => {
    savePendingOrderId(ORDER_B, 'usr-1');

    expect(
      resolveResultOrderId(
        new URLSearchParams(`external_reference=${ORDER_A}&order_id=${ORDER_B}`),
        'usr-1',
      ),
    ).toBe(ORDER_A);

    expect(resolveResultOrderId(new URLSearchParams(`order_id=${ORDER_A}`), 'usr-1')).toBe(ORDER_A);

    expect(
      resolveResultOrderId(
        new URLSearchParams('external_reference=null&order_id=undefined'),
        'usr-1',
      ),
    ).toBe(ORDER_B);

    expect(resolveResultOrderId(new URLSearchParams('external_reference='), 'usr-1')).toBe(ORDER_B);
  });

  it('devuelve null sin caer en sessionStorage cuando el parámetro explícito es inválido', () => {
    savePendingOrderId(ORDER_B, 'usr-1');
    expect(
      resolveResultOrderId(new URLSearchParams('external_reference=not-a-uuid'), 'usr-1'),
    ).toBeNull();
    expect(resolveResultOrderId(new URLSearchParams('order_id=12345'), 'usr-1')).toBeNull();
  });

  it('ignora sessionStorage de otro usuario y limpia entradas corruptas o expiradas (>24h)', () => {
    savePendingOrderId(ORDER_A, 'usr-1');
    expect(readPendingOrderId('usr-2')).toBeNull();
    expect(readPendingOrderId(undefined)).toBeNull();
    expect(readPendingOrderId('usr-1')).toBe(ORDER_A);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 86_400_001);
    expect(readPendingOrderId('usr-1')).toBeNull();
    expect(sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY)).toBeNull();

    sessionStorage.setItem(PENDING_ORDER_STORAGE_KEY, '{corrupt');
    expect(readPendingOrderId('usr-1')).toBeNull();
    expect(sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY)).toBeNull();

    savePendingOrderId(ORDER_A, 'usr-1');
    clearPendingOrderId(ORDER_B);
    expect(readPendingOrderId('usr-1')).toBe(ORDER_A);
    clearPendingOrderId(ORDER_A);
    expect(readPendingOrderId('usr-1')).toBeNull();
  });
});
