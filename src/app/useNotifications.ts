import { useCallback, useMemo, useState } from 'react';
import { useTransactions } from '@/features/billing/hooks/useBillingQueries';
import { useWallet } from '@/features/billing/hooks/useWallet';
import { type TransactionItem } from '@/shared/api/schemas';

/**
 * Avisos derivados de datos reales del backend (saldo y movimientos de créditos): la API aún no
 * expone un endpoint de notificaciones, así que no se inventa ninguno.
 */
export type AppNotification =
  | { id: string; kind: 'credits-empty'; resetAt: string }
  | {
      id: string;
      kind: 'purchase' | 'refund' | 'reversal';
      credits: number;
      at: string;
    };

const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 6;
const MAX_SEEN = 60;
const SEEN_KEY_PREFIX = 'navby-notifications-seen:';

function readSeen(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeSeen(key: string, seen: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...seen].slice(-MAX_SEEN)));
  } catch {
    // Almacenamiento no disponible: el aviso vuelve a figurar como nuevo en la próxima sesión.
  }
}

/** «hace 5 min», «ayer»… con el idioma activo. */
export function formatRelative(iso: string, locale: string, now = Date.now()): string {
  const diffSec = Math.round((Date.parse(iso) - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}

export function transactionToNotification(
  tx: TransactionItem,
  now: number,
): AppNotification | null {
  const at = Date.parse(tx.created_at);
  if (Number.isNaN(at) || now - at > RECENT_WINDOW_MS) return null;
  const credits = Math.abs(tx.free_delta + tx.paid_delta);
  switch (tx.type) {
    case 'PURCHASE':
      return { id: `tx:${tx.id}`, kind: 'purchase', credits, at: tx.created_at };
    case 'SEARCH_REFUND':
      return { id: `tx:${tx.id}`, kind: 'refund', credits, at: tx.created_at };
    case 'PURCHASE_REVERSAL':
      return { id: `tx:${tx.id}`, kind: 'reversal', credits, at: tx.created_at };
    default:
      return null;
  }
}

export function useNotifications(userId: string, enabled: boolean) {
  const wallet = useWallet(enabled);
  const transactions = useTransactions(1, 20, enabled);
  const seenKey = `${SEEN_KEY_PREFIX}${userId}`;
  const [seen, setSeen] = useState(() => readSeen(seenKey));

  const items = useMemo(() => {
    const list: AppNotification[] = [];
    if (wallet.data && wallet.data.searches_available === 0) {
      list.push({
        id: `credits-empty:${wallet.data.free_credits_reset_at}`,
        kind: 'credits-empty',
        resetAt: wallet.data.free_credits_reset_at,
      });
    }
    // `dataUpdatedAt` evita leer el reloj durante el render y se renueva con cada consulta.
    const now = transactions.dataUpdatedAt;
    for (const tx of transactions.data?.items ?? []) {
      const item = transactionToNotification(tx, now);
      if (item) list.push(item);
    }
    return list.slice(0, MAX_ITEMS);
  }, [wallet.data, transactions.data, transactions.dataUpdatedAt]);

  const unreadIds = useMemo(
    () => new Set(items.filter((item) => !seen.has(item.id)).map((item) => item.id)),
    [items, seen],
  );

  const markAllSeen = useCallback(() => {
    setSeen((prev) => {
      if (items.every((item) => prev.has(item.id))) return prev;
      const next = new Set([...prev, ...items.map((item) => item.id)]);
      writeSeen(seenKey, next);
      return next;
    });
  }, [items, seenKey]);

  return { items, unreadIds, markAllSeen, isLoading: wallet.isLoading || transactions.isLoading };
}
