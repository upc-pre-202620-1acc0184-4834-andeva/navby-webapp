import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { applyTheme, readTheme, THEME_STORAGE_KEY, toggleTheme, useTheme } from './theme';

describe('theme', () => {
  it('lee, aplica y alterna el tema actualizando .dark y localStorage', () => {
    expect(readTheme()).toBe('light');

    applyTheme('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readTheme()).toBe('dark');

    const next = toggleTheme();
    expect(next).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('useTheme se sincroniza con cambios externos de clase .dark', async () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');

    await act(async () => {
      result.current.setTheme('dark');
    });
    expect(result.current.theme).toBe('dark');

    await act(async () => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');
  });
});
