import { z } from 'zod';

/** Contraseña nueva: espeja `PlainPassword` de navby-platform (8-72, letra y número). */
export const newPasswordSchema = z
  .string()
  .min(8, 'auth.errors.passwordMin')
  .max(72, 'auth.errors.passwordMax')
  .refine((v) => /\p{L}/u.test(v) && /\p{N}/u.test(v), 'auth.errors.passwordComplexity');
