import { describe, expect, it } from 'vitest';
import { registerSchema, resetPasswordSchema, verifyEmailSchema } from './authSchemas';

const base = {
  full_name: 'Ana Torres',
  email: '  Ana@Mail.com ',
  password: 'Viajar2026',
  accept_terms: true,
};

describe('authSchemas', () => {
  it('normaliza el correo y acepta una contraseña de 8–72 con letra y número', () => {
    const parsed = registerSchema.parse(base);
    expect(parsed.email).toBe('ana@mail.com');
  });

  it('rechaza contraseñas sin número, cortas o largas (RN de PlainPassword)', () => {
    for (const password of ['soloLetras', 'abc12', `a1${'x'.repeat(71)}`]) {
      expect(registerSchema.safeParse({ ...base, password }).success).toBe(false);
    }
    expect(resetPasswordSchema.safeParse({ new_password: 'Ñandú2026' }).success).toBe(true);
  });

  it('exige aceptar términos (RL-01)', () => {
    const result = registerSchema.safeParse({ ...base, accept_terms: false });
    expect(result.error?.issues[0]?.message).toBe('auth.errors.termsRequired');
  });

  it('acepta el OTP pegado con espacios y rechaza menos de 6 dígitos', () => {
    expect(verifyEmailSchema.parse({ email: 'a@b.co', code: '849 201' }).code).toBe('849201');
    expect(verifyEmailSchema.safeParse({ email: 'a@b.co', code: '12345' }).success).toBe(false);
  });
});
