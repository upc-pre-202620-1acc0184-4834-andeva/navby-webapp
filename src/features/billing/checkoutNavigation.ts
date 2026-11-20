export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PENDING_ORDER_STORAGE_KEY = 'navby:pending_order_id';
const PENDING_ORDER_TTL_MS = 86_400_000; // 24 horas

interface PendingOrderEntry {
  orderId: string;
  userId: string;
  savedAt: number;
}

/** Solo se redirige a URLs HTTPS válidas de Mercado Pago. */
export function isSafeCheckoutUrl(raw: string): boolean {
  try {
    return new URL(raw).protocol === 'https:';
  } catch {
    return false;
  }
}

export function redirectToCheckout(url: string): void {
  window.location.assign(url);
}

export function savePendingOrderId(orderId: string, userId: string): void {
  try {
    const entry: PendingOrderEntry = { orderId, userId, savedAt: Date.now() };
    sessionStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // sessionStorage puede no estar disponible en modo privado estricto.
  }
}

export function readPendingOrderId(userId: string | undefined): string | null {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingOrderEntry>;
    if (
      typeof parsed.orderId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.savedAt !== 'number' ||
      !Number.isFinite(parsed.savedAt) ||
      !UUID_REGEX.test(parsed.orderId)
    ) {
      sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
      return null;
    }
    if (Date.now() - parsed.savedAt > PENDING_ORDER_TTL_MS) {
      sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
      return null;
    }
    if (parsed.userId !== userId) {
      return null;
    }
    return parsed.orderId;
  } catch {
    try {
      sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
    } catch {
      // noop
    }
    return null;
  }
}

export function clearPendingOrderId(orderId?: string): void {
  try {
    if (orderId === undefined) {
      sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
      return;
    }
    const raw = sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<PendingOrderEntry>;
    if (parsed.orderId === orderId) {
      sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
    }
  } catch {
    try {
      sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
    } catch {
      // noop
    }
  }
}

function normalizeOrderParam(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (trimmed === '' || lower === 'null' || lower === 'undefined') return null;
  return trimmed;
}

/**
 * Resuelve el `order_id` al volver de Mercado Pago:
 * `external_reference` > `order_id` > `sessionStorage` del mismo usuario.
 * Un parámetro explícito malformado devuelve `null` sin caer en `sessionStorage`.
 */
export function resolveResultOrderId(
  searchParams: URLSearchParams,
  userId: string | undefined,
): string | null {
  const externalRef = normalizeOrderParam(searchParams.get('external_reference'));
  if (externalRef !== null) {
    return UUID_REGEX.test(externalRef) ? externalRef : null;
  }

  const orderIdParam = normalizeOrderParam(searchParams.get('order_id'));
  if (orderIdParam !== null) {
    return UUID_REGEX.test(orderIdParam) ? orderIdParam : null;
  }

  return readPendingOrderId(userId);
}
