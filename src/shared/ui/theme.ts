import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'navby-theme';

export function readTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Almacenamiento no disponible.
  }
}

export function toggleTheme(): Theme {
  const next: Theme = readTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

export function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ['class'] });

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    if (event.newValue === 'dark' || event.newValue === 'light') {
      document.documentElement.classList.toggle('dark', event.newValue === 'dark');
    }
    onChange();
  };

  window.addEventListener('storage', handleStorage);
  return () => {
    observer.disconnect();
    window.removeEventListener('storage', handleStorage);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, (): Theme => 'light');
  return {
    theme,
    setTheme: applyTheme,
    toggleTheme,
  };
}
