import { type ApiPreferences } from '@/shared/api/endpoints';

/** Perfiles de `navby-documentation.md` §5.4. */
export const PRESET_PROFILES = ['BALANCED', 'SAVER', 'FAST'] as const;
export type PresetProfile = (typeof PRESET_PROFILES)[number];

export const WEIGHT_KEYS = ['price', 'duration', 'stops'] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];

/** Pesos en porcentaje entero (múltiplos de `WEIGHT_STEP`) que suman 100. */
export type PercentWeights = Record<WeightKey, number>;

export type PreferenceSelection =
  { profile: PresetProfile } | { profile: 'CUSTOM'; weights: PercentWeights };

export const WEIGHT_STEP = 5;
export const DEFAULT_SELECTION: PreferenceSelection = { profile: 'BALANCED' };

export const PROFILE_WEIGHTS: Record<PresetProfile, PercentWeights> = {
  BALANCED: { price: 50, duration: 30, stops: 20 },
  SAVER: { price: 70, duration: 20, stops: 10 },
  FAST: { price: 20, duration: 60, stops: 20 },
};

const PROFILE_PARAM = 'profile';
const WEIGHTS_PARAM = 'w';
const STORAGE_PREFIX = 'navby-default-preference';

function storageKeyForUser(userId?: string | null): string {
  return userId ? `${STORAGE_PREFIX}:${userId}` : STORAGE_PREFIX;
}

function isPreset(value: string | null): value is PresetProfile {
  return (PRESET_PROFILES as readonly string[]).includes(value ?? '');
}

function isValidWeights(weights: unknown): weights is PercentWeights {
  if (!weights || typeof weights !== 'object') return false;
  const candidate = weights as Record<string, unknown>;
  const values = WEIGHT_KEYS.map((key) => candidate[key]);
  if (
    values.some(
      (n) =>
        typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 100 || n % WEIGHT_STEP !== 0,
    )
  ) {
    return false;
  }
  const [price = 0, duration = 0, stops = 0] = values as number[];
  return price + duration + stops === 100;
}

/** `w=40,40,20`: tres múltiplos de 5 que suman 100; si no, null. */
function parseWeights(raw: string | null): PercentWeights | null {
  const parts = (raw ?? '').split(',').map(Number);
  if (parts.length !== 3) return null;
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 100 || n % WEIGHT_STEP !== 0)) {
    return null;
  }
  const [price = 0, duration = 0, stops = 0] = parts;
  return price + duration + stops === 100 ? { price, duration, stops } : null;
}

export function selectionWeights(selection: PreferenceSelection): PercentWeights {
  return selection.profile === 'CUSTOM' ? selection.weights : PROFILE_WEIGHTS[selection.profile];
}

/** Lee la preferencia predeterminada guardada por el usuario en su perfil (`/account`). */
export function readDefaultPreference(userId?: string | null): PreferenceSelection {
  if (typeof window === 'undefined') return DEFAULT_SELECTION;
  try {
    const raw = window.localStorage.getItem(storageKeyForUser(userId));
    if (!raw) return DEFAULT_SELECTION;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SELECTION;
    const record = parsed as Record<string, unknown>;
    if (record.profile === 'CUSTOM' && isValidWeights(record.weights)) {
      return { profile: 'CUSTOM', weights: record.weights };
    }
    if (typeof record.profile === 'string' && isPreset(record.profile)) {
      return { profile: record.profile };
    }
    return DEFAULT_SELECTION;
  } catch {
    return DEFAULT_SELECTION;
  }
}

/** Guarda el perfil de búsqueda predeterminado del usuario en `localStorage`. */
export function writeDefaultPreference(
  userId: string | null | undefined,
  selection: PreferenceSelection,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKeyForUser(userId), JSON.stringify(selection));
  } catch {
    // Modo privado o almacenamiento lleno: el estado en memoria de la búsqueda sigue operando.
  }
}

/**
 * Perfil de la URL; si falta o es inválido, usa `fallback` (por defecto la preferencia del
 * perfil del usuario o Equilibrado). `CUSTOM` sin `w` válido arranca en 50/30/20.
 */
export function parsePreferences(
  params: URLSearchParams,
  fallback: PreferenceSelection = DEFAULT_SELECTION,
): PreferenceSelection {
  const profile = params.get(PROFILE_PARAM);
  if (profile === 'CUSTOM') {
    return {
      profile: 'CUSTOM',
      weights: parseWeights(params.get(WEIGHTS_PARAM)) ?? PROFILE_WEIGHTS.BALANCED,
    };
  }
  return isPreset(profile) ? { profile } : fallback;
}

/** Copia de `params` con el perfil; Equilibrado no se escribe (URL más corta). */
export function writePreferences(
  params: URLSearchParams,
  selection: PreferenceSelection,
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(WEIGHTS_PARAM);
  if (selection.profile === 'BALANCED') {
    next.delete(PROFILE_PARAM);
  } else {
    next.set(PROFILE_PARAM, selection.profile);
  }
  if (selection.profile === 'CUSTOM') {
    const { price, duration, stops } = selection.weights;
    next.set(WEIGHTS_PARAM, `${price},${duration},${stops}`);
  }
  return next;
}

/** Cuerpo de `preferences` para la API: fracciones (40 → 0.4). */
export function toApiPreferences(selection: PreferenceSelection): ApiPreferences {
  if (selection.profile !== 'CUSTOM') return { profile: selection.profile };
  const { price, duration, stops } = selection.weights;
  return {
    profile: 'CUSTOM',
    weights: { price: price / 100, duration: duration / 100, stops: stops / 100 },
  };
}

/** Selección equivalente a las `preferences` de una respuesta (0.35 → 35). */
export function selectionFromApi(preferences: {
  profile: string;
  weights: Record<WeightKey, number>;
}): PreferenceSelection {
  if (isPreset(preferences.profile)) return { profile: preferences.profile };
  const { price, duration, stops } = preferences.weights;
  return {
    profile: 'CUSTOM',
    weights: {
      price: Math.round(price * 100),
      duration: Math.round(duration * 100),
      stops: Math.round(stops * 100),
    },
  };
}

/** Parte de la query key del podio: `SAVER` o `CUSTOM:40-40-20`. */
export function preferenceKey(selection: PreferenceSelection): string {
  if (selection.profile !== 'CUSTOM') return selection.profile;
  const { price, duration, stops } = selection.weights;
  return `CUSTOM:${price}-${duration}-${stops}`;
}

/**
 * Mueve un slider y reparte la diferencia entre los otros dos en proporción a sus valores
 * (partes iguales si ambos valen 0), en múltiplos de 5 que siempre suman 100. Un peso en 0
 * se queda en 0 mientras el otro tenga valor (reparto proporcional, DESIGN.md).
 */
export function redistributeWeights(
  current: PercentWeights,
  changed: WeightKey,
  value: number,
): PercentWeights {
  const snapped = Math.min(100, Math.max(0, Math.round(value / WEIGHT_STEP) * WEIGHT_STEP));
  const others = WEIGHT_KEYS.filter((key) => key !== changed);
  const remainder = 100 - snapped;
  const base = others.reduce((sum, key) => sum + current[key], 0);
  const exact = others.map((key) =>
    base === 0 ? remainder / others.length : (remainder * current[key]) / base,
  );
  const floors = exact.map((n) => Math.floor(n / WEIGHT_STEP) * WEIGHT_STEP);
  let missing = remainder - floors.reduce((sum, n) => sum + n, 0);
  // Mayor resto primero; empate → orden fijo precio, duración, escalas.
  const order = others
    .map((_, index) => index)
    .sort((a, b) => (exact[b] ?? 0) - (floors[b] ?? 0) - ((exact[a] ?? 0) - (floors[a] ?? 0)));
  for (const index of order) {
    if (missing <= 0) break;
    floors[index] = (floors[index] ?? 0) + WEIGHT_STEP;
    missing -= WEIGHT_STEP;
  }
  const result = { ...current, [changed]: snapped };
  others.forEach((key, index) => {
    result[key] = floors[index] ?? 0;
  });
  return result;
}
