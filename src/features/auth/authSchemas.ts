import { z } from 'zod';

// Los mensajes son claves de i18n (auth.errors.*); la página las traduce al mostrarlas.
// Las reglas espejan los value objects de navby-platform (Email, FullName, PlainPassword).

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'auth.errors.emailRequired')
  .max(254, 'auth.errors.emailInvalid')
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'auth.errors.emailInvalid');

const newPassword = z
  .string()
  .min(8, 'auth.errors.passwordMin')
  .max(72, 'auth.errors.passwordMax')
  .refine((v) => /\p{L}/u.test(v) && /\p{N}/u.test(v), 'auth.errors.passwordComplexity');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'auth.errors.passwordRequired').max(72, 'auth.errors.passwordMax'),
});

export const registerSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, 'auth.errors.fullNameRequired')
    .max(100, 'auth.errors.fullNameTooLong'),
  email,
  password: newPassword,
  accept_terms: z.boolean().refine((v) => v, 'auth.errors.termsRequired'),
});

export const verifyEmailSchema = z.object({
  email,
  // Acepta el código pegado con espacios ("849 201").
  code: z
    .string()
    .transform((v) => v.replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{6}$/, 'auth.errors.otpFormat')),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ new_password: newPassword });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type VerifyEmailInput = z.input<typeof verifyEmailSchema>;
export type VerifyEmailValues = z.output<typeof verifyEmailSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
