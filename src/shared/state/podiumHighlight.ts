import { create } from 'zustand';

export type PodiumRank = 1 | 2 | 3;

interface PodiumHighlightState {
  highlightedRank: PodiumRank | null;
  setHighlightedRank: (rank: PodiumRank | null) => void;
}

/** Tarjeta ↔ ruta resaltada; lo comparten el podio y el mapa (estado de UI, no del servidor). */
export const usePodiumHighlight = create<PodiumHighlightState>()((set) => ({
  highlightedRank: null,
  setHighlightedRank: (rank) => set({ highlightedRank: rank }),
}));
