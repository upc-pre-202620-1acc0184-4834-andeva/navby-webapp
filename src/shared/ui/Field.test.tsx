import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { Input } from './Input';

describe('Field & Input', () => {
  it('asocia label visible, hint y error mediante aria-describedby y aria-invalid', () => {
    render(
      <Field
        label="Correo electrónico"
        hint="Usa tu correo personal"
        error="Correo inválido"
        required
      >
        {(ariaProps) => <Input {...ariaProps} type="email" />}
      </Field>,
    );

    const input = screen.getByLabelText(/Correo electrónico/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();

    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('-hint');
    expect(describedBy).toContain('-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Correo inválido');
    expect(input).toHaveClass('aria-[invalid=true]:border-error-ink');
  });
});
