import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Configura el worker ESM explícitamente una vez al cargar el bundle del mapa (Vite 8 + MapLibre v6).
setWorkerUrl(workerUrl);
