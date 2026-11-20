export type AuthDesktopSide = 'left' | 'right';

export const AUTH_LIQUID_DURATION_MS = 460;

let lastDesktopSide: AuthDesktopSide | null = null;
let transitionCounter = 0;

/**
 * Registra el lado del showcase en la ruta de acceso actual y devuelve la dirección
 * del flujo líquido (`ltr` o `rtl`) solo cuando se cambia directamente de columna.
 */
export function advanceAuthDesktopSide(currentSide: AuthDesktopSide): {
  direction: 'ltr' | 'rtl' | null;
  key: number;
} {
  const prev = lastDesktopSide;
  if (prev && prev !== currentSide) {
    transitionCounter += 1;
    return {
      direction: prev === 'left' ? 'ltr' : 'rtl',
      key: transitionCounter,
    };
  }
  return { direction: null, key: 0 };
}

export function commitAuthDesktopSide(side: AuthDesktopSide): void {
  lastDesktopSide = side;
}

export function resetAuthDesktopSide(): void {
  lastDesktopSide = null;
}
