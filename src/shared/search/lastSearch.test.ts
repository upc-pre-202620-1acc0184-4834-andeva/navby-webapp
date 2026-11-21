import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  clearLastSearch,
  LAST_SEARCH_STORAGE_KEY,
  readLastSearch,
  saveLastSearch,
  useHomeHref,
} from './lastSearch';

describe('lastSearch', () => {
  it('guarda y recupera la búsqueda por usuario y devuelve / si falta o no coincide', () => {
    expect(readLastSearch('usr-1')).toBeNull();

    saveLastSearch('usr-1', '?trip=ONE_WAY&from=LIM&to=MAD&sid=srch_1');
    expect(readLastSearch('usr-1')).toBe('?trip=ONE_WAY&from=LIM&to=MAD&sid=srch_1');
    expect(readLastSearch('usr-2')).toBeNull();
    expect(readLastSearch(null)).toBeNull();

    clearLastSearch();
    expect(readLastSearch('usr-1')).toBeNull();
  });

  it('descarta entradas corruptas o caducadas (>24h)', () => {
    localStorage.setItem(LAST_SEARCH_STORAGE_KEY, '{corrupt');
    expect(readLastSearch('usr-1')).toBeNull();
    expect(localStorage.getItem(LAST_SEARCH_STORAGE_KEY)).toBeNull();

    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000);
    saveLastSearch('usr-1', '?trip=ONE_WAY&from=CUZ&to=HND');
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000 + 25 * 60 * 60 * 1000);

    expect(readLastSearch('usr-1')).toBeNull();
    expect(localStorage.getItem(LAST_SEARCH_STORAGE_KEY)).toBeNull();
    vi.restoreAllMocks();
  });

  it('useHomeHref se actualiza al guardar, limpiar o recibir evento storage de otra pestaña', () => {
    const { result } = renderHook(() => useHomeHref('usr-1'));
    expect(result.current).toBe('/');

    act(() => {
      saveLastSearch('usr-1', '?trip=ROUND_TRIP&from=CUZ&to=HND%2CNRT&sid=srch_9');
    });
    expect(result.current).toBe('/?trip=ROUND_TRIP&from=CUZ&to=HND%2CNRT&sid=srch_9');

    act(() => {
      localStorage.setItem(
        LAST_SEARCH_STORAGE_KEY,
        JSON.stringify({ userId: 'usr-1', search: '?from=LIM&to=CUZ', updatedAt: Date.now() }),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: LAST_SEARCH_STORAGE_KEY }));
    });
    expect(result.current).toBe('/?from=LIM&to=CUZ');

    act(() => {
      clearLastSearch();
    });
    expect(result.current).toBe('/');
  });
});
