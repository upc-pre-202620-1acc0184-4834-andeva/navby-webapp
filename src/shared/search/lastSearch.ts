import { useEffect, useSyncExternalStore } from 'react';

export const LAST_SEARCH_STORAGE_KEY = 'navby:last_search';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface StoredLastSearch {
  userId: string;
  search: string;
  updatedAt: number;
}

const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

function removeStoredEntry(): void {
  try {
    localStorage.removeItem(LAST_SEARCH_STORAGE_KEY);
  } catch {
    // localStorage puede no estar disponible en entornos restringidos.
  }
}

function readStoredEntry(): StoredLastSearch | null {
  try {
    const raw = localStorage.getItem(LAST_SEARCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      removeStoredEntry();
      return null;
    }
    const candidate = parsed as Partial<StoredLastSearch>;
    if (
      typeof candidate.userId !== 'string' ||
      !candidate.userId ||
      typeof candidate.search !== 'string' ||
      !candidate.search.startsWith('?') ||
      candidate.search.length <= 1 ||
      typeof candidate.updatedAt !== 'number' ||
      !Number.isFinite(candidate.updatedAt) ||
      Date.now() - candidate.updatedAt > MAX_AGE_MS
    ) {
      removeStoredEntry();
      return null;
    }
    return {
      userId: candidate.userId,
      search: candidate.search,
      updatedAt: candidate.updatedAt,
    };
  } catch {
    removeStoredEntry();
    return null;
  }
}

/** Lee el query string (`?trip=...`) de la última búsqueda activa del usuario, si sigue vigente. */
export function readLastSearch(userId: string | null | undefined): string | null {
  if (!userId) return null;
  const entry = readStoredEntry();
  if (!entry || entry.userId !== userId) return null;
  return entry.search;
}

/** Persiste el query string de la búsqueda activa del usuario en `localStorage`. */
export function saveLastSearch(userId: string | null | undefined, search: string): void {
  if (!userId || !search.startsWith('?') || search.length <= 1) return;
  if (readLastSearch(userId) === search) return;
  try {
    const payload: StoredLastSearch = {
      userId,
      search,
      updatedAt: Date.now(),
    };
    localStorage.setItem(LAST_SEARCH_STORAGE_KEY, JSON.stringify(payload));
    notifyListeners();
  } catch {
    // localStorage puede no estar disponible en entornos restringidos.
  }
}

/** Borra la última búsqueda guardada (al cerrar sesión o reiniciar desde el logo en `/`). */
export function clearLastSearch(): void {
  try {
    if (localStorage.getItem(LAST_SEARCH_STORAGE_KEY) !== null) {
      localStorage.removeItem(LAST_SEARCH_STORAGE_KEY);
      notifyListeners();
    }
  } catch {
    // localStorage puede no estar disponible en entornos restringidos.
  }
}

function subscribeLastSearch(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Devuelve `'/?...'` con la última búsqueda del usuario mientras exista, o `'/'` en caso contrario.
 * Se mantiene sincronizado entre vistas y entre pestañas del navegador.
 */
export function useHomeHref(userId: string | null | undefined): string {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === LAST_SEARCH_STORAGE_KEY) {
        notifyListeners();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const search = useSyncExternalStore(
    subscribeLastSearch,
    () => readLastSearch(userId),
    () => null,
  );

  return search ? `/${search}` : '/';
}
