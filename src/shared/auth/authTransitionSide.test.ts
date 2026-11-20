import { beforeEach, describe, expect, it } from 'vitest';
import {
  advanceAuthDesktopSide,
  commitAuthDesktopSide,
  resetAuthDesktopSide,
} from './authTransitionSide';

describe('authTransitionSide', () => {
  beforeEach(() => {
    resetAuthDesktopSide();
  });

  it('no dispara transición en la primera carga ni al quedarse en el mismo lado', () => {
    expect(advanceAuthDesktopSide('right')).toEqual({ direction: null, key: 0 });
    commitAuthDesktopSide('right');

    expect(advanceAuthDesktopSide('right')).toEqual({ direction: null, key: 0 });
  });

  it('devuelve rtl al pasar de derecha a izquierda y ltr en sentido inverso', () => {
    commitAuthDesktopSide('right');

    const rtl = advanceAuthDesktopSide('left');
    expect(rtl.direction).toBe('rtl');
    expect(rtl.key).toBeGreaterThan(0);
    commitAuthDesktopSide('left');

    const ltr = advanceAuthDesktopSide('right');
    expect(ltr.direction).toBe('ltr');
    expect(ltr.key).toBeGreaterThan(rtl.key);
  });

  it('reinicia la transición al salir de las rutas de acceso', () => {
    commitAuthDesktopSide('left');
    resetAuthDesktopSide();

    expect(advanceAuthDesktopSide('right')).toEqual({ direction: null, key: 0 });
  });
});
