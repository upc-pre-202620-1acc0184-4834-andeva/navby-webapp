import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TURNSTILE_DUMMY_TOKEN, TurnstileField } from './TurnstileField';

describe('TurnstileField', () => {
  it('sin clave de sitio entrega el token de prueba y no pinta el widget', () => {
    const onToken = vi.fn();
    render(<TurnstileField onToken={onToken} />);
    expect(onToken).toHaveBeenCalledWith(TURNSTILE_DUMMY_TOKEN);
    expect(screen.getByTestId('turnstile-widget')).not.toBeVisible();
  });
});
