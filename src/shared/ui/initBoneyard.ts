import { configureBoneyard } from 'boneyard-js/react';
import '@/bones/registry';

// Skeletons con los tokens de DESIGN.md (las variables cambian solas con .dark).
// Se importa solo desde rutas lazy con <Skeleton> para no cargar boneyard ni los JSON en /login.
configureBoneyard({
  color: 'var(--color-skeleton)',
  darkColor: 'var(--color-skeleton)',
  animate: 'pulse',
});
