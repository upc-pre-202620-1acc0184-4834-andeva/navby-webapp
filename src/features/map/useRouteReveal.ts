import gsap from 'gsap';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { type PodiumRank } from '@/shared/state/podiumHighlight';

/**
 * Secuencia del mapa (independiente de cuándo responda el backend):
 * 1) la ruta preliminar se dibuja completa; 2) pausa breve; 3) se desvanece mientras las rutas del
 * podio se dibujan escalonadas (la 1 primero). Si el podio llega antes de que la preliminar
 * termine, espera su turno.
 */
export const PREVIEW_DRAW_S = 1.5;
const HOLD_S = 0.3;
const PREVIEW_FADE_S = 0.5;
const ARC_DRAW_S = 1.3;
const ARC_STAGGER_S = 0.4;
const ARC_START_S = 0.15;
const RANKS: readonly PodiumRank[] = [1, 2, 3];
const DRAW_EASE = 'power2.inOut';

/** Valores animados; viven en un ref para no re-renderizar React en cada fotograma. */
export interface RevealValues {
  previewDraw: number;
  previewAlpha: number;
  arcDraw: Record<PodiumRank, number>;
}

interface Options {
  /** Identifica la ruta preliminar actual; vacío si no hay. */
  previewKey: string;
  /** Identifica el podio actual; vacío si no hay. */
  podiumKey: string;
  reducedMotion: boolean;
}

export function useRouteReveal({ previewKey, podiumKey, reducedMotion }: Options) {
  const values = useRef<RevealValues>({
    previewDraw: 0,
    previewAlpha: 1,
    arcDraw: { 1: 0, 2: 0, 3: 0 },
  });
  const listeners = useRef(new Set<() => void>());
  const previewTween = useRef<gsap.core.Tween | null>(null);
  const [drawnKey, setDrawnKey] = useState('');
  const [releasedKey, setReleasedKey] = useState('');

  const emit = useCallback(() => {
    listeners.current.forEach((listener) => listener());
  }, []);
  const subscribe = useCallback((listener: () => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  // 1) La ruta preliminar se dibuja de origen a destino.
  useLayoutEffect(() => {
    const v = values.current;
    previewTween.current = null;
    v.previewAlpha = 1;
    v.previewDraw = previewKey && reducedMotion ? 1 : 0;
    emit();
    if (!previewKey || reducedMotion) return;

    const tween = gsap.to(v, {
      previewDraw: 1,
      duration: PREVIEW_DRAW_S,
      ease: DRAW_EASE,
      onUpdate: emit,
      onComplete: () => setDrawnKey(previewKey),
    });
    previewTween.current = tween;
    return () => {
      tween.kill();
    };
  }, [previewKey, reducedMotion, emit]);

  // 2) El podio espera a que la preliminar termine y entonces dibuja sus rutas.
  useLayoutEffect(() => {
    const v = values.current;
    if (!podiumKey) {
      RANKS.forEach((rank) => (v.arcDraw[rank] = 0));
      v.previewAlpha = 1;
      emit();
      return;
    }
    if (reducedMotion) {
      RANKS.forEach((rank) => (v.arcDraw[rank] = 1));
      v.previewAlpha = 0;
      emit();
      return;
    }

    RANKS.forEach((rank) => (v.arcDraw[rank] = 0));
    const preview = previewTween.current;
    const pending =
      preview && preview.progress() < 1 ? preview.duration() * (1 - preview.progress()) : 0;
    const wait = previewKey ? pending + HOLD_S : 0;

    const timeline = gsap.timeline({ delay: wait });
    timeline
      .call(() => setReleasedKey(podiumKey), [], 0)
      .to(v, { previewAlpha: 0, duration: PREVIEW_FADE_S, ease: 'power1.out', onUpdate: emit }, 0);
    RANKS.forEach((rank, index) => {
      timeline.to(
        v.arcDraw,
        { [rank]: 1, duration: ARC_DRAW_S, ease: DRAW_EASE, onUpdate: emit },
        ARC_START_S + index * ARC_STAGGER_S,
      );
    });
    return () => {
      timeline.kill();
    };
    // `previewKey` solo se lee para saber si hay que esperar: no reinicia el podio por sí solo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podiumKey, reducedMotion, emit]);

  return {
    values,
    subscribe,
    /** La preliminar ya terminó de dibujarse (activa su pulso lento). */
    previewDrawn: previewKey !== '' && drawnKey === previewKey,
    /** El podio ya puede reemplazar a los marcadores de la preliminar. */
    podiumReleased:
      podiumKey === '' || previewKey === '' || reducedMotion || releasedKey === podiumKey,
  };
}
